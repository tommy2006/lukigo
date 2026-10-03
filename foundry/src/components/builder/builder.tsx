"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, ChevronDown, Check, Lock, Rocket, Plus, Link2, Unlink, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MODULES, MODULE_MAP, LINKS, defaultSubmodules, defaultStack, type ModuleDef } from "@/lib/modules";
import type { ModuleId, Project, StackItem } from "@/lib/types";
import { DRAFT_KEY, type Draft } from "@/lib/draft";
import { Button, Card, Field, Input, Textarea, Tip, cx } from "@/components/ui";
import { Logo } from "@/components/logo";

const COLORS = ["#ff9a76", "#ffd88a", "#7ee0b0", "#9ad8ff", "#b9a6ff", "#ff8fb1"];

export function Builder() {
  const router = useRouter();
  const params = useSearchParams();
  const projectId = params.get("project");
  const [stack, setStack] = useState<StackItem[]>([]);
  const [meta, setMeta] = useState({ name: "", tagline: "", emoji: "🌱", color: COLORS[0], description: "", cause: "community", location: "" });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<ModuleId | null>(null);
  const [dragging, setDragging] = useState<ModuleId | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      if (projectId) {
        const { data } = await supabase().from("projects").select("*").eq("id", projectId).maybeSingle();
        const p = data as Project | null;
        if (p) {
          setStack(p.modules?.stack || []);
          setMeta({ name: p.name, tagline: p.tagline || "", emoji: p.emoji || "🌱", color: p.color || COLORS[0], description: p.description || "", cause: p.cause || "community", location: p.location || "" });
        }
      } else {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (raw) {
          const d = JSON.parse(raw) as Draft;
          setStack(d.stack || []);
          setReasons(d.reasons || {});
          setMeta((m) => ({ ...m, name: d.name || "", tagline: d.tagline || "", emoji: d.emoji || "🌱", description: d.description || "", cause: d.cause || "community", location: d.location || "" }));
        }
      }
      setLoaded(true);
    })();
  }, [projectId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const inStack = useMemo(() => new Set(stack.map((s) => s.id)), [stack]);

  function add(id: ModuleId, at?: number) {
    if (inStack.has(id)) return;
    const item = { id, submodules: defaultSubmodules(id) };
    setStack((s) => { const n = [...s]; n.splice(at ?? n.length, 0, item); return n; });
    setOpen(id);
  }
  function remove(id: ModuleId) { setStack((s) => s.filter((x) => x.id !== id)); }
  function toggleSub(id: ModuleId, sub: string) {
    setStack((s) => s.map((x) => x.id !== id ? x : { ...x, submodules: x.submodules.includes(sub) ? x.submodules.filter((y) => y !== sub) : [...x.submodules, sub] }));
  }

  function onDragStart(e: DragStartEvent) {
    const d = e.active.data.current as { mid: ModuleId } | undefined;
    setDragging(d?.mid ?? (e.active.id as ModuleId));
  }
  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const { active, over } = e;
    if (!over) return;
    const from = (active.data.current as { from?: string } | undefined)?.from;
    if (from === "palette") {
      const mid = (active.data.current as { mid: ModuleId }).mid;
      const idx = stack.findIndex((s) => s.id === over.id);
      add(mid, idx >= 0 ? idx + 1 : undefined);
    } else if (active.id !== over.id) {
      const a = stack.findIndex((s) => s.id === active.id);
      const b = stack.findIndex((s) => s.id === over.id);
      if (a >= 0 && b >= 0) setStack((s) => arrayMove(s, a, b));
    }
  }

  async function launch() {
    setErr("");
    if (!meta.name.trim()) { setErr("Give your project a name first."); return; }
    if (!stack.length) { setErr("Snap in at least one module."); return; }
    setSaving(true);
    const sb = supabase();
    if (projectId) {
      const { error } = await sb.from("projects").update({ modules: { stack }, name: meta.name, tagline: meta.tagline, emoji: meta.emoji, color: meta.color, description: meta.description, location: meta.location || null }).eq("id", projectId);
      setSaving(false);
      if (error) { setErr(error.message); return; }
      router.push(`/p/${projectId}`);
    } else {
      const { data, error } = await sb.rpc("create_project", {
        p_name: meta.name, p_tagline: meta.tagline, p_description: meta.description, p_cause: meta.cause,
        p_emoji: meta.emoji, p_color: meta.color, p_modules: { stack },
      });
      setSaving(false);
      if (error) { setErr(error.message); return; }
      if (meta.location) await sb.from("projects").update({ location: meta.location }).eq("id", data);
      sessionStorage.removeItem(DRAFT_KEY);
      router.push(`/p/${data}?welcome=1`);
    }
  }

  const featureCount = stack.reduce((n, s) => n + s.submodules.length, 0);
  const stepState = [stack.length > 0, featureCount > 0 && open !== null || featureCount > 3, !!meta.name.trim()];

  if (!loaded) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-line">
        <div className="flex items-center gap-6">
          <Link href={projectId ? `/p/${projectId}` : "/home"}><Logo /></Link>
          <div className="hidden md:flex items-center gap-2">
            {["Snap in modules", "Pick features", projectId ? "Save" : "Name & launch"].map((s, i) => (
              <div key={s} className={cx("flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1 border", stepState[i] ? "border-good/40 text-good" : "border-line text-ink-3")}>
                {stepState[i] ? <Check className="size-3" /> : <span className="font-mono">{i + 1}</span>} {s}
              </div>
            ))}
          </div>
        </div>
        <div className="text-sm text-ink-3 font-mono">{stack.length} modules · {featureCount} features</div>
      </header>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex-1 grid lg:grid-cols-[280px_1fr_340px] min-h-0">
          {/* PALETTE */}
          <aside className="border-r border-line p-5 space-y-3 overflow-y-auto">
            <div>
              <div className="text-[12px] font-bold uppercase tracking-wider text-ink-3">Module shelf</div>
              <p className="text-xs text-ink-3 mt-1">Drag a block onto the canvas — or just click it.</p>
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-3 pt-2">Essentials</div>
            {MODULES.filter((m) => m.core).map((m) => <PaletteBlock key={m.id} m={m} used={inStack.has(m.id)} onAdd={() => add(m.id)} />)}
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-3 pt-2">Optional add-ons</div>
            {MODULES.filter((m) => !m.core).map((m) => <PaletteBlock key={m.id} m={m} used={inStack.has(m.id)} onAdd={() => add(m.id)} />)}
            <div className="rounded-xl border border-dashed border-line-2 p-3 text-xs text-ink-3 flex items-center gap-2"><Lock className="size-3.5" /> More modules coming soon (Volunteer shifts, Grants, Partners…)</div>
          </aside>

          {/* CANVAS */}
          <Canvas>
            <div className="max-w-xl mx-auto">
              <CoreBlock meta={meta} />
              <SortableContext items={stack.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <AnimatePresence initial={false}>
                  {stack.map((s) => (
                    <StackBlock key={s.id} item={s} reason={reasons[s.id]} open={open === s.id}
                      onToggleOpen={() => setOpen(open === s.id ? null : s.id)} onRemove={() => remove(s.id)} onToggleSub={(sub) => toggleSub(s.id, sub)} />
                  ))}
                </AnimatePresence>
              </SortableContext>
              <DropHint empty={!stack.length} onDefaults={() => { setStack(defaultStack()); setOpen("events"); }} />
            </div>
          </Canvas>

          {/* RIGHT PANEL */}
          <aside className="border-l border-line p-5 space-y-5 overflow-y-auto">
            <Connections stack={stack} />
            <Card className="space-y-3">
              <div className="font-bold">{projectId ? "Project details" : "Name your project"}</div>
              <div className="flex gap-2">
                <Input value={meta.emoji} onChange={(e) => setMeta({ ...meta, emoji: e.target.value })} className="!w-14 shrink-0 text-2xl text-center px-1" />
                <Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder="Project name" className="font-bold" />
              </div>
              <Input value={meta.tagline} onChange={(e) => setMeta({ ...meta, tagline: e.target.value })} placeholder="One-line tagline" />
              <Input value={meta.location} onChange={(e) => setMeta({ ...meta, location: e.target.value })} placeholder="📍 City, country (tailors AI to your area)" />
              <Field label="Description"><Textarea value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} className="min-h-20 text-[13px]" placeholder="What does your project do?" /></Field>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setMeta({ ...meta, color: c })} className={cx("size-7 rounded-full border-2", meta.color === c ? "border-white" : "border-transparent")} style={{ background: c }} />
                ))}
              </div>
              {err && <div className="text-sm text-bad">{err}</div>}
              <Button size="lg" className="w-full" onClick={launch} loading={saving}>
                <Rocket className="size-4" /> {projectId ? "Save changes" : "Launch project"}
              </Button>
              {!projectId && <p className="text-[11px] text-ink-3 text-center">You&apos;ll be the President. You can invite your team right after.</p>}
            </Card>
          </aside>
        </div>
        <DragOverlay dropAnimation={{ duration: 180 }}>
          {dragging ? <BlockFace m={MODULE_MAP[dragging]} lifted /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/* ---------- pieces ---------- */

function Canvas({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });
  return (
    <section ref={setNodeRef} className={cx("dot-grid p-8 md:p-12 overflow-y-auto transition-colors", isOver && "bg-accent/[0.03]")}>
      {children}
    </section>
  );
}

