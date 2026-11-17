Build a complete, interactive React + Tailwind CSS web application for an exam preparation and reviewer tool based on the attached PDF (`1784098676248.pdf` — *Claude Certified Architect Foundations (CCAR-F) Practice Exam Question Set* by Matthew Purcell).

### 1. Data Extraction & Schema
Parse all 60 questions, 6 scenarios, 5 blueprint domains, answer keys, and rationales from the attached PDF into a strongly typed data module (`src/data/questions.ts`). Do not truncate or summarize the questions or rationales.

Use this exact schema:
- **Scenarios (6 total):**
  1. Customer Support Resolution Agent (Questions 1.1–1.10)[cite: 3, 4, 5]
  2. Code Generation with Claude Code (Questions 2.1–2.10)[cite: 6, 7, 8]
  3. Multi-Agent Research System (Questions 3.1–3.10)[cite: 9, 10, 11]
  4. Developer Productivity with Claude (Questions 4.1–4.10)[cite: 12, 13, 14]
  5. Claude Code for Continuous Integration (Questions 5.1–5.10)[cite: 15, 16, 17]
  6. Structured Data Extraction (Questions 6.1–6.10)[cite: 18, 19, 20]
- **Blueprint Domains (5 total, with official exam weights):**
  1. Agentic Architecture & Orchestration (27% — 16 questions)
  2. Tool Design & MCP Integration (18% — 11 questions)
  3. Claude Code Configuration & Workflows (20% — 12 questions)
  4. Prompt Engineering & Structured Output (20% — 12 questions)
  5. Context Management & Reliability (15% — 9 questions)
- **Question Object Shape:**
  ```ts
  interface Question {
    id: string; // e.g., "1.1"
    scenarioId: number; // 1 to 6
    domainId: number; // 1 to 5
    type: 'single' | 'multi'; // 'multi' for "Select TWO" items
    requiredSelections: number; // 1 or 2
    prompt: string;
    options: { key: 'A' | 'B' | 'C' | 'D' | 'E'; text: string }[];
    correctAnswers: ('A' | 'B' | 'C' | 'D' | 'E')[];
    rationale: string; // Full explanation including why distractors fall short
    topicTag: string; // Concise 2-4 word concept label for weak-topic diagnostics (e.g., "stop_reason Control Flow", "MCP Error Metadata")
  }