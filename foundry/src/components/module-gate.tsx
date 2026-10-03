"use client";
import Link from "next/link";
import { useProject } from "./project-context";
import { MODULE_MAP } from "@/lib/modules";
import type { ModuleId } from "@/lib/types";
import { Empty } from "./ui";
import { can } from "@/lib/roles";

/** Wrap a module page: shows a friendly message if the module isn't attached to this project. */
export function ModuleGate({ id, children }: { id: ModuleId; children: React.ReactNode }) {
  const { stack, project, me } = useProject();
  if (!stack.some((s) => s.id === id)) {
    const m = MODULE_MAP[id];
    return (
      <Empty emoji={m.emoji} title={`${m.name} isn't attached`} action={<Link className="text-accent font-semibold" href={`/build?project=${project.id}`}>Open the builder →</Link>}>
        {m.tagline} Snap it onto your project in the builder to use it.
      </Empty>
    );
  }
  if (!can(me, id, "view")) {
    const m = MODULE_MAP[id];
    return (
      <Empty emoji="🔒" title={`${m.name} is for project leaders`} action={<Link className="text-accent font-semibold" href={`/p/${project.id}`}>Back to overview →</Link>}>
        This area has donor and money details, so only the president, VP, treasurer and department heads can see it. Ask a leader if you need something from it.
      </Empty>
    );
  }
  return <>{children}</>;
}
