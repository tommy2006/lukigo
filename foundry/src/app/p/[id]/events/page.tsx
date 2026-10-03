"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, MapPin, Plus } from "lucide-react";
import { ModuleGate } from "@/components/module-gate";
import { useProject } from "@/components/project-context";
import { hasModule, hasSub } from "@/lib/modules";
import { can } from "@/lib/roles";
import type { EventRow, Task } from "@/lib/types";
import { Avatar, Badge, Button, Card, Empty, Modal, PageHeader, Progress, Spinner, Tip, cx, fmtDate } from "@/components/ui";
import { EventForm } from "@/components/modules/event-form";
import { EVENT_STATUS, EVENT_STATUS_MAP, EVENT_TYPE_EMOJI, NoPerm, pct, tsToDate, useRows, daysUntil } from "@/components/modules/shared";

export default function EventsPage() {
  return <ModuleGate id="events"><EventsBoard /></ModuleGate>;
}

function EventsBoard() {
  const { project, stack, me, members } = useProject();
  const router = useRouter();
  const [events, , loadingE] = useRows<EventRow>("events", project.id, "starts_at", true);
  const [tasks] = useRows<Task>("tasks", project.id);
  const [open, setOpen] = useState(false);
  const showCal = hasSub(stack, "events", "calendar");
  const [view, setView] = useState<"board" | "calendar">("board");
  const [filter, setFilter] = useState<string>("all");
  const canEdit = can(me, "events", "edit");

  const byEvent = useMemo(() => {
    const m: Record<string, { total: number; done: number }> = {};
    for (const t of tasks) {
      if (!t.event_id) continue;
      m[t.event_id] ??= { total: 0, done: 0 };
      m[t.event_id].total++;
      if (t.status === "done") m[t.event_id].done++;
    }
    return m;
  }, [tasks]);

  const shown = events.filter((e) => filter === "all" || e.status === filter);
  const upcoming = shown.filter((e) => !["done", "cancelled"].includes(e.status));
  const past = shown.filter((e) => ["done", "cancelled"].includes(e.status));

  return (
    <div>
      <div className="relative z-10">
        <PageHeader emoji="🎪" title="Event" accent="Manager"
          subtitle="Every event your team runs — from first idea to done. Click an event to break it into tasks and track progress."
          actions={<>
            {showCal && (
              <div className="flex rounded-xl border border-line p-0.5">
                <button onClick={() => setView("board")} className={cx("px-3 h-9 rounded-lg text-sm flex items-center gap-1.5", view === "board" ? "bg-panel-2 text-ink" : "text-ink-3")}><LayoutGrid className="size-4" />Board</button>
                <button onClick={() => setView("calendar")} className={cx("px-3 h-9 rounded-lg text-sm flex items-center gap-1.5", view === "calendar" ? "bg-panel-2 text-ink" : "text-ink-3")}><CalendarDays className="size-4" />Calendar</button>
              </div>
            )}
            {canEdit && <Button onClick={() => setOpen(true)}><Plus className="size-4" />New event</Button>}
          </>}
        />
        {!canEdit && <div className="mb-4"><NoPerm>You can view events but your role can&apos;t create them.</NoPerm></div>}
      </div>

      {loadingE ? <div className="grid place-items-center py-20"><Spinner /></div> : events.length === 0 ? (
        <div className="space-y-4">
          <Empty emoji="🎪" title="No events yet" action={canEdit && <Button onClick={() => setOpen(true)}><Plus className="size-4" />Create your first event</Button>}>
            Events are the heart of your project — a bake sale, a tutoring session, a supply drive. Create one, then open it to plan the tasks.
          </Empty>
          <Tip title="Where to start">Pick the next thing your team is actually going to do (even a first team meeting counts!). Give it a date — deadlines make everything else easier to plan.{hasSub(stack, "events", "ai_planner") && " Then use ✨ Plan with AI on the event page to get a full checklist in seconds."}</Tip>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-5">
            {[{ id: "all", label: "All", color: "#f4efe9" }, ...EVENT_STATUS].map((s) => {
              const n = s.id === "all" ? events.length : events.filter((e) => e.status === s.id).length;
              if (s.id !== "all" && n === 0) return null;
              return (
                <button key={s.id} onClick={() => setFilter(s.id)}
                  className={cx("rounded-full px-3 py-1 text-[13px] border transition", filter === s.id ? "border-line-2 bg-panel-2 text-ink" : "border-line text-ink-3 hover:text-ink")}>
                  <span className="inline-block size-2 rounded-full mr-1.5" style={{ background: s.color }} />{s.label} <span className="font-mono text-ink-3">{n}</span>
                </button>
              );
            })}
          </div>
          {view === "calendar" && showCal ? <MonthCalendar events={shown} projectId={project.id} /> : (
            <div className="relative z-0 isolate space-y-8">
              {upcoming.length > 0 && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcoming.map((e, i) => <EventCard key={e.id} e={e} i={i} prog={byEvent[e.id]} href={`/p/${project.id}/events/${e.id}`} lead={members.find((m) => m.id === e.lead_member_id)?.full_name} />)}
                </div>
              )}
              {past.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-ink-3 mb-3">Past & cancelled</h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-75">
                    {past.map((e, i) => <EventCard key={e.id} e={e} i={i} prog={byEvent[e.id]} href={`/p/${project.id}/events/${e.id}`} lead={members.find((m) => m.id === e.lead_member_id)?.full_name} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New event">
        <EventForm projectId={project.id} members={members} showBudget={hasModule(stack, "finance")} onCancel={() => setOpen(false)}
          onSaved={(e) => { setOpen(false); router.push(`/p/${project.id}/events/${e.id}`); }} />
      </Modal>
    </div>
  );
}

function EventCard({ e, i, prog, href, lead }: { e: EventRow; i: number; prog?: { total: number; done: number }; href: string; lead?: string }) {
  const st = EVENT_STATUS_MAP[e.status] || EVENT_STATUS[0];
  const p = pct(prog?.done || 0, prog?.total || 0);
  const days = daysUntil(e.starts_at);
  return (
    <motion.div className="relative isolate" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
      <Link href={href}>
        <Card className="h-full hover:border-line-2 hover:-translate-y-0.5 transition cursor-pointer">
          <div className="flex items-start justify-between gap-2">
            <div className="text-2xl">{EVENT_TYPE_EMOJI[e.type] || "✨"}</div>
            <Badge color={st.color}>{st.label}</Badge>
          </div>
          <div className="font-bold text-lg mt-2 leading-tight">{e.name}</div>
          <div className="text-sm text-ink-3 mt-1 flex flex-wrap gap-x-3">
            <span>{fmtDate(e.starts_at, { weekday: "short", month: "short", day: "numeric" })}</span>
            {days !== null && days >= 0 && !["done", "cancelled"].includes(e.status) && <span className={days <= 7 ? "text-warn" : ""}>{days === 0 ? "today" : `in ${days}d`}</span>}
            {e.location && <span className="flex items-center gap-1"><MapPin className="size-3" />{e.location}</span>}
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-ink-3 mb-1.5">
              <span>{prog?.total ? `${prog.done}/${prog.total} tasks` : "No tasks yet"}</span>
              <span className="font-mono">{p}%</span>
            </div>
            <Progress value={p} color={p === 100 ? "var(--good)" : "var(--accent)"} />
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-ink-3">
            {lead ? <><Avatar name={lead} size={22} /> Led by <span className="text-ink-2">{lead}</span></> : "No lead assigned"}
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}

function MonthCalendar({ events, projectId }: { events: EventRow[]; projectId: string }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const first = new Date(year, month, 1).getDay();
  const daysIn = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const today = tsToDate(new Date().toISOString());
  const key = (d: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const byDay: Record<string, EventRow[]> = {};
  for (const e of events) { const k = tsToDate(e.starts_at); if (k) (byDay[k] ??= []).push(e); }
  const undated = events.filter((e) => !e.starts_at);
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft className="size-4" /></Button>
        <div className="font-bold text-lg">{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
        <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight className="size-4" /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wider text-ink-3 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => (
          <div key={i} className={cx("min-h-24 rounded-lg p-1.5 text-left", d ? "bg-white/[0.03] border border-line" : "", d && key(d) === today && "border-accent/60")}>
            {d && <div className={cx("text-xs font-mono mb-1", key(d) === today ? "text-accent font-bold" : "text-ink-3")}>{d}</div>}
            {d && (byDay[key(d)] || []).map((e) => (
              <Link key={e.id} href={`/p/${projectId}/events/${e.id}`} className="block truncate rounded px-1.5 py-0.5 text-[11.5px] font-semibold mb-0.5 hover:brightness-110"
                style={{ background: (EVENT_STATUS_MAP[e.status]?.color || "#aaa") + "30", color: EVENT_STATUS_MAP[e.status]?.color }}>
                {EVENT_TYPE_EMOJI[e.type] || "✨"} {e.name}
              </Link>
            ))}
          </div>
        ))}
      </div>
      {undated.length > 0 && <div className="mt-3 text-xs text-ink-3">No date yet: {undated.map((e) => e.name).join(", ")}</div>}
    </Card>
  );
}