function PaletteBlock({ m, used, onAdd }: { m: ModuleDef; used: boolean; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `pal:${m.id}`, data: { from: "palette", mid: m.id }, disabled: used });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={() => !used && onAdd()}
      className={cx("transition", used ? "opacity-35 cursor-not-allowed" : "cursor-grab active:cursor-grabbing hover:-translate-y-0.5", isDragging && "opacity-30")}>
      <BlockFace m={m} small used={used} />
    </div>
  );
}

/** The illustrated "puzzle" block. */
function BlockFace({ m, small, lifted, used }: { m: ModuleDef; small?: boolean; lifted?: boolean; used?: boolean }) {
  return (
    <div className={cx("relative rounded-2xl font-bold select-none", small ? "px-3.5 py-3" : "px-5 py-4", lifted && "shadow-2xl rotate-[-2deg] scale-105")}
      style={{ background: m.color, color: m.ink, boxShadow: lifted ? `0 20px 50px -10px ${m.color}aa` : `inset 0 -3px 0 rgba(0,0,0,0.12)` }}>
      <span className="absolute -top-[7px] left-6 w-10 h-2 rounded-t-md" style={{ background: m.color }} />
      <div className="flex items-center gap-2.5">
        <span className={small ? "text-lg" : "text-2xl"}>{m.emoji}</span>
        <div className="min-w-0">
          <div className={small ? "text-sm" : "text-base"}>{m.name}</div>
          {small && <div className="text-[11px] font-medium opacity-75 leading-tight line-clamp-2">{m.tagline}</div>}
        </div>
        {used && <Check className="size-4 ml-auto shrink-0" />}
        {!used && small && <Plus className="size-4 ml-auto shrink-0 opacity-60" />}
      </div>
    </div>
  );
}

