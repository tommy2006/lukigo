"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, X, Inbox } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PORTAL_ROLES } from "@/lib/roles";
import type { JoinRequest, Profile } from "@/lib/types";
import { Avatar, Badge, Button, Card, fmtDate } from "@/components/ui";

/** Pending portal join requests for leaders (president / VP / Head of HR). Renders nothing when empty. */
export function JoinRequests({ projectId, onDecided }: { projectId: string; onDecided: () => void }) {
  const [reqs, setReqs] = useState<(JoinRequest & { profile?: Profile })[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const sb = supabase();
    const { data } = await sb.from("join_requests").select("*").eq("project_id", projectId).eq("status", "pending").order("created_at");
    const rs = (data as JoinRequest[]) || [];
    if (!rs.length) { setReqs([]); return; }
    const { data: profs } = await sb.from("profiles").select("*").in("id", rs.map((r) => r.user_id));
    const byId = new Map(((profs as Profile[]) || []).map((p) => [p.id, p]));
    setReqs(rs.map((r) => ({ ...r, profile: byId.get(r.user_id) })));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function decide(id: string, accept: boolean) {
    setBusy(id); setErr("");
    const { error } = await supabase().rpc("decide_join_request", { p_id: id, p_accept: accept });
    setBusy(null);
    if (error) { setErr(error.message); return; }
    await load(); onDecided();
  }

  if (!reqs.length) return null;
  return (
    <Card className="border-accent/30">
      <div className="font-extrabold flex items-center gap-2 mb-3"><Inbox className="size-4 text-accent" /> Join requests from the portal <Badge color="#ff9a76">{reqs.length}</Badge></div>
      <ul className="space-y-2">
        {reqs.map((r) => {
          const role = PORTAL_ROLES.find((x) => x.k === r.role);
          return (
            <li key={r.id} className="flex items-start gap-3 rounded-xl border border-line p-3">
              <Avatar name={r.profile?.full_name} size={34} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{r.profile?.full_name || "Someone"} <span className="text-ink-3 font-normal">wants to join as</span> {role?.label}</div>
                <div className="text-[11px] text-ink-3">{[r.profile?.school, r.profile?.grade && `Grade ${r.profile.grade}`, r.profile?.email, fmtDate(r.created_at)].filter(Boolean).join(" · ")}</div>
                {r.message && <div className="text-sm text-ink-2 mt-1.5 italic">&ldquo;{r.message}&rdquo;</div>}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" onClick={() => decide(r.id, true)} loading={busy === r.id}><Check className="size-3.5" /> Accept</Button>
                <Button size="sm" variant="ghost" onClick={() => decide(r.id, false)} disabled={busy === r.id}><X className="size-3.5" /></Button>
              </div>
            </li>
          );
        })}
      </ul>
      {err && <div className="text-sm text-bad mt-2">{err}</div>}
    </Card>
  );
}
