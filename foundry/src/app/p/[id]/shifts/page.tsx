"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Clock, MapPin, Check, UserPlus, LogIn, Sparkles, Printer, Award, X, Lock, Copy } from "lucide-react";
import { useProject } from "@/components/project-context";
import { ModuleGate } from "@/components/module-gate";
import { supabase } from "@/lib/supabase";
import { askAI } from "@/lib/ai/client";
import { activeLinks, hasSub } from "@/lib/modules";
import { can } from "@/lib/roles";
import type { EventRow, Member, Shift, ShiftSignup } from "@/lib/types";
import { Avatar, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Progress, Select, Stat, Textarea, Tip, cx, fmtDate } from "@/components/ui";

export default function ShiftsPage() {
  return <ModuleGate id="shifts"><Shifts /></ModuleGate>;
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABEL: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const PARTS = [{ k: "am", l: "Morning" }, { k: "pm", l: "Afternoon" }, { k: "eve", l: "Evening" }];
const LEADER_ROLES = ["president", "vice_president", "secretary", "head", "treasurer"];

const dayKey = (iso: string) => DAYS[(new Date(iso).getDay() + 6) % 7];
const partKey = (iso: string) => { const h = new Date(iso).getHours(); return h < 12 ? "am" : h < 17 ? "pm" : "eve"; };
const hoursBetween = (a: string, b: string) => Math.max(0, Math.round(((new Date(b).getTime() - new Date(a).getTime()) / 36e5) * 4) / 4);
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function Shifts() {
  const { project, stack, me, members, reloadMembers } = useProject();
  const sub = (s: string) => hasSub(stack, "shifts", s);
  const links = activeLinks(stack);
  const eventsLinked = links.some((l) => l.from === "events" && l.to === "shifts");
  const hrLinked = links.some((l) => l.from === "shifts" && l.to === "hr");
  const canCreate = can(me, "shifts", "manage") || (!!me && LEADER_ROLES.includes(me.role));
  const isLeader = !!me && LEADER_ROLES.includes(me.role);

  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [signups, setSignups] = useState<ShiftSignup[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [staffFor, setStaffFor] = useState<Shift | null>(null);
  const [certFor, setCertFor] = useState<Member | null>(null);
  const [err, setErr] = useState("");
  const active = members.filter((m) => m.status === "active");

  const load = useCallback(async () => {
    const sb = supabase();
    const [s, su, e] = await Promise.all([
      sb.from("shifts").select("*").eq("project_id", project.id).order("starts_at"),
      sb.from("shift_signups").select("*").eq("project_id", project.id),
      sb.from("events").select("*").eq("project_id", project.id).order("starts_at"),
    ]);
    if (s.error) setErr(s.error.message.includes("shifts") ? "Run supabase/patch-003-shifts-partners-sync.sql in Supabase first." : s.error.message);
    setShifts((s.data as Shift[]) || []); setSignups((su.data as ShiftSignup[]) || []); setEvents((e.data as EventRow[]) || []);
  }, [project.id]);
  useEffect(() => { load(); }, [load]);

  const now = new Date().toISOString();
  const upcoming = (shifts || []).filter((s) => s.ends_at >= now);
  const past = (shifts || []).filter((s) => s.ends_at < now).reverse();
  const forShift = (id: string) => signups.filter((x) => x.shift_id === id);
  const mineIds = new Set(signups.filter((x) => x.member_id === me?.id).map((x) => x.shift_id));
  const openSlots = upcoming.reduce((n, s) => n + Math.max(0, s.slots - forShift(s.id).length), 0);
  const confirmedHours = signups.filter((x) => x.status === "completed").reduce((n, x) => n + Number(x.hours || 0), 0);

  async function signUp(s: Shift, memberId = me?.id) {
    if (!memberId) return;
    const { error } = await supabase().from("shift_signups").insert({ shift_id: s.id, project_id: project.id, member_id: memberId });
    if (error) setErr(error.message); else load();
  }
  async function leave(su: ShiftSignup) { await supabase().from("shift_signups").delete().eq("id", su.id); load(); }
  async function setStatus(su: ShiftSignup, status: ShiftSignup["status"]) {
    await supabase().from("shift_signups").update({ status, ...(status === "checked_in" ? { checked_in_at: new Date().toISOString() } : {}) }).eq("id", su.id);
    load();
  }
  async function complete(su: ShiftSignup, s: Shift) {
    const def = hoursBetween(s.starts_at, s.ends_at);
    const v = prompt(`Confirm hours for this shift`, String(su.hours ?? def));
    if (v === null) return;
    const { error } = await supabase().rpc("complete_shift_signup", { p_signup: su.id, p_hours: Number(v) || 0 });
    if (error) { setErr(error.message); return; }
    await load(); reloadMembers();
  }

  const myAvail = me?.availability || {};
  async function toggleAvail(day: string, part: string) {
    if (!me) return;
    const cur = new Set(myAvail[day] || []);
    if (cur.has(part)) cur.delete(part); else cur.add(part);
    await supabase().from("project_members").update({ availability: { ...myAvail, [day]: [...cur] } }).eq("id", me.id);
    reloadMembers();
  }

  return (
    <div className="space-y-6">
      <PageHeader emoji="🗓️" title="Volunteer" accent="Shifts"
        subtitle="Post shifts, let people claim a spot, check them in on the day, and turn it into service hours that count."
        actions={canCreate ? <Button onClick={() => setNewOpen(true)}><Plus className="size-4" /> New shift</Button> : undefined} />
      {err && <div className="text-sm text-bad bg-bad/10 border border-bad/25 rounded-lg px-3 py-2 flex justify-between">{err}<button onClick={() => setErr("")}><X className="size-4" /></button></div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Upcoming shifts" value={upcoming.length} />
        <Stat label="Open spots" value={openSlots} color={openSlots ? "#ffd166" : "#7ee0b0"} />
        <Stat label="My shifts" value={mineIds.size} />
        <Stat label="Hours confirmed" value={confirmedHours} sub={hrLinked ? "added to People & HR" : undefined} color="#d4f59a" />
      </div>

      {sub("signups") && (
        <div className="space-y-3">
          <div className="font-extrabold text-lg">Upcoming</div>
          {shifts === null ? <div className="skeleton h-32" /> : upcoming.length === 0 ? (
            <Empty emoji="🗓️" title="No shifts yet" action={canCreate ? <Button onClick={() => setNewOpen(true)}><Plus className="size-4" /> Post the first shift</Button> : undefined}>
              A shift is a block of time someone covers — e.g. &ldquo;Bake sale table, Sat 10–12, 3 people&rdquo;. {eventsLinked && "Link it to an event so the event lead sees who's coming."}
            </Empty>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {upcoming.map((s) => {
                const su = forShift(s.id);
                const mine = su.find((x) => x.member_id === me?.id);
                const full = su.length >= s.slots;
                const ev = events.find((e) => e.id === s.event_id);
                return (
                  <Card key={s.id} className="!p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold">{s.title}</div>
                        <div className="text-xs text-ink-3 mt-0.5 flex flex-wrap gap-x-3">
                          <span className="inline-flex items-center gap-1"><Clock className="size-3" />{fmtDate(s.starts_at, { weekday: "short", month: "short", day: "numeric" })} · {fmtTime(s.starts_at)}–{fmtTime(s.ends_at)}</span>
                          {s.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{s.location}</span>}
                        </div>
                        {ev && <div className="text-[11px] text-ink-3 mt-1">🎪 {ev.name}</div>}
                      </div>
                      <Badge color={full ? "#7ee0b0" : "#ffd166"}>{su.length}/{s.slots}</Badge>
                    </div>
                    <Progress value={(su.length / Math.max(1, s.slots)) * 100} height={5} className="mt-3" color="#d4f59a" />
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {su.map((x) => {
                        const m = members.find((mm) => mm.id === x.member_id);
                        return (
                          <span key={x.id} className="inline-flex items-center gap-1.5 rounded-full bg-panel-2 pl-1 pr-2 py-0.5 text-xs">
                            <Avatar name={m?.full_name} size={18} />{m?.full_name.split(" ")[0]}
                            {x.status === "checked_in" && <span className="text-good">●</span>}
                            {isLeader && sub("checkin") && x.status === "signed_up" && <button onClick={() => setStatus(x, "checked_in")} title="Check in" className="text-ink-3 hover:text-good"><LogIn className="size-3" /></button>}
                            {isLeader && sub("checkin") && x.status !== "completed" && <button onClick={() => complete(x, s)} title="Confirm hours" className="text-ink-3 hover:text-good"><Check className="size-3" /></button>}
                          </span>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 mt-3">
                      {mine ? <Button size="sm" variant="ghost" onClick={() => leave(mine)}>Leave shift</Button>
                        : !full && me && can(me, "shifts", "edit") ? <Button size="sm" onClick={() => signUp(s)}><UserPlus className="size-3.5" /> Sign me up</Button>
                        : full ? <span className="text-xs text-good self-center">Fully staffed 🎉</span> : null}
                      {isLeader && !full && sub("ai_staffing") && <Button size="sm" variant="ai" onClick={() => setStaffFor(s)}><Sparkles className="size-3.5" /> Fill with AI</Button>}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {sub("checkin") && past.length > 0 && (
        <Card>
          <div className="font-extrabold mb-1">Past shifts — confirm hours</div>
          <div className="text-xs text-ink-3 mb-3">{isLeader ? `Tick ✓ to confirm someone's hours${hrLinked ? " — they're added to People & HR automatically" : ""}. Mark no-shows so stats stay honest.` : "Leaders confirm hours after each shift."}</div>
          <ul className="divide-y divide-line">
            {past.slice(0, 8).map((s) => (
              <li key={s.id} className="py-2.5">
                <div className="text-sm font-semibold">{s.title} <span className="text-xs text-ink-3 font-normal">· {fmtDate(s.starts_at)} · {hoursBetween(s.starts_at, s.ends_at)}h</span></div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {forShift(s.id).map((x) => {
                    const m = members.find((mm) => mm.id === x.member_id);
                    return (
                      <span key={x.id} className={cx("inline-flex items-center gap-1.5 rounded-full pl-1 pr-2 py-0.5 text-xs border", x.status === "completed" ? "border-good/40 text-good" : x.status === "no_show" ? "border-bad/40 text-bad line-through" : "border-line text-ink-2")}>
                        <Avatar name={m?.full_name} size={18} />{m?.full_name}{x.status === "completed" && ` · ${x.hours}h`}
                        {isLeader && x.status !== "completed" && <>
                          <button onClick={() => complete(x, s)} title="Confirm hours" className="hover:text-good"><Check className="size-3" /></button>
                          {x.status !== "no_show" && <button onClick={() => setStatus(x, "no_show")} title="No-show" className="hover:text-bad"><X className="size-3" /></button>}
                        </>}
                      </span>
                    );
                  })}
                  {forShift(s.id).length === 0 && <span className="text-xs text-ink-3">Nobody signed up.</span>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {sub("availability") && me && (
          <Card>
            <div className="font-extrabold">My weekly availability</div>
            <div className="text-xs text-ink-3 mb-3">Tap the times you&apos;re usually free. Leaders (and the AI helper) use this to ask the right people.</div>
            <div className="grid grid-cols-[70px_repeat(7,1fr)] gap-1 text-xs">
              <span />
              {DAYS.map((d) => <span key={d} className="text-center text-ink-3 font-semibold">{DAY_LABEL[d]}</span>)}
              {PARTS.map((p) => (
                <div key={p.k} className="contents">
                  <span className="text-ink-3 self-center">{p.l}</span>
                  {DAYS.map((d) => {
                    const on = (myAvail[d] || []).includes(p.k);
                    return <button key={d} onClick={() => toggleAvail(d, p.k)} className={cx("h-8 rounded-md border transition", on ? "bg-[#d4f59a]/80 border-[#d4f59a]" : "border-line hover:border-line-2")} aria-label={`${DAY_LABEL[d]} ${p.l}`} />;
                  })}
                </div>
              ))}
            </div>
          </Card>
        )}
        <Card>
          <div className="font-extrabold flex items-center gap-2"><Award className="size-4 text-[#d4f59a]" /> Service hours</div>
          <div className="text-xs text-ink-3 mb-3">Total confirmed hours per member{sub("certificates") ? " — print a certificate for school or award applications." : "."}</div>
          <ul className="space-y-1.5">
            {[...active].sort((a, b) => Number(b.hours || 0) - Number(a.hours || 0)).slice(0, 10).map((m) => (
              <li key={m.id} className="flex items-center gap-2.5">
                <Avatar name={m.full_name} size={26} />
                <span className="flex-1 text-sm truncate">{m.full_name}</span>
                <span className="font-mono text-sm">{Number(m.hours || 0)}h</span>
                {sub("certificates") && (isLeader || m.id === me?.id) && Number(m.hours || 0) > 0 &&
                  <button onClick={() => setCertFor(m)} className="text-ink-3 hover:text-ink" title="Certificate"><Printer className="size-4" /></button>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {!isLeader && <Tip title="How it works">Sign up for any open shift. On the day, a leader checks you in; afterwards they confirm your hours and they appear on your profile.</Tip>}

      <NewShiftModal open={newOpen} onClose={() => setNewOpen(false)} projectId={project.id} events={eventsLinked ? events : []} members={active} onSaved={() => { setNewOpen(false); load(); }} />
      <StaffModal shift={staffFor} onClose={() => setStaffFor(null)} members={active} signups={signups} shifts={shifts || []} events={events}
        onInvite={async (ids) => { for (const id of ids) await signUp(staffFor!, id); setStaffFor(null); }} />
      <CertModal member={certFor} project={project.name} location={project.location} onClose={() => setCertFor(null)} signups={signups} shifts={shifts || []} />
    </div>
  );
}

function NewShiftModal({ open, onClose, projectId, events, members, onSaved }: { open: boolean; onClose: () => void; projectId: string; events: EventRow[]; members: Member[]; onSaved: () => void }) {
  const [v, setV] = useState({ title: "", date: "", start: "10:00", end: "12:00", location: "", slots: "3", event_id: "", lead: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setV({ title: "", date: "", start: "10:00", end: "12:00", location: "", slots: "3", event_id: "", lead: "", description: "" }); setErr(""); } }, [open]);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (k === "event_id" && val) {
      const ev = events.find((x) => x.id === val);
      setV({ ...v, event_id: val, date: v.date || ev?.starts_at?.slice(0, 10) || "", location: v.location || ev?.location || "" });
    } else setV({ ...v, [k]: val });
  };
  async function save() {
    if (!v.title.trim() || !v.date) return setErr("Title and date are required.");
    const starts = new Date(`${v.date}T${v.start}`), ends = new Date(`${v.date}T${v.end}`);
    if (ends <= starts) return setErr("End time must be after start time.");
    setBusy(true);
    const { error } = await supabase().from("shifts").insert({
      project_id: projectId, title: v.title.trim(), starts_at: starts.toISOString(), ends_at: ends.toISOString(), location: v.location || null,
      slots: Math.max(1, Number(v.slots) || 1), event_id: v.event_id || null, lead_member_id: v.lead || null, description: v.description || null,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    onSaved();
  }
  return (
    <Modal open={open} onClose={onClose} title="New shift">
      <div className="space-y-3">
        {events.length > 0 && <Field label="For event" hint="optional"><Select value={v.event_id} onChange={set("event_id")}><option value="">— none —</option>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>}
        <Field label="What's the shift?"><Input autoFocus value={v.title} onChange={set("title")} placeholder="e.g. Bake sale table, Setup crew, Tutoring room B" /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Date"><Input type="date" value={v.date} onChange={set("date")} /></Field>
          <Field label="Start"><Input type="time" value={v.start} onChange={set("start")} /></Field>
          <Field label="End"><Input type="time" value={v.end} onChange={set("end")} /></Field>
        </div>
        <div className="grid grid-cols-[1fr_90px] gap-2">
          <Field label="Location"><Input value={v.location} onChange={set("location")} /></Field>
          <Field label="People"><Input type="number" min={1} value={v.slots} onChange={set("slots")} /></Field>
        </div>
        <Field label="Shift lead" hint="optional"><Select value={v.lead} onChange={set("lead")}><option value="">— none —</option>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</Select></Field>
        <Field label="Notes for volunteers" hint="optional"><Textarea value={v.description} onChange={set("description")} className="min-h-16" placeholder="What to bring, dress code, who to ask for…" /></Field>
        {err && <div className="text-sm text-bad">{err}</div>}
        <Button className="w-full" onClick={save} loading={busy}>Post shift</Button>
      </div>
    </Modal>
  );
}

function StaffModal({ shift, onClose, members, signups, shifts, events, onInvite }: {
  shift: Shift | null; onClose: () => void; members: Member[]; signups: ShiftSignup[]; shifts: Shift[]; events: EventRow[]; onInvite: (ids: string[]) => Promise<void>;
}) {
  const [res, setRes] = useState<{ picks: { id: string; reason: string }[]; message: string; _source?: string } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const taken = useMemo(() => new Set(signups.filter((x) => x.shift_id === shift?.id).map((x) => x.member_id)), [signups, shift]);

  useEffect(() => {
    if (!shift) { setRes(null); return; }
    const d = dayKey(shift.starts_at), p = partKey(shift.starts_at);
    const monthAgo = Date.now() - 30 * 864e5;
    const recent = (mid: string) => signups.filter((x) => x.member_id === mid && new Date(shifts.find((s) => s.id === x.shift_id)?.starts_at || 0).getTime() > monthAgo).length;
    const open = Math.max(0, shift.slots - taken.size);
    askAI<{ picks: { id: string; reason: string }[]; message: string }>("shift_staffing", {
      shift: { title: shift.title, starts_at: fmtTime(shift.starts_at), ends_at: fmtTime(shift.ends_at), day: DAY_LABEL[d], part: PARTS.find((x) => x.k === p)!.l, open, event: events.find((e) => e.id === shift.event_id)?.name },
      candidates: members.filter((m) => !taken.has(m.id)).map((m) => ({ id: m.id, name: m.full_name, available: (m.availability?.[d] || []).includes(p), hours: Number(m.hours || 0), shifts_this_month: recent(m.id), department: m.department })),
    }).then((r) => { const picks = (r.picks || []).filter((x) => members.some((m) => m.id === x.id) && !taken.has(x.id)); setRes({ ...r, picks }); setSel(new Set(picks.slice(0, open).map((x) => x.id))); });
  }, [shift]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal open={!!shift} onClose={onClose} title={`✨ Staff "${shift?.title || ""}"`} wide>
      {!res ? <div className="space-y-2"><div className="skeleton h-10" /><div className="skeleton h-10" /><div className="skeleton h-10" /></div> : (
        <div className="space-y-4">
          {res._source === "fallback" && <div className="text-xs text-ink-3">Offline mode: ranked by availability and how many shifts each person already has.</div>}
          <ul className="space-y-1.5">
            {res.picks.map((p) => {
              const m = members.find((x) => x.id === p.id)!;
              const on = sel.has(p.id);
              return (
                <li key={p.id}>
                  <button onClick={() => { const n = new Set(sel); if (on) n.delete(p.id); else n.add(p.id); setSel(n); }}
                    className={cx("w-full flex items-center gap-3 rounded-xl border px-3 py-2 text-left", on ? "border-[#d4f59a] bg-[#d4f59a]/10" : "border-line")}>
                    <Avatar name={m.full_name} size={28} />
                    <span className="flex-1"><span className="text-sm font-semibold">{m.full_name}</span><span className="block text-xs text-ink-3">{p.reason}</span></span>
                    {on && <Check className="size-4 text-[#d4f59a]" />}
                  </button>
                </li>
              );
            })}
          </ul>
          {res.message && (
            <div className="rounded-xl border border-line p-3 text-sm">
              <div className="flex justify-between text-[11px] uppercase tracking-wider text-ink-3 font-bold mb-1">Group-chat message <button onClick={() => navigator.clipboard.writeText(res.message)} className="normal-case tracking-normal font-normal inline-flex items-center gap-1 hover:text-ink"><Copy className="size-3" />Copy</button></div>
              {res.message}
            </div>
          )}
          <Button className="w-full" disabled={!sel.size} loading={busy} onClick={async () => { setBusy(true); await onInvite([...sel]); setBusy(false); }}>Add {sel.size} to this shift</Button>
          <div className="text-[11px] text-ink-3 flex items-center gap-1"><Lock className="size-3" /> Tip: let people know before adding them — they can leave the shift anytime.</div>
        </div>
      )}
    </Modal>
  );
}

function CertModal({ member, project, location, onClose, signups, shifts }: { member: Member | null; project: string; location: string | null; onClose: () => void; signups: ShiftSignup[]; shifts: Shift[] }) {
  if (!member) return null;
  const done = signups.filter((x) => x.member_id === member.id && x.status === "completed");
  function print() {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const rows = done.map((x) => { const s = shifts.find((y) => y.id === x.shift_id); return `<tr><td>${s ? new Date(s.starts_at).toLocaleDateString() : ""}</td><td>${(s?.title || "").replace(/</g, "&lt;")}</td><td style="text-align:right">${x.hours}h</td></tr>`; }).join("");
    w.document.write(`<!doctype html><html><head><title>Service hours — ${member!.full_name}</title><style>
      body{font-family:Georgia,serif;padding:48px;color:#1a1020} .box{border:6px double #1a1020;padding:40px;text-align:center}
      h1{font-size:34px;margin:0 0 6px} h2{font-weight:normal;margin:4px 0 24px} .big{font-size:48px;font-weight:bold;margin:12px 0}
      table{margin:24px auto 0;border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px} td{padding:4px 12px;border-bottom:1px solid #ddd;text-align:left}
      .sig{display:flex;justify-content:space-around;margin-top:56px;font-family:Arial,sans-serif;font-size:12px} .sig div{border-top:1px solid #1a1020;padding-top:6px;width:220px}
    </style></head><body><div class="box"><h1>Certificate of Community Service</h1><h2>This certifies that</h2>
      <div style="font-size:30px">${member!.full_name.replace(/</g, "&lt;")}</div><h2>contributed</h2><div class="big">${Number(member!.hours || 0)} hours</div>
      <h2>of volunteer service with <b>${project.replace(/</g, "&lt;")}</b>${location ? ` (${location.replace(/</g, "&lt;")})` : ""}</h2>
      ${rows ? `<table>${rows}</table>` : ""}
      <div class="sig"><div>Project President</div><div>Adult Advisor / Teacher</div><div>Date: ${new Date().toLocaleDateString()}</div></div>
    </div><script>setTimeout(()=>print(),300)</script></body></html>`);
    w.document.close();
  }
  return (
    <Modal open onClose={onClose} title="Service-hour certificate">
      <div className="text-center space-y-3">
        <div className="text-4xl">🏅</div>
        <div className="font-extrabold text-lg">{member.full_name}</div>
        <div className="font-mono text-3xl">{Number(member.hours || 0)}h</div>
        <div className="text-sm text-ink-3">{done.length} confirmed shift{done.length === 1 ? "" : "s"} in Lukigo{Number(member.hours || 0) > done.reduce((n, x) => n + Number(x.hours || 0), 0) ? " + hours logged in People & HR" : ""}.</div>
        <Button className="w-full" onClick={print}><Printer className="size-4" /> Print / save as PDF</Button>
        <div className="text-[11px] text-ink-3">Most schools need an adult advisor&apos;s signature — print it and have them sign.</div>
      </div>
    </Modal>
  );
}
