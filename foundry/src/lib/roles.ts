import type { Member, ModuleId, Role } from "./types";

export const ROLES: { id: Role; label: string; rank: number; color: string; summary: string }[] = [
  { id: "president", label: "President", rank: 100, color: "#ff8a65", summary: "Founder. Full control over everything, including the project's modules and deleting the project." },
  { id: "vice_president", label: "Vice President", rank: 80, color: "#ffb74d", summary: "Full control of all modules and the team roster. Can't delete the project." },
  { id: "secretary", label: "Secretary", rank: 60, color: "#ba68c8", summary: "Manages events, tasks and publicity. Read-only on finances." },
  { id: "treasurer", label: "Treasurer", rank: 60, color: "#4db6ac", summary: "Owns fundraising & finance. Read-only on other modules." },
  { id: "head", label: "Department Head", rank: 50, color: "#64b5f6", summary: "Full control of their department's module (e.g. Head of HR edits the roster). Assigns tasks." },
  { id: "member", label: "Member", rank: 10, color: "#a1a1aa", summary: "Sees the project, updates their own tasks and profile, logs donations/posts." },
];

export const ROLE_MAP = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<Role, (typeof ROLES)[number]>;

/** Which department a head must belong to in order to manage a module. */
export const DEPARTMENT_FOR_MODULE: Record<ModuleId, string> = {
  hr: "HR",
  events: "Events",
  fundraising: "Fundraising",
  publicity: "Publicity",
  finance: "Finance",
  sponsors: "Fundraising",
  shifts: "Events",
  partners: "Outreach",
};

export const PORTAL_ROLES: { k: import("./types").PortalRole; label: string; blurb: string; team: boolean }[] = [
  { k: "member", label: "Member", blurb: "Join the core team long-term and get access to the project workspace.", team: true },
  { k: "contributor", label: "Contributor", blurb: "Help with specific tasks or skills; also gets workspace access.", team: true },
  { k: "volunteer", label: "Volunteer", blurb: "Help out at events and short-term activities.", team: false },
  { k: "donor", label: "Donor", blurb: "Support the project financially.", team: false },
  { k: "partner", label: "Mentor / Partner", blurb: "Mentors, businesses or organizations who want to collaborate.", team: false },
];

export const DEPARTMENTS = ["Leadership", "HR", "Events", "Fundraising", "Publicity", "Finance", "Logistics", "Outreach"];

export type Action = "view" | "edit" | "manage";
// view   = see the module
// edit   = create/update records (tasks, donations, posts, transactions)
// manage = delete records, change settings, edit other people's things

export function can(me: Pick<Member, "role" | "department"> | null | undefined, module: ModuleId | "project", action: Action): boolean {
  if (!me) return false;
  const r = me.role;
  if (r === "president") return true;
  if (module === "project") return r === "vice_president" ? action !== "manage" : action === "view";
  if (r === "vice_president") return true;
  // Money modules are leaders-only: regular members can't see donors, amounts or the ledger.
  if (r === "member" && MONEY_MODULES.includes(module)) return false;
  if (action === "view") return true;
  if (r === "head" && me.department === DEPARTMENT_FOR_MODULE[module]) return true;
  if (r === "secretary") return ["events", "publicity", "shifts", "partners"].includes(module) || (module === "hr" && action === "edit");
  if (r === "treasurer") return ["fundraising", "finance", "sponsors"].includes(module);
  if (r === "head") return action === "edit" && module === "events"; // heads can assign event tasks
  // members: can add day-to-day records but not manage
  if (r === "member") return action === "edit" && ["events", "publicity", "shifts"].includes(module);
  return false;
}

export const MONEY_MODULES: (ModuleId | "project")[] = ["fundraising", "finance", "sponsors"];

/** Modules of the stack this person is allowed to see (drives sidebar, overview, gates). */
export function visibleModules<T extends { id: ModuleId }>(stack: T[], me: Pick<Member, "role" | "department"> | null | undefined): T[] {
  return stack.filter((s) => can(me, s.id, "view"));
}

const rankOf = (m: Pick<Member, "role">) => ROLE_MAP[m.role]?.rank ?? 0;

/**
 * Task assignment rule (mirrored by the DB trigger in patch-004):
 * anyone may assign a task to themselves; leaders (head and above) may assign to people of equal or lower rank;
 * regular members may only assign to themselves.
 */
export function canAssignTo(me: Pick<Member, "id" | "role"> | null | undefined, target: Pick<Member, "id" | "role"> | null | undefined): boolean {
  if (!me) return false;
  if (!target || target.id === me.id) return true;
  return rankOf(me) >= 50 && rankOf(me) >= rankOf(target);
}

/** Can `me` change this task's current assignee at all? (e.g. a member can't take a task away from the president) */
export const canReassign = (me: Pick<Member, "id" | "role"> | null | undefined, current: Pick<Member, "id" | "role"> | null | undefined) =>
  !current || canAssignTo(me, current);

/** Can `me` change the builder (add/remove modules)? */
export const canEditModules = (me?: Pick<Member, "role"> | null) => me?.role === "president" || me?.role === "vice_president";

export function roleLabel(m: Pick<Member, "role" | "department" | "title">) {
  if (m.title) return m.title;
  if (m.role === "head" && m.department) return `Head of ${m.department}`;
  return ROLE_MAP[m.role]?.label ?? m.role;
}
