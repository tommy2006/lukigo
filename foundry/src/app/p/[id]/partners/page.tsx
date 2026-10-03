"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus, Mail, Phone, Globe, Sparkles, Copy, Users, HeartHandshake, ShieldCheck, MessageSquareQuote, CalendarClock, X } from "lucide-react";
import { useProject } from "@/components/project-context";
import { ModuleGate } from "@/components/module-gate";
import { supabase } from "@/lib/supabase";
import { askAI } from "@/lib/ai/client";
import { activeLinks, hasSub } from "@/lib/modules";
import { can } from "@/lib/roles";
import type { Beneficiary, EventRow, Partner } from "@/lib/types";
import { AIBox, Avatar, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Stat, Textarea, Tip, cx, fmtDate, todayISO } from "@/components/ui";

export default function PartnersPage() {
  return <ModuleGate id="partners"><Partners /></ModuleGate>;
}

const KINDS = [
  { k: "school", l: "School", e: "🏫" }, { k: "ngo", l: "NGO / charity", e: "💚" }, { k: "business", l: "Business", e: "🏪" },
  { k: "government", l: "Government / city", e: "🏛️" }, { k: "community", l: "Community group", e: "🏘️" }, { k: "media", l: "Media", e: "📰" }, { k: "other", l: "Other", e: "✨" },
];
const STATUS: Record<Partner["status"], { l: string; c: string }> = {
  prospect: { l: "Prospect", c: "#9ad8ff" }, active: { l: "Active", c: "#7ee0b0" }, paused: { l: "Paused", c: "#ffd166" }, ended: { l: "Ended", c: "#a1a1aa" },
};
const BKINDS = [{ k: "individual", l: "Individual" }, { k: "group", l: "Group / class" }, { k: "organization", l: "Organization" }, { k: "community", l: "Community" }];

