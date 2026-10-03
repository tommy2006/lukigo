import { NextResponse } from "next/server";
import { chatJSON, aiConfigured } from "@/lib/ai/llm";
import { coreTasks } from "@/lib/ai/tasks/core";
import { moduleTasks } from "@/lib/ai/tasks/modules";
import { localeInstructions } from "@/lib/ai/locale";

const TASKS = { ...coreTasks, ...moduleTasks };

export async function POST(req: Request, ctx: { params: Promise<{ task: string }> }) {
  const { task } = await ctx.params;
  const def = TASKS[task];
  if (!def) return NextResponse.json({ error: `unknown task ${task}` }, { status: 404 });
  const input = await req.json().catch(() => ({}));
  if (aiConfigured()) {
    try {
      const out = await chatJSON(def.system + localeInstructions(input?._ctx), def.prompt(input), def.maxTokens);
      return NextResponse.json({ ...(out as object), _source: "ai" });
    } catch (e) {
      console.error(`[ai:${task}]`, e);
    }
  }
  return NextResponse.json({ ...def.fallback(input), _source: "fallback" });
}
