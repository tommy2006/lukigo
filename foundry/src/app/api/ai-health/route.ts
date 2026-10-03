import { NextResponse } from "next/server";
import { callModel, currentModel } from "@/lib/ai/llm";

// Diagnostic: is the LLM configured and reachable? Never returns the key.
export async function GET() {
  const base = process.env.AI_BASE_URL || "";
  const info = {
    base_url_set: !!base,
    base_host: base ? (() => { try { return new URL(base).host; } catch { return "INVALID URL"; } })() : null,
    base_path: base ? (() => { try { return new URL(base).pathname; } catch { return null; } })() : null,
    key_set: !!process.env.AI_API_KEY,
    key_length: process.env.AI_API_KEY?.length ?? 0,
    key_has_whitespace: /\s/.test(process.env.AI_API_KEY || ""),
    model: process.env.AI_MODEL || "(default)", // raw value; llm.ts normalizes for api.mistral.ai
  };
  if (!base) return NextResponse.json({ ...info, ok: false, error: "AI_BASE_URL is not set in this deployment" });
  const probes: Record<string, string> = {};
  for (const m of ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"]) {
    try { probes[m] = "OK: " + (await callModel(m, "Reply with one word: pong", "ping", { maxTokens: 5 })).slice(0, 20); }
    catch (e) { probes[m] = String((e as Error).message).replace(/\{[\s\S]*"message":"([^"]*)"[\s\S]*/, "$1").slice(0, 120); }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return NextResponse.json({ ...info, model_in_use: currentModel(), probes });
}