function CoreBlock({ meta }: { meta: { name: string; emoji: string; tagline: string; color: string } }) {
  return (
    <div className="relative rounded-t-[28px] rounded-b-2xl bg-[#f4efe9] text-[#1a1020] px-6 py-5 shadow-xl">
      <div className="absolute -bottom-[7px] left-6 w-10 h-2 rounded-b-md bg-[#f4efe9]" />
      <div className="text-[11px] font-bold uppercase tracking-widest text-[#1a1020]/50">Project core</div>
      <div className="flex items-center gap-3 mt-1">
        <span className="text-3xl">{meta.emoji || "🌱"}</span>
        <div>
          <div className="text-xl font-extrabold">{meta.name || <span className="opacity-40">Untitled project</span>}</div>
          {meta.tagline && <div className="text-sm opacity-60">{meta.tagline}</div>}
        </div>
        <div className="ml-auto size-4 rounded-full" style={{ background: meta.color }} />
      </div>
    </div>
  );
}

function StackBlock({ item, reason, open, onToggleOpen, onRemove, onToggleSub }: {
  item: StackItem; reason?: string; open: boolean; onToggleOpen: () => void; onRemove: () => void; onToggleSub: (s: string) => void;
}) {
  const m = MODULE_MAP[item.id];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, data: { from: "stack" } });
  return (
    <motion.div ref={setNodeRef} layout initial={{ opacity: 0, y: -14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 40, transition: { duration: 0.15 } }}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={cx("relative mt-2 ml-5", isDragging && "opacity-40")}>
      {/* connector spine */}
      <span className="absolute -left-5 top-0 bottom-0 w-[3px] rounded-full bg-white/10" />
      <span className="absolute -left-5 top-7 w-5 h-[3px] bg-white/10" />
      <div className="relative rounded-2xl" style={{ background: m.color, color: m.ink, boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.12), 0 10px 30px -15px rgba(0,0,0,0.6)" }}>
        <span className="absolute -top-[7px] left-6 w-10 h-2 rounded-t-md" style={{ background: m.color }} />
        <div className="flex items-center gap-3 px-4 py-3.5">
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing opacity-50 hover:opacity-100"><GripVertical className="size-4" /></button>
          <span className="text-2xl">{m.emoji}</span>
          <button onClick={onToggleOpen} className="flex-1 text-left min-w-0">
            <div className="font-extrabold flex items-center gap-2">{m.name}
              {!m.core && <span className="text-[10px] uppercase tracking-wider bg-black/10 rounded px-1.5 py-0.5">add-on</span>}
            </div>
            <div className="text-xs font-medium opacity-75">{item.submodules.length} of {m.submodules.length} features on · click to customize</div>
          </button>
          <ChevronDown onClick={onToggleOpen} className={cx("size-5 cursor-pointer transition", open && "rotate-180")} />
          <button onClick={onRemove} className="opacity-50 hover:opacity-100" title="Remove module"><X className="size-4" /></button>
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="px-4 pb-4">
                {reason && <div className="text-[13px] rounded-lg bg-black/10 px-3 py-2 mb-3 flex gap-2"><Sparkles className="size-3.5 shrink-0 mt-0.5" />{reason}</div>}
                <div className="grid sm:grid-cols-2 gap-2">
                  {m.submodules.map((s) => {
                    const on = item.submodules.includes(s.id);
                    return (
                      <button key={s.id} onClick={() => onToggleSub(s.id)}
                        className={cx("text-left rounded-xl px-3 py-2.5 transition border-2", on ? "bg-white/70 border-black/10" : "bg-black/5 border-transparent opacity-70 hover:opacity-100")}>
                        <div className="flex items-center gap-2 text-sm font-bold">
                          <span className={cx("size-4 rounded grid place-items-center border-2", on ? "bg-current border-current" : "border-current/40")} style={on ? { borderColor: m.ink } : {}}>
                            {on && <Check className="size-3" style={{ color: m.color }} />}
                          </span>
                          {s.name}
                        </div>
                        <div className="text-[11.5px] font-medium opacity-75 mt-0.5 leading-snug">{s.blurb}</div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3 text-[11px] font-semibold">
                  {m.provides.map((p) => <span key={p} className="rounded-full bg-black/10 px-2 py-0.5">↗ shares {p}</span>)}
                  {m.consumes.map((p) => <span key={p} className="rounded-full border border-current/30 px-2 py-0.5">↘ uses {p}</span>)}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function DropHint({ empty, onDefaults }: { empty: boolean; onDefaults: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: "drop-end" });
  return (
    <div ref={setNodeRef} className={cx("mt-3 ml-5 rounded-2xl border-2 border-dashed p-6 text-center transition", isOver ? "border-accent bg-accent/10" : "border-line-2")}>
      {empty ? (
        <>
          <div className="text-ink-2 font-semibold">Drop your first module here</div>
          <div className="text-ink-3 text-sm mt-1">Not sure where to start? Most projects begin with the four essentials.</div>
          <Button variant="outline" size="sm" className="mt-4" onClick={onDefaults}><Plus className="size-4" /> Add the 4 essentials</Button>
        </>
      ) : (
        <div className="text-ink-3 text-sm">Drop another module here to snap it on</div>
      )}
    </div>
  );
}

function Connections({ stack }: { stack: StackItem[] }) {
  const ids = new Set(stack.map((s) => s.id));
  const live = LINKS.filter((l) => ids.has(l.from) && ids.has(l.to));
  const locked = LINKS.filter((l) => ids.has(l.from) !== ids.has(l.to));
  return (
    <div className="space-y-3">
      <div>
        <div className="font-bold flex items-center gap-2"><Link2 className="size-4 text-good" /> Connections</div>
        <p className="text-xs text-ink-3 mt-0.5">Modules share data with each other. Each live link unlocks an integration.</p>
      </div>
      {live.length === 0 && locked.length === 0 && <div className="text-sm text-ink-3">Add modules to see how they connect.</div>}
      <AnimatePresence>
        {live.map((l) => <LinkRow key={`${l.from}-${l.to}`} l={l} live />)}
        {locked.map((l) => <LinkRow key={`${l.from}-${l.to}`} l={l} missing={ids.has(l.from) ? l.to : l.from} />)}
      </AnimatePresence>
      {stack.length > 0 && stack.length < 3 && <Tip>Event Manager is the heart of most projects — almost everything else connects to it.</Tip>}
    </div>
  );
}

function LinkRow({ l, live, missing }: { l: (typeof LINKS)[number]; live?: boolean; missing?: ModuleId }) {
  const a = MODULE_MAP[l.from], b = MODULE_MAP[l.to];
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      className={cx("rounded-xl border px-3 py-2.5", live ? "border-good/30 bg-good/[0.06]" : "border-line border-dashed")}>
      <div className="flex items-center gap-2">
        <span className="size-6 rounded-md grid place-items-center text-xs" style={{ background: a.color, opacity: missing === l.from ? 0.3 : 1 }}>{a.emoji}</span>
        <span className={cx("flex-1 h-[2px] rounded relative", live ? "bg-good" : "bg-line-2")}>
          {live && <motion.span className="absolute -top-[3px] size-2 rounded-full bg-good" animate={{ left: ["0%", "95%"] }} transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }} />}
        </span>
        <span className="text-[10px] font-mono text-ink-3">{l.port}</span>
        <span className={cx("flex-1 h-[2px] rounded", live ? "bg-good" : "bg-line-2")} />
        <span className="size-6 rounded-md grid place-items-center text-xs" style={{ background: b.color, opacity: missing === l.to ? 0.3 : 1 }}>{b.emoji}</span>
      </div>
      <div className={cx("text-xs mt-1.5 flex items-center gap-1.5", live ? "text-ink" : "text-ink-3")}>
        {live ? <Check className="size-3 text-good" /> : <Unlink className="size-3" />}
        {live ? l.label : <>Add <b className="text-ink-2">{MODULE_MAP[missing!].name}</b> to unlock: {l.label.toLowerCase()}</>}
      </div>
    </motion.div>
  );
}
