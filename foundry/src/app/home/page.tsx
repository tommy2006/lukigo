"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, LogIn, LogOut, CalendarDays, CheckCircle2, Circle, RefreshCw } from "lucide-react";
import { RequireAuth, useAuth } from "@/components/auth";
import { supabase } from "@/lib/supabase";
import { askAI } from "@/lib/ai/client";
import type { EventRow, Member, Project, Task } from "@/lib/types";
import { MODULE_MAP } from "@/lib/modules";
import { ROLE_MAP, roleLabel, visibleModules } from "@/lib/roles";
import { AIBox, Badge, Button, Card, Empty, Field, Input, Modal, Progress, Tip, fmtDate, todayISO } from "@/components/ui";
import { Logo } from "@/components/logo";
import { PortalButton } from "@/components/portal/portal-button";
import type { HomeSummaryInput } from "@/lib/ai/tasks/core";

export default function HomePage() {
  return <RequireAuth><Suspense><Home /></Suspense></RequireAuth>;
}

type Mem = Member & { projects: Project };
interface Summary { headline: string; projects: { project_id: string; summary: string; focus: string }[]; _source?: string }

function Home() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [mems, setMems] = useState<Mem[] | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [joinOpen, setJoinOpen] = useState(useSearchParams().get("join") === "1");

  const load = useCallback(async () => {
    const sb = supabase();
    const { data } = await sb.from("project_members").select("*, projects(*)").eq("user_id", user.id).eq("status", "active");
    const ms = ((data as Mem[]) || []).filter((m) => m.projects);
    setMems(ms);
    if (!ms.length) return;
    const [t, e] = await Promise.all([
      sb.from("tasks").select("*").in("assignee_member_id", ms.map((m) => m.id)),
      sb.from("events").select("*").in("project_id", ms.map((m) => m.project_id)).gte("starts_at", new Date().toISOString()).order("starts_at").limit(30),
    ]);
    setTasks((t.data as Task[]) || []);
    setEvents(((e.data as EventRow[]) || []).filter((x) => (x.approval ?? "approved") === "approved"));
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const summarize = useCallback(async () => {
    if (!mems?.length) return;
    setAiLoading(true);
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    const input: HomeSummaryInput = {
      today: todayISO(),
      user_name: profile?.full_name || "there",
      projects: mems.map((m) => ({
        project_id: m.project_id,
        name: m.projects.name,
        role: roleLabel(m),
        done: tasks.filter((t) => t.assignee_member_id === m.id && t.status === "done" && (t.completed_at || t.created_at) >= weekAgo).map((t) => ({ title: t.title })),
        due: tasks.filter((t) => t.assignee_member_id === m.id && t.status !== "done").map((t) => ({ title: t.title, due_date: t.due_date })),
        upcoming_events: events.filter((e) => e.project_id === m.project_id).slice(0, 3).map((e) => ({ name: e.name, starts_at: e.starts_at })),
      })),
    };
    try { setSummary(await askAI<Summary>("home_summary", input)); } catch { /* ignore */ }
    setAiLoading(false);
  }, [mems, tasks, events, profile]);

  useEffect(() => { if (mems?.length) summarize(); }, [mems, tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const myOpen = tasks.filter((t) => t.status !== "done").sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
  const first = (profile?.full_name || "").split(" ")[0];

  async function toggleTask(t: Task) {
    const status = t.status === "done" ? "todo" : "done";
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status } : x)));
    await supabase().from("tasks").update({ status, completed_at: status === "done" ? new Date().toISOString() : null }).eq("id", t.id);
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-line">
        <Logo />
        <div className="flex items-center gap-3">
          <PortalButton />
          <span className="text-sm text-ink-2 max-sm:hidden">{profile?.full_name}</span>
          <Button variant="ghost" size="sm" onClick={() => supabase().auth.signOut()}><LogOut className="size-4" /></Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 md:px-10 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-ink-3 text-sm">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mt-1">
              Hey {first || "there"}, <span className="serif italic font-normal grad-text">let&apos;s make a dent.</span>
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setJoinOpen(true)}><LogIn className="size-4" /> Join with code</Button>
            <Button onClick={() => router.push("/onboarding")}><Plus className="size-4" /> Found a project</Button>
          </div>
        </div>

        {mems === null ? (
          <div className="grid md:grid-cols-2 gap-4"><div className="skeleton h-48" /><div className="skeleton h-48" /></div>
        ) : mems.length === 0 ? (
          <div className="space-y-4">
            <Empty emoji="🌱" title="You're not in any projects yet"
              action={<div className="flex justify-center gap-2"><Button onClick={() => router.push("/onboarding")}><Plus className="size-4" /> Found your first project</Button><Button variant="outline" onClick={() => setJoinOpen(true)}>Join with a code</Button></div>}>
              Got an idea for helping your community? Lukigo will walk you through setting it up in about 3 minutes. Or, if a friend already started one, ask them for the 6-letter invite code.
            </Empty>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_340px] gap-6">
            <div className="space-y-6">
              <AIBox title="Your week, summarized" loading={aiLoading && !summary} source={summary?._source}
                action={<button onClick={summarize} className="text-ink-3 hover:text-ink"><RefreshCw className={`size-3.5 ${aiLoading ? "animate-spin" : ""}`} /></button>}>
                {summary?.headline}
              </AIBox>

              <div className="pt-2">
                <div className="font-extrabold text-lg">Your projects <span className="font-mono text-ink-3 text-sm">{mems.length}</span></div>
                <div className="text-xs text-ink-3 mt-0.5 mb-4">Click a card to open its workspace. Inside, use the project name at the top of the sidebar to switch.</div>
              <div className="grid md:grid-cols-2 gap-4">
                {mems.map((m, i) => {
                  const p = m.projects;
                  const mine = tasks.filter((t) => t.assignee_member_id === m.id);
                  const done = mine.filter((t) => t.status === "done").length;
                  const s = summary?.projects?.find((x) => x.project_id === p.id);
                  const next = events.find((e) => e.project_id === p.id);
                  return (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                      <Link href={`/p/${p.id}`} className="block group">
                        <Card className="h-full hover:border-line-2 transition relative overflow-hidden">
                          <div className="absolute -right-10 -top-10 size-32 rounded-full blur-2xl opacity-25" style={{ background: p.color || "#ff9a76" }} />
                          <div className="flex items-start justify-between">
                            <div className="text-3xl">{p.emoji}</div>
                            <Badge color={ROLE_MAP[m.role]?.color}>{roleLabel(m)}</Badge>
                          </div>
                          <div className="font-extrabold text-xl mt-3 group-hover:text-accent transition">{p.name}</div>
                          {p.tagline && <div className="text-sm text-ink-3">{p.tagline}</div>}
                          <div className="flex gap-1 mt-3">
                            {visibleModules(p.modules?.stack || [], m).map((s) => (
                              <span key={s.id} title={MODULE_MAP[s.id]?.name} className="size-6 rounded-md grid place-items-center text-xs" style={{ background: MODULE_MAP[s.id]?.color }}>{MODULE_MAP[s.id]?.emoji}</span>
                            ))}
                          </div>
                          <div className="mt-4">
                            <div className="flex justify-between text-xs text-ink-3 mb-1"><span>My tasks</span><span className="font-mono">{done}/{mine.length}</span></div>
                            <Progress value={mine.length ? (done / mine.length) * 100 : 0} color={p.color || undefined} height={6} />
                          </div>
                          {s ? (
                            <div className="mt-4 text-sm text-ink-2 leading-relaxed">
                              {s.summary}
                              <div className="mt-2 text-[13px]"><span className="text-violet font-semibold">Next up → </span><span className="text-ink">{s.focus}</span></div>
                            </div>
                          ) : aiLoading ? <div className="skeleton h-10 mt-4" /> : null}
                          {next && <div className="mt-3 text-xs text-ink-3 flex items-center gap-1.5"><CalendarDays className="size-3.5" /> {next.name} · {fmtDate(next.starts_at)}</div>}
                        </Card>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
              </div>
            </div>

            <div className="space-y-4">
              <Card>
                <div className="font-bold mb-3 flex items-center justify-between">My to-dos <span className="font-mono text-ink-3 text-sm">{myOpen.length}</span></div>
                {myOpen.length === 0 ? <div className="text-sm text-ink-3">All clear ✨ Tasks assigned to you in any project show up here.</div> : (
                  <ul className="space-y-1">
                    {myOpen.slice(0, 10).map((t) => {
                      const m = mems.find((x) => x.id === t.assignee_member_id);
                      const overdue = t.due_date && t.due_date < todayISO();
                      return (
                        <li key={t.id} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-panel">
                          <button onClick={() => toggleTask(t)} className="mt-0.5 text-ink-3 hover:text-good">
                            {t.status === "done" ? <CheckCircle2 className="size-4 text-good" /> : <Circle className="size-4" />}
                          </button>
                          <Link href={t.event_id ? `/p/${t.project_id}/events/${t.event_id}` : `/p/${t.project_id}`} className="flex-1 min-w-0">
                            <div className="text-sm truncate">{t.title}</div>
                            <div className="text-[11px] text-ink-3">{m?.projects.emoji} {m?.projects.name} {t.due_date && <span className={overdue ? "text-bad" : ""}>· due {fmtDate(t.due_date)}</span>}</div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
              <Card>
                <div className="font-bold mb-3">Coming up</div>
                {events.length === 0 ? <div className="text-sm text-ink-3">No upcoming events.</div> : (
                  <ul className="space-y-2.5">
                    {events.slice(0, 6).map((e) => {
                      const p = mems.find((m) => m.project_id === e.project_id)?.projects;
                      return (
                        <li key={e.id}>
                          <Link href={`/p/${e.project_id}/events/${e.id}`} className="flex gap-3 items-center group">
                            <div className="w-11 text-center rounded-lg bg-panel-2 py-1">
                              <div className="text-[10px] uppercase text-ink-3">{fmtDate(e.starts_at, { month: "short" })}</div>
                              <div className="font-mono font-bold">{fmtDate(e.starts_at, { day: "numeric" })}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate group-hover:text-accent">{e.name}</div>
                              <div className="text-[11px] text-ink-3">{p?.emoji} {p?.name}</div>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
              <Tip title="Roles">Your badge on each card shows your role. Presidents and VPs can change the project&apos;s modules; heads manage their department.</Tip>
            </div>
          </div>
        )}
      </div>
      <JoinModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  );
}

function JoinModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function join() {
    setLoading(true); setErr("");
    const { data, error } = await supabase().rpc("join_project", { p_code: code });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    router.push(`/p/${data}`);
  }
  return (
    <Modal open={open} onClose={onClose} title="Join a project">
      <div className="space-y-4">
        <Field label="Invite code" hint="6 letters, ask your project lead">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} autoFocus onKeyDown={(e) => e.key === "Enter" && code.length === 6 && join()} className="font-mono text-2xl tracking-[0.4em] text-center" placeholder="ABC123" />
        </Field>
        {err && <div className="text-sm text-bad">{err}</div>}
        <Button className="w-full" onClick={join} loading={loading} disabled={code.length < 6}>Join</Button>
      </div>
    </Modal>
  );
}
