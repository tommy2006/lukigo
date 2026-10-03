"use client";
import { useState } from "react";
import Link from "next/link";
import { Compass, Plus, X, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PORTAL_ROLES } from "@/lib/roles";
import type { OpenRole, Project } from "@/lib/types";
import { Button, Card, Field, Input, Textarea, cx } from "@/components/ui";

const DEFAULT_ROLES: OpenRole[] = PORTAL_ROLES.map((r) => ({ k: r.k, on: true, slots: 0 }));

/** Founder controls for appearing on the public Project Portal. President/VP only. */
export function ListingCard({ project, onSaved }: { project: Project; onSaved: () => void }) {
  const [listed, setListed] = useState(!!project.is_listed);
  const [location, setLocation] = useState(project.location || "");
  const [skills, setSkills] = useState<string[]>(project.skills || []);
  const [skillDraft, setSkillDraft] = useState("");
  const [looking, setLooking] = useState(project.looking_for || "");
  const [roles, setRoles] = useState<OpenRole[]>(project.open_roles?.length ? project.open_roles : DEFAULT_ROLES);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [expanded, setExpanded] = useState(!project.is_listed);

  function addSkill() {
    const s = skillDraft.trim();
    if (s && !skills.includes(s)) setSkills([...skills, s]);
    setSkillDraft("");
  }
  const setRole = (k: string, patch: Partial<OpenRole>) => setRoles(roles.map((r) => (r.k === k ? { ...r, ...patch } : r)));

  async function save(nextListed = listed) {
    setSaving(true); setMsg("");
    const { error } = await supabase().from("projects")
      .update({ is_listed: nextListed, location: location || null, skills, looking_for: looking || null, open_roles: roles }).eq("id", project.id);
    setSaving(false);
    if (error) { setMsg(error.message.includes("column") ? "Run supabase/patch-002-sponsors-portal.sql first." : error.message); return; }
    setListed(nextListed); setMsg(nextListed ? "You're live on the portal ✨" : "Saved — not listed publicly."); onSaved();
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-extrabold flex items-center gap-2"><Compass className="size-4 text-accent" /> Project Portal listing
            <span className={cx("text-[11px] rounded-full px-2 py-0.5 border font-semibold", listed ? "border-good/40 text-good" : "border-line text-ink-3")}>{listed ? "Listed" : "Not listed"}</span>
          </div>
          <p className="text-sm text-ink-2 mt-1">Let students, volunteers, donors and mentors find you and request to join — no invite code needed.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {listed && <Link href={`/discover?p=${project.id}`} className="text-xs text-ink-3 hover:text-ink inline-flex items-center gap-1"><ExternalLink className="size-3" /> View</Link>}
          <Button size="sm" variant={listed ? "outline" : "primary"} onClick={() => save(!listed)} loading={saving}>{listed ? "Unlist" : "List my project"}</Button>
        </div>
      </div>

      <button onClick={() => setExpanded(!expanded)} className="text-xs text-ink-3 hover:text-ink mt-3">{expanded ? "Hide details ▲" : "Edit listing details ▼"}</button>
      {expanded && (
        <div className="mt-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Location" hint="city / school / online"><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Da Nang · Online" /></Field>
            <Field label="Skills you need">
              <div className="flex gap-2">
                <Input value={skillDraft} onChange={(e) => setSkillDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} placeholder="Design, Python, Public speaking…" />
                <Button variant="outline" size="sm" className="!h-[42px]" onClick={addSkill}><Plus className="size-4" /></Button>
              </div>
              {skills.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{skills.map((s) => (
                <span key={s} className="text-xs rounded-md bg-panel-2 pl-2 pr-1 py-0.5 inline-flex items-center gap-1">{s}<button onClick={() => setSkills(skills.filter((x) => x !== s))} className="text-ink-3 hover:text-bad"><X className="size-3" /></button></span>
              ))}</div>}
            </Field>
          </div>
          <Field label="What you're looking for"><Textarea value={looking} onChange={(e) => setLooking(e.target.value)} className="min-h-20" placeholder="e.g. 2 volunteers who can teach basic Scratch on Saturday mornings, and a designer for our posters." /></Field>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wider text-ink-3 mb-2">Open roles <span className="normal-case tracking-normal font-normal">— slots 0 = unlimited</span></div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {roles.map((r) => {
                const def = PORTAL_ROLES.find((x) => x.k === r.k);
                return (
                  <div key={r.k} className={cx("rounded-xl border px-3 py-2 flex items-center gap-3", r.on ? "border-line-2" : "border-line opacity-60")}>
                    <input type="checkbox" checked={r.on} onChange={(e) => setRole(r.k, { on: e.target.checked })} className="accent-[var(--accent)]" />
                    <span className="text-sm font-semibold flex-1">{def?.label}</span>
                    <input type="number" min={0} value={r.slots} onChange={(e) => setRole(r.k, { slots: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-14 rounded-lg bg-white/[0.04] border border-line px-2 py-1 text-sm font-mono text-center" title="Slots" />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => save(listed)} loading={saving}>Save listing</Button>
            {msg && <span className="text-sm text-ink-2">{msg}</span>}
          </div>
        </div>
      )}
      {!expanded && msg && <div className="text-sm text-ink-2 mt-2">{msg}</div>}
    </Card>
  );
}
