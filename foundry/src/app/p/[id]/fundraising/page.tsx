"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, ExternalLink, Pencil, Plug, Plus, Sparkles, Trash2, Zap, Building2 } from "lucide-react";
import { ModuleGate } from "@/components/module-gate";
import { useProject } from "@/components/project-context";
import { supabase } from "@/lib/supabase";
import { askAI } from "@/lib/ai/client";
import { activeLinks, hasSub } from "@/lib/modules";
import { can } from "@/lib/roles";
import type { Donation, EventRow, Fundraiser } from "@/lib/types";
import { AIBox, Avatar, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Progress, Select, Spinner, Stat, Textarea, Tip, cx, fmtDate, fmtMoney } from "@/components/ui";
import { NoPerm, pct, sum, useRows } from "@/components/modules/shared";

const PLATFORMS: Record<string, { label: string; color: string }> = {
  manual: { label: "Cash / manual", color: "#d4d4d8" },
  gofundme: { label: "GoFundMe", color: "#7ee0a8" },
  givebutter: { label: "Givebutter", color: "#ffd88a" },
  stripe: { label: "Stripe", color: "#b9a6ff" },
  paypal: { label: "PayPal", color: "#7aa8ff" },
  zeffy: { label: "Zeffy", color: "#ff9ad5" },
};
const DEMO_DONORS = ["Maya Chen", "Jordan Patel", "The Okafor Family", "Liam Nguyen", "Sofia Ramirez", "Mr. Thompson", "Ava Kim", "Anonymous", "Noah Williams", "Priya Shah", "Ethan Brooks", "Grandma Rose"];
const DEMO_MSGS = ["So proud of you all!", "Keep it up 💛", null, "For the kids!", "Amazing cause.", null, "Happy to help!", null];

export default function FundraisingPage() {
  return <ModuleGate id="fundraising"><Fundraising /></ModuleGate>;
}

