import type { ModuleId, StackItem } from "./types";

export interface Submodule {
  id: string;
  name: string;
  blurb: string;          // plain-English "why you'd want this" for clueless founders
  defaultOn: boolean;
}

export interface ModuleDef {
  id: ModuleId;
  name: string;
  short: string;
  tagline: string;
  emoji: string;
  color: string;          // block color
  ink: string;            // darker shade for text/notch outline
  core: boolean;          // default (recommended) vs optional
  provides: string[];     // data "ports" this module outputs
  consumes: string[];     // data "ports" this module can take in
  submodules: Submodule[];
}

export const MODULES: ModuleDef[] = [
  {
    id: "hr",
    name: "People & HR",
    short: "HR",
    tagline: "Who's on the team, what they do, and what they can access.",
    emoji: "🧑‍🤝‍🧑",
    color: "#ffb4a2",
    ink: "#7a2e1d",
    core: true,
    provides: ["people"],
    consumes: [],
    submodules: [
      { id: "roster", name: "Member roster", blurb: "A full directory of everyone with contact info, school & grade.", defaultOn: true },
      { id: "roles", name: "Roles & privileges", blurb: "President, VP, heads, members — each sees and edits only what they should.", defaultOn: true },
      { id: "org_chart", name: "Org chart", blurb: "A visual tree of departments and who reports to whom.", defaultOn: true },
      { id: "recruitment", name: "Recruitment pipeline", blurb: "Track applicants from 'interested' to 'onboarded'. Great when you're growing.", defaultOn: false },
      { id: "volunteer_hours", name: "Volunteer hours log", blurb: "Count service hours per member — useful for school / NHS / award forms.", defaultOn: false },
      { id: "availability", name: "Availability & scheduling", blurb: "See who's free when, so you don't schedule events nobody can staff.", defaultOn: false },
    ],
  },
  {
    id: "events",
    name: "Event Manager",
    short: "Events",
    tagline: "Every fundraiser, workshop and drive — with tasks, owners and progress.",
    emoji: "🎪",
    color: "#ffd88a",
    ink: "#6b4a00",
    core: true,
    provides: ["events", "tasks"],
    consumes: ["people"],
    submodules: [
      { id: "event_board", name: "Event board", blurb: "All your events in one place, from idea to done.", defaultOn: true },
      { id: "task_tracker", name: "Task tracker", blurb: "Break each event into tasks, assign people, and watch progress bars fill.", defaultOn: true },
      { id: "prep_checklist", name: "Prep checklists", blurb: "Venue, content, logistics, supplies… track each prep area separately.", defaultOn: true },
      { id: "calendar", name: "Calendar view", blurb: "See everything on a month calendar.", defaultOn: true },
      { id: "ai_planner", name: "AI event planner", blurb: "Describe an event; AI drafts the whole task list for you.", defaultOn: true },
      { id: "attendance", name: "Attendance & check-in", blurb: "Track who showed up — volunteers and attendees.", defaultOn: false },
      { id: "post_mortem", name: "Post-event review", blurb: "Capture what went well and what to fix next time.", defaultOn: false },
    ],
  },
  {
    id: "fundraising",
    name: "Fundraising Tracker",
    short: "Fundraising",
    tagline: "Campaign goals, live donation feed, and who gave what.",
    emoji: "💸",
    color: "#a8e6cf",
    ink: "#1d5c43",
    core: true,
    provides: ["donations"],
    consumes: ["events"],
    submodules: [
      { id: "campaigns", name: "Campaigns & goals", blurb: "Set a target for each fundraiser and see a live thermometer.", defaultOn: true },
      { id: "live_feed", name: "Live donation feed", blurb: "Donations from GoFundMe / Givebutter / Stripe stream in in real time.", defaultOn: true },
      { id: "donor_list", name: "Donor list", blurb: "Remember who supported you so you can thank them.", defaultOn: true },
      { id: "sponsors", name: "Sponsor tracker", blurb: "Track local businesses you've pitched and what they committed.", defaultOn: false },
      { id: "thank_you", name: "AI thank-you notes", blurb: "AI drafts personal thank-you messages for donors.", defaultOn: false },
    ],
  },
  {
    id: "publicity",
    name: "Publicity Pulse",
    short: "Publicity",
    tagline: "An AI feed that summarizes what your socials did today.",
    emoji: "📣",
    color: "#c3b5ff",
    ink: "#3b2a8a",
    core: true,
    provides: ["reach"],
    consumes: ["events"],
    submodules: [
      { id: "accounts", name: "Connected accounts", blurb: "Link your Instagram, TikTok, etc. so posts flow in.", defaultOn: true },
      { id: "daily_digest", name: "AI daily digest", blurb: "Every day, AI tells you what was posted and how people reacted.", defaultOn: true },
      { id: "content_calendar", name: "Content calendar", blurb: "Plan posts ahead — especially before events.", defaultOn: false },
      { id: "caption_ai", name: "AI caption writer", blurb: "Turn an event into ready-to-post captions.", defaultOn: false },
      { id: "metrics", name: "Engagement metrics", blurb: "Likes, comments and shares over time.", defaultOn: true },
    ],
  },
  {
    id: "finance",
    name: "Finance & Merch",
    short: "Finance",
    tagline: "Money in, money out, cashflow — plus merch inventory & sales.",
    emoji: "🧾",
    color: "#9ad8ff",
    ink: "#0f4a6b",
    core: false,
    provides: ["money"],
    consumes: ["donations", "events"],
    submodules: [
      { id: "ledger", name: "Cash in / cash out ledger", blurb: "Log every dollar that comes in or goes out.", defaultOn: true },
      { id: "cashflow", name: "Cashflow chart", blurb: "See your balance over time at a glance.", defaultOn: true },
      { id: "budgets", name: "Event budgets", blurb: "Compare what each event was budgeted vs. what it really cost.", defaultOn: false },
      { id: "merch_inventory", name: "Merch inventory", blurb: "T-shirts, stickers, bracelets — track stock and cost.", defaultOn: true },
      { id: "merch_sales", name: "Merch sales", blurb: "Record sales; revenue automatically lands in the ledger.", defaultOn: true },
      { id: "reports", name: "AI finance report", blurb: "A plain-English money summary for your advisor or school.", defaultOn: false },
    ],
  },
  {
    id: "sponsors",
    name: "Sponsor Finder",
    short: "Sponsors",
    tagline: "AI finds real sponsors & grants, tracks your outreach, and drafts the letters.",
    emoji: "🤝",
    color: "#ffb3d1",
    ink: "#6e1745",
    core: false,
    provides: ["sponsors"],
    consumes: ["people"],
    submodules: [
      { id: "brief", name: "Sponsorship brief", blurb: "One page describing your project, budget and needs — sponsors and AI read this.", defaultOn: true },
      { id: "ai_finder", name: "AI sponsor search", blurb: "AI suggests real foundations, companies and grant programs that fit you.", defaultOn: true },
      { id: "pipeline", name: "Outreach board", blurb: "Drag each sponsor from Saved → Contacted → In talks → Committed.", defaultOn: true },
      { id: "letters", name: "AI letter writer", blurb: "Draft intro emails, proposals, follow-ups and thank-you letters.", defaultOn: true },
      { id: "deadlines", name: "Deadlines & follow-ups", blurb: "Never miss a grant deadline or forget to follow up.", defaultOn: false },
    ],
  },
];

