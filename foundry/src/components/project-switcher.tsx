"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronsUpDown, Compass, Home, LogIn, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ROLE_MAP, roleLabel } from "@/lib/roles";
import type { Member, Project } from "@/lib/types";
import { useAuth } from "./auth";
import { cx } from "./ui";

type Mem = Member & { projects: Pick<Project, "id" | "name" | "emoji" | "color"> };

/** Sidebar header: shows the current project; click to jump to any other project you belong to. */
export function ProjectSwitcher({ current, compact }: { current: Pick<Project, "id" | "name" | "emoji">; compact?: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mems, setMems] = useState<Mem[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || mems) return;
    supabase().from("project_members").select("*, projects(id,name,emoji,color)").eq("user_id", user.id).eq("status", "active")
      .then(({ data }) => setMems(((data as Mem[]) || []).filter((m) => m.projects)));
  }, [open, mems, user.id]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} title="Switch project"
        className={cx("w-full flex items-center gap-3 rounded-xl border border-line hover:border-line-2 hover:bg-panel transition text-left", compact ? "px-2.5 py-1.5" : "px-3 py-2.5")}>
        <span className={compact ? "text-lg" : "text-2xl"}>{current.emoji}</span>
        <span className="flex-1 min-w-0">
          {!compact && <span className="block text-[10px] uppercase tracking-wider text-ink-3 font-bold">Project</span>}
          <span className="block font-extrabold leading-tight truncate">{current.name}</span>
        </span>
        <ChevronsUpDown className="size-4 text-ink-3 shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="absolute z-40 left-0 right-0 mt-2 min-w-64 rounded-xl border border-line-2 bg-[#16121f] shadow-2xl p-1.5">
            <div className="px-2.5 pt-1.5 pb-1 text-[10px] uppercase tracking-wider text-ink-3 font-bold">Switch project</div>
            {mems === null ? <div className="skeleton h-10 m-1.5" /> : mems.map((m) => {
              const here = m.project_id === current.id;
              return (
                <Link key={m.id} href={`/p/${m.project_id}`} onClick={() => setOpen(false)}
                  className={cx("flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-panel-2", here && "bg-panel")}>
                  <span className="text-lg">{m.projects.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate">{m.projects.name}</span>
                    <span className="block text-[11px]" style={{ color: ROLE_MAP[m.role]?.color }}>{roleLabel(m)}</span>
                  </span>
                  {here && <Check className="size-4 text-good" />}
                </Link>
              );
            })}
            <div className="h-px bg-line my-1.5" />
            <MenuLink href="/home" icon={<Home className="size-4" />} onClick={() => setOpen(false)}>All my projects</MenuLink>
            <MenuLink href="/onboarding" icon={<Plus className="size-4" />} onClick={() => setOpen(false)}>Found a new project</MenuLink>
            <MenuLink href="/home?join=1" icon={<LogIn className="size-4" />} onClick={() => setOpen(false)}>Join with a code</MenuLink>
            <MenuLink href="/discover" icon={<Compass className="size-4" />} onClick={() => setOpen(false)}>Discover projects</MenuLink>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuLink({ href, icon, children, onClick }: { href: string; icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-2 hover:text-ink hover:bg-panel-2">
      <span className="text-ink-3">{icon}</span>{children}
    </Link>
  );
}
