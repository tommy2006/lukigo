"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardPaste, Copy, ExternalLink, Heart, MessageCircle, Pencil, Plus, Repeat2, Sparkles, Trash2, RefreshCw } from "lucide-react";
import { ModuleGate } from "@/components/module-gate";
import { useProject } from "@/components/project-context";
import { supabase } from "@/lib/supabase";
import { askAI } from "@/lib/ai/client";
import { activeLinks, hasSub } from "@/lib/modules";
import { can } from "@/lib/roles";
import type { EventRow, SocialAccount, SocialPost } from "@/lib/types";
import { AIBox, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Stat, Textarea, Tip, cx, fmtDate, todayISO } from "@/components/ui";
import { NoPerm, PLATFORMS, addDays, dateToTs, sum, tsToDate, useRows } from "@/components/modules/shared";

type Digest = { headline: string; summary: string; highlights: string[]; suggestions: string[]; _source?: string };
const eng = (p: SocialPost) => (p.likes || 0) + (p.comments || 0) + (p.shares || 0);
const plat = (id: string | null) => PLATFORMS[id || ""] || { label: id || "Other", color: "#a1a1aa", emoji: "🌐" };

export default function PublicityPage() {
  return <ModuleGate id="publicity"><Publicity /></ModuleGate>;
}