function Partners() {
  const { project, stack, me, members } = useProject();
  const sub = (s: string) => hasSub(stack, "partners", s);
  const links = activeLinks(stack);
  const hrLinked = links.some((l) => l.from === "hr" && l.to === "partners");
  const eventsLinked = links.some((l) => l.from === "events" && l.to === "partners");
  const canEdit = can(me, "partners", "edit");
  const canManage = can(me, "partners", "manage");

  const [tab, setTab] = useState<"partners" | "beneficiaries">("partners");
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [bens, setBens] = useState<Beneficiary[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [editP, setEditP] = useState<Partial<Partner> | null>(null);
  const [editB, setEditB] = useState<Partial<Beneficiary> | null>(null);
  const [draftFor, setDraftFor] = useState<Partner | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const sb = supabase();
    const [p, b, e] = await Promise.all([
      sb.from("partners").select("*").eq("project_id", project.id).order("created_at", { ascending: false }),
      sb.from("beneficiaries").select("*").eq("project_id", project.id).order("created_at", { ascending: false }),
      sb.from("events").select("id,name,starts_at").eq("project_id", project.id).order("starts_at", { ascending: false }),
    ]);
    if (p.error) setErr(p.error.message.includes("partners") ? "Run supabase/patch-003-shifts-partners-sync.sql in Supabase first." : p.error.message);
    setPartners((p.data as Partner[]) || []); setBens((b.data as Beneficiary[]) || []); setEvents((e.data as EventRow[]) || []);
  }, [project.id]);
  useEffect(() => { load(); }, [load]);

  const logEntry = (text: string, event?: string | null) => ({ t: Date.now(), by: me?.full_name || null, text, event: event || null });

  async function savePartner(v: Partial<Partner>) {
    const row = { ...v, project_id: project.id };
    delete (row as Partial<Partner>).id;
    const { error } = v.id ? await supabase().from("partners").update(row).eq("id", v.id)
      : await supabase().from("partners").insert({ ...row, log: [logEntry("Partner added")] });
    if (error) { setErr(error.message); return; }
    setEditP(null); load();
  }
  async function addLog(p: Partner, text: string, event?: string | null) {
    await supabase().from("partners").update({ log: [...(p.log || []), logEntry(text, event)] }).eq("id", p.id); load();
  }
  async function delPartner(p: Partner) { if (!confirm(`Remove ${p.name}?`)) return; await supabase().from("partners").delete().eq("id", p.id); setEditP(null); load(); }

  async function saveBen(v: Partial<Beneficiary>) {
    const row = { ...v, project_id: project.id };
    delete (row as Partial<Beneficiary>).id;
    const { error } = v.id ? await supabase().from("beneficiaries").update(row).eq("id", v.id) : await supabase().from("beneficiaries").insert(row);
    if (error) { setErr(error.message); return; }
    setEditB(null); load();
  }
  async function addFeedback(b: Beneficiary, text: string, rating?: number) {
    await supabase().from("beneficiaries").update({ feedback: [...(b.feedback || []), { t: Date.now(), by: me?.full_name || null, text, rating }], last_contact: todayISO() }).eq("id", b.id);
    load();
  }
  async function delBen(b: Beneficiary) { if (!confirm(`Remove ${b.name}?`)) return; await supabase().from("beneficiaries").delete().eq("id", b.id); setEditB(null); load(); }

  const ps = partners || [];
  const today = todayISO();
  const served = bens.filter((b) => b.status !== "completed").reduce((n, b) => n + Number(b.people_count || 0), 0);
  const dueContact = bens.filter((b) => b.next_contact && b.next_contact <= today && b.status === "active");
  const expiring = ps.filter((p) => p.agreement_end && p.agreement_end >= today && p.agreement_end <= new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10));

  return (
    <div className="space-y-6">
      <PageHeader emoji="🏫" title="Partners" accent={sub("beneficiaries") ? "& Beneficiaries" : undefined}
        subtitle={sub("beneficiaries") ? "The organizations you work with, and the people you serve — with who-talks-to-whom and what everyone needs." : "The schools, NGOs, businesses and groups you work with — and what each side gives and gets."}
        actions={canEdit ? (tab === "partners"
          ? <Button onClick={() => setEditP({ kind: "ngo", status: "prospect" })}><Plus className="size-4" /> Add partner</Button>
          : <Button onClick={() => setEditB({ kind: "group", people_count: 1, status: "active", consent: false })}><Plus className="size-4" /> Add beneficiary</Button>) : undefined} />
      {err && <div className="text-sm text-bad bg-bad/10 border border-bad/25 rounded-lg px-3 py-2 flex justify-between">{err}<button onClick={() => setErr("")}><X className="size-4" /></button></div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Active partners" value={ps.filter((p) => p.status === "active").length} sub={`${ps.length} total`} />
        <Stat label="Prospects" value={ps.filter((p) => p.status === "prospect").length} color="#9ad8ff" />
        {sub("beneficiaries") ? <>
          <Stat label="People served" value={served} color="#f0c4ff" sub={`${bens.length} beneficiar${bens.length === 1 ? "y" : "ies"}`} />
          <Stat label="Check-ins due" value={dueContact.length} color={dueContact.length ? "#ffd166" : undefined} />
        </> : <>
          <Stat label="Agreements ending ≤30d" value={expiring.length} color={expiring.length ? "#ffd166" : undefined} />
          <Stat label="Logged activities" value={ps.reduce((n, p) => n + (p.log?.length || 0), 0)} />
        </>}
      </div>

      {sub("beneficiaries") && (
        <div className="flex gap-1 p-1 rounded-xl bg-panel w-fit">
          {(["partners", "beneficiaries"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cx("px-4 py-1.5 rounded-lg text-sm font-semibold capitalize", tab === t ? "bg-panel-2 text-ink" : "text-ink-3 hover:text-ink")}>
              {t === "partners" ? <><HeartHandshake className="inline size-4 mr-1.5" />Partners</> : <><Users className="inline size-4 mr-1.5" />Beneficiaries</>}
            </button>
          ))}
        </div>
      )}

      {tab === "partners" && (
        partners === null ? <div className="skeleton h-40" /> : ps.length === 0 ? (
          <Empty emoji="🤝" title="No partners yet" action={canEdit ? <Button onClick={() => setEditP({ kind: "school", status: "prospect" })}><Plus className="size-4" /> Add your first partner</Button> : undefined}>
            Partners are organizations you work <i>with</i> (not just money): your school, the library that lends you a room, the shelter you deliver to, a local business that prints your flyers.
          </Empty>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {ps.map((p) => {
              const k = KINDS.find((x) => x.k === p.kind) || KINDS[6];
              const owner = members.find((m) => m.id === p.owner_member_id);
              return (
                <Card key={p.id} className="!p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{k.e}</span>
                    <div className="flex-1 min-w-0">
                      <button onClick={() => canEdit && setEditP(p)} className="font-bold text-left hover:text-accent">{p.name}</button>
                      <div className="text-xs text-ink-3">{k.l}{p.contact_name ? ` · ${p.contact_name}` : ""}</div>
                    </div>
                    <Badge color={STATUS[p.status]?.c}>{STATUS[p.status]?.l}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-ink-3">
                    {p.contact_email && <a href={`mailto:${p.contact_email}`} className="inline-flex items-center gap-1 hover:text-ink"><Mail className="size-3" />{p.contact_email}</a>}
                    {p.contact_phone && <span className="inline-flex items-center gap-1"><Phone className="size-3" />{p.contact_phone}</span>}
                    {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-ink"><Globe className="size-3" />website</a>}
                  </div>
                  {sub("agreements") && (p.gives || p.gets) && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-panel p-2"><div className="text-ink-3 font-semibold mb-0.5">They give</div>{p.gives || "—"}</div>
                      <div className="rounded-lg bg-panel p-2"><div className="text-ink-3 font-semibold mb-0.5">We give</div>{p.gets || "—"}</div>
                    </div>
                  )}
                  {sub("agreements") && (p.agreement_start || p.agreement_end) && (
                    <div className={cx("text-xs", p.agreement_end && p.agreement_end < today ? "text-bad" : "text-ink-3")}>
                      <CalendarClock className="inline size-3 mr-1" />Agreement {fmtDate(p.agreement_start)} → {fmtDate(p.agreement_end)}
                    </div>
                  )}
                  {hrLinked && owner && <div className="text-xs text-ink-3 flex items-center gap-1.5">Point person <Avatar name={owner.full_name} size={18} /> {owner.full_name}</div>}
                  {sub("activity") && <ActivityLog p={p} canEdit={canEdit} events={eventsLinked ? events : []} onAdd={(t, e) => addLog(p, t, e)} />}
                  {sub("ai_drafts") && canEdit && <Button size="sm" variant="ai" onClick={() => setDraftFor(p)}><Sparkles className="size-3.5" /> Write to them</Button>}
                </Card>
              );
            })}
          </div>
        )
      )}

      {tab === "beneficiaries" && sub("beneficiaries") && (
        <div className="space-y-4">
          <Tip title="Privacy & respect">Only store what you need. Get consent before saving contact details or taking photos, and never store details about minors without a parent/guardian&apos;s OK. Prefer groups (&ldquo;Grade 6 class at Lincoln Middle&rdquo;) over individuals when you can.</Tip>
          {dueContact.length > 0 && (
            <Card className="!p-4 border-warn/30"><div className="text-sm font-semibold mb-2">Time to check in</div>
              <div className="flex flex-wrap gap-2">{dueContact.map((b) => <button key={b.id} onClick={() => setEditB(b)} className="text-xs rounded-full border border-warn/40 text-warn px-2.5 py-1">{b.name} · due {fmtDate(b.next_contact)}</button>)}</div>
            </Card>
          )}
          {bens.length === 0 ? (
            <Empty emoji="🫶" title="No beneficiaries yet" action={canEdit ? <Button onClick={() => setEditB({ kind: "group", people_count: 10, status: "active", consent: false })}><Plus className="size-4" /> Add who you serve</Button> : undefined}>
              Beneficiaries are the people your project directly helps — a class you tutor, families who receive food packs, a shelter&apos;s residents. Track their needs and feedback so your help actually fits.
            </Empty>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {bens.map((b) => {
                const via = ps.find((p) => p.id === b.partner_id);
                const avg = b.feedback?.filter((f) => f.rating).reduce((n, f, _, a) => n + (f.rating || 0) / a.length, 0);
                return (
                  <Card key={b.id} className="!p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <button onClick={() => canEdit && setEditB(b)} className="font-bold text-left hover:text-accent">{b.name}</button>
                        <div className="text-xs text-ink-3">{BKINDS.find((k) => k.k === b.kind)?.l} · {b.people_count} {b.people_count === 1 ? "person" : "people"}{b.location ? ` · ${b.location}` : ""}</div>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        {b.consent ? <span title="Consent recorded"><ShieldCheck className="size-4 text-good" /></span> : <span className="text-[10px] text-warn">no consent</span>}
                        <Badge color={b.status === "active" ? "#7ee0b0" : b.status === "paused" ? "#ffd166" : "#a1a1aa"}>{b.status}</Badge>
                      </div>
                    </div>
                    {b.needs && <div className="text-sm"><span className="text-ink-3">Needs: </span>{b.needs}</div>}
                    {via && <div className="text-xs text-ink-3">Reached via 🤝 {via.name}</div>}
                    <div className="text-xs text-ink-3">Last contact {fmtDate(b.last_contact)} · next {b.next_contact ? <span className={b.next_contact <= today ? "text-warn" : ""}>{fmtDate(b.next_contact)}</span> : "—"}{avg ? ` · ★ ${avg.toFixed(1)}` : ""}</div>
                    {b.feedback?.length > 0 && <div className="text-sm italic text-ink-2 border-l-2 border-[#f0c4ff]/50 pl-2">&ldquo;{b.feedback[b.feedback.length - 1].text}&rdquo;</div>}
                    {canEdit && <FeedbackBox onAdd={(t, r) => addFeedback(b, t, r)} />}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!sub("beneficiaries") && canManage && <div className="text-xs text-ink-3">Serving specific people or groups? Turn on <b>Beneficiary management</b> in Edit modules → Partners. Pure awareness / social-media campaigns can leave it off.</div>}

      <PartnerModal v={editP} onClose={() => setEditP(null)} onSave={savePartner} onDelete={canManage ? delPartner : undefined} members={hrLinked ? members.filter((m) => m.status === "active") : []} agreements={sub("agreements")} />
      <BenModal v={editB} onClose={() => setEditB(null)} onSave={saveBen} onDelete={canManage ? delBen : undefined} partners={ps} />
      <DraftModal p={draftFor} onClose={() => setDraftFor(null)} project={project} />
    </div>
  );
}

function ActivityLog({ p, canEdit, events, onAdd }: { p: Partner; canEdit: boolean; events: EventRow[]; onAdd: (t: string, e?: string | null) => void }) {
  const [t, setT] = useState("");
  const [ev, setEv] = useState("");
  const log = [...(p.log || [])].reverse().slice(0, 3);
  return (
    <div className="border-t border-line pt-2.5">
      <ul className="space-y-1 mb-2">
        {log.map((l, i) => <li key={i} className="text-xs text-ink-2"><span className="text-ink-3">{fmtDate(new Date(l.t).toISOString())}</span> · {l.text}{l.event ? <span className="text-ink-3"> · 🎪 {l.event}</span> : ""}</li>)}
      </ul>
      {canEdit && (
        <form onSubmit={(e) => { e.preventDefault(); if (t.trim()) { onAdd(t.trim(), ev || null); setT(""); setEv(""); } }} className="flex gap-1.5">
          <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Log a meeting, delivery, help…" className="flex-1 min-w-0 rounded-lg bg-white/[0.04] border border-line px-2.5 py-1.5 text-xs outline-none focus:border-accent/60" />
          {events.length > 0 && <select value={ev} onChange={(e) => setEv(e.target.value)} className="rounded-lg bg-white/[0.04] border border-line px-1.5 text-xs max-w-28"><option value="">event…</option>{events.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}</select>}
          <Button size="sm" variant="outline" disabled={!t.trim()}>Log</Button>
        </form>
      )}
    </div>
  );
}

function FeedbackBox({ onAdd }: { onAdd: (t: string, r?: number) => void }) {
  const [t, setT] = useState("");
  const [r, setR] = useState(0);
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (t.trim()) { onAdd(t.trim(), r || undefined); setT(""); setR(0); } }} className="flex gap-1.5 items-center border-t border-line pt-2.5">
      <MessageSquareQuote className="size-4 text-ink-3 shrink-0" />
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Record feedback or a check-in…" className="flex-1 min-w-0 rounded-lg bg-white/[0.04] border border-line px-2.5 py-1.5 text-xs outline-none focus:border-accent/60" />
      <span className="flex">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} onClick={() => setR(n === r ? 0 : n)} className={cx("text-sm", n <= r ? "text-warn" : "text-ink-3")}>★</button>)}</span>
      <Button size="sm" variant="outline" disabled={!t.trim()}>Save</Button>
    </form>
  );
}

