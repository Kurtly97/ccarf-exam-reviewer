/**
 * CCAR-F Quick Reference Flashcards
 * Source: "Claude Certified Architect Foundations (CCAR-F): Quick Reference"
 * by Matthew Purcell (linkedin.com/in/purcellmatthew/) — the pure-convention facts
 * (file locations, flag names, stop_reason values) that can't be derived by reasoning.
 *
 * Schema:
 * interface FlashcardSeed {
 *   id: string;       // e.g. "qr-stop-reason-1"
 *   category: string; // matches a PDF section header, used for filtering
 *   front: string;    // term / question
 *   back: string;     // explanation
 * }
 */

const FLASHCARDS = [
  // ───────────────────────────── Claude API: stop_reason ─────────────────────────────
  {
    id: "qr-stop-1",
    category: "stop_reason",
    front: "What does stop_reason: \"end_turn\" mean, and what should the agent loop do?",
    back: "Claude has finished generating — surface the reply to the user. This is the signal (along with tool_use) that drives whether an agent loop keeps running or stops.",
  },
  {
    id: "qr-stop-2",
    category: "stop_reason",
    front: "What does stop_reason: \"tool_use\" mean, and what should the agent loop do?",
    back: "Claude wants a tool run. Execute the requested tool(s) and feed the result back into the conversation for the next turn. This is what drives the loop to continue.",
  },
  {
    id: "qr-stop-3",
    category: "stop_reason",
    front: "What does stop_reason: \"max_tokens\" indicate?",
    back: "The output token cap was hit mid-generation — the reply is truncated. Consider raising max_tokens if this happens unexpectedly.",
  },
  {
    id: "qr-stop-4",
    category: "stop_reason",
    front: "What does stop_reason: \"stop_sequence\" indicate?",
    back: "A configured stop string was encountered in the output, halting generation at that point.",
  },

  // ───────────────────────────── Tools: tool_choice ─────────────────────────────
  {
    id: "qr-toolchoice-1",
    category: "tool_choice",
    front: "What does tool_choice: \"auto\" do?",
    back: "Leaves the decision to the model — it can answer in plain text or invoke a tool. This is the usual default.",
  },
  {
    id: "qr-toolchoice-2",
    category: "tool_choice",
    front: "What does tool_choice: \"any\" do, and when is it useful?",
    back: "Forces the model to use some tool (not necessarily a specific one). Handy when you need guaranteed structured output via a tool call.",
  },
  {
    id: "qr-toolchoice-3",
    category: "tool_choice",
    front: "What does tool_choice: {\"type\": \"tool\", \"name\": ...} do?",
    back: "Pins the first call to one named tool, forcing an execution order — e.g. forcing \"extract\" to run before \"enrich\".",
  },
  {
    id: "qr-toolchoice-4",
    category: "tool_choice",
    front: "What must a coordinator agent's tool list include before it can spawn sub-agents?",
    back: "The Task tool. Without it in the tool list, the coordinator has no mechanism to delegate to sub-agents.",
  },

  // ───────────────────────────── JSON schemas for structured output ─────────────────────────────
  {
    id: "qr-schema-1",
    category: "JSON Schemas",
    front: "A tool call with a JSON schema guarantees well-formed, structurally-valid JSON with required fields present. What does it NOT guarantee?",
    back: "It doesn't fact-check values — the shape is enforced, but the content can still be wrong (hallucinated or inaccurate).",
  },
  {
    id: "qr-schema-2",
    category: "JSON Schemas",
    front: "When should a schema field be marked \"required\"?",
    back: "Only when it is genuinely always present. Marking a sometimes-absent field as required invites the model to invent a value to fill the gap.",
  },
  {
    id: "qr-schema-3",
    category: "JSON Schemas",
    front: "How do you let a schema field be legitimately missing instead of hallucinated?",
    back: "Allow nulls: \"type\": [\"string\", \"null\"] lets the model return null for missing data rather than making something up.",
  },
  {
    id: "qr-schema-4",
    category: "JSON Schemas",
    front: "What is an \"open enum\" in schema design, and why use one?",
    back: "Pairing your fixed categories with an \"other\" option plus a free-text detail field, so a value outside the known list isn't silently dropped or forced into the wrong bucket.",
  },
  {
    id: "qr-schema-5",
    category: "JSON Schemas",
    front: "Why add an \"unclear\" enum value to a classification schema?",
    back: "It gives the model an honest escape hatch when it can't confidently classify — a known \"unclear\" is better than a confident but wrong label.",
  },

  // ───────────────────────────── MCP — configuration and errors ─────────────────────────────
  {
    id: "qr-mcp-1",
    category: "MCP Config & Errors",
    front: "Where does shared/team MCP server config live, and is it committed to version control?",
    back: ".mcp.json at the project root — committed, so the whole team gets the same servers.",
  },
  {
    id: "qr-mcp-2",
    category: "MCP Config & Errors",
    front: "Where does personal or throwaway MCP server config live, and is it committed?",
    back: "~/.claude.json in your home directory — kept out of version control, personal to you.",
  },
  {
    id: "qr-mcp-3",
    category: "MCP Config & Errors",
    front: "How does a failed MCP tool call signal an error, and what makes that error actually useful to an agent?",
    back: "It returns isError: true. Pair it with a structured error object (category, retryable flag, message) — a bare \"operation failed\" string gives the agent nothing to act on (can't decide retry vs. rephrase vs. escalate).",
  },

  // ───────────────────────────── Claude Code — CLAUDE.md hierarchy ─────────────────────────────
  {
    id: "qr-claudemd-1",
    category: "CLAUDE.md Hierarchy",
    front: "What is the User-level CLAUDE.md, where does it live, and is it committed?",
    back: "~/.claude/CLAUDE.md — applies to you alone, never committed. Personal style and preferences.",
  },
  {
    id: "qr-claudemd-2",
    category: "CLAUDE.md Hierarchy",
    front: "What is the Project-level CLAUDE.md, where does it live, and is it committed?",
    back: ".claude/CLAUDE.md or a root CLAUDE.md — applies to everyone on the repo, committed. Coding/testing standards, architectural decisions.",
  },
  {
    id: "qr-claudemd-3",
    category: "CLAUDE.md Hierarchy",
    front: "What is a Directory-level CLAUDE.md and when does it apply?",
    back: "A CLAUDE.md placed inside a subfolder — applies only while editing files in that part of the tree. Holds conventions local to that folder.",
  },
  {
    id: "qr-claudemd-4",
    category: "CLAUDE.md Hierarchy",
    front: "What's the classic CLAUDE.md mistake regarding instruction scope?",
    back: "Putting project-wide instructions in the user-level file — new teammates never receive them, since the user-level file is personal and uncommitted.",
  },

  // ───────────────────────────── @path imports ─────────────────────────────
  {
    id: "qr-import-1",
    category: "@path Imports",
    front: "What path styles can a CLAUDE.md @path import use?",
    back: "Both relative and absolute paths are supported.",
  },
  {
    id: "qr-import-2",
    category: "@path Imports",
    front: "How deep can @path imports nest in CLAUDE.md?",
    back: "Up to 5 levels deep.",
  },

  // ───────────────────────────── The .claude/rules/ directory ─────────────────────────────
  {
    id: "qr-rules-1",
    category: ".claude/rules/",
    front: "What is the .claude/rules/ directory, and what's the key lever that makes it efficient?",
    back: "A topic-by-topic alternative to one monolithic CLAUDE.md, using individual .md files. The key lever is YAML frontmatter with a `paths` glob — a rule loads only when Claude edits a matching file, saving context/tokens.",
  },
  {
    id: "qr-rules-2",
    category: ".claude/rules/",
    front: "When should you use a .claude/rules/ paths-glob rule vs. a directory-level CLAUDE.md?",
    back: "Use a paths rule when a convention spans files scattered across the tree (e.g. tests, migrations). Use a directory-level CLAUDE.md when the convention is tied to one specific folder.",
  },

  // ───────────────────────────── Slash commands ─────────────────────────────
  {
    id: "qr-slash-1",
    category: "Slash Commands",
    front: "What is the legacy location for committed slash commands, and what replaced it?",
    back: "Legacy: .claude/commands/. Current location: .claude/skills/.",
  },
  {
    id: "qr-slash-2",
    category: "Slash Commands",
    front: "Where do personal, uncommitted slash-command variants live?",
    back: "Under ~/.claude/... — for individual workflows, not shared with the team.",
  },

  // ───────────────────────────── Skills ─────────────────────────────
  {
    id: "qr-skills-1",
    category: "Skills",
    front: "How do Skills differ from always-on CLAUDE.md standards in intended use?",
    back: "Skills (defined by SKILL.md frontmatter) are for on-demand, task-specific work. CLAUDE.md is for always-on standards that should apply to everything.",
  },
  {
    id: "qr-skills-2",
    category: "Skills",
    front: "What does a skill's `context: fork` frontmatter field do?",
    back: "Runs the skill in an isolated sub-agent so its noisy output stays out of the main session's context.",
  },
  {
    id: "qr-skills-3",
    category: "Skills",
    front: "What does a skill's `allowed-tools` frontmatter field do?",
    back: "Whitelists the tools the skill may use — a safety boundary, e.g. restricting a skill so it can't perform deletes.",
  },
  {
    id: "qr-skills-4",
    category: "Skills",
    front: "What does a skill's `argument-hint` frontmatter field do?",
    back: "Prompts the user for an argument when the skill is invoked without one (invoked bare).",
  },

  // ───────────────────────────── Planning mode vs direct execution ─────────────────────────────
  {
    id: "qr-plan-1",
    category: "Planning Mode",
    front: "What does planning mode produce, and when is it the right call?",
    back: "Investigation and a proposed plan only — no edits — which you then approve. Best for large/multi-file changes, weighing several approaches, or architectural decisions.",
  },
  {
    id: "qr-plan-2",
    category: "Planning Mode",
    front: "When is direct execution (skipping planning mode) the right call?",
    back: "For single-file fixes and changes you already understand well — just make the change.",
  },
  {
    id: "qr-plan-3",
    category: "Planning Mode",
    front: "What is the Explore sub-agent for?",
    back: "A dedicated explorer that does verbose digging and returns only a summary, keeping that noise out of the main context — so long multi-phase tasks don't exhaust the context window.",
  },

  // ───────────────────────────── /compact and /memory ─────────────────────────────
  {
    id: "qr-compact-1",
    category: "/compact and /memory",
    front: "What does /compact do, and what's the tradeoff?",
    back: "Compresses the running context by summarizing history — useful when verbose tool output fills the window, but summarizing can drop precise details like exact numbers and dates.",
  },
  {
    id: "qr-compact-2",
    category: "/compact and /memory",
    front: "What does /memory do?",
    back: "Opens CLAUDE.md to edit notes, preferences, and context that persist between sessions and load automatically at startup — so you aren't re-explaining the same things each session.",
  },

  // ───────────────────────────── CLI for CI/CD ─────────────────────────────
  {
    id: "qr-cli-1",
    category: "CLI for CI/CD",
    front: "What does `claude -p` (--print) do, and why is it the only option for pipelines?",
    back: "Runs non-interactively: prompt in, result to stdout, then exit. It's the only way to drive Claude in a pipeline like CI/CD, since there's no interactive session.",
  },
  {
    id: "qr-cli-2",
    category: "CLI for CI/CD",
    front: "What do --output-format json and --json-schema do?",
    back: "--output-format json emits JSON output; --json-schema validates that output against a given schema.",
  },
  {
    id: "qr-cli-3",
    category: "CLI for CI/CD",
    front: "Why should code review be done with a fresh Claude instance rather than the same session that wrote the code?",
    back: "The session that wrote the code is anchored to its own reasoning, making it a weaker reviewer. Spin up an independent instance for review.",
  },
  {
    id: "qr-cli-4",
    category: "CLI for CI/CD",
    front: "How do you avoid repeat comments when Claude re-reviews the same PR after fixes?",
    back: "Feed in the prior review and instruct Claude to flag only new or still-open issues.",
  },

  // ───────────────────────────── Sessions — resume and fork ─────────────────────────────
  {
    id: "qr-session-1",
    category: "Sessions: Resume & Fork",
    front: "What does `claude -r` / `--resume <name>` do, and what should you watch for?",
    back: "Picks a named session back up. Watch for stale tool results if files have moved on since the session was last active.",
  },
  {
    id: "qr-session-2",
    category: "Sessions: Resume & Fork",
    front: "What does fork_session do, and when is it useful?",
    back: "Branches the current context into independent lines that share everything up to the split point, then diverge. Good for trialling two different approaches side by side.",
  },

  // ───────────────────────────── Message Batches API ─────────────────────────────
  {
    id: "qr-batch-1",
    category: "Message Batches API",
    front: "What are the key constraints of the Message Batches API?",
    back: "Asynchronous bulk requests with up to a 24-hour turnaround, and no multi-turn tool calling.",
  },
  {
    id: "qr-batch-2",
    category: "Message Batches API",
    front: "What is custom_id for in the Message Batches API, and why does it matter?",
    back: "It ties each result back to its source request, so when only a few items fail you can resubmit just those by id rather than re-running the whole batch.",
  },

  // ───────────────────────────── Production context management ─────────────────────────────
  {
    id: "qr-prod-1",
    category: "Production Context Mgmt",
    front: "Why shouldn't production systems lean on raw conversation history for must-keep facts?",
    back: "Raw history frays under summarization. Pull must-keep facts into a structured block and re-include that block in every prompt instead.",
  },
  {
    id: "qr-prod-2",
    category: "Production Context Mgmt",
    front: "What is the \"lost-in-the-middle\" effect, and how do you mitigate it?",
    back: "Models attend less reliably to content buried in the middle of a long prompt. Mitigate by placing the critical bits at the very top or bottom of the message.",
  },
  {
    id: "qr-prod-3",
    category: "Production Context Mgmt",
    front: "What's the scratchpad.md pattern for long investigations?",
    back: "Have the agent write findings to a scratchpad.md as it goes. When context degrades or a new session starts, it reads the scratchpad instead of rediscovering everything from scratch.",
  },
];
