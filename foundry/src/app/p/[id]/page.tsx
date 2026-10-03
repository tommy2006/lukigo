"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Copy, ArrowRight, Wand2 } from "lucide-react";
import { seedDemo } from "@/lib/demo-seed";
import { ListingCard } from "@/components/portal/listing-card";
import { ProjectSettings } from "@/components/project-settings";
import { EventRequests } from "@/components/modules/event-requests";
import { JoinRequests } from "@/components/portal/join-requests";
import { useProject } from "@/components/project-context";
import { supabase } from "@/lib/supabase";
import { MODULE_MAP, hasModule, hasSub } from "@/lib/modules";
import { ROLE_MAP, roleLabel, can, visibleModules, canApproveEvents, isPresident } from "@/lib/roles";
import type { Donation, EventRow, Fundraiser, SocialPost, SponsorLead, Task, Transaction } from "@/lib/types";
import { Avatar, Badge, Button, Card, PageHeader, Progress, Tip, cx, fmtDate, fmtMoney } from "@/components/ui";

export default function OverviewPage() {
  return <Suspense><Overview /></Suspense>;
}

interface Data { events: EventRow[]; tasks: Task[]; fundraisers: Fundraiser[]; donations: Donation[]; posts: SocialPost[]; tx: Transaction[]; accounts: number; leads: SponsorLead[]; shifts: number; openSpots: number; partners: number; served: number }

