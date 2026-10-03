"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Ban, Check, CalendarDays, MapPin, Pencil, Plus, Sparkles, Trash2, Users, Wallet, HeartHandshake, ClipboardCheck } from "lucide-react";
import { ModuleGate } from "@/components/module-gate";
import { useProject } from "@/components/project-context";
import { supabase } from "@/lib/supabase";
import { askAI } from "@/lib/ai/client";
import { activeLinks, hasModule, hasSub } from "@/lib/modules";
import { can } from "@/lib/roles";
import type { Donation, EventRow, Fundraiser, Member, Task, Transaction } from "@/lib/types";
import type { PlannedTask } from "@/lib/ai/tasks/modules";
import { AIBox, Avatar, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Progress, Select, Spinner, Textarea, Tip, cx, fmtDate, fmtMoney, todayISO } from "@/components/ui";
import { EventForm } from "@/components/modules/event-form";
import { CAT_MAP, EVENT_STATUS, EVENT_TYPE_EMOJI, NoPerm, PRIORITY_COLOR, TASK_CATEGORIES, TASK_STATUS, addDays, pct, sum, tsToDate, daysUntil } from "@/components/modules/shared";

const REVIEW_MARK = "\n\n--- Post-event review ---\n";

export default function EventDetailPage({ params }: { params: Promise<{ id: string; eventId: string }> }) {
  const { eventId } = use(params);
  return <ModuleGate id="events"><EventDetail eventId={eventId} /></ModuleGate>;
}

