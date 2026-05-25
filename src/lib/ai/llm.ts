// LLM provider seam — tries Anthropic Claude via REST when ANTHROPIC_API_KEY is
// set, otherwise returns null so callers can fall back to a deterministic path.
// No SDK dependency: a single fetch call keeps the surface tiny and the build
// lean. Failure modes (timeout, bad JSON, non-2xx) all collapse to "null", so
// the caller never has to handle provider-specific errors.

export type LlmRole = "user" | "assistant";
export type LlmMessage = { role: LlmRole; content: string };

export type LlmCallOptions = {
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  // Tag for logs/metrics — purely descriptive (e.g. "coach-note-structurer").
  purpose?: string;
};

export type LlmResult = {
  text: string;
  model: string;
  provider: "anthropic";
};

// Pick a sensible default that exists in production. Callers can override.
const DEFAULT_MODEL = process.env.LEAF_LLM_MODEL ?? "claude-sonnet-4-5";

export function llmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function callLlm(messages: LlmMessage[], opts: LlmCallOptions = {}): Promise<LlmResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const model = opts.model ?? DEFAULT_MODEL;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 1500,
        temperature: opts.temperature ?? 0.3,
        ...(opts.system ? { system: opts.system } : {}),
        messages,
      }),
      // Bound the call so a slow provider can't hold up a request indefinitely.
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn(`[llm] ${opts.purpose ?? "call"} failed: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { content?: { type: string; text: string }[] };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "";
    if (!text) return null;
    return { text, model, provider: "anthropic" };
  } catch (err) {
    console.warn(`[llm] ${opts.purpose ?? "call"} threw`, err);
    return null;
  }
}

// Extract the first JSON object from a model response. The LLM might wrap
// JSON in prose or fence it in markdown; we accept both.
export function extractJson<T = unknown>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)```/);
  const candidate = fenced ? fenced[1] : text;
  // Find the first balanced { … }. Cheap heuristic — good enough for our prompts.
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = candidate.slice(start, end + 1);
  try {
    return JSON.parse(slice) as T;
  } catch {
    return null;
  }
}
