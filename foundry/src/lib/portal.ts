// Project Portal helpers (shared by /discover page and the discover_search AI fallback).
import type { ListedProject, OpenRole, PortalRole } from "./types";

export const CAUSES = ["education", "environment", "health", "hunger", "animals", "community", "arts", "other"];
export const CAUSE_LABEL: Record<string, string> = {
  education: "Education", environment: "Environment & climate", health: "Health", hunger: "Hunger & food",
  animals: "Animals", community: "Community", arts: "Arts & culture", other: "Other",
};

/** Lowercase + strip diacritics so "giao duc" matches "Giáo dục". */
export const norm = (s: string | null | undefined) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

export function roleStatus(p: Pick<ListedProject, "open_roles" | "role_counts">) {
  return (p.open_roles || []).filter((r) => r.on).map((r: OpenRole) => {
    const count = p.role_counts?.[r.k] || 0;
    return { ...r, count, full: r.slots > 0 && count >= r.slots };
  });
}

export function hasOpenRole(p: ListedProject, role?: PortalRole | "") {
  const rs = roleStatus(p);
  return role ? rs.some((r) => r.k === role && !r.full) : rs.some((r) => !r.full);
}

/** Weighted keyword search, accent-insensitive. Returns projects sorted by relevance. */
export function keywordSearch(projects: ListedProject[], q: string) {
  const toks = norm(q).split(/[\s,.;:/]+/).filter((t) => t.length > 1);
  if (!toks.length) return projects.map((p) => ({ p, score: 0 }));
  const out: { p: ListedProject; score: number }[] = [];
  for (const p of projects) {
    const fields: [string, number][] = [
      [p.name, 6], [p.tagline || "", 3], [CAUSE_LABEL[p.cause || ""] || p.cause || "", 3], [(p.skills || []).join(" "), 3],
      [p.location || "", 2], [p.looking_for || "", 2], [p.description || "", 1],
    ].map(([t, w]) => [norm(t as string), w as number]);
    let score = 0, hit = 0;
    for (const t of toks) {
      let best = 0;
      for (const [txt, w] of fields) if (txt.includes(t)) best = Math.max(best, w);
      if (best) { hit++; score += best; }
    }
    if (norm(p.name).includes(norm(q).trim())) score += 10;
    if (hit) out.push({ p, score: score + hit * 5 });
  }
  return out.sort((a, b) => b.score - a.score);
}
