"use client";
import Link from "next/link";
import { useState } from "react";
import { Check, X, Inbox, Hourglass } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { EventRow, Member } from "@/lib/types";
import { Avatar, Badge, Button, Card, fmtDate } from "@/components/ui";

/**
 * Pending event requests. Approvers (president / VP / Head of Events) get Approve / Decline;
 * the requester sees the status of their own requests. Renders nothing when there's nothing to show.
 */
export function EventRequests({ events, members, me, canApprove, projectId, onChanged, compact }: {
  events: EventRow[]; members: Member[]; me: Member | null; canApprove: boolean; projectId: string; onChanged: () => void; compact?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const pending = events.filter((e) => e.approval === "pending" && (canApprove || e.requested_by === me?.id));
  const myDeclined = events.filter((e) => e.approval === "declined" && e.requested_by === me?.id && !canApprove);
  if (!pending.length && !myDeclined.length) return null;

  async function decide(e: EventRow, approve: boolean) {
    let note: string | null = null;
    if (!approve) { note = prompt(`Why are you declining "${e.name}"? (optional, shown to the requester)`); if (note === null) return; }
    setBusy(e.id); setErr("");
    const { error } = await supabase().from("events").update({ approval: approve ? "approved" : "declined", decision_note: note || null }).eq("id", e.id);
    setBusy(null);
    if (error) { setErr(error.message); return; }
    onChanged();
  }
  async function withdraw(e: EventRow) {
    setBusy(e.id);
    await supabase().from("events").delete().eq("id", e.id);
    setBusy(null); onChanged();
  }

  return (
    <Card className={canApprove ? "border-warn/30" : ""}>
      <div className="font-extrabold flex items-center gap-2 mb-1">
        {canApprove ? <><Inbox className="size-4 text-warn" /> Event requests to review</> : <><Hourglass className="size-4 text-warn" /> Your event requests</>}
        {pending.length > 0 && <Badge color="#ffd166">{pending.length}</Badge>}
      </div>
      <div className="text-xs text-ink-3 mb-3">
        {canApprove ? "Members proposed these events. Once you approve, everyone in the project can see and help plan them." : "A leader (president, VP or Head of Events) reviews new events before the whole team sees them."}
      </div>
      <ul className="space-y-2">
        {pending.slice(0, compact ? 3 : 20).map((e) => {
          const who = members.find((m) => m.id === e.requested_by);
          return (
            <li key={e.id} className="flex items-start gap-3 rounded-xl border border-line p-3">
              <Avatar name={who?.full_name} size={30} />
              <div className="flex-1 min-w-0">
                <Link href={`/p/${projectId}/events/${e.id}`} className="text-sm font-semibold hover:text-accent">{e.name}</Link>
                <div className="text-[11px] text-ink-3">{who ? `${who.full_name} · ` : ""}{fmtDate(e.starts_at, { weekday: "short", month: "short", day: "numeric" })}{e.location ? ` · ${e.location}` : ""}</div>
                {e.description && !compact && <div className="text-sm text-ink-2 mt-1 line-clamp-2">{e.description}</div>}
              </div>
              {canApprove ? (
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" onClick={() => decide(e, true)} loading={busy === e.id}><Check className="size-3.5" /> Approve</Button>
                  <Button size="sm" variant="ghost" onClick={() => decide(e, false)} disabled={busy === e.id} title="Decline"><X className="size-3.5" /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 shrink-0"><Badge color="#ffd166">Awaiting approval</Badge>
                  <Button size="sm" variant="ghost" onClick={() => withdraw(e)} loading={busy === e.id}>Withdraw</Button></div>
              )}
            </li>
          );
        })}
        {myDeclined.map((e) => (
          <li key={e.id} className="flex items-start gap-3 rounded-xl border border-bad/25 p-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{e.name} <Badge color="#ff7a85">Declined</Badge></div>
              {e.decision_note && <div className="text-xs text-ink-2 mt-1 italic">&ldquo;{e.decision_note}&rdquo;</div>}
            </div>
            <Button size="sm" variant="ghost" onClick={() => withdraw(e)} loading={busy === e.id}>Dismiss</Button>
          </li>
        ))}
      </ul>
      {err && <div className="text-sm text-bad mt-2">{err}</div>}
    </Card>
  );
}