function PartnerModal({ v, onClose, onSave, onDelete, members, agreements }: { v: Partial<Partner> | null; onClose: () => void; onSave: (v: Partial<Partner>) => Promise<void>; onDelete?: (p: Partner) => void; members: { id: string; full_name: string }[]; agreements: boolean }) {
  const [f, setF] = useState<Partial<Partner>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (v) setF(v); }, [v]);
  const set = (k: keyof Partner) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value || null });
  return (
    <Modal open={!!v} onClose={onClose} title={v?.id ? `Edit ${v.name}` : "Add a partner"} wide>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Organization"><Input autoFocus value={f.name || ""} onChange={set("name")} placeholder="e.g. Da Nang Public Library" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Type"><Select value={f.kind || "ngo"} onChange={set("kind")}>{KINDS.map((k) => <option key={k.k} value={k.k}>{k.e} {k.l}</option>)}</Select></Field>
          <Field label="Status"><Select value={f.status || "prospect"} onChange={set("status")}>{Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.l}</option>)}</Select></Field>
        </div>
        <Field label="Contact person"><Input value={f.contact_name || ""} onChange={set("contact_name")} /></Field>
        <Field label="Email"><Input type="email" value={f.contact_email || ""} onChange={set("contact_email")} /></Field>
        <Field label="Phone"><Input value={f.contact_phone || ""} onChange={set("contact_phone")} /></Field>
        <Field label="Website"><Input value={f.website || ""} onChange={set("website")} placeholder="https://" /></Field>
        {agreements && <>
          <Field label="What they give us"><Textarea value={f.gives || ""} onChange={set("gives")} className="min-h-16" placeholder="Room every Saturday, 2 mentors…" /></Field>
          <Field label="What we give them"><Textarea value={f.gets || ""} onChange={set("gets")} className="min-h-16" placeholder="Free tutoring for their students, logo on posters…" /></Field>
          <Field label="Agreement start"><Input type="date" value={f.agreement_start || ""} onChange={set("agreement_start")} /></Field>
          <Field label="Agreement end"><Input type="date" value={f.agreement_end || ""} onChange={set("agreement_end")} /></Field>
        </>}
        {members.length > 0 && <Field label="Point person"><Select value={f.owner_member_id || ""} onChange={set("owner_member_id")}><option value="">— nobody —</option>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</Select></Field>}
        <Field label="Notes"><Textarea value={f.notes || ""} onChange={set("notes")} className="min-h-16" /></Field>
      </div>
      <div className="flex justify-between mt-5">
        {v?.id && onDelete ? <Button variant="danger" onClick={() => onDelete(v as Partner)}>Remove</Button> : <span />}
        <Button disabled={!f.name?.trim()} loading={busy} onClick={async () => { setBusy(true); await onSave({ ...f, name: f.name!.trim() }); setBusy(false); }}>Save</Button>
      </div>
    </Modal>
  );
}

