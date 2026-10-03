// Server-only. OpenAI-compatible chat client — points at Mistral Large 3 served by vLLM on Verda
// (or any OpenAI-compatible endpoint, e.g. https://api.mistral.ai/v1).

const BASE = process.env.AI_BASE_URL;        // e.g. http://<verda-ip>:8000/v1
const KEY = process.env.AI_API_KEY || "none";
const RAW_MODEL = (process.env.AI_MODEL || "mistralai/Mistral-Large-3-675B-Instruct-2512-NVFP4").trim();
// Mistral's hosted API uses hyphenated ids (mistral-large-latest); tolerate "mistral_large_latest".
const MODEL = BASE?.includes("api.mistral.ai") ? RAW_MODEL.replace(/_/g, "-") : RAW_MODEL;

export const aiConfigured = () => !!BASE;

export async function chat(system: string, user: string, opts: { json?: boolean; maxTokens?: number } = {}): Promise<string> {
  if (!BASE) throw new Error("AI_BASE_URL not set");
  const res = await fetch(`${BASE.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
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
