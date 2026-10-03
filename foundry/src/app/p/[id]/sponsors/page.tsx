"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Sparkles, ExternalLink, X, Check, Link2, CalendarClock, Lock } from "lucide-react";
import { useProject } from "@/components/project-context";
import { ModuleGate } from "@/components/module-gate";
import { supabase } from "@/lib/supabase";
import { askAI } from "@/lib/ai/client";
import { activeLinks, hasSub } from "@/lib/modules";
import { can } from "@/lib/roles";
import type { SponsorBrief, SponsorLead } from "@/lib/types";
import type { SponsorCandidate, SponsorProjectInfo } from "@/lib/ai/tasks/modules";
import { SPONSOR_TYPES } from "@/lib/ai/tasks/modules";
import { AIBox, Avatar, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Progress, Select, Stat, Textarea, Tip, cx, fmtDate, fmtMoney, todayISO } from "@/components/ui";
import { LeadModal } from "@/components/modules/sponsors/lead-modal";
import { CONF_COLOR, NEEDS, STAGES, STAGE_MAP } from "@/components/modules/sponsors/stages";

export default function SponsorsPage() {
  return <ModuleGate id="sponsors"><Sponsors /></ModuleGate>;
}

type Patch = Partial<SponsorLead>;

function Sponsors() {
  const { project, stack, me, members, reload } = useProject();
  const sub = (s: string) => hasSub(stack, "sponsors", s);
  const links = activeLinks(stack);
  const linked = (to: string) => links.some((l) => l.from === "sponsors" && l.to === to);
  const hrLinked = links.some((l) => l.from === "hr" && l.to === "sponsors");
  const canEdit = can(me, "sponsors", "edit");
  const canManage = can(me, "sponsors", "manage");
  const canBrief = me?.role === "president" || me?.role === "vice_president";

  const [leads, setLeads] = useState<SponsorLead[] | null>(null);
  const [open, setOpen] = useState<SponsorLead | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase().from("sponsor_leads").select("*").eq("project_id", project.id).order("updated_at", { ascending: false });
    setLeads((data as SponsorLead[]) || []);
  }, [project.id]);
  useEffect(() => { load(); }, [load]);

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2800); };

  const info: SponsorProjectInfo = {
    name: project.name, tagline: project.tagline, description: project.description, cause: project.cause, location: project.location,
    brief: project.sponsor_brief || {},
  };

  const logEntry = (text: string) => ({ t: Date.now(), by: me?.full_name || null, text });

  async function save(l: SponsorLead, p: Patch, logText?: string) {
    const patch: Patch = { ...p, updated_at: new Date().toISOString(), ...(logText ? { log: [...(l.log || []), logEntry(logText)] } : {}) };
    setLeads((ls) => ls?.map((x) => (x.id === l.id ? { ...x, ...patch } : x)) || null);
    await supabase().from("sponsor_leads").update(patch).eq("id", l.id);
  }

  async function setStage(l: SponsorLead, stage: SponsorLead["stage"]) {
    if (l.stage === stage) return;
    let committed = l.amount_committed;
    if (stage === "won" && !committed) {
      const v = prompt(`🎉 ${l.name} said yes! How much did they commit? (number, 0 for in-kind)`, String(l.amount_asked || ""));
      if (v === null) return;
      committed = Number(v) || 0;
    }
    await save(l, { stage, amount_committed: committed }, `Moved to ${STAGE_MAP[stage].label}`);
    if (stage === "won" && l.stage !== "won" && committed) {
      const sb = supabase();
      const done: string[] = [];
      if (linked("finance")) {
        await sb.from("transactions").insert({ project_id: project.id, kind: "income", category: "sponsorship", amount: committed, description: `Sponsorship — ${l.name}` });
        done.push("Finance ledger");
      }
      if (linked("fundraising")) {
        await sb.from("donations").insert({ project_id: project.id, donor_name: l.name, amount: committed, source: "sponsor", message: "Committed via Sponsor Finder" });
        done.push("Fundraising totals");
      }
      flash(`🎉 ${fmtMoney(committed)} from ${l.name}${done.length ? ` — added to ${done.join(" & ")}` : ""}`);
    }
  }

  async function remove(l: SponsorLead) {
    if (!confirm(`Delete ${l.name}?`)) return;
    await supabase().from("sponsor_leads").delete().eq("id", l.id);
    setOpen(null); load();
  }

  async function addLead(fields: Patch, logText: string) {
    const { error } = await supabase().from("sponsor_leads").insert({ project_id: project.id, stage: "idea", ...fields, log: [logEntry(logText)] });
    if (error) { flash(error.message); return false; }
    await load(); return true;
  }

  const ls = leads || [];
  const committed = ls.filter((l) => l.stage === "won");
  const decided = ls.filter((l) => l.stage === "won" || l.stage === "declined").length;
  const stats = {
    total: ls.length,
    contacted: ls.filter((l) => ["contacted", "talking", "won", "declined"].includes(l.stage)).length,
    talking: ls.filter((l) => l.stage === "talking").length,
    won: committed.reduce((n, l) => n + Number(l.amount_committed || 0), 0),
    rate: decided ? Math.round((committed.length / decided) * 100) : null,
  };

  return (
    <div className="space-y-6">
      <PageHeader emoji="🤝" title="Sponsor" accent="Finder"
        subtitle="Find real foundations, companies and grant programs that fit your project — then track every conversation until they say yes."
        actions={canEdit ? <Button variant="outline" onClick={() => setAddOpen(true)}><Plus className="size-4" /> Add sponsor</Button> : undefined} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Tracked" value={stats.total} />
        <Stat label="Contacted" value={stats.contacted} />
        <Stat label="In talks" value={stats.talking} color="#c3b5ff" />
        <Stat label="Committed" value={fmtMoney(stats.won)} color="#7ee0a8" sub={`${committed.length} sponsor${committed.length === 1 ? "" : "s"}`} />
        <Stat label="Win rate" value={stats.rate === null ? "—" : `${stats.rate}%`} sub="of decided" />
      </div>

      {(linked("finance") || linked("fundraising")) && (
        <div className="rounded-xl border border-good/25 bg-good/[0.05] px-4 py-2.5 text-sm flex items-center gap-2">
          <Link2 className="size-4 text-good shrink-0" />
          <span>Linked: when a sponsor moves to <b>Committed</b>, the amount is added to {[linked("fundraising") && "your Fundraising totals", linked("finance") && "the Finance ledger as income"].filter(Boolean).join(" and ")} automatically.</span>
        </div>
      )}

      {sub("brief") && <BriefPanel brief={project.sponsor_brief || {}} projectId={project.id} editable={canBrief} onSaved={reload} />}
      {sub("ai_finder") && <Finder info={info} exclude={ls.map((l) => l.name)} canEdit={canEdit} briefEmpty={!Object.values(project.sponsor_brief || {}).some((v) => (Array.isArray(v) ? v.length : v))}
        onAdd={(c) => addLead({ name: c.name, type: c.type, country: c.country, focus: c.focus, fit: c.fit, approach: c.approach, typical_amount: c.typicalAmount, cycle: c.cycle, website: c.website || null, fit_score: c.fitScore, confidence: c.confidence, source: "ai", next_step: c.approach }, "Added from AI suggestions")} />}

      {sub("pipeline") && (
        <Card className="!p-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="font-extrabold">Outreach board</div>
            <div className="text-xs text-ink-3">{canEdit ? "Drag cards between columns · click to open" : <span className="inline-flex items-center gap-1"><Lock className="size-3" /> View only</span>}</div>
          </div>
          {leads === null ? <div className="skeleton h-48" /> : (
            <div className="grid grid-flow-col auto-cols-[minmax(210px,1fr)] gap-3 overflow-x-auto pb-2">
              {STAGES.map((st) => <Column key={st.id} stage={st} leads={ls.filter((l) => l.stage === st.id)} members={members} hrLinked={hrLinked}
                canEdit={canEdit} onDrop={(id) => { const l = ls.find((x) => x.id === id); if (l) setStage(l, st.id); }} onOpen={setOpen} />)}
            </div>
          )}
          {leads?.length === 0 && <div className="mt-3"><Tip title="Start here">Fill in your brief, then hit <b>✨ Find sponsors</b> — or add a local business you already know with <b>Add sponsor</b>.</Tip></div>}
        </Card>
      )}

      {sub("deadlines") && <Deadlines leads={ls} onOpen={setOpen} />}

      <LeadModal lead={open} onClose={() => setOpen(null)} members={members} hrLinked={hrLinked} lettersOn={sub("letters")} canManage={canManage}
        project={info} onSave={async (l, p, t) => { await save(l, p, t); }} onStage={async (l, s) => { await setStage(l, s); setOpen(null); }} onDelete={remove} />
      <AddModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={async (f) => { if (await addLead(f, "Added manually")) setAddOpen(false); }} />

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed bottom-6 right-6 z-50 rounded-xl bg-[#16121f] border border-good/40 px-4 py-3 text-sm shadow-2xl">{toast}</motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- Brief ---------------- */
function BriefPanel({ brief, projectId, editable, onSaved }: { brief: SponsorBrief; projectId: string; editable: boolean; onSaved: () => void }) {
  const [b, setB] = useState<SponsorBrief>(brief);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const fields: (keyof SponsorBrief)[] = ["org_type", "region", "beneficiaries", "budget", "needs", "achievements", "timeline"];
  const filled = fields.filter((f) => { const v = b[f]; return Array.isArray(v) ? v.length : v; }).length;
  const pct = Math.round((filled / fields.length) * 100);
  const set = (k: keyof SponsorBrief, v: string | string[]) => setB({ ...b, [k]: v });

  async function save() {
    setSaving(true);
    await supabase().from("projects").update({ sponsor_brief: b }).eq("id", projectId);
    setSaving(false); setOpen(false); onSaved();
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="font-extrabold">Sponsorship brief</div>
          <div className="text-sm text-ink-2">The one-pager sponsors (and the AI) read. {pct < 100 ? "The more specific, the better the matches." : "Looking complete — nice."}</div>
          <div className="flex items-center gap-3 mt-2 max-w-sm"><Progress value={pct} height={6} color="#ffb3d1" /><span className="font-mono text-xs text-ink-3">{pct}%</span></div>
        </div>
        <Button variant={pct < 50 ? "primary" : "outline"} size="sm" onClick={() => setOpen(!open)}>{open ? "Close" : editable ? "Edit brief" : "View brief"}</Button>
      </div>
      {open && (
        <div className="mt-5 grid md:grid-cols-2 gap-4">
          <Field label="Who you are"><Select value={b.org_type || ""} disabled={!editable} onChange={(e) => set("org_type", e.target.value)}>
            <option value="">— Choose —</option>{["High-school student group", "University student club", "Student research team", "Nonprofit organization", "Volunteer / community group"].map((o) => <option key={o}>{o}</option>)}
          </Select></Field>
          <Field label="Where to look for sponsors" hint="country / city / global"><Input value={b.region || ""} disabled={!editable} onChange={(e) => set("region", e.target.value)} placeholder="e.g. Vietnam + international" /></Field>
          <Field label="Who benefits"><Input value={b.beneficiaries || ""} disabled={!editable} onChange={(e) => set("beneficiaries", e.target.value)} placeholder="e.g. 120 middle-schoolers in 3 rural schools" /></Field>
          <Field label="Budget"><Input value={b.budget || ""} disabled={!editable} onChange={(e) => set("budget", e.target.value)} placeholder="e.g. $2,500 for 6 months" /></Field>
          <div className="md:col-span-2">
            <Field label="What you need">
              <div className="flex flex-wrap gap-2">{NEEDS.map((n) => {
                const on = (b.needs || []).includes(n);
                return <button key={n} disabled={!editable} onClick={() => set("needs", on ? (b.needs || []).filter((x) => x !== n) : [...(b.needs || []), n])}
                  className={cx("rounded-xl px-3 py-1.5 text-sm border transition", on ? "border-[#ffb3d1] bg-[#ffb3d1]/15 text-ink" : "border-line text-ink-2 hover:border-line-2")}>{on && <Check className="inline size-3.5 mr-1" />}{n}</button>;
              })}</div>
            </Field>
          </div>
          <Field label="Achievements so far"><Textarea value={b.achievements || ""} disabled={!editable} onChange={(e) => set("achievements", e.target.value)} className="min-h-20" placeholder="Numbers! e.g. 3 workshops, 54 kids taught, $985 raised" /></Field>
          <Field label="Timeline"><Textarea value={b.timeline || ""} disabled={!editable} onChange={(e) => set("timeline", e.target.value)} className="min-h-20" placeholder="e.g. Jan–Jun 2027, monthly workshops" /></Field>
          {editable ? <div className="md:col-span-2"><Button onClick={save} loading={saving}>Save brief</Button></div>
            : <div className="md:col-span-2 text-xs text-ink-3 flex items-center gap-1"><Lock className="size-3" /> Only the president or VP can edit the brief.</div>}
        </div>
      )}
    </Card>
  );
}

/* ---------------- AI finder ---------------- */
function Finder({ info, exclude, canEdit, briefEmpty, onAdd }: { info: SponsorProjectInfo; exclude: string[]; canEdit: boolean; briefEmpty: boolean; onAdd: (c: SponsorCandidate) => Promise<boolean> }) {
  const [extra, setExtra] = useState("");
  const [items, setItems] = useState<SponsorCandidate[] | null>(null);
  const [source, setSource] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());

  async function find() {
    setLoading(true);
    try {
      const r = await askAI<{ items: SponsorCandidate[] }>("sponsor_find", { project: info, extra: extra || undefined, exclude });
      setItems((r.items || []).slice(0, 8)); setSource(r._source);
    } finally { setLoading(false); }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-64">
          <div className="font-extrabold flex items-center gap-2"><Sparkles className="size-4 text-violet" /> Find sponsors with AI</div>
          <div className="text-sm text-ink-2 mb-2">Real foundations, company programs and grants that fund projects like yours.</div>
          <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Optional: e.g. focus on tech companies, or only grants under $5,000" />
        </div>
        <Button variant="ai" onClick={find} loading={loading}><Sparkles className="size-4" /> {items ? "Find more" : "Find sponsors"}</Button>
      </div>
      {briefEmpty && !items && <div className="mt-3"><Tip>Fill in the sponsorship brief above first — AI matches get much better with your budget, needs and region.</Tip></div>}
      {loading && <div className="grid md:grid-cols-2 gap-3 mt-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-36" />)}</div>}
      {items && !loading && (
        <div className="mt-4 space-y-3">
          {source === "fallback" && <div className="text-xs text-ink-3">Offline mode: showing well-known youth & community funders. Connect the AI for tailored matches.</div>}
          <div className="grid md:grid-cols-2 gap-3">
            {items.map((c) => (
              <motion.div key={c.name} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-line p-4 bg-white/[0.02]">
                <div className="flex items-start gap-3">
                  <ScoreRing value={c.fitScore} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold leading-tight">{c.name}</div>
                    <div className="text-xs text-ink-3 mt-0.5">{[c.type, c.country].filter(Boolean).join(" · ")}</div>
                  </div>
                  <Badge color={CONF_COLOR[c.confidence] || "#a1a1aa"}>{c.confidence}</Badge>
                </div>
                {c.fit && <p className="text-sm text-ink-2 mt-2">{c.fit}</p>}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3 mt-2">
                  {c.typicalAmount && <span>💰 {c.typicalAmount}</span>}
                  {c.cycle && <span>🗓 {c.cycle}</span>}
                  {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-accent inline-flex items-center gap-1 hover:underline"><ExternalLink className="size-3" />website</a>}
                </div>
                <div className="flex gap-2 mt-3">
                  {added.has(c.name) ? <Badge color="#7ee0a8"><Check className="size-3" /> On your board</Badge> : canEdit && (
                    <Button size="sm" onClick={async () => { if (await onAdd(c)) setAdded(new Set(added).add(c.name)); }}><Plus className="size-3.5" /> Add to board</Button>
                  )}
                  {!added.has(c.name) && <Button size="sm" variant="ghost" onClick={() => setItems(items.filter((x) => x.name !== c.name))}><X className="size-3.5" /> Dismiss</Button>}
                </div>
              </motion.div>
            ))}
          </div>
          <div className="text-[11px] text-ink-3">Always double-check eligibility and deadlines on the sponsor&apos;s official website before applying.</div>
        </div>
      )}
    </Card>
  );
}