function Publicity() {
  const { project, stack, me } = useProject();
  const sub = (s: string) => hasSub(stack, "publicity", s);
  const eventsLinked = activeLinks(stack).some((l) => l.from === "events" && l.to === "publicity");
  const [accounts, reloadA] = useRows<SocialAccount>("social_accounts", project.id, "created_at", true);
  const [posts, reloadP, loadingP] = useRows<SocialPost>("social_posts", project.id, "posted_at", false);
  const [events] = useRows<EventRow>("events", eventsLinked ? project.id : null, "starts_at", true);
  const canEdit = can(me, "publicity", "edit");
  const canManage = can(me, "publicity", "manage");

  const [acctOpen, setAcctOpen] = useState(false);
  const [postModal, setPostModal] = useState<SocialPost | "new" | "idea" | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);

  const published = posts.filter((p) => p.status === "posted");
  const planned = posts.filter((p) => p.status !== "posted");
  const followers = sum(accounts, (a) => a.followers);
  const weekAgo = addDays(todayISO(), -7);
  const week = published.filter((p) => tsToDate(p.posted_at) >= weekAgo);

  return (
    <div>
      <PageHeader emoji="📣" title="Publicity" accent="Pulse"
        subtitle="Track what you post and how people react — and let AI tell you what to post next."
        actions={canEdit ? <>
          <Button variant="outline" onClick={() => setPasteOpen(true)}><ClipboardPaste className="size-4" />Paste a batch</Button>
          <Button onClick={() => setPostModal("new")}><Plus className="size-4" />Log a post</Button>
        </> : undefined}
      />
      {!canEdit && <div className="mb-4"><NoPerm>View only for your role.</NoPerm></div>}

      {sub("daily_digest") && !loadingP && <DigestBox project={project.name} posts={posts} events={events} accounts={accounts} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-6">
        <Stat label="Followers" value={followers.toLocaleString()} sub={`${accounts.length} account${accounts.length === 1 ? "" : "s"}`} />
        <Stat label="Posts this week" value={week.length} />
        <Stat label="Engagement (7d)" value={sum(week, eng).toLocaleString()} color="var(--violet)" />
        <Stat label="Planned" value={planned.length} sub="ideas & scheduled" />
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-6 min-w-0">
          {sub("metrics") && published.length > 0 && <Metrics posts={published} />}
          {sub("caption_ai") && <Captions project={project.name} events={events} canEdit={canEdit} onSaveIdea={async (platform, text, event_id) => {
            await supabase().from("social_posts").insert({ project_id: project.id, platform, content: text, status: "idea", event_id, posted_at: new Date().toISOString() });
            reloadP();
          }} />}
          <Card>
            <h2 className="text-lg font-bold mb-3">Posts</h2>
            {published.length === 0 ? (
              <Empty emoji="📸" title="No posts logged yet" action={canEdit && <Button onClick={() => setPostModal("new")}><Plus className="size-4" />Log your first post</Button>}>
                Every time your team posts, log it here with its likes/comments/shares (or paste a batch). Foundry will tell you what&apos;s working.
              </Empty>
            ) : (
              <div className="space-y-2">
                {published.map((p) => <PostRow key={p.id} p={p} event={events.find((e) => e.id === p.event_id)} canEdit={canEdit} canManage={canManage} onEdit={() => setPostModal(p)}
                  onDelete={async () => { if (confirm("Delete this post?")) { await supabase().from("social_posts").delete().eq("id", p.id); reloadP(); } }} />)}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {sub("accounts") && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold">Accounts</h3>
                {canEdit && <Button size="sm" variant="ghost" onClick={() => setAcctOpen(true)}><Plus className="size-4" />Add</Button>}
              </div>
              {accounts.length === 0 ? <div className="text-sm text-ink-3">Add your Instagram, TikTok, etc. so you can track followers and tag posts.</div> : (
                <div className="space-y-2">
                  {accounts.map((a) => {
                    const pl = plat(a.platform);
                    return (
                      <div key={a.id} className="flex items-center gap-3 rounded-xl bg-white/[0.02] px-3 py-2 group">
                        <div className="size-8 rounded-lg grid place-items-center" style={{ background: pl.color + "22" }}>{pl.emoji}</div>
                        <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">@{a.handle.replace(/^@/, "")}</div><div className="text-[11px] text-ink-3">{pl.label}</div></div>
                        <div className="font-mono text-sm">{a.followers.toLocaleString()}</div>
                        {canManage && <button onClick={async () => { await supabase().from("social_accounts").delete().eq("id", a.id); reloadA(); }} className="text-ink-3 hover:text-bad opacity-0 group-hover:opacity-100"><Trash2 className="size-3.5" /></button>}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
          {sub("content_calendar") && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold">Content calendar</h3>
                {canEdit && <Button size="sm" variant="ghost" onClick={() => setPostModal("idea")}><Plus className="size-4" />Plan</Button>}
              </div>
              {planned.length === 0 ? <Tip>Plan posts ahead — a teaser 1 week before each event, a reminder the day before, and a recap after.</Tip> : (
                <div className="space-y-2">
                  {[...planned].sort((a, b) => a.posted_at.localeCompare(b.posted_at)).map((p) => (
                    <button key={p.id} onClick={() => canEdit && setPostModal(p)} className="w-full text-left flex gap-3 rounded-xl bg-white/[0.02] px-3 py-2 hover:bg-white/[0.04]">
                      <div className="text-center w-10 shrink-0"><div className="text-[10px] uppercase text-ink-3">{fmtDate(p.posted_at, { month: "short" })}</div><div className="font-mono font-bold">{fmtDate(p.posted_at, { day: "numeric" })}</div></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex gap-1.5 mb-0.5"><Badge color={plat(p.platform).color}>{plat(p.platform).label}</Badge><Badge color={p.status === "scheduled" ? "#9ad8ff" : "#a1a1aa"}>{p.status}</Badge></div>
                        <div className="text-xs text-ink-2 line-clamp-2">{p.content}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      <Modal open={acctOpen} onClose={() => setAcctOpen(false)} title="Add a social account">
        <AccountForm projectId={project.id} onDone={() => { setAcctOpen(false); reloadA(); }} />
      </Modal>
      <Modal open={!!postModal} onClose={() => setPostModal(null)} title={typeof postModal === "object" && postModal ? "Edit post" : postModal === "idea" ? "Plan a post" : "Log a post"} wide>
        {postModal && <PostForm projectId={project.id} p={typeof postModal === "object" ? postModal : null} idea={postModal === "idea"} accounts={accounts} events={events}
          onDone={() => { setPostModal(null); reloadP(); }} />}
      </Modal>
      <Modal open={pasteOpen} onClose={() => setPasteOpen(false)} title="Paste a batch of posts" wide>
        <PasteBatch projectId={project.id} onDone={() => { setPasteOpen(false); reloadP(); }} />
      </Modal>
    </div>
  );
}

function DigestBox({ project, posts, events, accounts }: { project: string; posts: SocialPost[]; events: EventRow[]; accounts: SocialAccount[] }) {
  const [d, setD] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(false);
  const ran = useRef(false);
  const run = async () => {
    setLoading(true);
    const weekAgo = addDays(todayISO(), -7);
    try {
      setD(await askAI<Digest>("publicity_digest", {
        project, today: todayISO(),
        posts: posts.filter((p) => tsToDate(p.posted_at) >= weekAgo).slice(0, 30).map((p) => ({ platform: p.platform, content: p.content.slice(0, 200), posted_at: p.posted_at, likes: p.likes, comments: p.comments, shares: p.shares, status: p.status, event: events.find((e) => e.id === p.event_id)?.name ?? null })),
        upcoming_events: events.filter((e) => e.starts_at && e.starts_at >= new Date().toISOString() && !["done", "cancelled"].includes(e.status)).slice(0, 5).map((e) => ({ name: e.name, starts_at: e.starts_at })),
        accounts: accounts.map((a) => ({ platform: a.platform, handle: a.handle, followers: a.followers })),
      }));
    } catch { /* keep previous */ }
    setLoading(false);
  };
  const runRef = useRef(run);
  useEffect(() => { runRef.current = run; });
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    runRef.current();
  }, []);
  return (
    <AIBox title={`Today on your socials · ${fmtDate(todayISO(), { weekday: "long", month: "short", day: "numeric" })}`} loading={loading && !d} source={d?._source}
      action={<button onClick={run} className="text-ink-3 hover:text-ink" title="Refresh"><RefreshCw className={cx("size-4", loading && "animate-spin")} /></button>}>
      {d && (
        <div>
          <div className="text-xl font-bold mb-1">{d.headline}</div>
          <p className="text-ink-2">{d.summary}</p>
          <div className="grid sm:grid-cols-2 gap-4 mt-4 text-sm">
            {(d.highlights || []).length > 0 && <div><div className="font-bold text-violet mb-1">Highlights</div><ul className="space-y-1 text-ink-2">{d.highlights.map((h, i) => <li key={i}>• {h}</li>)}</ul></div>}
            {(d.suggestions || []).length > 0 && <div><div className="font-bold text-accent mb-1">Post next</div><ul className="space-y-1 text-ink-2">{d.suggestions.map((h, i) => <li key={i}>→ {h}</li>)}</ul></div>}
          </div>
        </div>
      )}
    </AIBox>
  );
}

function PostRow({ p, event, canEdit, canManage, onEdit, onDelete }: { p: SocialPost; event?: EventRow; canEdit: boolean; canManage: boolean; onEdit: () => void; onDelete: () => void }) {
  const pl = plat(p.platform);
  return (
    <motion.div layout className="flex gap-3 rounded-xl bg-white/[0.02] p-3 group">
      <div className="size-9 rounded-lg grid place-items-center shrink-0" style={{ background: pl.color + "22" }}>{pl.emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3 mb-1">
          <span className="font-semibold" style={{ color: pl.color }}>{pl.label}</span>
          <span>{fmtDate(p.posted_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
          {event && <Badge color="#ffd88a">🎪 {event.name}</Badge>}
          {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-accent inline-flex items-center gap-0.5">open<ExternalLink className="size-3" /></a>}
        </div>
        <div className="text-sm whitespace-pre-wrap line-clamp-3">{p.content}</div>
        <div className="flex gap-4 mt-2 text-xs text-ink-2 font-mono">
          <span className="flex items-center gap-1"><Heart className="size-3.5 text-[#ff7eb3]" />{p.likes}</span>
          <span className="flex items-center gap-1"><MessageCircle className="size-3.5 text-[#9ad8ff]" />{p.comments}</span>
          <span className="flex items-center gap-1"><Repeat2 className="size-3.5 text-good" />{p.shares}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100">
        {canEdit && <button onClick={onEdit} className="text-ink-3 hover:text-ink"><Pencil className="size-3.5" /></button>}
        {canManage && <button onClick={onDelete} className="text-ink-3 hover:text-bad"><Trash2 className="size-3.5" /></button>}
      </div>
    </motion.div>
  );
}

function Metrics({ posts }: { posts: SocialPost[] }) {
  const byPlat: Record<string, { likes: number; comments: number; shares: number; n: number }> = {};
  for (const p of posts) {
    const k = p.platform || "other";
    byPlat[k] ??= { likes: 0, comments: 0, shares: 0, n: 0 };
    byPlat[k].likes += p.likes || 0; byPlat[k].comments += p.comments || 0; byPlat[k].shares += p.shares || 0; byPlat[k].n++;
  }
  const rows = Object.entries(byPlat).sort((a, b) => b[1].likes + b[1].comments + b[1].shares - (a[1].likes + a[1].comments + a[1].shares));
  const maxP = Math.max(1, ...rows.map(([, r]) => r.likes + r.comments + r.shares));
  const top = [...posts].sort((a, b) => eng(b) - eng(a)).slice(0, 6);
  const maxT = Math.max(1, ...top.map(eng));
  const Bar = ({ l, c, s, max }: { l: number; c: number; s: number; max: number }) => (
    <div className="flex h-3 rounded-full overflow-hidden bg-white/[0.05] flex-1">
      {[[l, "#ff7eb3"], [c, "#9ad8ff"], [s, "#7ee0a8"]].map(([v, col], i) => (
        <motion.div key={i} initial={{ width: 0 }} animate={{ width: `${((v as number) / max) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.1 }} style={{ background: col as string }} />
      ))}
    </div>
  );
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Engagement <span className="serif italic grad-text font-normal">metrics</span></h2>
        <div className="flex gap-3 text-[11px] text-ink-3"><span><span className="inline-block size-2 rounded-full bg-[#ff7eb3] mr-1" />likes</span><span><span className="inline-block size-2 rounded-full bg-[#9ad8ff] mr-1" />comments</span><span><span className="inline-block size-2 rounded-full bg-good mr-1" />shares</span></div>
      </div>
      <div className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold mb-2">By platform</div>
      <div className="space-y-2 mb-5">
        {rows.map(([k, r]) => (
          <div key={k} className="flex items-center gap-3 text-sm">
            <span className="w-24 truncate">{plat(k).emoji} {plat(k).label}</span>
            <Bar l={r.likes} c={r.comments} s={r.shares} max={maxP} />
            <span className="w-24 text-right font-mono text-xs text-ink-3">{(r.likes + r.comments + r.shares).toLocaleString()} · {r.n}p</span>
          </div>
        ))}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold mb-2">Top posts</div>
      <div className="space-y-2">
        {top.map((p) => (
          <div key={p.id} className="flex items-center gap-3 text-sm">
            <span className="w-48 truncate text-ink-2">{plat(p.platform).emoji} {p.content}</span>
            <Bar l={p.likes} c={p.comments} s={p.shares} max={maxT} />
            <span className="w-12 text-right font-mono text-xs text-ink-3">{eng(p)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Captions({ project, events, canEdit, onSaveIdea }: { project: string; events: EventRow[]; canEdit: boolean; onSaveIdea: (platform: string, text: string, event_id: string | null) => Promise<void> }) {
  const [eventId, setEventId] = useState("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [plats, setPlats] = useState<string[]>(["instagram", "tiktok"]);
  const [res, setRes] = useState<{ captions: { platform: string; text: string }[]; _source?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<number[]>([]);
  const ev = events.find((e) => e.id === eventId);
  async function go() {
    setLoading(true); setSaved([]);
    try {
      setRes(await askAI("captions", { project, platforms: plats, event: ev ? { name: ev.name, type: ev.type, description: ev.description, starts_at: ev.starts_at, location: ev.location } : { name: name || project, description: desc } }));
    } finally { setLoading(false); }
  }
  return (
    <AIBox title="AI caption writer" loading={loading} source={res?._source}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {events.length > 0 ? (
            <Select className="flex-1 min-w-48" value={eventId} onChange={(e) => setEventId(e.target.value)}><option value="">Pick an event to promote…</option>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
          ) : (
            <><Input className="flex-1 min-w-40" placeholder="What are you promoting?" value={name} onChange={(e) => setName(e.target.value)} /><Input className="flex-1 min-w-40" placeholder="Short details" value={desc} onChange={(e) => setDesc(e.target.value)} /></>
          )}
          <Button variant="ai" onClick={go} loading={loading} disabled={!plats.length || (events.length > 0 && !eventId)}><Sparkles className="size-4" />Write captions</Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(PLATFORMS).map(([k, p]) => {
            const on = plats.includes(k);
            return <button key={k} onClick={() => setPlats(on ? plats.filter((x) => x !== k) : [...plats, k])} className={cx("rounded-full px-2.5 py-1 text-xs border", on ? "text-ink" : "border-line text-ink-3")} style={on ? { borderColor: p.color + "77", background: p.color + "1a" } : undefined}>{p.emoji} {p.label}</button>;
          })}
        </div>
        {res?.captions?.map((c, i) => (
          <div key={i} className="rounded-xl bg-white/[0.03] p-3 text-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold" style={{ color: plat(c.platform).color }}>{plat(c.platform).emoji} {plat(c.platform).label}</span>
              <div className="flex gap-3 text-xs">
                <button onClick={() => navigator.clipboard.writeText(c.text)} className="text-ink-3 hover:text-ink flex items-center gap-1"><Copy className="size-3" />Copy</button>
                {canEdit && <button disabled={saved.includes(i)} onClick={async () => { await onSaveIdea(c.platform, c.text, ev?.id ?? null); setSaved([...saved, i]); }} className="text-accent disabled:text-good">{saved.includes(i) ? "✓ Saved" : "Save as idea"}</button>}
              </div>
            </div>
            <p className="text-ink-2 whitespace-pre-wrap">{c.text}</p>
          </div>
        ))}
      </div>
    </AIBox>
  );
}

function AccountForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [v, setV] = useState({ platform: "instagram", handle: "", followers: "" });
  const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!v.handle.trim()) return;
    setSaving(true);
    const { error } = await supabase().from("social_accounts").insert({ project_id: projectId, platform: v.platform, handle: v.handle.trim().replace(/^@/, ""), followers: Math.round(Number(v.followers) || 0) });
    setSaving(false);
    if (error) return alert(error.message);
    onDone();
  }
  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Platform"><Select value={v.platform} onChange={(e) => setV({ ...v, platform: e.target.value })}>{Object.entries(PLATFORMS).map(([k, p]) => <option key={k} value={k}>{p.emoji} {p.label}</option>)}</Select></Field>
      <Field label="Handle"><Input autoFocus value={v.handle} onChange={(e) => setV({ ...v, handle: e.target.value })} placeholder="@bookbridge.club" /></Field>
      <Field label="Followers"><Input type="number" min="0" value={v.followers} onChange={(e) => setV({ ...v, followers: e.target.value })} /></Field>
      <div className="flex justify-end"><Button type="submit" loading={saving}>Add account</Button></div>
    </form>
  );
}

function PostForm({ projectId, p, idea, accounts, events, onDone }: { projectId: string; p: SocialPost | null; idea?: boolean; accounts: SocialAccount[]; events: EventRow[]; onDone: () => void }) {
  const [v, setV] = useState({
    platform: p?.platform || accounts[0]?.platform || "instagram", content: p?.content || "", url: p?.url || "", status: p?.status || (idea ? "idea" : "posted"),
    date: tsToDate(p?.posted_at) || todayISO(), likes: String(p?.likes ?? 0), comments: String(p?.comments ?? 0), shares: String(p?.shares ?? 0), event_id: p?.event_id || "",
  });
  const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!v.content.trim()) return;
    setSaving(true);
    const row = {
      project_id: projectId, platform: v.platform, content: v.content.trim(), url: v.url || null, status: v.status,
      posted_at: v.date === tsToDate(p?.posted_at) && p ? p.posted_at : v.date === todayISO() && !p ? new Date().toISOString() : dateToTs(v.date),
      likes: Math.round(Number(v.likes) || 0), comments: Math.round(Number(v.comments) || 0), shares: Math.round(Number(v.shares) || 0),
      event_id: v.event_id || null, account_id: accounts.find((a) => a.platform === v.platform)?.id ?? null,
    };
    const { error } = p ? await supabase().from("social_posts").update(row).eq("id", p.id) : await supabase().from("social_posts").insert(row);
    setSaving(false);
    if (error) return alert(error.message);
    onDone();
  }
  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Platform"><Select value={v.platform} onChange={(e) => setV({ ...v, platform: e.target.value })}>{Object.entries(PLATFORMS).map(([k, pl]) => <option key={k} value={k}>{pl.emoji} {pl.label}</option>)}</Select></Field>
        <Field label="Status"><Select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as SocialPost["status"] })}><option value="posted">Posted</option><option value="scheduled">Scheduled</option><option value="idea">Idea</option></Select></Field>
        <Field label={v.status === "posted" ? "Posted on" : "Planned for"}><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
      </div>
      <Field label="Caption / content"><Textarea autoFocus value={v.content} onChange={(e) => setV({ ...v, content: e.target.value })} placeholder="What did you post?" /></Field>
      <Field label="Link" hint="optional"><Input value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} placeholder="https://instagram.com/p/…" /></Field>
      {v.status === "posted" && (
        <div className="grid grid-cols-3 gap-3">
          <Field label="❤️ Likes"><Input type="number" min="0" value={v.likes} onChange={(e) => setV({ ...v, likes: e.target.value })} /></Field>
          <Field label="💬 Comments"><Input type="number" min="0" value={v.comments} onChange={(e) => setV({ ...v, comments: e.target.value })} /></Field>
          <Field label="🔁 Shares"><Input type="number" min="0" value={v.shares} onChange={(e) => setV({ ...v, shares: e.target.value })} /></Field>
        </div>
      )}
      {events.length > 0 && <Field label="Promotes event" hint="optional"><Select value={v.event_id} onChange={(e) => setV({ ...v, event_id: e.target.value })}><option value="">—</option>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>}
      <div className="flex justify-end"><Button type="submit" loading={saving}>Save</Button></div>
    </form>
  );
}

function PasteBatch({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  type P = { platform: string; content: string; likes: number; comments: number; shares: number; posted_at: string };
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<P[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  async function parse() {
    setLoading(true);
    try { const r = await askAI<{ posts: P[] }>("parse_posts", { text, today: todayISO() }); setParsed(r.posts || []); } finally { setLoading(false); }
  }
  async function save() {
    if (!parsed?.length) return;
    setSaving(true);
    const { error } = await supabase().from("social_posts").insert(parsed.map((p) => ({
      project_id: projectId, platform: PLATFORMS[p.platform] ? p.platform : "instagram", content: p.content, status: "posted",
      posted_at: /^\d{4}-\d{2}-\d{2}$/.test(p.posted_at || "") ? dateToTs(p.posted_at) : new Date().toISOString(),
      likes: Math.round(Number(p.likes) || 0), comments: Math.round(Number(p.comments) || 0), shares: Math.round(Number(p.shares) || 0),
    })));
    setSaving(false);
    if (error) return alert(error.message);
    onDone();
  }
  return !parsed ? (
    <div className="space-y-4">
      <Tip>Copy your recent posts from Instagram Insights, TikTok analytics or just your notes — one post per line. AI will pull out the platform, caption and numbers.</Tip>
      <Textarea className="min-h-40 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)}
        placeholder={"Instagram: Our first book drive collected 300 books! 142 likes 18 comments 9 shares\nTikTok: day in the life of a tutor 📚 890 likes 45 comments 30 shares 2026-10-01"} />
      <div className="flex justify-end"><Button variant="ai" onClick={parse} loading={loading} disabled={!text.trim()}><Sparkles className="size-4" />Parse posts</Button></div>
    </div>
  ) : (
    <div className="space-y-3">
      <div className="text-sm text-ink-2">Found <b>{parsed.length}</b> post{parsed.length === 1 ? "" : "s"}:</div>
      <div className="max-h-[50vh] overflow-y-auto space-y-1.5">
        {parsed.map((p, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
            <span>{plat(p.platform).emoji}</span><span className="flex-1 truncate">{p.content}</span>
            <span className="font-mono text-xs text-ink-3">❤️{p.likes} 💬{p.comments} 🔁{p.shares}</span>
            <button onClick={() => setParsed(parsed.filter((_, j) => j !== i))} className="text-ink-3 hover:text-bad"><Trash2 className="size-3.5" /></button>
          </div>
        ))}
      </div>
      <div className="flex justify-between"><Button variant="ghost" onClick={() => setParsed(null)}>← Edit text</Button><Button onClick={save} loading={saving} disabled={!parsed.length}>Import {parsed.length} posts</Button></div>
    </div>
  );
}
