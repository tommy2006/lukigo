"use client";
import Link from "next/link";
import { use } from "react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Blocks, ChevronLeft, Copy } from "lucide-react";
import { RequireAuth } from "@/components/auth";
import { ProjectProvider, useProject } from "@/components/project-context";
import { MODULE_MAP } from "@/lib/modules";
import { ROLE_MAP, roleLabel, canEditModules } from "@/lib/roles";
import { Badge, Empty, Spinner, cx } from "@/components/ui";
import { Logo } from "@/components/logo";
import { PortalButton } from "@/components/portal/portal-button";
import { ProjectSwitcher } from "@/components/project-switcher";

export default function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireAuth>
      <ProjectProvider
        id={id}
        fallback={<div className="min-h-screen grid place-items-center"><Spinner /></div>}
        notFound={<div className="p-10 max-w-lg mx-auto mt-20"><Empty emoji="🔒" title="Project not found" action={<Link href="/home" className="text-accent">Back home</Link>}>You may not be a member of this project.</Empty></div>}
      >
        <Shell>{children}</Shell>
      </ProjectProvider>
    </RequireAuth>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { project, stack, me } = useProject();
  const path = usePathname();
  const base = `/p/${project.id}`;
  const nav = [
    { href: base, label: "Overview", icon: <LayoutDashboard className="size-4" />, color: "#f4efe9" },
    ...stack.map((s) => {
      const m = MODULE_MAP[s.id];
      return { href: `${base}/${s.id}`, label: m.name, icon: <span className="text-base leading-none">{m.emoji}</span>, color: m.color };
    }),
  ];
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r border-line bg-black/20 backdrop-blur-xl p-4 flex flex-col gap-1 sticky top-0 h-screen max-md:hidden">
        <div className="flex items-center justify-between mb-5 px-2">
          <Link href="/home" className="flex items-center gap-2 text-ink-3 hover:text-ink text-sm"><ChevronLeft className="size-4" /><Logo small /></Link>
          <PortalButton className="!h-7 !px-2.5 !text-[12px]" />
        </div>
        <div className="mb-4">
          <ProjectSwitcher current={project} />
          {me && <div className="px-1 mt-2 flex items-center gap-1.5 text-[11px] text-ink-3">Your role <Badge color={ROLE_MAP[me.role]?.color}>{roleLabel(me)}</Badge></div>}
        </div>
        {nav.map((n) => {
          const active = n.href === base ? path === base : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href}
              className={cx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", active ? "bg-panel-2 text-ink" : "text-ink-2 hover:bg-panel hover:text-ink")}>
              <span className="w-1 h-5 rounded-full -ml-1" style={{ background: active ? n.color : "transparent" }} />
              {n.icon}{n.label}
            </Link>
          );
        })}
        {canEditModules(me) && (
          <Link href={`/build?project=${project.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-3 hover:text-ink hover:bg-panel mt-2 border border-dashed border-line-2">
            <Blocks className="size-4" /> Edit modules
          </Link>
        )}
        <div className="mt-auto rounded-xl border border-line p-3 text-xs text-ink-3">
          Invite code
          <button onClick={() => navigator.clipboard.writeText(project.join_code)} className="flex items-center justify-between w-full mt-1 font-mono text-lg text-ink tracking-[0.2em] hover:text-accent">
            {project.join_code}<Copy className="size-3.5" />
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        {/* mobile top nav */}
        <div className="md:hidden p-3 pb-0 flex gap-2 items-center">
          <div className="flex-1 min-w-0"><ProjectSwitcher current={project} compact /></div>
          <PortalButton className="shrink-0" />
        </div>
        <div className="md:hidden flex gap-2 overflow-x-auto p-3 border-b border-line">
          {nav.map((n) => <Link key={n.href} href={n.href} className="shrink-0 rounded-lg bg-panel px-3 py-1.5 text-sm">{n.label}</Link>)}
        </div>
        <div className="max-w-6xl mx-auto px-5 md:px-10 py-8 md:py-10">{children}</div>
      </main>
    </div>
  );
}