function ScoreRing({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const c = 2 * Math.PI * 16;
  const color = v >= 75 ? "#7ee0a8" : v >= 50 ? "#ffd88a" : "#ff9a76";
  return (
    <div className="relative size-11 shrink-0">
      <svg viewBox="0 0 40 40" className="size-11 -rotate-90"><circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle cx="20" cy="20" r="16" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} /></svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-[11px] font-bold">{v}</span>
    </div>
  );
}

/* ---------------- Board ---------------- */
function Column({ stage, leads, members, hrLinked, canEdit, onDrop, onOpen }: {
  stage: (typeof STAGES)[number]; leads: SponsorLead[]; members: { id: string; full_name: string }[]; hrLinked: boolean; canEdit: boolean;
  onDrop: (id: string) => void; onOpen: (l: SponsorLead) => void;
}) {
  const [over, setOver] = useState(false);
  const total = leads.reduce((n, l) => n + Number((stage.id === "won" ? l.amount_committed : l.amount_asked) || 0), 0);
  return (
    <div onDragOver={(e) => { if (canEdit) { e.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData("text/lead"); if (id) onDrop(id); }}
      className={cx("rounded-xl p-2 min-h-48 transition border", over ? "border-accent/60 bg-accent/[0.06]" : "border-transparent bg-white/[0.02]")}>
      <div className="flex items-center justify-between px-1.5 pb-2">
        <div className="text-[13px] font-bold flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: stage.color }} />{stage.label}<span className="text-ink-3 font-mono text-xs">{leads.length}</span></div>
        {total > 0 && <span className="text-[11px] font-mono text-ink-3">{fmtMoney(total)}</span>}
      </div>
      <div className="space-y-2">
        {leads.map((l) => {
          const a = members.find((m) => m.id === l.assignee_member_id);
          const late = l.deadline && l.deadline < todayISO() && !["won", "declined"].includes(l.stage);
          return (
            <motion.div layout key={l.id} draggable={canEdit} onDragStart={(e) => (e as unknown as React.DragEvent).dataTransfer.setData("text/lead", l.id)}
              onClick={() => onOpen(l)}
              className="rounded-lg bg-[#1a1625] border border-line hover:border-line-2 p-2.5 cursor-pointer active:cursor-grabbing">
              <div className="text-sm font-semibold leading-snug">{l.name}</div>
              <div className="text-[11px] text-ink-3 mt-0.5">{[l.type, l.country].filter(Boolean).join(" · ")}</div>
              <div className="flex items-center justify-between mt-2">
                <div className="text-[11px] font-mono">
                  {l.stage === "won" && l.amount_committed ? <span className="text-good">{fmtMoney(l.amount_committed)}</span>
                    : l.amount_asked ? <span className="text-ink-2">ask {fmtMoney(l.amount_asked)}</span> : l.source === "ai" ? <span className="text-violet">✨ AI pick</span> : null}
                </div>
                <div className="flex items-center gap-1.5">
                  {l.deadline && <span className={cx("text-[10px]", late ? "text-bad font-bold" : "text-ink-3")}>{fmtDate(l.deadline)}</span>}
                  {hrLinked && a && <Avatar name={a.full_name} size={18} />}
                </div>
              </div>
            </motion.div>
          );
        })}
        {leads.length === 0 && <div className="text-[11px] text-ink-3 text-center py-4">{stage.hint}</div>}
      </div>
    </div>
  );
}

/* ---------------- Deadlines ---------------- */
function Deadlines({ leads, onOpen }: { leads: SponsorLead[]; onOpen: (l: SponsorLead) => void }) {
  const items = useMemo(() => leads.filter((l) => l.deadline && !["won", "declined"].includes(l.stage)).sort((a, b) => a.deadline!.localeCompare(b.deadline!)), [leads]);
  const today = todayISO();
  return (
    <Card>
      <div className="font-extrabold flex items-center gap-2 mb-3"><CalendarClock className="size-4 text-warn" /> Deadlines & follow-ups</div>
      {items.length === 0 ? <div className="text-sm text-ink-3">No deadlines yet — open a sponsor and set an application deadline or follow-up date.</div> : (
        <ul className="divide-y divide-line">
          {items.map((l) => {
            const late = l.deadline! < today;
            const days = Math.round((new Date(l.deadline! + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 864e5);
            return (
              <li key={l.id}><button onClick={() => onOpen(l)} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-panel rounded-lg px-2">
                <span className={cx("w-20 text-xs font-mono", late ? "text-bad font-bold" : days <= 7 ? "text-warn" : "text-ink-3")}>{late ? `${-days}d late` : days === 0 ? "today" : `in ${days}d`}</span>
                <span className="flex-1 min-w-0"><span className="text-sm font-semibold">{l.name}</span>{l.next_step && <span className="text-xs text-ink-3"> — {l.next_step}</span>}</span>
                <Badge color={STAGE_MAP[l.stage].color}>{STAGE_MAP[l.stage].label}</Badge>
              </button></li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ---------------- Add manually ---------------- */
function AddModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (f: Patch) => Promise<void> }) {
  const [f, setF] = useState<Patch>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF({}); }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Add a sponsor">
      <div className="space-y-3">
        <Field label="Name"><Input value={f.name || ""} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Joe's Pizza, Rotary Club of Da Nang" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><Select value={f.type || ""} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="">—</option>{SPONSOR_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="Country / city"><Input value={f.country || ""} onChange={(e) => setF({ ...f, country: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact name"><Input value={f.contact_name || ""} onChange={(e) => setF({ ...f, contact_name: e.target.value })} /></Field>
          <Field label="Amount to ask ($)"><Input type="number" value={f.amount_asked ?? ""} onChange={(e) => setF({ ...f, amount_asked: e.target.value ? Number(e.target.value) : null })} /></Field>
        </div>
        <Field label="Website"><Input value={f.website || ""} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://" /></Field>
        <Button className="w-full" disabled={!f.name?.trim()} loading={busy} onClick={async () => { setBusy(true); await onAdd(f); setBusy(false); }}>Add to board</Button>
      </div>
    </Modal>
  );
}

export const _unusedAIBox = AIBox; // keep import tree-shake friendly
