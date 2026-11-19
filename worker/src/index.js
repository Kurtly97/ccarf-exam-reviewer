const MODEL = "claude-sonnet-4-5";
const ANTHROPIC_VERSION = "2023-06-01";
const REMAINING_MARKER = "\n<<<ASK_REMAINING:";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

function normalizeKey(str) {
  return String(str || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function buildPrompt({ prompt, options, correctAnswers, rationale, userQuestion }) {
  const optionsText = (options || [])
    .map((o) => `${o.key}. ${o.text}${correctAnswers?.includes(o.key) ? "  [correct]" : ""}`)
    .join("\n");

  return [
    "You are a study assistant helping a student prepare for the Claude Certified Architect Foundations (CCAR-F) exam.",
    "Below is a practice question, its options, the correct answer(s), and the official rationale.",
    "Answer the student's follow-up question about this item clearly and concisely, grounded only in the material shown.",
    "Format your answer in Markdown (short paragraphs, **bold** for key terms, `code` for identifiers, bullet lists where helpful).",
    "",
    "QUESTION:",
    prompt,
    "",
    "OPTIONS:",
    optionsText,
    "",
    "OFFICIAL RATIONALE:",
    rationale,
    "",
    "STUDENT'S FOLLOW-UP QUESTION:",
    userQuestion,
  ].join("\n");
}

// Parses an Anthropic SSE stream and re-emits just the text deltas as plain chunks.
function textDeltaStream(upstreamBody) {
  const reader = upstreamBody.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop(); // keep the last (possibly incomplete) event in the buffer

      for (const evt of events) {
        const dataLine = evt.split("\n").find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        try {
          const payload = JSON.parse(dataLine.slice(5).trim());
          if (payload.type === "content_block_delta" && payload.delta?.type === "text_delta") {
            controller.enqueue(encoder.encode(payload.delta.text));
          }
        } catch {
          // ignore malformed/partial event
        }
      }
    },
  });
}

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "*";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, origin);
    }

    const { passphrase, name, prompt, options, correctAnswers, rationale, userQuestion } = body;

    if (!passphrase || !name || !userQuestion || !prompt) {
      return json({ error: "Missing required fields: passphrase, name, userQuestion" }, 400, origin);
    }

    // --- Passphrase gate (shared secret, not a per-person allowlist) ---
    if (normalizeKey(passphrase) !== normalizeKey(env.ASK_PASSPHRASE)) {
      return json({ error: "Incorrect passphrase." }, 403, origin);
    }

    // --- Rate limit check (per name, per day — name is free text, just used to split up the shared quota) ---
    const dailyLimit = Number(env.DAILY_LIMIT || 30);
    const countKey = `count:${normalizeKey(name)}:${todayKey()}`;
    const currentCountRaw = await env.RATE_LIMIT_KV.get(countKey);
    const currentCount = currentCountRaw ? Number(currentCountRaw) : 0;

    if (currentCount >= dailyLimit) {
      return json(
        { error: `Daily limit reached (${dailyLimit} asks/day). Try again tomorrow.`, remaining: 0 },
        429,
        origin
      );
    }

    // --- Call Claude, streaming the response straight through to the client ---
    let anthropicRes;
    try {
      anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 500,
          stream: true,
          messages: [
            { role: "user", content: buildPrompt({ prompt, options, correctAnswers, rationale, userQuestion }) },
          ],
        }),
      });
    } catch (err) {
      return json({ error: `Request to Claude failed: ${err.message}` }, 502, origin);
    }

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return json({ error: `Claude API error: ${errText}` }, 502, origin);
    }

    // Reserve the quota slot now so concurrent asks from the same name can't race past the limit.
    const newCount = currentCount + 1;
    await env.RATE_LIMIT_KV.put(countKey, String(newCount), { expirationTtl: 60 * 60 * 48 });
    const remaining = dailyLimit - newCount;

    const upstream = textDeltaStream(anthropicRes.body);
    const encoder = new TextEncoder();

    const combined = new ReadableStream({
      async start(controller) {
        const reader = upstream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.enqueue(encoder.encode(`${REMAINING_MARKER}${remaining}>>>`));
        controller.close();
      },
    });

    return new Response(combined, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders(origin) },
    });
  },
};