function Overview() {
  const { project, stack, me, members, reload, reloadMembers } = useProject();
  const [seeding, setSeeding] = useState(false);
  const [tick, setTick] = useState(0);
  const welcome = useSearchParams().get("welcome");
  const [d, setD] = useState<Data | null>(null);
  const [copied, setCopied] = useState(false);
  const base = `/p/${project.id}`;

  useEffect(() => {
    const sb = supabase(); const pid = project.id;
    Promise.all([
      sb.from("events").select("*").eq("project_id", pid).order("starts_at"),
      sb.from("tasks").select("*").eq("project_id", pid),
      sb.from("fundraisers").select("*").eq("project_id", pid),
      sb.from("donations").select("*").eq("project_id", pid),
      sb.from("social_posts").select("*").eq("project_id", pid),
      sb.from("transactions").select("*").eq("project_id", pid),
      sb.from("social_accounts").select("id", { count: "exact", head: true }).eq("project_id", pid),
      hasModule(stack, "sponsors") ? sb.from("sponsor_leads").select("*").eq("project_id", pid) : Promise.resolve({ data: [] }),
      hasModule(stack, "shifts") ? sb.from("shifts").select("id,slots,shift_signups(id)").eq("project_id", pid).gte("ends_at", new Date().toISOString()) : Promise.resolve({ data: [] }),
      hasModule(stack, "partners") ? sb.from("partners").select("id,status").eq("project_id", pid) : Promise.resolve({ data: [] }),
      hasModule(stack, "partners") ? sb.from("beneficiaries").select("people_count,status").eq("project_id", pid) : Promise.resolve({ data: [] }),
    ]).then(([e, t, f, dn, p, tx, acc, sl, sh, pa, be]) => setD({
      events: (e.data as EventRow[]) || [], tasks: (t.data as Task[]) || [], fundraisers: (f.data as Fundraiser[]) || [],
      donations: (dn.data as Donation[]) || [], posts: (p.data as SocialPost[]) || [], tx: (tx.data as Transaction[]) || [], accounts: acc.count || 0, leads: (sl.data as SponsorLead[]) || [],
      shifts: (sh.data || []).length,
      openSpots: ((sh.data || []) as { slots: number; shift_signups: unknown[] }[]).reduce((n, x) => n + Math.max(0, x.slots - (x.shift_signups?.length || 0)), 0),
      partners: ((pa.data || []) as { status: string }[]).filter((x) => x.status === "active").length,
      served: ((be.data || []) as { people_count: number; status: string }[]).filter((x) => x.status !== "completed").reduce((n, x) => n + Number(x.people_count || 0), 0),
    }));
  }, [project.id, tick, stack]);

  async function loadDemo() {
    setSeeding(true);
    try { await seedDemo(project.id, stack, me?.id); await reloadMembers(); setTick((t) => t + 1); } catch (e) { alert((e as Error).message); }
    setSeeding(false);
  }

  const active = members.filter((m) => m.status === "active");
  const raised = d?.donations.reduce((n, x) => n + Number(x.amount), 0) || 0;
  const goal = d?.fundraisers.reduce((n, x) => n + Number(x.goal), 0) || 0;
  const doneTasks = d?.tasks.filter((t) => t.status === "done").length || 0;
  const upcoming = d?.events.filter((e) => (e.approval ?? "approved") === "approved" && e.starts_at && e.starts_at >= new Date().toISOString() && e.status !== "cancelled") || [];
  const balance = d?.tx.reduce((n, t) => n + (t.kind === "income" ? 1 : -1) * Number(t.amount), 0) || 0;

  const checklist = [
    { done: active.length > 1, label: "Invite your team", hint: `Share code ${project.join_code}`, href: hasModule(stack, "hr") ? `${base}/hr` : undefined },
    { done: (d?.events.length || 0) > 0, label: "Create your first event", hint: "Fundraiser, workshop, drive…", href: hasModule(stack, "events") ? `${base}/events` : undefined },
    { done: (d?.tasks.some((t) => t.assignee_member_id) ?? false), label: "Break it into tasks & assign owners", hint: "Try ✨ Plan with AI", href: hasModule(stack, "events") ? `${base}/events` : undefined },
    { done: (d?.fundraisers.length || 0) > 0, label: "Set a fundraising goal", hint: "Even $200 is a great start", href: hasModule(stack, "fundraising") && can(me, "fundraising", "view") ? `${base}/fundraising` : undefined },
    { done: (d?.accounts || 0) > 0, label: "Connect your socials", hint: "Get a daily AI digest", href: hasModule(stack, "publicity") ? `${base}/publicity` : undefined },
  ].filter((c) => c.href);
  const progress = checklist.length ? (checklist.filter((c) => c.done).length / checklist.length) * 100 : 100;

  const tiles = visibleModules(stack, me).map((s) => {
    const m = MODULE_MAP[s.id];
    let stat = "", sub = "";
    if (d) {
      if (s.id === "hr") { stat = `${active.length}`; sub = "active members"; }
      if (s.id === "events") { stat = `${upcoming.length}`; sub = `upcoming · ${doneTasks}/${d.tasks.length} tasks done`; }
      if (s.id === "fundraising") { stat = fmtMoney(raised); sub = goal ? `of ${fmtMoney(goal)} goal` : "raised"; }
      if (s.id === "publicity") { stat = `${d.posts.filter((p) => Date.now() - new Date(p.posted_at).getTime() < 7 * 864e5).length}`; sub = "posts this week"; }
      if (s.id === "finance") { stat = fmtMoney(balance); sub = "current balance"; }
      if (s.id === "shifts") { stat = `${d.shifts}`; sub = d.openSpots ? `upcoming · ${d.openSpots} open spots` : "upcoming shifts"; }
      if (s.id === "partners") { stat = `${d.partners}`; sub = hasSub(stack, "partners", "beneficiaries") && d.served ? `active partners · ${d.served} people served` : "active partners"; }
      if (s.id === "sponsors") {
        const won = d.leads.filter((l) => l.stage === "won");
        stat = won.length ? fmtMoney(won.reduce((n, l) => n + Number(l.amount_committed || 0), 0)) : `${d.leads.length}`;
        sub = won.length ? `committed · ${d.leads.length} sponsors tracked` : "sponsors tracked";
      }
    }
    return { s, m, stat, sub };
  });

  return (
    <div className="space-y-8">
      <PageHeader emoji={project.emoji || undefined} title={project.name} accent={welcome ? "is live!" : undefined} subtitle={project.tagline || project.description || undefined}
        actions={me?.role === "president" && d && d.events.length === 0 && active.length <= 1 ? <Button variant="ai" onClick={loadDemo} loading={seeding}><Wand2 className="size-4" /> Load demo data</Button> : undefined} />

      {(progress < 100 || welcome) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-accent/10 via-transparent to-violet/10 pointer-events-none" />
            <div className="relative grid md:grid-cols-[1fr_auto] gap-6">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="font-extrabold text-lg">{welcome ? "🎉 Welcome, founder! Here's your launch checklist" : "Getting started"}</div>
                  <span className="font-mono text-sm text-ink-3">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="mb-4" />
                <div className="grid sm:grid-cols-2 gap-2">
                  {checklist.map((c) => (
                    <Link key={c.label} href={c.href!} className={cx("flex items-center gap-3 rounded-xl px-3 py-2.5 border transition group", c.done ? "border-good/25 bg-good/[0.05]" : "border-line hover:border-line-2 hover:bg-panel")}>
                      <span className={cx("size-5 rounded-full grid place-items-center border", c.done ? "bg-good border-good" : "border-ink-3")}>{c.done && <Check className="size-3 text-[#0c2a1c]" />}</span>
                      <div className="flex-1 min-w-0">
                        <div className={cx("text-sm font-semibold", c.done && "line-through text-ink-3")}>{c.label}</div>
                        <div className="text-[11px] text-ink-3">{c.hint}</div>
                      </div>
                      {!c.done && <ArrowRight className="size-4 text-ink-3 group-hover:text-accent" />}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-black/30 border border-line p-5 text-center self-start">
                <div className="text-xs uppercase tracking-wider text-ink-3 font-bold">Invite code</div>
                <div className="font-mono text-4xl font-bold tracking-[0.25em] my-2 grad-text">{project.join_code}</div>
                <button onClick={() => { navigator.clipboard.writeText(project.join_code); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-xs text-ink-2 hover:text-ink inline-flex items-center gap-1">
                  {copied ? <><Check className="size-3" /> Copied</> : <><Copy className="size-3" /> Copy</>}
                </button>
                <div className="text-[11px] text-ink-3 mt-2 max-w-40">Teammates sign up, tap &ldquo;Join with code&rdquo;, and land here as Members.</div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {me && (me.role === "president" || me.role === "vice_president" || (me.role === "head" && me.department === "HR")) && (
        <JoinRequests projectId={project.id} onDecided={reloadMembers} />
      )}
      {d && hasModule(stack, "events") && <EventRequests events={d.events} members={members} me={me} canApprove={canApproveEvents(me)} projectId={project.id} onChanged={() => setTick((t) => t + 1)} compact />}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map(({ s, m, stat, sub }, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link href={`${base}/${s.id}`} className="block group h-full">
              <div className="h-full rounded-2xl p-5 relative overflow-hidden transition group-hover:-translate-y-0.5" style={{ background: m.color, color: m.ink }}>
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{m.emoji}</span>
                  <ArrowRight className="size-4 opacity-0 group-hover:opacity-100 transition" />
                </div>
                <div className="font-extrabold mt-3">{m.name}</div>
                {d ? <div className="font-mono text-3xl font-bold mt-1">{stat}</div> : <div className="h-9 mt-1 rounded bg-black/10 animate-pulse" />}
                <div className="text-xs font-semibold opacity-75">{sub}</div>
                {s.id === "fundraising" && goal > 0 && <Progress value={(raised / goal) * 100} color={m.ink} className="mt-3 !bg-black/10" height={6} />}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {me && (me.role === "president" || me.role === "vice_president") && <ListingCard project={project} onSaved={reload} />}
      {isPresident(me) && <ProjectSettings project={project} onSaved={reload} />}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <div className="font-bold mb-3">Upcoming events</div>
          {!d ? <div className="skeleton h-20" /> : upcoming.length === 0 ? <div className="text-sm text-ink-3">No upcoming events yet.</div> : (
            <ul className="space-y-3">
              {upcoming.slice(0, 5).map((e) => {
                const ts = d.tasks.filter((t) => t.event_id === e.id);
                const pct = ts.length ? (ts.filter((t) => t.status === "done").length / ts.length) * 100 : 0;
                return (
                  <li key={e.id}>
                    <Link href={`${base}/events/${e.id}`} className="block hover:bg-panel rounded-xl p-2 -m-2">
                      <div className="flex justify-between text-sm"><span className="font-semibold">{e.name}</span><span className="text-ink-3">{fmtDate(e.starts_at)}</span></div>
                      <Progress value={pct} height={5} className="mt-1.5" color="#ffd88a" />
                      <div className="text-[11px] text-ink-3 mt-1">{Math.round(pct)}% prepared · {ts.length} tasks</div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <div className="font-bold mb-3 flex justify-between">Team <span className="text-xs text-ink-3 font-normal">your role: {me ? roleLabel(me) : "—"}</span></div>
          <ul className="space-y-2">
            {active.sort((a, b) => (ROLE_MAP[b.role]?.rank || 0) - (ROLE_MAP[a.role]?.rank || 0)).slice(0, 8).map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar name={m.full_name} size={30} />
                <div className="flex-1 min-w-0 text-sm font-medium truncate">{m.full_name}{!m.user_id && <span className="text-ink-3 text-xs"> · invited</span>}</div>
                <Badge color={ROLE_MAP[m.role]?.color}>{roleLabel(m)}</Badge>
              </li>
            ))}
          </ul>
          {active.length <= 1 && <div className="mt-4"><Tip>Projects with 3+ committed members are far more likely to last. Share your invite code in your group chat!</Tip></div>}
        </Card>
      </div>
    </div>
  );
}
