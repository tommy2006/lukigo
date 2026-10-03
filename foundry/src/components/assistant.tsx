"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Send, Sparkles, X, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MODULE_MAP } from "@/lib/modules";
import { roleLabel, visibleModules } from "@/lib/roles";
import type { EventRow, Task } from "@/lib/types";
import { useProject } from "./project-context";
import { cx, todayISO } from "./ui";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What should I focus on this week?",
  "How do I keep volunteers coming back?",
  "Tips for our first event?",
  "How do I ask a local business to sponsor us?",
  "What safety steps do we need for minors?",
];

/** Floating "Ask Lukigo" chat for any project member. */
export function Assistant() {
  const { project, stack, me, members } = useProject();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => { scroller.current?.scrollTo({ top: 1e9, behavior: "smooth" }); }, [msgs, busy]);

  async function context() {
    const sb = supabase();
    const [t, e] = await Promise.all([
      me ? sb.from("tasks").select("*").eq("assignee_member_id", me.id).neq("status", "done").order("due_date").limit(8) : Promise.resolve({ data: [] }),
      sb.from("events").select("*").eq("project_id", project.id).gte("starts_at", new Date().toISOString()).order("starts_at").limit(4),
    ]);
    const events = (e.data as EventRow[]) || [];
    return {
      project: project.name, tagline: project.tagline, cause: project.cause, location: project.location,
      role: me ? roleLabel(me) : "member", modules: visibleModules(stack, me).map((s) => MODULE_MAP[s.id]?.name).filter(Boolean),
      members: members.filter((m) => m.status === "active").length, today: todayISO(), page: path.split("/").pop(),
      my_open_tasks: ((t.data as Task[]) || []).map((x) => ({ title: x.title, due: x.due_date, event: events.find((ev) => ev.id === x.event_id)?.name ?? null })),
      upcoming_events: events.map((ev) => ({ name: ev.name, date: ev.starts_at?.slice(0, 10) })),
    };
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next, context: await context() }) });
      const d = await res.json();
      setOffline(d._source === "fallback");
      setMsgs([...next, { role: "assistant", content: d.reply || "Sorry, I couldn't answer that." }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "Connection problem — try again in a moment." }]);
    } finally { setBusy(false); }
  }

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
            onClick={() => setOpen(true)} title="Ask Lukigo"
            className="fixed bottom-5 right-5 z-40 h-12 pl-4 pr-5 rounded-full inline-flex items-center gap-2 font-semibold text-[#140d33] bg-gradient-to-r from-[#9ad8ff] to-violet shadow-[0_10px_30px_-8px_rgba(185,166,255,0.8)] hover:brightness-105">
            <MessageCircle className="size-5" /> Ask Lukigo
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}
            className="fixed z-50 bottom-5 right-5 w-[min(400px,calc(100vw-2rem))] h-[min(600px,calc(100vh-2.5rem))] rounded-2xl border border-line-2 bg-[#14111d] shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
              <div className="size-8 rounded-full bg-gradient-to-br from-[#9ad8ff] to-violet grid place-items-center"><Sparkles className="size-4 text-[#140d33]" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">Ask Lukigo</div>
                <div className="text-[11px] text-ink-3 truncate">Help with {project.name}{project.location ? ` · ${project.location}` : ""}{offline ? " · offline mode" : ""}</div>
              </div>
              {msgs.length > 0 && <button onClick={() => setMsgs([])} title="New chat" className="text-ink-3 hover:text-ink"><RotateCcw className="size-4" /></button>}
              <button onClick={() => setOpen(false)} className="text-ink-3 hover:text-ink"><X className="size-5" /></button>
            </div>

            <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {msgs.length === 0 && (
                <div>
                  <div className="text-sm text-ink-2">Hi{me ? ` ${me.full_name.split(" ")[0]}` : ""}! Ask me about your tasks, how to use Lukigo, or best practices for volunteering and running your project.</div>
                  <div className="mt-4 flex flex-col gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => send(s)} className="text-left text-sm rounded-xl border border-line px-3 py-2 text-ink-2 hover:border-violet/50 hover:text-ink">{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cx("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed",
                    m.role === "user" ? "bg-accent/20 rounded-br-sm text-ink" : "bg-panel-2 rounded-bl-sm text-ink")}>{m.role === "assistant" ? <Rich text={m.content} /> : m.content}</div>
                </div>
              ))}
              {busy && <div className="flex gap-1 px-2">{[0, 1, 2].map((i) => <span key={i} className="size-2 rounded-full bg-violet/70 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="p-3 border-t border-line flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything…" autoFocus
                className="flex-1 rounded-xl bg-white/[0.04] border border-line px-3.5 py-2.5 text-sm outline-none focus:border-violet/60" />
              <button disabled={!input.trim() || busy} className="size-10 rounded-xl grid place-items-center bg-gradient-to-r from-[#9ad8ff] to-violet text-[#140d33] disabled:opacity-40"><Send className="size-4" /></button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Minimal formatter: **bold**, strips heading hashes. */
function Rich({ text }: { text: string }) {
  const clean = text.replace(/^#{1,6}\s*/gm, "");
  return <>{clean.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>)}</>;
}
