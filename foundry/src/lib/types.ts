// Row types mirroring supabase/schema.sql

export type Role = "president" | "vice_president" | "secretary" | "treasurer" | "head" | "member";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  school: string | null;
  grade: string | null;
  avatar_color: string | null;
}

export interface StackItem {
  id: ModuleId;
  submodules: string[];
}

export type ModuleId = "hr" | "events" | "fundraising" | "publicity" | "finance" | "sponsors" | "shifts" | "partners";

export interface Project {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  cause: string | null;
  emoji: string | null;
  color: string | null;
  join_code: string;
  modules: { stack: StackItem[] };
  webhook_secret: string;
  created_by: string;
  created_at: string;
  // portal listing (patch-002)
  is_listed: boolean;
  location: string | null;
  skills: string[];
  looking_for: string | null;
  open_roles: OpenRole[];
  sponsor_brief: SponsorBrief;
}

export type PortalRole = "member" | "contributor" | "volunteer" | "donor" | "partner";
export interface OpenRole { k: PortalRole; on: boolean; slots: number }

export interface SponsorBrief {
  org_type?: string;
  region?: string;          // where sponsors should be (e.g. "Vietnam", "US - California", "Global")
  beneficiaries?: string;
  budget?: string;
  needs?: string[];         // cash, in-kind, mentorship, media, venue, implementation partner, travel/scholarship
  achievements?: string;
  timeline?: string;
}

export interface SponsorLead {
  id: string;
  project_id: string;
  name: string;
  type: string | null;
  country: string | null;
  focus: string | null;
  fit: string | null;
  approach: string | null;
  typical_amount: string | null;
  cycle: string | null;
  website: string | null;
  fit_score: number;
  confidence: "high" | "medium" | "low" | null;
  source: "manual" | "ai";
  stage: "idea" | "research" | "contacted" | "talking" | "won" | "declined";
  assignee_member_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  amount_asked: number | null;
  amount_committed: number | null;
  deadline: string | null;
  next_step: string | null;
  draft: string | null;
  log: { t: number; by: string | null; text: string }[];
  created_at: string;
  updated_at: string;
}

export interface JoinRequest {
  id: string;
  project_id: string;
  user_id: string;
  role: PortalRole;
  message: string | null;
  status: "pending" | "accepted" | "declined" | "withdrawn";
  created_at: string;
  decided_at: string | null;
}

/** Row returned by rpc("discover_projects") — safe public fields only. */
export interface ListedProject {
  id: string; name: string; tagline: string | null; description: string | null; cause: string | null;
  emoji: string | null; color: string | null; location: string | null; skills: string[]; looking_for: string | null;
  open_roles: OpenRole[]; modules: { stack: StackItem[] }; member_count: number; role_counts: Record<string, number>; created_at: string;
}

export interface Member {
  id: string;
  project_id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  school: string | null;
  grade: string | null;
  role: Role;
  department: string | null;
  title: string | null;
  status: "active" | "inactive" | "alumni";
  hours: number;
  notes: string | null;
  joined_at: string;
  portal_role?: PortalRole | null;
  availability?: Record<string, string[]>;
}

export interface EventRow {
  id: string;
  project_id: string;
  name: string;
  type: string;
  description: string | null;
  starts_at: string | null;
  location: string | null;
  status: "idea" | "planning" | "ready" | "live" | "done" | "cancelled";
  budget: number;
  lead_member_id: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  event_id: string | null;
  title: string;
  description: string | null;
  category: string;
  status: "todo" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high";
  assignee_member_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Fundraiser {
  id: string;
  project_id: string;
  event_id: string | null;
  name: string;
  goal: number;
  platform: string;
  platform_url: string | null;
  starts_on: string | null;
  ends_on: string | null;
  status: "draft" | "active" | "closed";
  created_at: string;
}

export interface Donation {
  id: string;
  project_id: string;
  fundraiser_id: string | null;
  donor_name: string;
  amount: number;
  message: string | null;
  source: string;
  created_at: string;
}

export interface SocialAccount {
  id: string;
  project_id: string;
  platform: string;
  handle: string;
  followers: number;
}

export interface SocialPost {
  id: string;
  project_id: string;
  account_id: string | null;
  event_id: string | null;
  platform: string | null;
  content: string;
  url: string | null;
  status: "idea" | "scheduled" | "posted";
  posted_at: string;
  likes: number;
  comments: number;
  shares: number;
}

export interface Transaction {
  id: string;
  project_id: string;
  kind: "income" | "expense";
  category: string;
  amount: number;
  description: string | null;
  occurred_on: string;
  event_id: string | null;
  fundraiser_id: string | null;
  recorded_by: string | null;
}

export interface MerchItem {
  id: string;
  project_id: string;
  name: string;
  price: number;
  unit_cost: number;
  stock: number;
  emoji: string | null;
}

export interface MerchSale {
  id: string;
  project_id: string;
  item_id: string | null;
  quantity: number;
  unit_price: number;
  buyer: string | null;
  sold_on: string;
}

export interface Shift {
  id: string; project_id: string; event_id: string | null; title: string; description: string | null;
  starts_at: string; ends_at: string; location: string | null; slots: number; lead_member_id: string | null; created_at: string;
}
export interface ShiftSignup {
  id: string; shift_id: string; project_id: string; member_id: string;
  status: "signed_up" | "checked_in" | "completed" | "no_show";
  checked_in_at: string | null; checked_out_at: string | null; hours: number | null; created_at: string;
}
export interface Partner {
  id: string; project_id: string; name: string; kind: string; status: "prospect" | "active" | "paused" | "ended";
  contact_name: string | null; contact_email: string | null; contact_phone: string | null; website: string | null;
  gives: string | null; gets: string | null; agreement_start: string | null; agreement_end: string | null;
  owner_member_id: string | null; notes: string | null; log: { t: number; by: string | null; text: string; event?: string | null }[]; created_at: string;
}
export interface Beneficiary {
  id: string; project_id: string; name: string; kind: string; people_count: number; location: string | null;
  contact_name: string | null; contact_info: string | null; partner_id: string | null; needs: string | null; consent: boolean;
  status: "active" | "paused" | "completed"; last_contact: string | null; next_contact: string | null; notes: string | null;
  feedback: { t: number; by: string | null; text: string; rating?: number }[]; created_at: string;
}
