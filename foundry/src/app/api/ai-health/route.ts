import { NextResponse } from "next/server";
import { chat } from "@/lib/ai/llm";

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
    model: process.env.AI_MODEL || "(default)",
  };
  if (!base) return NextResponse.json({ ...info, ok: false, error: "AI_BASE_URL is not set in this deployment" });
  try {
    const out = await chat("Reply with the single word: pong", "ping", { maxTokens: 5 });
    return NextResponse.json({ ...info, ok: true, reply: out.slice(0, 40) });
  } catch (e) {
    return NextResponse.json({ ...info, ok: false, error: String((e as Error).message).slice(0, 300) });
  }
}