function BenModal({ v, onClose, onSave, onDelete, partners }: { v: Partial<Beneficiary> | null; onClose: () => void; onSave: (v: Partial<Beneficiary>) => Promise<void>; onDelete?: (b: Beneficiary) => void; partners: Partner[] }) {
  const [f, setF] = useState<Partial<Beneficiary>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (v) setF(v); }, [v]);
  const set = (k: keyof Beneficiary) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value || null });
  return (
    <Modal open={!!v} onClose={onClose} title={v?.id ? `Edit ${v.name}` : "Add who you serve"} wide>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Name" hint="person, class, family group, shelter…"><Input autoFocus value={f.name || ""} onChange={set("name")} placeholder="e.g. Grade 6 coding class, Hoa Khanh school" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Type"><Select value={f.kind || "group"} onChange={set("kind")}>{BKINDS.map((k) => <option key={k.k} value={k.k}>{k.l}</option>)}</Select></Field>
          <Field label="# people"><Input type="number" min={1} value={f.people_count ?? 1} onChange={(e) => setF({ ...f, people_count: Math.max(1, Number(e.target.value) || 1) })} /></Field>
        </div>
        <Field label="Location"><Input value={f.location || ""} onChange={set("location")} /></Field>
        <Field label="Reached through partner"><Select value={f.partner_id || ""} onChange={set("partner_id")}><option value="">— none —</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Contact person" hint="adult contact if minors"><Input value={f.contact_name || ""} onChange={set("contact_name")} /></Field>
        <Field label="Contact info"><Input value={f.contact_info || ""} onChange={set("contact_info")} /></Field>
        <div className="sm:col-span-2"><Field label="What they need from us"><Textarea value={f.needs || ""} onChange={set("needs")} className="min-h-16" placeholder="e.g. Weekly 1h coding lesson, laptops, snacks" /></Field></div>
        <Field label="Next check-in"><Input type="date" value={f.next_contact || ""} onChange={set("next_contact")} /></Field>
        <Field label="Status"><Select value={f.status || "active"} onChange={set("status")}><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></Select></Field>
        <label className="sm:col-span-2 flex items-start gap-2 text-sm rounded-xl border border-line p-3 cursor-pointer">
          <input type="checkbox" checked={!!f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} className="mt-0.5 accent-[var(--accent)]" />
          <span><b>Consent recorded</b> — they (or a parent/guardian for minors) agreed to us keeping these details{f.kind === "individual" ? " and any photos" : ""}.</span>
        </label>
        <div className="sm:col-span-2"><Field label="Notes"><Textarea value={f.notes || ""} onChange={set("notes")} className="min-h-16" /></Field></div>
      </div>
      <div className="flex justify-between mt-5">
        {v?.id && onDelete ? <Button variant="danger" onClick={() => onDelete(v as Beneficiary)}>Remove</Button> : <span />}
        <Button disabled={!f.name?.trim()} loading={busy} onClick={async () => { setBusy(true); await onSave({ ...f, name: f.name!.trim() }); setBusy(false); }}>Save</Button>
      </div>
    </Modal>
  );
}

