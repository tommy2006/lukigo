"use client";
// Shared helpers for module pages.
import { useCallback, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui";

/** Load all rows of a project-scoped table. Returns [rows, reload, loading, setRows]. */
export function useRows<T>(table: string, projectId: string | null, order = "created_at", ascending = false) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    const { data, error } = await supabase().from(table).select("*").eq("project_id", projectId).order(order, { ascending });
    if (error) console.error(`[${table}]`, error.message);
    setRows((data as T[]) || []);
    setLoading(false);
  }, [table, projectId, order, ascending]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState happens after await
  useEffect(() => { reload(); }, [reload]);
  return [rows, reload, loading, setRows] as const;
}

/** Small "you can't do this" hint. */
export function NoPerm({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-ink-3">
      <Lock className="size-3.5" /> {children}
    </div>
  );
}

export const TASK_CATEGORIES: { id: string; label: string; emoji: string; color: string }[] = [
  { id: "venue", label: "Venue", emoji: "🏫", color: "#ffb4a2" },
  { id: "content", label: "Content", emoji: "📝", color: "#c3b5ff" },
  { id: "logistics", label: "Logistics", emoji: "📦", color: "#9ad8ff" },
  { id: "marketing", label: "Marketing", emoji: "📣", color: "#ff9ad5" },
  { id: "supplies", label: "Supplies", emoji: "🛒", color: "#ffd88a" },
  { id: "volunteers", label: "Volunteers", emoji: "🙋", color: "#a8e6cf" },
  { id: "general", label: "General", emoji: "📌", color: "#d4d4d8" },
];
export const CAT_MAP = Object.fromEntries(TASK_CATEGORIES.map((c) => [c.id, c]));

export const TASK_STATUS: Record<string, { label: string; color: string }> = {
  todo: { label: "To do", color: "#a1a1aa" },
  in_progress: { label: "In progress", color: "#ffd88a" },
  blocked: { label: "Blocked", color: "#ff7a7a" },
  done: { label: "Done", color: "#7ee0a8" },
};

export const EVENT_STATUS: { id: string; label: string; color: string }[] = [
  { id: "idea", label: "Idea", color: "#a1a1aa" },
  { id: "planning", label: "Planning", color: "#9ad8ff" },
  { id: "ready", label: "Ready", color: "#c3b5ff" },
  { id: "live", label: "Live", color: "#ff9a76" },
  { id: "done", label: "Done", color: "#7ee0a8" },
  { id: "cancelled", label: "Cancelled", color: "#ff7a7a" },
];
export const EVENT_STATUS_MAP = Object.fromEntries(EVENT_STATUS.map((s) => [s.id, s]));

export const EVENT_TYPES = ["fundraiser", "teaching", "outreach", "meeting", "drive", "other"];
export const EVENT_TYPE_EMOJI: Record<string, string> = { fundraiser: "💸", teaching: "📚", outreach: "🤝", meeting: "🗓️", drive: "📦", other: "✨" };

export const PRIORITY_COLOR: Record<string, string> = { low: "#a1a1aa", medium: "#ffd88a", high: "#ff7a7a" };

export const PLATFORMS: Record<string, { label: string; color: string; emoji: string }> = {
  instagram: { label: "Instagram", color: "#ff7eb3", emoji: "📸" },
  tiktok: { label: "TikTok", color: "#7ef0ff", emoji: "🎵" },
  facebook: { label: "Facebook", color: "#7aa8ff", emoji: "👍" },
  x: { label: "X", color: "#e4e4e7", emoji: "✖️" },
  linkedin: { label: "LinkedIn", color: "#6ab7ff", emoji: "💼" },
  youtube: { label: "YouTube", color: "#ff6b6b", emoji: "▶️" },
};

export function StatusPill({ status, map }: { status: string; map: Record<string, { label: string; color: string }> }) {
  const s = map[status] || { label: status, color: "#a1a1aa" };
  return <Badge color={s.color}>{s.label}</Badge>;
}

export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
export const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((n, x) => n + (Number(f(x)) || 0), 0);

/** Date input value (YYYY-MM-DD) -> ISO timestamp at local noon-ish (keeps day stable across TZs). */
export const dateToTs = (d: string, time = "12:00") => (d ? new Date(`${d}T${time || "12:00"}:00`).toISOString() : null);
export const tsToDate = (ts: string | null | undefined) => {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const tsToTime = (ts: string | null | undefined) => {
  if (!ts) return "";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return tsToDate(d.toISOString());
};

/** Whole days from now until ts (negative = past). */
export const daysUntil = (ts: string | null | undefined) => (ts ? Math.ceil((new Date(ts).getTime() - Date.now()) / 86400000) : null);