export const MODULE_MAP = Object.fromEntries(MODULES.map((m) => [m.id, m])) as Record<ModuleId, ModuleDef>;

// Links between modules. A link is "live" when both modules are in the stack.
export interface ModuleLink {
  from: ModuleId;
  to: ModuleId;
  port: string;
  label: string;          // integration feature unlocked by this link
}

export const LINKS: ModuleLink[] = [
  { from: "hr", to: "events", port: "people", label: "Assign team members to event tasks" },
  { from: "events", to: "fundraising", port: "events", label: "Attach fundraisers to events" },
  { from: "events", to: "publicity", port: "events", label: "Tag posts with the event they promote" },
  { from: "fundraising", to: "finance", port: "donations", label: "Donations auto-flow into the ledger as income" },
  { from: "events", to: "finance", port: "events", label: "Track spending per event vs. budget" },
  { from: "hr", to: "publicity", port: "people", label: "Credit members for content they created" },
  { from: "hr", to: "sponsors", port: "people", label: "Assign an owner to every sponsor conversation" },
  { from: "sponsors", to: "fundraising", port: "sponsors", label: "Committed sponsors show up in your fundraising totals" },
  { from: "sponsors", to: "finance", port: "sponsors", label: "Committed sponsorships land in the ledger as income" },
];

export function activeLinks(stack: StackItem[]) {
  const ids = new Set(stack.map((s) => s.id));
  return LINKS.filter((l) => ids.has(l.from) && ids.has(l.to));
}

export function missingLinks(stack: StackItem[]) {
  const ids = new Set(stack.map((s) => s.id));
  return LINKS.filter((l) => ids.has(l.from) !== ids.has(l.to));
}

export function defaultSubmodules(id: ModuleId) {
  return MODULE_MAP[id].submodules.filter((s) => s.defaultOn).map((s) => s.id);
}

export function defaultStack(): StackItem[] {
  return MODULES.filter((m) => m.core).map((m) => ({ id: m.id, submodules: defaultSubmodules(m.id) }));
}

/** Helpers for module pages: is a module / submodule enabled for this project? */
export function hasModule(stack: StackItem[] | undefined, id: ModuleId) {
  return !!stack?.some((s) => s.id === id);
}
export function hasSub(stack: StackItem[] | undefined, id: ModuleId, sub: string) {
  return !!stack?.find((s) => s.id === id)?.submodules.includes(sub);
}
