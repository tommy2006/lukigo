"use client";

/** Call an AI task from the browser. Result includes `_source: "ai" | "fallback"`. */
export async function askAI<T = any>(task: string, input: unknown): Promise<T & { _source: "ai" | "fallback" }> {
  const res = await fetch(`/api/ai/${task}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`AI task ${task} failed`);
  return res.json();
}
