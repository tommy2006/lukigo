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

export type ModuleId = "hr" | "events" | "fundraising" | "publicity" | "finance";

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
