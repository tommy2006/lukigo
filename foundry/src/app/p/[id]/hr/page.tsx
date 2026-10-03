"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Clock, Mail, Pencil, Phone, Plus, Search, Trash2, UserPlus, X, Minus } from "lucide-react";
import { ModuleGate } from "@/components/module-gate";
import { useProject } from "@/components/project-context";
import { supabase } from "@/lib/supabase";
import { MODULES, hasSub } from "@/lib/modules";
import { DEPARTMENTS, ROLES, ROLE_MAP, can, roleLabel, type Action } from "@/lib/roles";
import { DEPARTMENT_FOR_MODULE } from "@/lib/roles";
import type { Member, Role } from "@/lib/types";
import { Avatar, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Progress, Select, Stat, Textarea, Tip, cx } from "@/components/ui";
import { NoPerm } from "@/components/modules/shared";

const STAGES = [
  { id: "interested", label: "Interested", color: "#9ad8ff" },
  { id: "interview", label: "Interviewing", color: "#ffd88a" },
  { id: "accepted", label: "Accepted", color: "#7ee0a8" },
];
const stageOf = (m: Member) => (m.notes?.match(/^stage:(\w+)/)?.[1] ?? null);
const isApplicant = (m: Member) => m.status === "inactive" && !!stageOf(m);
const stripStage = (n: string | null) => (n || "").replace(/^stage:\w+\n?/, "");

export default function HRPage() {
  return <ModuleGate id="hr"><HR /></ModuleGate>;
}

