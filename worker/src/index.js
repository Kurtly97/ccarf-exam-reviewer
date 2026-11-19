const MODEL = "claude-sonnet-4-5";
const ANTHROPIC_VERSION = "2023-06-01";

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

function normalizeName(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function buildPrompt({ prompt, options, correctAnswers, rationale, userQuestion }) {
  const optionsText = (options || [])
    .map((o) => `${o.key}. ${o.text}${correctAnswers?.includes(o.key) ? "  [correct]" : ""}`)
    .join("\n");

  return [
    "You are a study assistant helping a student prepare for the Claude Certified Architect Foundations (CCAR-F) exam.",
    "Below is a practice question, its options, the correct answer(s), and the official rationale.",
    "Answer the student's follow-up question about this item clearly and concisely, grounded only in the material shown.",
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

    const { name, prompt, options, correctAnswers, rationale, userQuestion } = body;

    if (!name || !userQuestion || !prompt) {
      return json({ error: "Missing required fields: name, prompt, userQuestion" }, 400, origin);
    }

    // --- Allowlist check ---
    const allowed = (env.ALLOWED_NAMES || "")
      .split(",")
      .map(normalizeName)
      .filter(Boolean);
    if (!allowed.includes(normalizeName(name))) {
      return json({ error: "Name not recognized. Ask the admin to add you to the list." }, 403, origin);
    }

    // --- Rate limit check (per person, per day) ---
    const dailyLimit = Number(env.DAILY_LIMIT || 30);
    const countKey = `count:${normalizeName(name)}:${todayKey()}`;
    const currentCountRaw = await env.RATE_LIMIT_KV.get(countKey);
    const currentCount = currentCountRaw ? Number(currentCountRaw) : 0;

    if (currentCount >= dailyLimit) {
      return json(
        { error: `Daily limit reached (${dailyLimit} asks/day). Try again tomorrow.`, remaining: 0 },
        429,
        origin
      );
    }

    // --- Call Claude ---
    let answer;
    try {
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 500,
          messages: [
            { role: "user", content: buildPrompt({ prompt, options, correctAnswers, rationale, userQuestion }) },
          ],
        }),
      });

      if (!anthropicRes.ok) {
        const errText = await anthropicRes.text();
        return json({ error: `Claude API error: ${errText}` }, 502, origin);
      }

      const data = await anthropicRes.json();
      answer = data.content?.[0]?.text || "(no response)";
    } catch (err) {
      return json({ error: `Request to Claude failed: ${err.message}` }, 502, origin);
    }

    // --- Increment usage counter (expires after 2 days so KV self-cleans) ---
    const newCount = currentCount + 1;
    await env.RATE_LIMIT_KV.put(countKey, String(newCount), { expirationTtl: 60 * 60 * 48 });

    return json({ answer, remaining: dailyLimit - newCount }, 200, origin);
  },
};
