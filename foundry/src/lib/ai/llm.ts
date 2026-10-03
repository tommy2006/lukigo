// Server-only. OpenAI-compatible chat client: Mistral API, Groq, or a self-hosted vLLM (e.g. Mistral Large 3 on Verda).

const BASE = process.env.AI_BASE_URL;        // e.g. http://<verda-ip>:8000/v1
const KEY = process.env.AI_API_KEY || "none";
const RAW_MODEL = (process.env.AI_MODEL || "mistralai/Mistral-Large-3-675B-Instruct-2512-NVFP4").trim();
// Mistral's hosted API uses hyphenated ids (mistral-large-latest); tolerate "mistral_large_latest".
const MODEL = BASE?.includes("api.mistral.ai") ? RAW_MODEL.replace(/_/g, "-") : RAW_MODEL;

// If the plan doesn't include MODEL (Mistral 403 tier_not_allowed), fall back to these, in order.
const DEFAULT_FALLBACKS = BASE?.includes("api.mistral.ai") ? "mistral-medium-latest,mistral-small-latest"
  : BASE?.includes("api.groq.com") ? "llama-3.3-70b-versatile,llama-3.1-8b-instant" : "";
const FALLBACK_MODELS = (process.env.AI_FALLBACK_MODELS || DEFAULT_FALLBACKS).split(",").map((m) => m.trim()).filter(Boolean);
let activeModel = MODEL;
export const currentModel = () => activeModel;

export const aiConfigured = () => !!BASE;

export async function chat(system: string, user: string, opts: { json?: boolean; maxTokens?: number } = {}): Promise<string> {
  if (!BASE) throw new Error("AI_BASE_URL not set");
  const tried = new Set<string>();
  let rateRetries = 0;
  for (;;) {
    tried.add(activeModel);
    try {
      return await callModel(activeModel, system, user, opts);
    } catch (e) {
      const msg = String((e as Error).message);
      if (/LLM 429/.test(msg) && rateRetries < 2) { rateRetries++; await new Promise((r) => setTimeout(r, 1200 * rateRetries)); continue; }
      const next = FALLBACK_MODELS.find((m) => !tried.has(m));
      if (/tier_not_allowed|invalid_model|not available/i.test(msg) && next) { activeModel = next; continue; }
      throw e;
    }
  }
}

export const modelChain = () => [MODEL, ...FALLBACK_MODELS.filter((m) => m !== MODEL)];

export async function callModel(model: string, system: string, user: string, opts: { json?: boolean; maxTokens?: number }): Promise<string> {
  const res = await fetch(`${BASE!.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: opts.maxTokens ?? 1200,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/** Ask for JSON; tolerant of models that wrap JSON in prose / code fences. */
export async function chatJSON<T>(system: string, user: string, maxTokens?: number): Promise<T> {
  const raw = await chat(system + "\nRespond with a single valid JSON object only. No markdown.", user, { json: true, maxTokens });
  const m = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : raw) as T;
}
