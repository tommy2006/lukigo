import type { StackItem } from "./types";

export const DRAFT_KEY = "foundry_draft";
export interface Draft {
  name: string; tagline: string; emoji: string; cause: string; description: string; location?: string;
  stack: StackItem[]; reasons?: Record<string, string>; first_steps?: string[];
}
