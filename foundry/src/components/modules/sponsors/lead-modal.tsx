"use client";
import { useState } from "react";
import { Copy, ExternalLink, Sparkles, Trash2 } from "lucide-react";
import { askAI } from "@/lib/ai/client";
import type { SponsorProjectInfo } from "@/lib/ai/tasks/modules";
import type { Member, SponsorLead } from "@/lib/types";
import { AIBox, Avatar, Badge, Button, Field, Input, Modal, Select, Textarea, cx, fmtDate } from "@/components/ui";
import { CONF_COLOR, STAGES, STAGE_MAP } from "./stages";

export const DRAFT_KINDS: Record<string, string> = { intro: "Intro email", proposal: "One-page proposal", follow: "Follow-up email", thanks: "Thank-you letter" };
const LANGS = ["English", "Vietnamese", "Spanish"];

type Patch = Partial<SponsorLead>;

export function LeadModal({ lead, onClose, members, hrLinked, lettersOn, canManage, project, onSave, onStage, onDelete }: {
  lead: SponsorLead | null; onClose: () => void; members: Member[]; hrLinked: boolean; lettersOn: boolean; canManage: boolean;
  project: SponsorProjectInfo;
  onSave: (l: SponsorLead, p: Patch, logText?: string) => Promise<void>;
  onStage: (l: SponsorLead, stage: SponsorLead["stage"]) => Promise<void>;
  onDelete: (l: SponsorLead) => Promise<void>;
}) {
  return (
    <Modal open={!!lead} onClose={onClose} title={lead?.name || ""} wide>
      {lead && <LeadBody key={lead.id} lead={lead} members={members} hrLinked={hrLinked} lettersOn={lettersOn} canManage={canManage} project={project} onSave={onSave} onStage={onStage} onDelete={onDelete} onClose={onClose} />}
    </Modal>
  );
}