function DraftModal({ p, onClose, project }: { p: Partner | null; onClose: () => void; project: { name: string; tagline: string | null; description: string | null; cause: string | null; location: string | null } }) {
  const [kind, setKind] = useState<"proposal" | "checkin" | "thanks">("proposal");
  const [out, setOut] = useState<{ subject: string; body: string; _source?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setOut(null); if (p) setKind(p.status === "prospect" ? "proposal" : "checkin"); }, [p]);
  async function draft() {
    if (!p) return;
    setBusy(true);
    try {
      setOut(await askAI("partner_draft", { project, kind, partner: { name: p.name, kind: p.kind, contact_name: p.contact_name, gives: p.gives, gets: p.gets, recent: (p.log || []).slice(-3).map((l) => l.text) } }));
    } finally { setBusy(false); }
  }
  return (
    <Modal open={!!p} onClose={onClose} title={`Write to ${p?.name || ""}`} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {([["proposal", "Partnership proposal"], ["checkin", "Check-in / update"], ["thanks", "Thank-you note"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setKind(k)} className={cx("rounded-xl px-3 py-1.5 text-sm border", kind === k ? "border-violet bg-violet/10" : "border-line text-ink-2")}>{l}</button>
          ))}
          <Button variant="ai" size="sm" className="ml-auto" onClick={draft} loading={busy}><Sparkles className="size-3.5" /> {out ? "Redraft" : "Draft"}</Button>
        </div>
        {out && (
          <AIBox title="Draft" source={out._source} action={<button onClick={() => navigator.clipboard.writeText(`Subject: ${out.subject}\n\n${out.body}`)} className="text-xs text-ink-3 hover:text-ink inline-flex items-center gap-1"><Copy className="size-3" />Copy</button>}>
            <div className="font-semibold mb-2">Subject: {out.subject}</div>
            <div className="whitespace-pre-wrap text-sm">{out.body}</div>
          </AIBox>
        )}
        {p?.contact_email && out && <a href={`mailto:${p.contact_email}?subject=${encodeURIComponent(out.subject)}&body=${encodeURIComponent(out.body)}`} className="text-sm text-accent inline-flex items-center gap-1"><Mail className="size-4" /> Open in my email app</a>}
      </div>
    </Modal>
  );
}