function HR() {
  const { project, stack, me, members, reloadMembers } = useProject();
  const canManage = can(me, "hr", "manage");
  const sub = (s: string) => hasSub(stack, "hr", s);
  const [modal, setModal] = useState<{ m: Member | null; selfOnly?: boolean; applicant?: boolean } | null>(null);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState<"active" | "inactive" | "alumni" | "all">("active");

  const roster = members.filter((m) => !isApplicant(m));
  const applicants = members.filter(isApplicant);
  const shown = roster
    .filter((m) => statusF === "all" || m.status === statusF)
    .filter((m) => !q || `${m.full_name} ${m.email} ${m.department} ${m.title} ${m.school}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (ROLE_MAP[b.role]?.rank ?? 0) - (ROLE_MAP[a.role]?.rank ?? 0) || a.full_name.localeCompare(b.full_name));

  async function remove(m: Member) {
    if (!confirm(`Remove ${m.full_name} from ${project.name}?`)) return;
    const { error } = await supabase().from("project_members").delete().eq("id", m.id);
    if (error) alert(error.message);
    reloadMembers();
  }

  const active = roster.filter((m) => m.status === "active");
  const totalHours = roster.reduce((n, m) => n + Number(m.hours || 0), 0);

  return (
    <div>
      <PageHeader emoji="🧑‍🤝‍🧑" title="People &" accent="HR"
        subtitle="Your team directory: who's here, what they do, and what they're allowed to change."
        actions={canManage ? <Button onClick={() => setModal({ m: null })}><UserPlus className="size-4" />Add member</Button> : undefined}
      />
      {!canManage && <div className="mb-4"><NoPerm>Only the president, VP or Head of HR can edit the roster. You can update your own contact info.</NoPerm></div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Active members" value={active.length} />
        <Stat label="Departments" value={new Set(active.map((m) => m.department).filter(Boolean)).size} />
        <Stat label="Not signed up yet" value={active.filter((m) => !m.user_id).length} sub="invited by email" />
        {sub("volunteer_hours") ? <Stat label="Service hours" value={totalHours.toLocaleString()} color="var(--good)" /> : <Stat label="Leaders" value={active.filter((m) => m.role !== "member").length} />}
      </div>

      {active.length <= 1 && (
        <div className="mb-6"><Tip title="Grow your team">Share your invite code <span className="font-mono text-ink">{project.join_code}</span> with friends, or add them here by email — when they sign up with that email they&apos;ll be linked automatically. Give each person a role so they see the right things.</Tip></div>
      )}

      <div className="space-y-8">
        {sub("roster") && (
          <section>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <h2 className="text-lg font-bold mr-auto">Roster</h2>
              <div className="relative"><Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" /><Input className="pl-9 h-9 py-0 w-56" placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <div className="flex rounded-xl border border-line p-0.5">
                {(["active", "inactive", "alumni", "all"] as const).map((s) => (
                  <button key={s} onClick={() => setStatusF(s)} className={cx("px-2.5 h-8 rounded-lg text-[13px] capitalize", statusF === s ? "bg-panel-2 text-ink" : "text-ink-3")}>{s}</button>
                ))}
              </div>
            </div>
            {shown.length === 0 ? <Empty emoji="👥" title="Nobody here">{q ? "No one matches that search." : "No members with this status."}</Empty> : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {shown.map((m, i) => {
                  const isMe = m.id === me?.id;
                  const role = ROLE_MAP[m.role] || ROLE_MAP.member;
                  return (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                      <Card className="p-4 h-full group">
                        <div className="flex items-start gap-3">
                          <Avatar name={m.full_name} size={42} />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold truncate">{m.full_name} {isMe && <span className="text-xs text-ink-3 font-normal">(you)</span>}</div>
                            <div className="text-sm text-ink-2 truncate">{roleLabel(m)}</div>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              <Badge color={role.color}>{role.label}</Badge>
                              {m.department && <Badge>{m.department}</Badge>}
                              {m.status !== "active" && <Badge color="#a1a1aa">{m.status}</Badge>}
                              {!m.user_id && <Badge color="#ffd88a">invited</Badge>}
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                            {(canManage || isMe) && <button onClick={() => setModal({ m, selfOnly: !canManage })} className="text-ink-3 hover:text-ink"><Pencil className="size-3.5" /></button>}
                            {canManage && !isMe && m.role !== "president" && <button onClick={() => remove(m)} className="text-ink-3 hover:text-bad"><Trash2 className="size-3.5" /></button>}
                          </div>
                        </div>
                        <div className="mt-3 space-y-1 text-xs text-ink-3">
                          {m.email && <div className="flex items-center gap-1.5 truncate"><Mail className="size-3" />{m.email}</div>}
                          {m.phone && <div className="flex items-center gap-1.5"><Phone className="size-3" />{m.phone}</div>}
                          {(m.school || m.grade) && <div>🎓 {[m.school, m.grade && `Grade ${m.grade}`].filter(Boolean).join(" · ")}</div>}
                          {sub("volunteer_hours") && <div className="flex items-center gap-1.5"><Clock className="size-3" /><span className="font-mono text-ink-2">{Number(m.hours || 0)}</span> service hours</div>}
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {sub("org_chart") && <OrgChart members={active} />}
        {sub("volunteer_hours") && <Hours members={active} canManage={canManage} reload={reloadMembers} />}
        {sub("recruitment") && <Recruitment applicants={applicants} canManage={canManage} reload={reloadMembers} onAdd={() => setModal({ m: null, applicant: true })} onEdit={(m) => setModal({ m, applicant: true })} />}
        {sub("roles") && <RolesMatrix />}
        {sub("availability") && (
          <Card>
            <h2 className="text-lg font-bold mb-1">Availability <span className="serif italic grad-text font-normal">& scheduling</span></h2>
            <p className="text-sm text-ink-2 mb-3">Coming soon: everyone marks when they&apos;re free, and Lukigo suggests event times the most people can staff.</p>
            <Tip>For now, ask your team to share free periods in your group chat, and note them in each member&apos;s profile notes.</Tip>
          </Card>
        )}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.applicant ? (modal.m ? "Edit applicant" : "New applicant") : modal?.m ? (modal.selfOnly ? "Update your info" : `Edit ${modal.m.full_name}`) : "Add a member"} wide>
        {modal && <MemberForm projectId={project.id} m={modal.m} selfOnly={modal.selfOnly} applicant={modal.applicant} onDone={() => { setModal(null); reloadMembers(); }} />}
      </Modal>
    </div>
  );
}

function MemberForm({ projectId, m, selfOnly, applicant, onDone }: { projectId: string; m: Member | null; selfOnly?: boolean; applicant?: boolean; onDone: () => void }) {
  const [v, setV] = useState({
    full_name: m?.full_name || "", email: m?.email || "", phone: m?.phone || "", school: m?.school || "", grade: m?.grade || "",
    role: (m?.role || "member") as Role, department: m?.department || "", title: m?.title || "", status: m?.status || "active",
    hours: String(m?.hours ?? 0), notes: stripStage(m?.notes ?? null), stage: (m && stageOf(m)) || "interested",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!v.full_name.trim()) return setErr("Name is required.");
    setSaving(true); setErr("");
    const contact = { email: v.email.trim() || null, phone: v.phone || null, school: v.school || null, grade: v.grade || null };
    const row = selfOnly ? { ...contact, full_name: v.full_name.trim() } : applicant ? {
      ...contact, full_name: v.full_name.trim(), status: "inactive", role: "member" as Role, department: v.department || null, notes: `stage:${v.stage}\n${v.notes}`.trim(),
    } : {
      ...contact, full_name: v.full_name.trim(), role: v.role, department: v.department || null, title: v.title || null, status: v.status, hours: Number(v.hours) || 0, notes: v.notes || null,
    };
    const { error } = m
      ? await supabase().from("project_members").update(row).eq("id", m.id)
      : await supabase().from("project_members").insert({ project_id: projectId, ...row });
    setSaving(false);
    if (error) return setErr(error.message.includes("row-level") ? "You don't have permission to do that." : error.message);
    onDone();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Full name"><Input autoFocus value={v.full_name} onChange={set("full_name")} placeholder="Alex Rivera" /></Field>
        <Field label="Email" hint={m ? undefined : "auto-links when they sign up"}><Input type="email" value={v.email} onChange={set("email")} placeholder="alex@school.edu" /></Field>
        <Field label="Phone"><Input value={v.phone} onChange={set("phone")} placeholder="(555) 123-4567" /></Field>
        <div className="grid grid-cols-[1fr_80px] gap-2">
          <Field label="School"><Input value={v.school} onChange={set("school")} /></Field>
          <Field label="Grade"><Input value={v.grade} onChange={set("grade")} placeholder="11" /></Field>
        </div>
      </div>
      {!selfOnly && !applicant && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Role">
              <Select value={v.role} onChange={set("role")}>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</Select>
            </Field>
            <Field label="Department">
              <Select value={v.department} onChange={set("department")}><option value="">—</option>{DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}</Select>
            </Field>
            <Field label="Status">
              <Select value={v.status} onChange={set("status")}><option value="active">Active</option><option value="inactive">Inactive</option><option value="alumni">Alumni</option></Select>
            </Field>
          </div>
          <div className="text-xs text-ink-3 -mt-2">{ROLE_MAP[v.role]?.summary}{v.role === "head" && !v.department && " Pick a department so they can manage that module."}</div>
          <div className="grid sm:grid-cols-[1fr_120px] gap-3">
            <Field label="Display title" hint="optional"><Input value={v.title} onChange={set("title")} placeholder={v.role === "head" && v.department ? `Head of ${v.department}` : "e.g. Social Media Lead"} /></Field>
            <Field label="Hours"><Input type="number" min="0" value={v.hours} onChange={set("hours")} /></Field>
          </div>
        </>
      )}
      {applicant && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Stage"><Select value={v.stage} onChange={set("stage")}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
          <Field label="Interested in"><Select value={v.department} onChange={set("department")}><option value="">—</option>{DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}</Select></Field>
        </div>
      )}
      {!selfOnly && <Field label="Notes"><Textarea className="min-h-16" value={v.notes} onChange={set("notes")} placeholder={applicant ? "Why they want to join, interview notes…" : "Free periods, skills, allergies…"} /></Field>}
      {err && <div className="text-bad text-sm">{err}</div>}
      <div className="flex justify-end"><Button type="submit" loading={saving}>{m ? "Save" : applicant ? "Add applicant" : "Add member"}</Button></div>
    </form>
  );
}

function Node({ m, big }: { m: Member; big?: boolean }) {
  return (
  <div className={cx("inline-flex items-center gap-2 rounded-xl border bg-panel px-3 py-2", big ? "border-line-2" : "border-line")} style={{ borderColor: (ROLE_MAP[m.role]?.color || "#888") + "66" }}>
    <Avatar name={m.full_name} size={big ? 32 : 24} />
    <div className="text-left"><div className={cx("font-semibold leading-tight", big ? "text-sm" : "text-xs")}>{m.full_name}</div><div className="text-[11px] text-ink-3 leading-tight">{roleLabel(m)}</div></div>
  </div>
);
}

function OrgChart({ members }: { members: Member[] }) {
  const top = members.filter((m) => m.role === "president");
  const officers = members.filter((m) => ["vice_president", "secretary", "treasurer"].includes(m.role));
  const depts = (() => {
    const d: Record<string, { heads: Member[]; members: Member[] }> = {};
    for (const m of members) {
      if (!["head", "member"].includes(m.role)) continue;
      const k = m.department || "General";
      d[k] ??= { heads: [], members: [] };
      (m.role === "head" ? d[k].heads : d[k].members).push(m);
    }
    return Object.entries(d).sort((a, b) => b[1].heads.length - a[1].heads.length);
  })();
  return (
    <Card>
      <h2 className="text-lg font-bold mb-5">Org <span className="serif italic grad-text font-normal">chart</span></h2>
      <div className="flex flex-col items-center gap-0 overflow-x-auto">
        <div className="flex gap-3 flex-wrap justify-center">{top.map((m) => <Node key={m.id} m={m} big />)}</div>
        {officers.length > 0 && <><div className="w-px h-6 bg-line-2" /><div className="flex gap-3 flex-wrap justify-center">{officers.map((m) => <Node key={m.id} m={m} big />)}</div></>}
        {depts.length > 0 && <div className="w-px h-6 bg-line-2" />}
        {depts.length > 0 && (
          <div className="flex gap-4 flex-wrap justify-center border-t border-line-2 pt-6">
            {depts.map(([d, g]) => (
              <div key={d} className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line p-3 min-w-44">
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-3">{d}</div>
                {g.heads.map((m) => <Node key={m.id} m={m} />)}
                {g.heads.length > 0 && g.members.length > 0 && <div className="w-px h-3 bg-line-2" />}
                <div className="flex flex-col gap-1.5 items-center">{g.members.map((m) => <Node key={m.id} m={m} />)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {depts.length === 0 && officers.length === 0 && <div className="mt-4"><Tip>Add members and give them roles & departments to grow your org chart.</Tip></div>}
    </Card>
  );
}

function Hours({ members, canManage, reload }: { members: Member[]; canManage: boolean; reload: () => Promise<void> }) {
  const sorted = [...members].sort((a, b) => Number(b.hours || 0) - Number(a.hours || 0));
  const max = Math.max(1, ...sorted.map((m) => Number(m.hours || 0)));
  async function bump(m: Member, n: number) {
    await supabase().from("project_members").update({ hours: Math.max(0, Number(m.hours || 0) + n) }).eq("id", m.id);
    reload();
  }
  return (
    <Card>
      <h2 className="text-lg font-bold mb-1">Volunteer <span className="serif italic grad-text font-normal">hours</span></h2>
      <p className="text-sm text-ink-3 mb-4">Service hours count for NHS, school requirements and the President&apos;s Volunteer Service Award — log them as you go.</p>
      <div className="space-y-2.5">
        {sorted.map((m, i) => (
          <div key={m.id} className="flex items-center gap-3">
            <span className="w-6 text-center text-sm">{i < 3 && Number(m.hours) > 0 ? ["🥇", "🥈", "🥉"][i] : <span className="font-mono text-xs text-ink-3">{i + 1}</span>}</span>
            <Avatar name={m.full_name} size={26} />
            <span className="w-36 truncate text-sm">{m.full_name}</span>
            <Progress value={(Number(m.hours || 0) / max) * 100} className="flex-1" color="var(--good)" />
            <span className="font-mono text-sm w-12 text-right">{Number(m.hours || 0)}h</span>
            {canManage && (
              <div className="flex gap-1">
                <button onClick={() => bump(m, -1)} className="size-6 rounded-md border border-line text-ink-3 hover:text-ink grid place-items-center"><Minus className="size-3" /></button>
                <button onClick={() => bump(m, 1)} className="size-6 rounded-md border border-line text-ink-3 hover:text-ink grid place-items-center"><Plus className="size-3" /></button>
              </div>
            )}
          </div>
        ))}
      </div>
      {!canManage && <div className="mt-3"><NoPerm>Ask the Head of HR to log your hours.</NoPerm></div>}
    </Card>
  );
}

function Recruitment({ applicants, canManage, reload, onAdd, onEdit }: { applicants: Member[]; canManage: boolean; reload: () => Promise<void>; onAdd: () => void; onEdit: (m: Member) => void }) {
  async function move(m: Member, stage: string) {
    await supabase().from("project_members").update({ notes: `stage:${stage}\n${stripStage(m.notes)}`.trim() }).eq("id", m.id);
    reload();
  }
  async function onboard(m: Member) {
    await supabase().from("project_members").update({ status: "active", notes: stripStage(m.notes) || null }).eq("id", m.id);
    reload();
  }
  async function reject(m: Member) {
    if (!confirm(`Remove applicant ${m.full_name}?`)) return;
    await supabase().from("project_members").delete().eq("id", m.id);
    reload();
  }
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Recruitment <span className="serif italic grad-text font-normal">pipeline</span></h2>
        {canManage && <Button size="sm" variant="outline" onClick={onAdd}><Plus className="size-4" />Add applicant</Button>}
      </div>
      {applicants.length === 0 && <div className="mb-4"><Tip>Post a sign-up form at school or on Instagram, then add interested students here. Move them along as you chat, and hit “Onboard” to make them members.</Tip></div>}
      <div className="grid md:grid-cols-3 gap-3">
        {STAGES.map((s, si) => {
          const col = applicants.filter((a) => stageOf(a) === s.id);
          return (
            <div key={s.id} className="rounded-xl bg-white/[0.02] border border-line p-3 min-h-32">
              <div className="flex items-center justify-between mb-2"><Badge color={s.color}>{s.label}</Badge><span className="font-mono text-xs text-ink-3">{col.length}</span></div>
              <div className="space-y-2">
                {col.map((a) => (
                  <div key={a.id} className="rounded-lg bg-panel border border-line p-2.5">
                    <div className="flex items-center gap-2"><Avatar name={a.full_name} size={22} /><span className="text-sm font-semibold flex-1 truncate">{a.full_name}</span>
                      {canManage && <button onClick={() => onEdit(a)} className="text-ink-3 hover:text-ink"><Pencil className="size-3" /></button>}</div>
                    {a.department && <div className="text-[11px] text-ink-3 mt-1">→ {a.department}</div>}
                    {canManage && (
                      <div className="flex gap-1 mt-2">
                        {si < STAGES.length - 1 && <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => move(a, STAGES[si + 1].id)}>Next →</Button>}
                        {s.id === "accepted" && <Button size="sm" className="h-6 px-2 text-xs" onClick={() => onboard(a)}><Check className="size-3" />Onboard</Button>}
                        <button onClick={() => reject(a)} className="ml-auto text-ink-3 hover:text-bad"><X className="size-3.5" /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function RolesMatrix() {
  const actions: Action[] = ["view", "edit", "manage"];
  return (
    <Card>
      <h2 className="text-lg font-bold mb-1">Roles <span className="serif italic grad-text font-normal">& privileges</span></h2>
      <p className="text-sm text-ink-3 mb-4">Every role sees a different slice of the app. Here&apos;s exactly who can do what.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-6">
        {ROLES.map((r) => (
          <div key={r.id} className="rounded-xl border border-line p-3">
            <Badge color={r.color}>{r.label}</Badge>
            <p className="text-xs text-ink-2 mt-2">{r.summary}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-ink-3">
              <th className="text-left font-semibold py-2 pr-3">Role</th>
              {MODULES.map((m) => <th key={m.id} className="font-semibold px-2 py-2 text-center" colSpan={3}>{m.emoji} {m.short}</th>)}
            </tr>
            <tr className="text-[10px] text-ink-3 uppercase">
              <th />
              {MODULES.flatMap((m) => actions.map((a) => <th key={m.id + a} className="px-1 pb-2 font-normal">{a[0]}</th>))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r) => {
              // heads shown for a sample department per module
              return (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-2 pr-3 whitespace-nowrap"><span className="font-semibold" style={{ color: r.color }}>{r.label}</span></td>
                  {MODULES.flatMap((m) => actions.map((a) => {
                    const own = r.id === "head" && can({ role: r.id, department: DEPARTMENT_FOR_MODULE[m.id] }, m.id, a);
                    const ok = can({ role: r.id, department: null }, m.id, a);
                    return (
                      <td key={m.id + a} className="text-center px-1">
                        {ok ? <span className="text-good">●</span> : own ? <span className="text-warn" title="Only the head of this department">◐</span> : <span className="text-ink-3/40">·</span>}
                      </td>
                    );
                  }))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[11px] text-ink-3 mt-3 flex flex-wrap gap-4">
        <span><span className="text-good">●</span> allowed</span>
        <span><span className="text-warn">◐</span> only if they head that department</span>
        <span>v = view · e = edit (add/update records) · m = manage (delete, settings, other people&apos;s things)</span>
      </div>
    </Card>
  );
}
