"use client";

/** Project-wide context sent with every AI call (set by ProjectProvider / onboarding). */
export interface AIContext { project?: string | null; location?: string | null; cause?: string | null }
let aiCtx: AIContext | null = null;
export function setAIContext(c: AIContext | null) { aiCtx = c; }

/** Call an AI task from the browser. Result includes `_source: "ai" | "fallback"`. */
export async function askAI<T = any>(task: string, input: unknown, ctx?: AIContext): Promise<T & { _source: "ai" | "fallback" }> {
  const c = ctx ?? aiCtx;
  const body = input && typeof input === "object" && !Array.isArray(input) && c ? { ...(input as object), _ctx: c } : input;
  const res = await fetch(`/api/ai/${task}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AI task ${task} failed`);
  return res.json();
}
