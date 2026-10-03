"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { EventRow, Member } from "@/lib/types";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { EVENT_STATUS, EVENT_TYPES, EVENT_TYPE_EMOJI, dateToTs, tsToDate, tsToTime } from "./shared";

/** Create / edit an event. Calls onSaved with the saved row. */
export function EventForm({ projectId, event, members, showBudget, onSaved, onCancel }: {
  projectId: string;
  event?: EventRow | null;
  members: Member[];
  showBudget?: boolean;
  onSaved: (e: EventRow) => void;
  onCancel?: () => void;
}) {
  const [f, setF] = useState({
    name: event?.name || "",
    type: event?.type || "fundraiser",
    description: event?.description || "",
    date: tsToDate(event?.starts_at),
    time: tsToTime(event?.starts_at) || "15:00",
    location: event?.location || "",
    status: event?.status || "planning",
    budget: String(event?.budget ?? ""),
    lead_member_id: event?.lead_member_id || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return setErr("Give your event a name.");
    setSaving(true); setErr("");
    const row = {
      project_id: projectId,
      name: f.name.trim(),
      type: f.type,
      description: f.description || null,
      starts_at: f.date ? dateToTs(f.date, f.time) : null,
      location: f.location || null,
      status: f.status,
      budget: Number(f.budget) || 0,
      lead_member_id: f.lead_member_id || null,
    };
    const q = event
      ? supabase().from("events").update(row).eq("id", event.id).select().single()
      : supabase().from("events").insert(row).select().single();
    const { data, error } = await q;
    setSaving(false);
    if (error) return setErr(error.message);
    onSaved(data as EventRow);
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Event name"><Input autoFocus value={f.name} onChange={set("name")} placeholder="e.g. Spring Bake Sale for Literacy" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <Select value={f.type} onChange={set("type")}>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_TYPE_EMOJI[t]} {t[0].toUpperCase() + t.slice(1)}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={f.status} onChange={set("status")}>
            {EVENT_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><Input type="date" value={f.date} onChange={set("date")} /></Field>
        <Field label="Time"><Input type="time" value={f.time} onChange={set("time")} /></Field>
      </div>
      <Field label="Location"><Input value={f.location} onChange={set("location")} placeholder="School cafeteria, Room 204…" /></Field>
      <Field label="Description" hint="what & why — AI uses this to plan tasks">
        <Textarea value={f.description} onChange={set("description")} placeholder="Sell baked goods at lunch to fund books for the elementary school library." />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Event lead">
          <Select value={f.lead_member_id} onChange={set("lead_member_id")}>
            <option value="">— nobody yet —</option>
            {members.filter((m) => m.status === "active").map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </Select>
        </Field>
        {showBudget && <Field label="Budget ($)"><Input type="number" min="0" value={f.budget} onChange={set("budget")} placeholder="0" /></Field>}
      </div>
      {err && <div className="text-bad text-sm">{err}</div>}
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" loading={saving}>{event ? "Save changes" : "Create event"}</Button>
      </div>
    </form>
  );
}