function LeadBody({ lead, members, hrLinked, lettersOn, canManage, project, onSave, onStage, onDelete, onClose }: {
  lead: SponsorLead; members: Member[]; hrLinked: boolean; lettersOn: boolean; canManage: boolean; project: SponsorProjectInfo;
  onSave: (l: SponsorLead, p: Patch, logText?: string) => Promise<void>; onStage: (l: SponsorLead, s: SponsorLead["stage"]) => Promise<void>; onDelete: (l: SponsorLead) => Promise<void>; onClose: () => void;
}) {
  const [v, setV] = useState({
    name: lead.name, type: lead.type || "", country: lead.country || "", website: lead.website || "", focus: lead.focus || "", fit: lead.fit || "", approach: lead.approach || "",
    contact_name: lead.contact_name || "", contact_email: lead.contact_email || "", amount_asked: lead.amount_asked != null ? String(lead.amount_asked) : "",
    amount_committed: lead.amount_committed != null ? String(lead.amount_committed) : "", deadline: lead.deadline || "", next_step: lead.next_step || "",
    assignee_member_id: lead.assignee_member_id || "", typical_amount: lead.typical_amount || "", cycle: lead.cycle || "",
  });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(lead.draft || "");
  const [kind, setKind] = useState("intro");
  const [lang, setLang] = useState("English");
  const [drafting, setDrafting] = useState(false);
  const [draftSrc, setDraftSrc] = useState<string>();
  const [copied, setCopied] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const num = (s: string) => (s.trim() === "" ? null : Number(s) || 0);

  async function save() {
    setSaving(true);
    await onSave(lead, {
      name: v.name.trim() || lead.name, type: v.type || null, country: v.country || null, website: v.website || null, focus: v.focus || null, fit: v.fit || null, approach: v.approach || null,
      contact_name: v.contact_name || null, contact_email: v.contact_email || null, amount_asked: num(v.amount_asked), amount_committed: num(v.amount_committed),
      deadline: v.deadline || null, next_step: v.next_step || null, assignee_member_id: hrLinked ? v.assignee_member_id || null : lead.assignee_member_id,
      typical_amount: v.typical_amount || null, cycle: v.cycle || null, draft: draft || null,
    });
    setSaving(false);
    onClose();
  }
  async function addNote() {
    if (!note.trim()) return;
    await onSave(lead, {}, note.trim());
    setNote("");
  }
  async function write() {
    setDrafting(true);
    try {
      const r = await askAI<{ subject: string; body: string }>("sponsor_letter", {
        project, kind, language: lang,
        lead: { name: v.name, type: v.type, country: v.country, contact_name: v.contact_name, focus: v.focus, fit: v.fit, approach: v.approach, amount_asked: num(v.amount_asked) },
      });
      setDraft(`Subject: ${r.subject || ""}\n\n${r.body || ""}`);
      setDraftSrc(r._source);
    } catch { alert("Couldn't draft right now — try again."); }
    setDrafting(false);
  }

  return (
    <div className="space-y-5">
      {/* stage */}
      <div className="flex flex-wrap gap-1.5">
        {STAGES.map((s) => (
          <button key={s.id} onClick={() => s.id !== lead.stage && onStage(lead, s.id)}
            className={cx("rounded-full px-3 py-1 text-[12.5px] font-semibold border transition", s.id === lead.stage ? "" : "border-line text-ink-3 hover:text-ink")}
            style={s.id === lead.stage ? { color: s.color, borderColor: s.color + "77", background: s.color + "22" } : undefined}>{s.emoji} {s.label}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-center text-xs text-ink-3">
        {lead.source === "ai" && <Badge color="#b9a6ff">✨ AI suggestion</Badge>}
        {lead.confidence && <Badge color={CONF_COLOR[lead.confidence]}>{lead.confidence} confidence</Badge>}
        {lead.fit_score > 0 && <Badge color="#ffb3d1">fit {lead.fit_score}</Badge>}
        {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" className="text-accent inline-flex items-center gap-1">website <ExternalLink className="size-3" /></a>}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Organization"><Input value={v.name} onChange={set("name")} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Type"><Input value={v.type} onChange={set("type")} placeholder="Foundation" /></Field>
          <Field label="Country"><Input value={v.country} onChange={set("country")} /></Field>
        </div>
        <Field label="Contact person"><Input value={v.contact_name} onChange={set("contact_name")} placeholder="Ms. Lee, CSR manager" /></Field>
        <Field label="Contact email"><Input type="email" value={v.contact_email} onChange={set("contact_email")} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Asking ($)"><Input type="number" min="0" value={v.amount_asked} onChange={set("amount_asked")} /></Field>
          <Field label="Committed ($)"><Input type="number" min="0" value={v.amount_committed} onChange={set("amount_committed")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Deadline"><Input type="date" value={v.deadline} onChange={set("deadline")} /></Field>
          {hrLinked ? (
            <Field label="Owner">
              <Select value={v.assignee_member_id} onChange={set("assignee_member_id")}><option value="">— nobody —</option>{members.filter((m) => m.status === "active").map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</Select>
            </Field>
          ) : <Field label="Website"><Input value={v.website} onChange={set("website")} placeholder="https://" /></Field>}
        </div>
      </div>
      <Field label="Next step"><Input value={v.next_step} onChange={set("next_step")} placeholder="e.g. Email Ms. Lee the 1-page proposal" /></Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Why they fit"><Textarea className="min-h-20" value={v.fit} onChange={set("fit")} /></Field>
        <Field label="How to approach"><Textarea className="min-h-20" value={v.approach} onChange={set("approach")} /></Field>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Their focus"><Input value={v.focus} onChange={set("focus")} /></Field>
        <Field label="Typical amount"><Input value={v.typical_amount} onChange={set("typical_amount")} /></Field>
        <Field label="Application cycle"><Input value={v.cycle} onChange={set("cycle")} /></Field>
      </div>

      {lettersOn && (
        <AIBox title="Letter writer" loading={false} source={draftSrc}>
          <div className="flex flex-wrap gap-2 mb-3">
            <Select className="w-auto" value={kind} onChange={(e) => setKind(e.target.value)}>{Object.entries(DRAFT_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
            <Select className="w-auto" value={lang} onChange={(e) => setLang(e.target.value)}>{LANGS.map((l) => <option key={l}>{l}</option>)}</Select>
            <Button variant="ai" onClick={write} loading={drafting}><Sparkles className="size-4" />{draft ? "Redraft" : "Draft letter"}</Button>
            {draft && <Button variant="ghost" onClick={() => { navigator.clipboard.writeText(draft); setCopied(true); }}><Copy className="size-4" />{copied ? "Copied!" : "Copy"}</Button>}
          </div>
          <Textarea className="min-h-56 font-mono text-[12.5px]" value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder="Pick a letter type and hit Draft. Fill in anything in [square brackets] before sending. The draft is saved with this sponsor when you click Save." />
        </AIBox>
      )}

      {/* activity log */}
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-wider text-ink-3 mb-2">Activity</div>
        <div className="flex gap-2 mb-3">
          <Input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNote(); } }} placeholder="Add a note — e.g. Called, they want a proposal by Friday" />
          <Button variant="outline" onClick={addNote} disabled={!note.trim()}>Add</Button>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {[...(lead.log || [])].reverse().map((e, i) => (
            <div key={i} className="flex gap-2.5 text-sm">
              <Avatar name={e.by || "?"} size={22} />
              <div className="flex-1"><span className="text-ink-2">{e.text}</span><div className="text-[11px] text-ink-3">{e.by || "Someone"} · {fmtDate(new Date(e.t).toISOString(), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div></div>
            </div>
          ))}
          {!lead.log?.length && <div className="text-sm text-ink-3">No activity yet.</div>}
        </div>
      </div>

      <div className="flex justify-between gap-2 pt-2 border-t border-line">
        {canManage ? <Button variant="danger" onClick={() => onDelete(lead)}><Trash2 className="size-4" />Delete</Button> : <span />}
        <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
      </div>
      {STAGE_MAP[lead.stage]?.id === "won" && <div className="text-xs text-ink-3">🎉 Committed! Remember to send a thank-you letter.</div>}
    </div>
  );
}