function Fundraising() {
  const { project, stack, me } = useProject();
  const [fundraisers, reloadF, loadingF] = useRows<Fundraiser>("fundraisers", project.id);
  const [donations, , , setDonations] = useRows<Donation>("donations", project.id);
  const links = activeLinks(stack);
  const eventsLinked = links.some((l) => l.from === "events" && l.to === "fundraising");
  const financeLinked = links.some((l) => l.from === "fundraising" && l.to === "finance");
  const [events] = useRows<EventRow>("events", eventsLinked ? project.id : null, "starts_at", true);
  const canEdit = can(me, "fundraising", "edit");
  const canManage = can(me, "fundraising", "manage");
  const sub = (s: string) => hasSub(stack, "fundraising", s);

  const [campaignModal, setCampaignModal] = useState<Fundraiser | "new" | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [toast, setToast] = useState<Donation | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- realtime live feed
  useEffect(() => {
    const ch = supabase()
      .channel(`donations-${project.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "donations", filter: `project_id=eq.${project.id}` }, (payload) => {
        const d = payload.new as Donation;
        setDonations((prev) => (prev.some((x) => x.id === d.id) ? prev : [d, ...prev]));
        setToast(d); setFresh(d.id);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => { setToast(null); setFresh(null); }, 4500);
      })
      .subscribe();
    return () => { supabase().removeChannel(ch); };
  }, [project.id, setDonations]);

  async function recordDonation(d: { fundraiser_id: string | null; donor_name: string; amount: number; message: string | null; source: string }) {
    const { data, error } = await supabase().from("donations").insert({ project_id: project.id, ...d }).select().single();
    if (error) { alert(error.message); return false; }
    const row = data as Donation;
    setDonations((prev) => (prev.some((x) => x.id === row.id) ? prev : [row, ...prev]));
    setFresh(row.id);
    if (financeLinked) {
      await supabase().from("transactions").insert({
        project_id: project.id, kind: "income", category: d.source === "sponsor" ? "sponsorship" : "donation", amount: d.amount,
        description: `${d.source === "sponsor" ? "Sponsor" : "Donation"} from ${d.donor_name}`, fundraiser_id: d.fundraiser_id, recorded_by: me?.id ?? null,
      });
    }
    return true;
  }

  async function simulate() {
    const active = fundraisers.filter((f) => f.status === "active");
    const f = active[Math.floor(Math.random() * active.length)] || fundraisers[0];
    const amounts = [5, 10, 10, 15, 20, 25, 25, 30, 50, 50, 75, 100, 150];
    await recordDonation({
      fundraiser_id: f?.id ?? null,
      donor_name: DEMO_DONORS[Math.floor(Math.random() * DEMO_DONORS.length)],
      amount: amounts[Math.floor(Math.random() * amounts.length)],
      message: DEMO_MSGS[Math.floor(Math.random() * DEMO_MSGS.length)],
      source: f && f.platform !== "manual" ? f.platform : "gofundme",
    });
  }

  const gifts = donations.filter((d) => d.source !== "sponsor");
  const sponsors = donations.filter((d) => d.source === "sponsor");
  const total = sum(donations, (d) => d.amount);
  const donorCount = new Set(gifts.map((d) => d.donor_name.toLowerCase())).size;
  const raisedFor = (fid: string) => sum(donations.filter((d) => d.fundraiser_id === fid), (d) => d.amount);

  return (
    <div>
      <PageHeader emoji="💸" title="Fundraising" accent="Tracker"
        subtitle="Set goals, watch donations roll in live, and remember everyone who helped."
        actions={<>
          {canEdit && sub("live_feed") && <Button variant="outline" onClick={simulate} title="Demo: insert a random donation"><Zap className="size-4" />Simulate donation</Button>}
          {canEdit && <Button variant="outline" onClick={() => setLogOpen(true)}><Plus className="size-4" />Log donation</Button>}
          {canEdit && sub("campaigns") && <Button onClick={() => setCampaignModal("new")}><Plus className="size-4" />New campaign</Button>}
        </>}
      />
      {!canEdit && <div className="mb-4"><NoPerm>View only — ask a treasurer or the Head of Fundraising to log donations.</NoPerm></div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Total raised" value={fmtMoney(total)} color="var(--good)" />
        <Stat label="Donors" value={donorCount} />
        <Stat label="Avg. gift" value={fmtMoney(gifts.length ? sum(gifts, (d) => d.amount) / gifts.length : 0)} />
        <Stat label="Campaigns" value={fundraisers.filter((f) => f.status === "active").length} sub={`${fundraisers.length} total`} />
      </div>
      {financeLinked && <div className="mb-6"><Tip title="Linked to Finance">Donations you log here automatically show up in your Finance ledger as income.</Tip></div>}

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6 min-w-0">
          {sub("campaigns") && (
            <section>
              <h2 className="text-lg font-bold mb-3">Campaigns <span className="serif italic grad-text font-normal">& goals</span></h2>
              {loadingF ? <Spinner /> : fundraisers.length === 0 ? (
                <Empty emoji="🎯" title="No campaigns yet" action={canEdit && <Button onClick={() => setCampaignModal("new")}><Plus className="size-4" />Start a campaign</Button>}>
                  A campaign is one fundraising push with a goal — like &ldquo;$500 for library books&rdquo;. Already have a GoFundMe or Givebutter? Add it here and connect it so donations stream in.
                </Empty>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {fundraisers.map((f) => (
                    <CampaignCard key={f.id} f={f} raised={raisedFor(f.id)} count={donations.filter((d) => d.fundraiser_id === f.id).length}
                      event={events.find((e) => e.id === f.event_id)} canEdit={canEdit} canManage={canManage}
                      onEdit={() => setCampaignModal(f)}
                      onDelete={async () => { if (confirm(`Delete campaign "${f.name}"? Donations are kept.`)) { await supabase().from("fundraisers").delete().eq("id", f.id); reloadF(); } }} />
                  ))}
                </div>
              )}
            </section>
          )}

          {sub("donor_list") && <DonorList donations={gifts} />}
          {sub("thank_you") && <ThankYou donations={gifts} fundraisers={fundraisers} project={project.name} cause={project.cause} />}
          {sub("sponsors") && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold flex items-center gap-2"><Building2 className="size-4 text-accent" />Sponsors</h2>
                {canEdit && <Button size="sm" variant="outline" onClick={() => setSponsorOpen(true)}><Plus className="size-4" />Add sponsor</Button>}
              </div>
              {sponsors.length === 0 ? <Tip>Local businesses (pizza places, banks, dentists) often sponsor student projects for $50–$500 in exchange for a logo on your flyer or a shout-out. Pitch 3 this week and log their commitments here.</Tip> : (
                <div className="divide-y divide-line">
                  {sponsors.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 py-2.5">
                      <div className="size-9 rounded-xl bg-panel-2 grid place-items-center">🏪</div>
                      <div className="flex-1 min-w-0"><div className="font-semibold">{s.donor_name}</div>{s.message && <div className="text-xs text-ink-3 truncate">{s.message}</div>}</div>
                      <div className="font-mono font-bold text-good">{fmtMoney(s.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {sub("live_feed") && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold flex items-center gap-2"><span className="live-dot" />Live donations</h3>
                <span className="text-xs text-ink-3">real-time</span>
              </div>
              {donations.length === 0 ? (
                <div className="text-sm text-ink-3 py-6 text-center">Waiting for the first donation…<br />{canEdit && <button onClick={simulate} className="text-accent mt-2">Try “Simulate donation”</button>}</div>
              ) : (
                <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
                  <AnimatePresence initial={false}>
                    {donations.slice(0, 30).map((d) => (
                      <motion.div key={d.id} layout initial={{ opacity: 0, x: 30, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }}
                        className={cx("flex items-start gap-3 rounded-xl p-2.5 transition-colors duration-1000", fresh === d.id ? "bg-good/15" : "bg-white/[0.02]")}>
                        <Avatar name={d.donor_name} size={30} />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between gap-2"><span className="font-semibold text-sm truncate">{d.donor_name}</span><span className="font-mono font-bold text-good">+{fmtMoney(d.amount)}</span></div>
                          {d.message && <div className="text-xs text-ink-2 truncate">&ldquo;{d.message}&rdquo;</div>}
                          <div className="text-[11px] text-ink-3 mt-0.5">{PLATFORMS[d.source]?.label || d.source} · {fundraisers.find((f) => f.id === d.fundraiser_id)?.name || "General"} · {fmtDate(d.created_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </Card>
          )}
          <ConnectPanel projectId={project.id} secret={project.webhook_secret} canManage={canManage} fundraisers={fundraisers} />
        </div>
      </div>

      {/* toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 rounded-2xl border border-good/40 bg-[#122019]/95 backdrop-blur px-5 py-4 shadow-2xl flex items-center gap-3">
            <div className="text-3xl">🎉</div>
            <div>
              <div className="font-bold"><span className="font-mono text-good">{fmtMoney(toast.amount)}</span> from {toast.donor_name}</div>
              <div className="text-xs text-ink-2">{toast.message || "New donation just came in!"}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={!!campaignModal} onClose={() => setCampaignModal(null)} title={campaignModal === "new" ? "New campaign" : "Edit campaign"}>
        {campaignModal && <CampaignForm projectId={project.id} f={campaignModal === "new" ? null : campaignModal} events={eventsLinked ? events : []}
          onDone={() => { setCampaignModal(null); reloadF(); }} />}
      </Modal>
      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Log a donation">
        <DonationForm fundraisers={fundraisers} onSubmit={async (d) => { if (await recordDonation(d)) setLogOpen(false); }} />
      </Modal>
      <Modal open={sponsorOpen} onClose={() => setSponsorOpen(false)} title="Add a sponsor">
        <DonationForm sponsor fundraisers={fundraisers} onSubmit={async (d) => { if (await recordDonation(d)) setSponsorOpen(false); }} />
      </Modal>
    </div>
  );
}

function CampaignCard({ f, raised, count, event, canEdit, canManage, onEdit, onDelete }: { f: Fundraiser; raised: number; count: number; event?: EventRow; canEdit: boolean; canManage: boolean; onEdit: () => void; onDelete: () => void }) {
  const p = pct(raised, Number(f.goal));
  const plat = PLATFORMS[f.platform] || PLATFORMS.manual;
  return (
    <Card className="flex gap-4 group">
      {/* thermometer */}
      <div className="flex flex-col items-center shrink-0">
        <div className="relative w-5 h-32 rounded-full bg-white/[0.07] overflow-hidden">
          <motion.div className="absolute bottom-0 inset-x-0 rounded-full bg-gradient-to-t from-good to-[#c6ffe0]" initial={{ height: 0 }} animate={{ height: `${Math.min(100, p)}%` }} transition={{ type: "spring", stiffness: 60, damping: 16 }} />
        </div>
        <div className="size-8 -mt-2 rounded-full bg-good grid place-items-center text-[10px] font-bold text-black font-mono">{Math.min(999, p)}%</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="font-bold leading-tight">{f.name}</div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
            {canEdit && <button onClick={onEdit} className="text-ink-3 hover:text-ink"><Pencil className="size-3.5" /></button>}
            {canManage && <button onClick={onDelete} className="text-ink-3 hover:text-bad"><Trash2 className="size-3.5" /></button>}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <Badge color={plat.color}>{plat.label}</Badge>
          {f.status !== "active" && <Badge color="#a1a1aa">{f.status}</Badge>}
          {event && <Badge color="#ffd88a">🎪 {event.name}</Badge>}
        </div>
        <div className="mt-3 font-mono text-2xl font-bold text-good">{fmtMoney(raised)}</div>
        <div className="text-xs text-ink-3">of {fmtMoney(f.goal)} goal · {count} gift{count === 1 ? "" : "s"}</div>
        <Progress value={p} color="var(--good)" className="mt-2" height={5} />
        <div className="text-xs text-ink-3 mt-2 flex items-center gap-2">
          {f.ends_on && <span>Ends {fmtDate(f.ends_on)}</span>}
          {f.platform_url && <a href={f.platform_url} target="_blank" rel="noreferrer" className="text-accent inline-flex items-center gap-1">Open page <ExternalLink className="size-3" /></a>}
        </div>
      </div>
    </Card>
  );
}

function CampaignForm({ projectId, f, events, onDone }: { projectId: string; f: Fundraiser | null; events: EventRow[]; onDone: () => void }) {
  const [v, setV] = useState({
    name: f?.name || "", goal: String(f?.goal ?? ""), platform: f?.platform || "manual", platform_url: f?.platform_url || "",
    starts_on: f?.starts_on || "", ends_on: f?.ends_on || "", event_id: f?.event_id || "", status: f?.status || "active",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!v.name.trim()) return;
    setSaving(true);
    const row = { project_id: projectId, name: v.name.trim(), goal: Number(v.goal) || 0, platform: v.platform, platform_url: v.platform_url || null, starts_on: v.starts_on || null, ends_on: v.ends_on || null, event_id: v.event_id || null, status: v.status };
    const { error } = f ? await supabase().from("fundraisers").update(row).eq("id", f.id) : await supabase().from("fundraisers").insert(row);
    setSaving(false);
    if (error) return alert(error.message);
    onDone();
  }
  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Campaign name"><Input autoFocus value={v.name} onChange={set("name")} placeholder="Books for Brookside Elementary" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Goal ($)"><Input type="number" min="0" value={v.goal} onChange={set("goal")} placeholder="500" /></Field>
        <Field label="Status"><Select value={v.status} onChange={set("status")}><option value="draft">Draft</option><option value="active">Active</option><option value="closed">Closed</option></Select></Field>
      </div>
      <Field label="Where do people donate?">
        <Select value={v.platform} onChange={set("platform")}>{Object.entries(PLATFORMS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</Select>
      </Field>
      {v.platform !== "manual" && <Field label="Donation page URL"><Input value={v.platform_url} onChange={set("platform_url")} placeholder="https://gofund.me/…" /></Field>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts"><Input type="date" value={v.starts_on} onChange={set("starts_on")} /></Field>
        <Field label="Ends"><Input type="date" value={v.ends_on} onChange={set("ends_on")} /></Field>
      </div>
      {events.length > 0 && (
        <Field label="For which event?" hint="optional">
          <Select value={v.event_id} onChange={set("event_id")}><option value="">— not tied to an event —</option>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
        </Field>
      )}
      <div className="flex justify-end"><Button type="submit" loading={saving}>{f ? "Save" : "Create campaign"}</Button></div>
    </form>
  );
}

function DonationForm({ fundraisers, sponsor, onSubmit }: { fundraisers: Fundraiser[]; sponsor?: boolean; onSubmit: (d: { fundraiser_id: string | null; donor_name: string; amount: number; message: string | null; source: string }) => Promise<void> }) {
  const [v, setV] = useState({ donor_name: "", amount: "", message: "", fundraiser_id: fundraisers.find((f) => f.status === "active")?.id || "", source: sponsor ? "sponsor" : "manual" });
  const [saving, setSaving] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!(Number(v.amount) > 0)) return;
    setSaving(true);
    await onSubmit({ fundraiser_id: v.fundraiser_id || null, donor_name: v.donor_name.trim() || "Anonymous", amount: Number(v.amount), message: v.message || null, source: v.source });
    setSaving(false);
  }
  return (
    <form onSubmit={go} className="space-y-4">
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <Field label={sponsor ? "Business name" : "Donor name"}><Input autoFocus value={v.donor_name} onChange={(e) => setV({ ...v, donor_name: e.target.value })} placeholder={sponsor ? "Tony's Pizza" : "Anonymous"} /></Field>
        <Field label="Amount ($)"><Input type="number" min="1" step="0.01" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} placeholder="25" /></Field>
      </div>
      {fundraisers.length > 0 && (
        <Field label="Campaign"><Select value={v.fundraiser_id} onChange={(e) => setV({ ...v, fundraiser_id: e.target.value })}><option value="">General / none</option>{fundraisers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select></Field>
      )}
      {!sponsor && (
        <Field label="How did it come in?">
          <Select value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })}>{Object.entries(PLATFORMS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</Select>
        </Field>
      )}
      <Field label={sponsor ? "What they get / notes" : "Message"} hint="optional"><Textarea className="min-h-16" value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} placeholder={sponsor ? "Logo on flyer + Instagram shout-out" : "Go team!"} /></Field>
      <div className="flex justify-end"><Button type="submit" loading={saving}>{sponsor ? "Add sponsor" : "Log donation"}</Button></div>
    </form>
  );
}

function DonorList({ donations }: { donations: Donation[] }) {
  const donors = useMemo(() => {
    const m: Record<string, { name: string; total: number; count: number; last: string }> = {};
    for (const d of donations) {
      const k = d.donor_name.trim().toLowerCase();
      m[k] ??= { name: d.donor_name, total: 0, count: 0, last: d.created_at };
      m[k].total += Number(d.amount); m[k].count++;
      if (d.created_at > m[k].last) m[k].last = d.created_at;
    }
    return Object.values(m).sort((a, b) => b.total - a.total);
  }, [donations]);
  return (
    <Card>
      <h2 className="text-lg font-bold mb-3">Donor <span className="serif italic grad-text font-normal">wall</span></h2>
      {donors.length === 0 ? <div className="text-sm text-ink-3">Your supporters will appear here. Remember them — repeat donors are the best donors.</div> : (
        <div className="grid sm:grid-cols-2 gap-2">
          {donors.slice(0, 20).map((d, i) => (
            <div key={d.name} className="flex items-center gap-3 rounded-xl bg-white/[0.02] px-3 py-2">
              <span className="w-5 text-xs font-mono text-ink-3">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
              <Avatar name={d.name} size={28} />
              <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{d.name}</div><div className="text-[11px] text-ink-3">{d.count} gift{d.count === 1 ? "" : "s"} · last {fmtDate(d.last)}</div></div>
              <span className="font-mono font-bold text-good">{fmtMoney(d.total)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ThankYou({ donations, fundraisers, project, cause }: { donations: Donation[]; fundraisers: Fundraiser[]; project: string; cause: string | null }) {
  const [notes, setNotes] = useState<{ donor: string; text: string }[] | null>(null);
  const [source, setSource] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  async function draft() {
    setLoading(true);
    try {
      const r = await askAI<{ notes: { donor: string; text: string }[] }>("thank_you", {
        project, cause,
        donors: donations.filter((d) => d.donor_name !== "Anonymous").slice(0, 5).map((d) => ({ name: d.donor_name, amount: d.amount, message: d.message, campaign: fundraisers.find((f) => f.id === d.fundraiser_id)?.name })),
      });
      setNotes(r.notes || []); setSource(r._source);
    } finally { setLoading(false); }
  }
  return (
    <AIBox title="Thank-you notes" loading={loading} source={source}
      action={<Button size="sm" variant="ai" onClick={draft} loading={loading} disabled={!donations.length}><Sparkles className="size-4" />{notes ? "Redraft" : "Draft notes"}</Button>}>
      {!notes ? <span className="text-ink-2 text-sm">{donations.length ? "Let AI draft personal thank-you messages for your 5 most recent named donors. Copy, tweak, send." : "Once donations come in, AI can draft thank-you notes for each donor."}</span> : notes.length === 0 ? <span className="text-sm text-ink-3">No named donors yet.</span> : (
        <div className="space-y-3">
          {notes.map((n, i) => (
            <div key={i} className="rounded-xl bg-white/[0.03] p-3 text-sm">
              <div className="flex justify-between mb-1"><span className="font-bold">To {n.donor}</span>
                <button onClick={() => { navigator.clipboard.writeText(n.text); setCopied(i); }} className="text-xs text-ink-3 hover:text-ink flex items-center gap-1"><Copy className="size-3" />{copied === i ? "Copied!" : "Copy"}</button></div>
              <p className="text-ink-2 whitespace-pre-wrap">{n.text}</p>
            </div>
          ))}
        </div>
      )}
    </AIBox>
  );
}

function ConnectPanel({ projectId, secret, canManage, fundraisers }: { projectId: string; secret: string; canManage: boolean; fundraisers: Fundraiser[] }) {
  const [show, setShow] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/api/webhooks/donations`;
  const body = JSON.stringify({ project_id: projectId, secret: show ? secret : "••••••••", fundraiser_id: fundraisers[0]?.id ?? null, donor_name: "Jane Doe", amount: 25, message: "Go team!", source: "gofundme" }, null, 2);
  return (
    <Card className="p-4">
      <h3 className="font-bold flex items-center gap-2 mb-1"><Plug className="size-4 text-violet" />Connect a platform</h3>
      <p className="text-xs text-ink-3 mb-3">Point GoFundMe / Givebutter / Stripe (via Zapier or their webhooks) at this URL and donations appear here instantly.</p>
      {!canManage ? <NoPerm>Only the president, VP, treasurer or Head of Fundraising can see connection secrets.</NoPerm> : (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold">POST to</div>
          <button onClick={() => navigator.clipboard.writeText(url)} className="w-full text-left font-mono text-xs rounded-lg bg-black/30 border border-line px-2.5 py-2 break-all hover:border-line-2 flex gap-2 items-start">
            <span className="flex-1">{url}</span><Copy className="size-3.5 shrink-0 mt-0.5 text-ink-3" />
          </button>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-ink-3 font-semibold pt-1">
            JSON body <button className="normal-case tracking-normal text-accent font-normal" onClick={() => setShow(!show)}>{show ? "hide secret" : "reveal secret"}</button>
          </div>
          <pre className="font-mono text-[11px] rounded-lg bg-black/30 border border-line p-2.5 overflow-x-auto text-ink-2">{body}</pre>
          {show && <button onClick={() => navigator.clipboard.writeText(secret)} className="text-xs text-accent flex items-center gap-1"><Copy className="size-3" />Copy secret</button>}
        </div>
      )}
    </Card>
  );
}