function EventDetail({ eventId }: { eventId: string }) {
  const { project, stack, me, members } = useProject();
  const router = useRouter();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [fundraisers, setFundraisers] = useState<Fundraiser[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [editing, setEditing] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  const links = activeLinks(stack);
  const linked = (from: string, to: string) => links.some((l) => l.from === from && l.to === to);
  const hrLinked = linked("hr", "events");
  const fundLinked = linked("events", "fundraising");
  const finLinked = linked("events", "finance");
  const canEdit = can(me, "events", "edit");
  const canManage = can(me, "events", "manage");

  const loadTasks = useCallback(async () => {
    const { data } = await supabase().from("tasks").select("*").eq("event_id", eventId).order("due_date", { ascending: true, nullsFirst: false });
    setTasks((data as Task[]) || []);
  }, [eventId]);

  const load = useCallback(async () => {
    const { data } = await supabase().from("events").select("*").eq("id", eventId).maybeSingle();
    if (!data) { setState("missing"); return; }
    setEvent(data as EventRow);
    await loadTasks();
    if (fundLinked) {
      const { data: fr } = await supabase().from("fundraisers").select("*").eq("event_id", eventId);
      const list = (fr as Fundraiser[]) || [];
      setFundraisers(list);
      if (list.length) {
        const { data: dn } = await supabase().from("donations").select("*").in("fundraiser_id", list.map((f) => f.id));
        setDonations((dn as Donation[]) || []);
      }
    }
    if (finLinked) {
      const { data: tx } = await supabase().from("transactions").select("*").eq("event_id", eventId).order("occurred_on");
      setTxs((tx as Transaction[]) || []);
    }
    setState("ok");
  }, [eventId, loadTasks, fundLinked, finLinked]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch
  useEffect(() => { load(); }, [load]);

  if (state === "loading") return <div className="grid place-items-center py-20"><Spinner /></div>;
  if (state === "missing" || !event) return <Empty emoji="🔍" title="Event not found" action={<Link href={`/p/${project.id}/events`} className="text-accent">← All events</Link>} />;

  const done = tasks.filter((t) => t.status === "done").length;
  const overall = pct(done, tasks.length);
  const lead = members.find((m) => m.id === event.lead_member_id);
  const [desc, review] = (event.description || "").split(REVIEW_MARK);
  const daysLeft = daysUntil(event.starts_at);

  async function setStatus(s: EventRow["status"]) {
    if (!event || !canEdit) return;
    setEvent({ ...event, status: s });
    await supabase().from("events").update({ status: s }).eq("id", event.id);
  }
  async function del() {
    if (!event || !confirm(`Delete "${event.name}" and all its tasks?`)) return;
    await supabase().from("events").delete().eq("id", event.id);
    router.push(`/p/${project.id}/events`);
  }

  return (
    <div>
      <Link href={`/p/${project.id}/events`} className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink mb-4"><ArrowLeft className="size-4" />All events</Link>
      <PageHeader emoji={EVENT_TYPE_EMOJI[event.type] || "✨"} title={event.name}
        subtitle={desc || undefined}
        actions={<>
          {hasSub(stack, "events", "ai_planner") && canEdit && <Button variant="ai" onClick={() => setPlanOpen(true)}><Sparkles className="size-4" />Plan with AI</Button>}
          {canEdit && <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="size-4" />Edit</Button>}
          {canManage && <Button variant="ghost" onClick={del} title="Delete event"><Trash2 className="size-4" /></Button>}
        </>}
      />

      {!canEdit && <div className="mb-3"><NoPerm>View only — your role can&apos;t edit this event.</NoPerm></div>}
      {/* status pipeline */}
      <div className="flex flex-wrap items-center gap-1 mb-6">
        {EVENT_STATUS.map((s, i) => {
          const idx = EVENT_STATUS.findIndex((x) => x.id === event.status);
          const reached = event.status !== "cancelled" && i <= idx && s.id !== "cancelled";
          const active = s.id === event.status;
          return (
            <div key={s.id} className="flex items-center gap-1">
              <button disabled={!canEdit} onClick={() => setStatus(s.id as EventRow["status"])}
                className={cx("rounded-full px-3 py-1.5 text-[13px] font-semibold border transition", active ? "" : reached ? "opacity-80" : "border-line text-ink-3 hover:text-ink", s.id === "cancelled" && "ml-3")}
                style={active || reached ? { color: s.color, borderColor: s.color + "66", background: s.color + (active ? "2e" : "12") } : undefined}>
                {reached && !active && <Check className="size-3 inline mr-1" />}{s.label}
              </button>
              {i < EVENT_STATUS.length - 2 && <span className="w-4 h-px bg-line-2" />}
            </div>
          );
        })}
      </div>

      <div className="grid md:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="text-[12px] uppercase tracking-wider text-ink-3 font-semibold">Overall progress</div>
          <div className="font-mono text-2xl font-bold mt-1">{overall}%</div>
          <Progress value={overall} className="mt-2" color={overall === 100 ? "var(--good)" : "var(--accent)"} />
          <div className="text-xs text-ink-3 mt-1.5">{done} of {tasks.length} tasks done</div>
        </Card>
        <Card className="p-4">
          <div className="text-[12px] uppercase tracking-wider text-ink-3 font-semibold flex items-center gap-1.5"><CalendarDays className="size-3.5" />When</div>
          <div className="font-bold mt-1">{fmtDate(event.starts_at, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
          {daysLeft !== null && <div className={cx("text-xs mt-1", daysLeft <= 7 && daysLeft >= 0 ? "text-warn" : "text-ink-3")}>{daysLeft > 0 ? `${daysLeft} days to go` : daysLeft === 0 ? "Today!" : `${-daysLeft} days ago`}</div>}
        </Card>
        <Card className="p-4">
          <div className="text-[12px] uppercase tracking-wider text-ink-3 font-semibold flex items-center gap-1.5"><MapPin className="size-3.5" />Where</div>
          <div className="font-bold mt-1">{event.location || <span className="text-ink-3 font-normal">Not set</span>}</div>
          <div className="text-xs text-ink-3 mt-1 capitalize">{event.type}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[12px] uppercase tracking-wider text-ink-3 font-semibold">Event lead</div>
          {lead ? <div className="flex items-center gap-2 mt-2"><Avatar name={lead.full_name} size={28} /><span className="font-bold">{lead.full_name}</span></div> : <div className="text-ink-3 mt-1">Nobody yet {canEdit && <button className="text-accent" onClick={() => setEditing(true)}>— assign</button>}</div>}
        </Card>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6 min-w-0">
          <TaskSection event={event} tasks={tasks} setTasks={setTasks} reload={loadTasks} members={members} hrLinked={hrLinked}
            grouped={hasSub(stack, "events", "prep_checklist")} canEdit={canEdit} canManage={canManage} onPlan={hasSub(stack, "events", "ai_planner") && canEdit ? () => setPlanOpen(true) : undefined} />
          {hasSub(stack, "events", "post_mortem") && (
            <PostMortem event={event} desc={desc} review={review} tasks={tasks} canEdit={canEdit} onSaved={setEvent} />
          )}
        </div>
        <div className="space-y-4">
          {hrLinked ? <PeoplePanel tasks={tasks} members={members} /> : hasModule(stack, "hr") ? null : (
            <Tip title="Unlock">Attach the People & HR module to assign tasks to teammates and see per-person progress.</Tip>
          )}
          {fundLinked && <FundPanel fundraisers={fundraisers} donations={donations} projectId={project.id} />}
          {finLinked && <BudgetPanel event={event} txs={txs} projectId={project.id} />}
          {hasSub(stack, "events", "attendance") && <Attendance eventId={event.id} members={members} />}
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit event">
        <EventForm projectId={project.id} event={{ ...event, description: desc || null }} members={members} showBudget={hasModule(stack, "finance")}
          onCancel={() => setEditing(false)}
          onSaved={async (e) => {
            // keep the post-mortem notes attached
            if (review) { await supabase().from("events").update({ description: (e.description || "") + REVIEW_MARK + review }).eq("id", e.id); e.description = (e.description || "") + REVIEW_MARK + review; }
            setEvent(e); setEditing(false);
          }} />
      </Modal>
      <PlanModal open={planOpen} onClose={() => setPlanOpen(false)} event={{ ...event, description: desc }} teamSize={members.filter((m) => m.status === "active").length}
        onInserted={() => { setPlanOpen(false); loadTasks(); }} />
    </div>
  );
}

// ---------------------------------------------------------------- tasks
function TaskSection({ event, tasks, setTasks, reload, members, hrLinked, grouped, canEdit, canManage, onPlan }: {
  event: EventRow; tasks: Task[]; setTasks: (t: Task[]) => void; reload: () => Promise<void>; members: Member[]; hrLinked: boolean; grouped: boolean; canEdit: boolean; canManage: boolean; onPlan?: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ title: "", category: "general", priority: "medium", due_date: "", assignee_member_id: "" });
  const [catFilter, setCatFilter] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return;
    const row = { project_id: event.project_id, event_id: event.id, title: f.title.trim(), category: f.category, priority: f.priority, due_date: f.due_date || null, assignee_member_id: hrLinked ? f.assignee_member_id || null : null };
    const { error } = await supabase().from("tasks").insert(row);
    if (error) return alert(error.message);
    setF({ ...f, title: "" });
    reload();
  }
  async function patch(t: Task, p: Partial<Task>) {
    if (p.status) p.completed_at = p.status === "done" ? new Date().toISOString() : null;
    setTasks(tasks.map((x) => (x.id === t.id ? { ...x, ...p } : x)));
    const { error } = await supabase().from("tasks").update(p).eq("id", t.id);
    if (error) { alert(error.message); reload(); }
  }
  async function remove(t: Task) {
    setTasks(tasks.filter((x) => x.id !== t.id));
    await supabase().from("tasks").delete().eq("id", t.id);
  }

  const cats = TASK_CATEGORIES.filter((c) => tasks.some((t) => (t.category || "general") === c.id));
  const visible = catFilter ? tasks.filter((t) => (t.category || "general") === catFilter) : tasks;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Tasks {grouped && <span className="serif italic grad-text font-normal">& prep checklist</span>}</h2>
        {canEdit && <Button size="sm" variant="outline" onClick={() => setAdding(!adding)}><Plus className="size-4" />Add task</Button>}
      </div>

      {grouped && cats.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-2 mb-5">
          {cats.map((c) => {
            const ct = tasks.filter((t) => (t.category || "general") === c.id);
            const d = ct.filter((t) => t.status === "done").length;
            const active = catFilter === c.id;
            return (
              <button key={c.id} onClick={() => setCatFilter(active ? null : c.id)}
                className={cx("text-left rounded-xl border p-3 transition", active ? "border-line-2 bg-panel-2" : "border-line hover:bg-panel")}>
                <div className="flex justify-between text-sm mb-1.5"><span className="font-semibold">{c.emoji} {c.label}</span><span className="font-mono text-ink-3 text-xs">{d}/{ct.length}</span></div>
                <Progress value={pct(d, ct.length)} color={c.color} height={6} />
              </button>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {adding && canEdit && (
          <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} onSubmit={add} className="overflow-hidden">
            <div className="rounded-xl border border-line p-3 mb-4 space-y-2">
              <Input autoFocus placeholder="What needs to happen? e.g. Book the cafeteria" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
              <div className="flex flex-wrap gap-2">
                <Select className="w-auto" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{TASK_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}</Select>
                <Select className="w-auto" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select>
                <Input className="w-auto" type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
                {hrLinked && <Select className="w-auto" value={f.assignee_member_id} onChange={(e) => setF({ ...f, assignee_member_id: e.target.value })}><option value="">Unassigned</option>{members.filter((m) => m.status === "active").map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</Select>}
                <Button type="submit" className="ml-auto">Add</Button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {tasks.length === 0 ? (
        <Empty emoji="📝" title="No tasks yet" action={onPlan ? <Button variant="ai" onClick={onPlan}><Sparkles className="size-4" />Plan with AI</Button> : canEdit ? <Button variant="outline" onClick={() => setAdding(true)}>Add the first task</Button> : undefined}>
          Break this event into small jobs — book the room, make a flyer, buy supplies. Each one gets an owner and a due date.
        </Empty>
      ) : (
        <div className="space-y-1">
          {catFilter && <div className="text-xs text-ink-3 mb-2">Showing {CAT_MAP[catFilter]?.label} only · <button className="text-accent" onClick={() => setCatFilter(null)}>show all</button></div>}
          {visible.map((t) => <TaskRow key={t.id} t={t} members={members} hrLinked={hrLinked} canEdit={canEdit} canManage={canManage} patch={(p) => patch(t, p)} remove={() => remove(t)} />)}
        </div>
      )}
      {tasks.length > 0 && <div className="mt-4"><Tip>Click the circle to mark a task done, or click the status pill to cycle To do → In progress → Done.</Tip></div>}
    </Card>
  );
}

const NEXT: Record<string, Task["status"]> = { todo: "in_progress", in_progress: "done", done: "todo", blocked: "in_progress" };

function TaskRow({ t, members, hrLinked, canEdit, canManage, patch, remove }: { t: Task; members: Member[]; hrLinked: boolean; canEdit: boolean; canManage: boolean; patch: (p: Partial<Task>) => void; remove: () => void }) {
  const cat = CAT_MAP[t.category || "general"] || CAT_MAP.general;
  const st = TASK_STATUS[t.status] || TASK_STATUS.todo;
  const overdue = t.due_date && t.status !== "done" && t.due_date < todayISO();
  const done = t.status === "done";
  return (
    <motion.div layout className={cx("group flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl px-2 py-2 hover:bg-white/[0.03]", done && "opacity-60")}>
      <button disabled={!canEdit} onClick={() => patch({ status: done ? "todo" : "done" })}
        className={cx("size-5 rounded-full border-2 grid place-items-center shrink-0 transition", done ? "bg-good border-good" : "border-line-2 hover:border-good")}>
        {done && <Check className="size-3 text-black" strokeWidth={3} />}
      </button>
      <span className="text-base" title={cat.label}>{cat.emoji}</span>
      <span className={cx("flex-1 min-w-40 text-sm", done && "line-through")}>{t.title}</span>
      <span className="size-2 rounded-full" style={{ background: PRIORITY_COLOR[t.priority] }} title={`${t.priority} priority`} />
      <button disabled={!canEdit} onClick={() => patch({ status: NEXT[t.status] })}
        className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold border" style={{ color: st.color, borderColor: st.color + "55", background: st.color + "1a" }}>{st.label}</button>
      {canEdit && t.status !== "blocked" && t.status !== "done" && (
        <button onClick={() => patch({ status: "blocked" })} title="Mark blocked" className="text-ink-3 hover:text-bad opacity-0 group-hover:opacity-100"><Ban className="size-3.5" /></button>
      )}
      {canEdit ? (
        <input type="date" value={t.due_date || ""} onChange={(e) => patch({ due_date: e.target.value || null })}
          className={cx("bg-transparent text-xs font-mono w-[7.5rem] outline-none", overdue ? "text-bad" : "text-ink-3")} />
      ) : <span className={cx("text-xs font-mono", overdue ? "text-bad" : "text-ink-3")}>{fmtDate(t.due_date)}</span>}
      {hrLinked && (canEdit ? (
        <select value={t.assignee_member_id || ""} onChange={(e) => patch({ assignee_member_id: e.target.value || null })}
          className="bg-transparent text-xs text-ink-2 outline-none max-w-32 cursor-pointer">
          <option value="" className="bg-[#16121f]">Unassigned</option>
          {members.filter((m) => m.status === "active" || m.id === t.assignee_member_id).map((m) => <option key={m.id} value={m.id} className="bg-[#16121f]">{m.full_name}</option>)}
        </select>
      ) : <span className="text-xs text-ink-3">{members.find((m) => m.id === t.assignee_member_id)?.full_name || "Unassigned"}</span>)}
      {canManage && <button onClick={remove} className="text-ink-3 hover:text-bad opacity-0 group-hover:opacity-100"><Trash2 className="size-3.5" /></button>}
    </motion.div>
  );
}

// ---------------------------------------------------------------- side panels
function PeoplePanel({ tasks, members }: { tasks: Task[]; members: Member[] }) {
  const rows = useMemo(() => {
    const m: Record<string, { total: number; done: number }> = {};
    for (const t of tasks) {
      const k = t.assignee_member_id || "_none";
      m[k] ??= { total: 0, done: 0 };
      m[k].total++;
      if (t.status === "done") m[k].done++;
    }
    return Object.entries(m).sort((a, b) => (a[0] === "_none" ? 1 : b[0] === "_none" ? -1 : b[1].total - a[1].total));
  }, [tasks]);
  return (
    <Card>
      <h3 className="font-bold flex items-center gap-2 mb-3"><Users className="size-4 text-accent" />Per-person progress</h3>
      {rows.length === 0 ? <div className="text-sm text-ink-3">Assign tasks to teammates to see who&apos;s on track.</div> : (
        <div className="space-y-3">
          {rows.map(([id, r]) => {
            const m = members.find((x) => x.id === id);
            const name = id === "_none" ? "Unassigned" : m?.full_name || "Former member";
            return (
              <div key={id}>
                <div className="flex items-center gap-2 text-sm mb-1">
                  {id === "_none" ? <div className="size-6 rounded-full border border-dashed border-line-2" /> : <Avatar name={name} size={24} />}
                  <span className={cx("flex-1 truncate", id === "_none" && "text-ink-3")}>{name}</span>
                  <span className="font-mono text-xs text-ink-3">{r.done}/{r.total}</span>
                </div>
                <Progress value={pct(r.done, r.total)} height={6} color={id === "_none" ? "var(--ink-3)" : pct(r.done, r.total) === 100 ? "var(--good)" : "var(--accent-2)"} />
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function FundPanel({ fundraisers, donations, projectId }: { fundraisers: Fundraiser[]; donations: Donation[]; projectId: string }) {
  const raised = sum(donations, (d) => d.amount);
  const goal = sum(fundraisers, (f) => f.goal);
  return (
    <Card>
      <h3 className="font-bold flex items-center gap-2 mb-3"><HeartHandshake className="size-4 text-good" />Fundraising</h3>
      {fundraisers.length === 0 ? (
        <div className="text-sm text-ink-3">No campaigns attached. <Link href={`/p/${projectId}/fundraising`} className="text-accent">Create one</Link> and link it to this event.</div>
      ) : (
        <>
          <div className="font-mono text-2xl font-bold text-good">{fmtMoney(raised)}</div>
          <div className="text-xs text-ink-3 mb-2">raised of {fmtMoney(goal)} goal</div>
          <Progress value={pct(raised, goal)} color="var(--good)" />
          <div className="mt-3 space-y-1.5">
            {fundraisers.map((f) => {
              const r = sum(donations.filter((d) => d.fundraiser_id === f.id), (d) => d.amount);
              return <div key={f.id} className="flex justify-between text-sm"><span className="truncate">{f.name}</span><span className="font-mono text-ink-2">{fmtMoney(r)}</span></div>;
            })}
          </div>
        </>
      )}
    </Card>
  );
}

function BudgetPanel({ event, txs, projectId }: { event: EventRow; txs: Transaction[]; projectId: string }) {
  const spent = sum(txs.filter((t) => t.kind === "expense"), (t) => t.amount);
  const income = sum(txs.filter((t) => t.kind === "income"), (t) => t.amount);
  const budget = Number(event.budget) || 0;
  const over = budget > 0 && spent > budget;
  return (
    <Card>
      <h3 className="font-bold flex items-center gap-2 mb-3"><Wallet className="size-4 text-[#9ad8ff]" />Budget vs. actual</h3>
      <div className="flex justify-between items-end">
        <div><div className={cx("font-mono text-2xl font-bold", over ? "text-bad" : "")}>{fmtMoney(spent)}</div><div className="text-xs text-ink-3">spent of {budget ? fmtMoney(budget) : "no budget set"}</div></div>
        {income > 0 && <div className="text-right"><div className="font-mono text-good font-bold">+{fmtMoney(income)}</div><div className="text-xs text-ink-3">income</div></div>}
      </div>
      {budget > 0 && <Progress className="mt-2" value={pct(spent, budget)} color={over ? "var(--bad)" : "#9ad8ff"} />}
      {over && <div className="text-xs text-bad mt-1.5">Over budget by {fmtMoney(spent - budget)}</div>}
      <div className="mt-3 space-y-1">
        {txs.filter((t) => t.kind === "expense").slice(-5).map((t) => (
          <div key={t.id} className="flex justify-between text-xs"><span className="text-ink-2 truncate">{t.description || t.category}</span><span className="font-mono text-ink-3">{fmtMoney(t.amount)}</span></div>
        ))}
      </div>
      <Link href={`/p/${projectId}/finance`} className="text-xs text-accent mt-3 inline-block">Log an expense in Finance →</Link>
    </Card>
  );
}

function Attendance({ eventId, members }: { eventId: string; members: Member[] }) {
  const key = `foundry-att-${eventId}`;
  const [state, setState] = useState<{ present: string[]; guests: number }>(() => {
    try { return JSON.parse((typeof window !== "undefined" && localStorage.getItem(key)) || "") || { present: [], guests: 0 }; } catch { return { present: [], guests: 0 }; }
  });
  const save = (s: typeof state) => { setState(s); try { localStorage.setItem(key, JSON.stringify(s)); } catch {} };
  const active = members.filter((m) => m.status === "active");
  return (
    <Card>
      <h3 className="font-bold flex items-center gap-2 mb-1"><ClipboardCheck className="size-4 text-violet" />Check-in</h3>
      <div className="text-xs text-ink-3 mb-3">Tap volunteers as they arrive. Count guests at the door.</div>
      <div className="flex flex-wrap gap-1.5">
        {active.map((m) => {
          const on = state.present.includes(m.id);
          return (
            <button key={m.id} onClick={() => save({ ...state, present: on ? state.present.filter((x) => x !== m.id) : [...state.present, m.id] })}
              className={cx("rounded-full px-2.5 py-1 text-xs border transition", on ? "bg-good/15 border-good/40 text-good" : "border-line text-ink-3")}>
              {on && "✓ "}{m.full_name.split(" ")[0]}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-4">
        <span className="text-sm">Guests</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => save({ ...state, guests: Math.max(0, state.guests - 1) })}>−</Button>
          <span className="font-mono text-xl font-bold w-10 text-center">{state.guests}</span>
          <Button size="sm" variant="outline" onClick={() => save({ ...state, guests: state.guests + 1 })}>+</Button>
        </div>
      </div>
      <div className="text-xs text-ink-3 mt-2">{state.present.length}/{active.length} volunteers present · saved on this device</div>
    </Card>
  );
}

// ---------------------------------------------------------------- post-mortem
function PostMortem({ event, desc, review, tasks, canEdit, onSaved }: { event: EventRow; desc: string; review?: string; tasks: Task[]; canEdit: boolean; onSaved: (e: EventRow) => void }) {
  const [notes, setNotes] = useState(review || "");
  const [saving, setSaving] = useState(false);
  const [ai, setAi] = useState<{ went_well: string[]; improve: string[]; next_time: string[]; _source?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    setSaving(true);
    const description = (desc || "") + (notes.trim() ? REVIEW_MARK + notes.trim() : "");
    await supabase().from("events").update({ description }).eq("id", event.id);
    onSaved({ ...event, description });
    setSaving(false);
  }
  async function runAI() {
    setLoading(true);
    try {
      const r = await askAI("event_review", {
        name: event.name, tasks_total: tasks.length, tasks_done: tasks.filter((t) => t.status === "done").length,
        blocked: tasks.filter((t) => t.status === "blocked").map((t) => t.title),
        overdue: tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date < todayISO()).map((t) => t.title), notes,
      });
      setAi(r);
    } finally { setLoading(false); }
  }
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">Post-event <span className="serif italic grad-text font-normal">review</span></h2>
        <Button size="sm" variant="ai" onClick={runAI} loading={loading}><Sparkles className="size-4" />AI review</Button>
      </div>
      {event.status !== "done" && <div className="mb-3"><Tip>After the event, jot down what went well and what to fix. Future-you (and next year&apos;s team) will thank you.</Tip></div>}
      {(ai || loading) && (
        <div className="mb-3">
          <AIBox title="Event review" loading={loading} source={ai?._source}>
            {ai && <div className="grid sm:grid-cols-3 gap-4 text-sm">
              {([["🌟 Went well", ai.went_well], ["🔧 Improve", ai.improve], ["➡️ Next time", ai.next_time]] as const).map(([h, xs]) => (
                <div key={h}><div className="font-bold mb-1">{h}</div><ul className="space-y-1 text-ink-2">{(xs || []).map((x, i) => <li key={i}>• {x}</li>)}</ul></div>
              ))}
            </div>}
          </AIBox>
        </div>
      )}
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} placeholder="Attendance, money raised, what went well, what to change…" />
      {canEdit && <div className="flex justify-end mt-2"><Button size="sm" onClick={save} loading={saving}>Save notes</Button></div>}
    </Card>
  );
}

// ---------------------------------------------------------------- AI planner
function PlanModal({ open, onClose, event, teamSize, onInserted }: { open: boolean; onClose: () => void; event: EventRow; teamSize: number; onInserted: () => void }) {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<(PlannedTask & { keep: boolean })[] | null>(null);
  const [summary, setSummary] = useState("");
  const [source, setSource] = useState<string>();
  const [extra, setExtra] = useState("");
  const [saving, setSaving] = useState(false);
  const evDate = tsToDate(event.starts_at);

  async function generate() {
    setLoading(true);
    try {
      const r = await askAI<{ summary?: string; tasks: PlannedTask[] }>("event_plan", {
        name: event.name, type: event.type, description: [event.description, extra].filter(Boolean).join("\n"), date: evDate || null, team_size: teamSize, location: event.location,
      });
      setPlan((r.tasks || []).map((t) => ({ ...t, category: CAT_MAP[t.category] ? t.category : "general", keep: true })));
      setSummary(r.summary || ""); setSource(r._source);
    } catch { alert("Couldn't reach the planner. Try again."); }
    setLoading(false);
  }
  async function insert() {
    if (!plan) return;
    setSaving(true);
    const base = evDate || addDays(todayISO(), 30);
    const rows = plan.filter((t) => t.keep).map((t) => ({
      project_id: event.project_id, event_id: event.id, title: t.title, category: t.category, priority: ["low", "medium", "high"].includes(t.priority) ? t.priority : "medium",
      due_date: addDays(base, -Math.round(Number(t.days_before) || 0)),
    }));
    const { error } = await supabase().from("tasks").insert(rows);
    setSaving(false);
    if (error) return alert(error.message);
    setPlan(null);
    onInserted();
  }

  return (
    <Modal open={open} onClose={onClose} title="✨ Plan this event with AI" wide>
      {!plan ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-2">AI will read your event&apos;s name, type, date and description and draft a full prep checklist — venue, content, marketing, supplies, volunteers. You can untick anything before adding.</p>
          <Field label="Anything else AI should know?" hint="optional">
            <Textarea value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="e.g. We expect 80 people, need permission from the principal, and have $150 to spend." />
          </Field>
          {!evDate && <Tip>This event has no date yet — due dates will be set relative to 30 days from now.</Tip>}
          <div className="flex justify-end"><Button variant="ai" onClick={generate} loading={loading}><Sparkles className="size-4" />Draft my checklist</Button></div>
        </div>
      ) : (
        <div className="space-y-3">
          {summary && <AIBox title="Planner" source={source}>{summary}</AIBox>}
          <div className="max-h-[50vh] overflow-y-auto space-y-1 pr-1">
            {plan.map((t, i) => (
              <label key={i} className={cx("flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.03] cursor-pointer", !t.keep && "opacity-40")}>
                <input type="checkbox" checked={t.keep} onChange={() => setPlan(plan.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)))} className="accent-[var(--accent)]" />
                <span>{CAT_MAP[t.category]?.emoji}</span>
                <span className="flex-1 text-sm">{t.title}</span>
                <Badge color={PRIORITY_COLOR[t.priority]}>{t.priority}</Badge>
                <span className="text-xs font-mono text-ink-3 w-20 text-right">{t.days_before > 0 ? `${t.days_before}d before` : t.days_before === 0 ? "day of" : "after"}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-between gap-2 pt-2">
            <Button variant="ghost" onClick={() => setPlan(null)}>← Regenerate</Button>
            <Button onClick={insert} loading={saving}>Add {plan.filter((t) => t.keep).length} tasks</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
