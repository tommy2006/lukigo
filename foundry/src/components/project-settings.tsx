"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Trash2, Crown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Project } from "@/lib/types";
import { Button, Card, Field, Input, Modal } from "@/components/ui";

/** President-only: rename the project, or delete it (type-to-confirm). */
export function ProjectSettings({ project, onSaved }: { project: Project; onSaved: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: project.name, tagline: project.tagline || "", emoji: project.emoji || "🌱", location: project.location || "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [delOpen, setDelOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState("");

  async function save() {
    if (!v.name.trim()) { setMsg("The project needs a name."); return; }
    setSaving(true); setMsg("");
    const { data, error } = await supabase().from("projects")
      .update({ name: v.name.trim(), tagline: v.tagline.trim() || null, emoji: v.emoji.trim() || "🌱", location: v.location.trim() || null })
      .eq("id", project.id).select("id");
    setSaving(false);
    if (error || !data?.length) { setMsg(error?.message || "Not saved — only the president can rename the project."); return; }
    setMsg("Saved ✓"); onSaved();
  }

  async function del() {
    setDeleting(true); setDelErr("");
    const { data, error } = await supabase().from("projects").delete().eq("id", project.id).select("id");
    setDeleting(false);
    if (error || !data?.length) { setDelErr(error?.message || "Couldn't delete — only the president can do this."); return; }
    router.replace("/home");
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-extrabold flex items-center gap-2"><Settings className="size-4 text-ink-3" /> Project settings
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full border border-accent/40 text-accent px-2 py-0.5"><Crown className="size-3" /> President only</span>
          </div>
          <p className="text-sm text-ink-2 mt-1">Rename the project, change its icon and tagline, or delete it.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>{open ? "Close" : "Rename / delete"}</Button>
      </div>
      {open && (
        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-[72px_1fr] gap-4 items-start">
            <Field label="Icon"><input value={v.emoji} onChange={(e) => setV({ ...v, emoji: e.target.value })} maxLength={4} aria-label="Project emoji"
              className="w-[72px] h-[72px] rounded-2xl bg-white/[0.04] border border-line text-4xl text-center outline-none focus:border-accent/60" /></Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Project name"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
              <Field label="Location" hint="tailors AI"><Input value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} placeholder="City, country" /></Field>
              <div className="sm:col-span-2"><Field label="Tagline"><Input value={v.tagline} onChange={(e) => setV({ ...v, tagline: e.target.value })} /></Field></div>
            </div>
          </div>
          <div className="flex items-center gap-3"><Button onClick={save} loading={saving}>Save changes</Button>{msg && <span className="text-sm text-ink-2">{msg}</span>}</div>

          <div className="rounded-xl border border-bad/30 bg-bad/[0.05] p-4 flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-bad">Delete this project</div>
              <div className="text-xs text-ink-2">Permanently removes the project and everything in it — members, events, tasks, money records. This can&apos;t be undone.</div>
            </div>
            <Button variant="danger" size="sm" onClick={() => { setConfirmName(""); setDelOpen(true); }}><Trash2 className="size-4" /> Delete…</Button>
          </div>
        </div>
      )}

      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Delete project?">
        <div className="space-y-4">
          <p className="text-sm text-ink-2">This permanently deletes <b className="text-ink">{project.name}</b> for everyone. Type the project name to confirm.</p>
          <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={project.name} autoFocus />
          {delErr && <div className="text-sm text-bad">{delErr}</div>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDelOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={confirmName.trim() !== project.name} loading={deleting} onClick={del}><Trash2 className="size-4" /> Delete forever</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
