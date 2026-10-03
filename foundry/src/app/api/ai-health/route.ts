import { NextResponse } from "next/server";
import { aiConfigured, currentModel } from "@/lib/ai/llm";

// Lightweight status (no LLM calls, no secrets).
export async function GET() {
  const base = process.env.AI_BASE_URL || "";
  let host: string | null = null;
  try { host = base ? new URL(base).host : null; } catch { host = "invalid"; }
  return NextResponse.json({ configured: aiConfigured(), provider_host: host, model_in_use: currentModel() });
}
