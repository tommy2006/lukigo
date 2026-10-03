"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Member, Project, StackItem } from "@/lib/types";
import { useAuth } from "./auth";
import { setAIContext } from "@/lib/ai/client";

export interface ProjectCtx {
  project: Project;
  stack: StackItem[];
  me: Member | null;           // current user's membership row (role/department)
  members: Member[];           // full roster (active + inactive)
  reload: () => Promise<void>;
  reloadMembers: () => Promise<void>;
}

const Ctx = createContext<ProjectCtx | null>(null);

/** Use inside /p/[id]/* pages. */
export function useProject() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useProject outside ProjectProvider");
  return c;
}

export function ProjectProvider({ id, children, fallback, notFound }: { id: string; children: React.ReactNode; fallback: React.ReactNode; notFound: React.ReactNode }) {
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  const reloadMembers = useCallback(async () => {
    const { data } = await supabase().from("project_members").select("*").eq("project_id", id).order("joined_at");
    setMembers((data as Member[]) || []);
  }, [id]);

  const reload = useCallback(async () => {
    const { data } = await supabase().from("projects").select("*").eq("id", id).maybeSingle();
    if (!data) { setState("missing"); return; }
    setProject(data as Project);
    await reloadMembers();
    setState("ok");
  }, [id, reloadMembers]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    setAIContext(project ? { project: project.name, location: project.location, cause: project.cause } : null);
    return () => setAIContext(null);
  }, [project]);

  if (state === "loading") return <>{fallback}</>;
  if (state === "missing" || !project) return <>{notFound}</>;
  const me = members.find((m) => m.user_id === user.id) || null;
  return (
    <Ctx.Provider value={{ project, stack: project.modules?.stack || [], me, members, reload, reloadMembers }}>
      {children}
    </Ctx.Provider>
  );
}
