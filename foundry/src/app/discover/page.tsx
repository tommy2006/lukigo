"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Sparkles, MapPin, Users, X, Check, ArrowRight, Clock } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { askAI } from "@/lib/ai/client";
import { MODULE_MAP } from "@/lib/modules";
import { PORTAL_ROLES } from "@/lib/roles";
import { CAUSES, CAUSE_LABEL, hasOpenRole, keywordSearch, roleStatus } from "@/lib/portal";
import type { JoinRequest, ListedProject, PortalRole } from "@/lib/types";
import { AIBox, Badge, Button, Card, Empty, Field, Modal, Select, Textarea, Tip, cx } from "@/components/ui";
import { Logo } from "@/components/logo";

export default function DiscoverPage() {
  return <Suspense><Discover /></Suspense>;
}

interface AIResult { query: string; summary: string; matches: { id: string; reason: string }[]; _source?: string }

function Discover() {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<ListedProject[] | null>(null);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [q, setQ] = useState("");
  const [cause, setCause] = useState("");
  const [role, setRole] = useState<PortalRole | "">("");
  const [openOnly, setOpenOnly] = useState(false);
  const [ai, setAi] = useState<AIResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [open, setOpen] = useState<ListedProject | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const sb = supabase();
    const { data: { user } } = await sb.auth.getUser();
    setUser(user);
    const { data, error } = await sb.rpc("discover_projects");
    if (error) { setErr(error.message); setProjects([]); return; }
    setProjects((data as ListedProject[]) || []);
    if (user) {
      const [m, r] = await Promise.all([
        sb.from("project_members").select("project_id").eq("user_id", user.id).eq("status", "active"),
        sb.from("join_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setMine(new Set(((m.data as { project_id: string }[]) || []).map((x) => x.project_id)));
      setRequests((r.data as JoinRequest[]) || []);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // deep link ?p=<id> (e.g. after signing in)
  useEffect(() => {
    const id = params.get("p");
    if (id && projects) setOpen(projects.find((p) => p.id === id) || null);
  }, [params, projects]);

  const filtered = useMemo(() => (projects || []).filter((p) =>
    (!cause || p.cause === cause) && (!role || hasOpenRole(p, role)) && (!openOnly || hasOpenRole(p))), [projects, cause, role, openOnly]);

  const results = useMemo(() => {
    if (ai && ai.query === q) {
      const byId = new Map(filtered.map((p) => [p.id, p]));
      return ai.matches.filter((m) => byId.has(m.id)).map((m) => ({ p: byId.get(m.id)!, reason: m.reason }));
    }
    return keywordSearch(filtered, q).map(({ p }) => ({ p, reason: "" }));
  }, [filtered, q, ai]);

  async function aiSearch() {
    if (!q.trim() || !filtered.length) return;
    setAiLoading(true);
    try {
      const r = await askAI<Omit<AIResult, "query">>("discover_search", {
        query: q,
        projects: filtered.slice(0, 60).map((p) => ({
          id: p.id, name: p.name, tagline: p.tagline, cause: p.cause, location: p.location, skills: p.skills,
          open_roles: roleStatus(p).filter((r) => !r.full).map((r) => r.k), looking_for: p.looking_for?.slice(0, 200), description: p.description?.slice(0, 300),
        })),
      });
      setAi({ ...r, query: q });
    } finally { setAiLoading(false); }
  }

  const pendingFor = (pid: string) => requests.find((r) => r.project_id === pid && r.status === "pending");

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-line">
        <Link href={user ? "/home" : "/"}><Logo /></Link>
        <div className="flex items-center gap-2">
          {user ? <Button variant="outline" size="sm" onClick={() => router.push("/home")}>My projects</Button>
            : <Button size="sm" onClick={() => router.push("/login?next=/discover")}>Sign in</Button>}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 md:px-10 py-10">
        <div className="text-ink-3 text-sm font-semibold uppercase tracking-wider">Project Portal</div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mt-1">
          Find a project <span className="serif italic font-normal grad-text">worth your Saturdays.</span>
        </h1>
        <p className="text-ink-2 mt-3 max-w-2xl">Student-led community projects looking for members, volunteers, donors and mentors. Search by cause, skill, place — or just describe what you want to do.</p>

        <div className="mt-7 flex flex-col md:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && aiSearch()}
              placeholder='Try "teach kids coding on weekends" or "environment Da Nang"'
              className="w-full h-12 rounded-xl bg-white/[0.04] border border-line pl-10 pr-4 text-[15px] outline-none focus:border-accent/60" />
          </div>
          <Button variant="ai" size="lg" onClick={aiSearch} loading={aiLoading} disabled={!q.trim()}><Sparkles className="size-4" /> Ask AI</Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={() => setCause("")} className={cx("rounded-full px-3 py-1 text-xs font-semibold border", !cause ? "border-accent/60 bg-accent/10 text-ink" : "border-line text-ink-3 hover:text-ink")}>All causes</button>
          {CAUSES.map((c) => (
            <button key={c} onClick={() => setCause(cause === c ? "" : c)} className={cx("rounded-full px-3 py-1 text-xs font-semibold border", cause === c ? "border-accent/60 bg-accent/10 text-ink" : "border-line text-ink-3 hover:text-ink")}>{CAUSE_LABEL[c]}</button>
          ))}
          <span className="mx-1 h-5 w-px bg-line" />
          <Select value={role} onChange={(e) => setRole(e.target.value as PortalRole | "")} className="!w-auto !py-1 !text-xs !rounded-full">
            <option value="">Any role</option>
            {PORTAL_ROLES.map((r) => <option key={r.k} value={r.k}>{r.label}</option>)}
          </Select>
          <label className="flex items-center gap-1.5 text-xs text-ink-2 cursor-pointer">
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="accent-[var(--accent)]" /> Open spots only
          </label>
        </div>

        {ai && ai.query === q && (
          <div className="mt-5">
            <AIBox title="AI matches" source={ai._source} action={<button onClick={() => setAi(null)} className="text-xs text-ink-3 hover:text-ink inline-flex items-center gap-1"><X className="size-3" /> Clear</button>}>{ai.summary}</AIBox>
          </div>
        )}

        <div className="mt-6">
          {projects === null ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-56" />)}</div>
          ) : err ? (
            <Empty emoji="🛠️" title="The portal isn't set up yet">Run <code className="font-mono">supabase/patch-002-sponsors-portal.sql</code> in Supabase. ({err})</Empty>
          ) : results.length === 0 ? (
            <Empty emoji="🔭" title={projects.length ? "No projects match" : "No listed projects yet"}>
              {projects.length ? "Try fewer words, another cause, or turn off filters." : "Founders can list their project from its Overview page → “List on the Project Portal”."}
            </Empty>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map(({ p, reason }, i) => (
                <motion.button key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}
                  onClick={() => setOpen(p)} className="text-left">
                  <Card className="h-full hover:border-line-2 transition relative overflow-hidden group">
                    <div className="absolute -right-10 -top-10 size-32 rounded-full blur-2xl opacity-25" style={{ background: p.color || "#ff9a76" }} />
                    <div className="flex items-start justify-between">
                      <span className="text-3xl">{p.emoji}</span>
                      {mine.has(p.id) ? <Badge color="#7ee0b0"><Check className="size-3" /> Joined</Badge>
                        : pendingFor(p.id) ? <Badge color="#ffd166"><Clock className="size-3" /> Requested</Badge>
                        : p.cause && <Badge>{CAUSE_LABEL[p.cause] || p.cause}</Badge>}
                    </div>
                    <div className="font-extrabold text-lg mt-3 group-hover:text-accent transition">{p.name}</div>
                    {p.tagline && <div className="text-sm text-ink-2 line-clamp-2">{p.tagline}</div>}
                    {reason && <div className="text-[13px] text-violet mt-2 flex gap-1.5"><Sparkles className="size-3.5 shrink-0 mt-0.5" />{reason}</div>}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3 mt-3">
                      {p.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{p.location}</span>}
                      <span className="inline-flex items-center gap-1"><Users className="size-3" />{p.member_count} member{p.member_count === 1 ? "" : "s"}</span>
                    </div>
                    {p.skills?.length > 0 && <div className="flex flex-wrap gap-1 mt-3">{p.skills.slice(0, 5).map((s) => <span key={s} className="text-[11px] rounded-md bg-panel-2 px-2 py-0.5 text-ink-2">{s}</span>)}</div>}
                    <div className="flex flex-wrap gap-1 mt-3">
                      {roleStatus(p).map((r) => (
                        <span key={r.k} className={cx("text-[11px] font-semibold rounded-full px-2 py-0.5 border", r.full ? "border-line text-ink-3 line-through" : "border-good/30 text-good")}>
                          {PORTAL_ROLES.find((x) => x.k === r.k)?.label}
                        </span>
                      ))}
                    </div>
                  </Card>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ProjectModal project={open} user={user} member={!!open && mine.has(open.id)} pending={open ? pendingFor(open.id) : undefined}
        onClose={() => { setOpen(null); if (params.get("p")) router.replace("/discover"); }} onChanged={load} />
    </div>
  );
}

function ProjectModal({ project: p, user, member, pending, onClose, onChanged }: {
  project: ListedProject | null; user: User | null; member: boolean; pending?: JoinRequest; onClose: () => void; onChanged: () => void;
}) {
  const router = useRouter();
  const [role, setRole] = useState<PortalRole>("member");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const roles = p ? roleStatus(p) : [];

  useEffect(() => { setErr(""); setMsg(""); const first = roles.find((r) => !r.full); if (first) setRole(first.k); }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function request() {
    if (!p || !user) return;
    setBusy(true); setErr("");
    const { error } = await supabase().from("join_requests").insert({ project_id: p.id, user_id: user.id, role, message: msg || null });
    setBusy(false);
    if (error) { setErr(error.message.includes("duplicate") ? "You already have a pending request here." : error.message); return; }
    onChanged();
  }
  async function withdraw() {
    if (!pending) return;
    setBusy(true);
    await supabase().from("join_requests").update({ status: "withdrawn" }).eq("id", pending.id);
    setBusy(false); onChanged();
  }

  return (
    <Modal open={!!p} onClose={onClose} title={p ? `${p.emoji} ${p.name}` : ""} wide>
      {p && (
        <div className="space-y-5">
          <div>
            {p.tagline && <div className="text-ink font-semibold">{p.tagline}</div>}
            {p.description && <p className="text-sm text-ink-2 mt-1.5 whitespace-pre-line">{p.description}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3 mt-3">
              {p.cause && <span>{CAUSE_LABEL[p.cause] || p.cause}</span>}
              {p.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{p.location}</span>}
              <span className="inline-flex items-center gap-1"><Users className="size-3" />{p.member_count} members</span>
            </div>
          </div>
          {p.looking_for && <Card className="!p-4"><div className="text-[12px] uppercase tracking-wider text-ink-3 font-bold mb-1">What we&apos;re looking for</div><div className="text-sm whitespace-pre-line">{p.looking_for}</div></Card>}
          {p.skills?.length > 0 && <div className="flex flex-wrap gap-1.5">{p.skills.map((s) => <span key={s} className="text-xs rounded-md bg-panel-2 px-2 py-1 text-ink-2">{s}</span>)}</div>}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-ink-3 mr-1">Runs on Lukigo with</span>
            {(p.modules?.stack || []).map((s) => MODULE_MAP[s.id] && <span key={s.id} title={MODULE_MAP[s.id].name} className="size-6 rounded-md grid place-items-center text-xs" style={{ background: MODULE_MAP[s.id].color }}>{MODULE_MAP[s.id].emoji}</span>)}
          </div>

          <div className="border-t border-line pt-5">
            {member ? (
              <Button className="w-full" onClick={() => router.push(`/p/${p.id}`)}>Open workspace <ArrowRight className="size-4" /></Button>
            ) : pending ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-warn/30 bg-warn/[0.07] px-4 py-3">
                <div className="text-sm"><b>Request sent</b> as {PORTAL_ROLES.find((r) => r.k === pending.role)?.label}. The project&apos;s leaders will review it — you&apos;ll see it on your home page once accepted.</div>
                <Button variant="ghost" size="sm" onClick={withdraw} loading={busy}>Withdraw</Button>
              </div>
            ) : !user ? (
              <div className="text-center space-y-3">
                <div className="text-sm text-ink-2">Sign in (it&apos;s free) to ask to join this project.</div>
                <Button className="w-full" onClick={() => router.push(`/login?mode=signup&next=${encodeURIComponent(`/discover?p=${p.id}`)}`)}>Sign up to join</Button>
              </div>
            ) : roles.every((r) => r.full) ? (
              <div className="text-sm text-ink-3 text-center">All roles are full right now — check back later.</div>
            ) : (
              <div className="space-y-4">
                <div className="font-bold">How do you want to help?</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {roles.map((r) => {
                    const def = PORTAL_ROLES.find((x) => x.k === r.k)!;
                    return (
                      <button key={r.k} disabled={r.full} onClick={() => setRole(r.k)}
                        className={cx("text-left rounded-xl border px-3 py-2.5 transition disabled:opacity-40", role === r.k ? "border-accent bg-accent/10" : "border-line hover:border-line-2")}>
                        <div className="text-sm font-semibold flex items-center justify-between">{def.label}
                          <span className="text-[11px] font-mono text-ink-3">{r.slots ? `${r.count}/${r.slots}` : r.count ? `${r.count} joined` : ""}</span></div>
                        <div className="text-[11.5px] text-ink-3 leading-snug mt-0.5">{def.blurb}</div>
                      </button>
                    );
                  })}
                </div>
                <Field label="Message to the team" hint="optional">
                  <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Say hi — your grade, what you're good at, why this project." className="min-h-20" />
                </Field>
                {err && <div className="text-sm text-bad">{err}</div>}
                <Button className="w-full" size="lg" onClick={request} loading={busy}>Send join request</Button>
                <Tip title="What happens next">The project&apos;s president, VP or Head of HR reviews your request. Members and contributors get access to the team workspace; volunteers, donors and partners are added to the roster.</Tip>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
