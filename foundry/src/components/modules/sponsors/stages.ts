import type { SponsorLead } from "@/lib/types";

export const STAGES: { id: SponsorLead["stage"]; label: string; color: string; emoji: string; hint: string }[] = [
  { id: "idea", label: "Saved", color: "#a1a1aa", emoji: "🔖", hint: "Ideas worth a look" },
  { id: "research", label: "Researching", color: "#9ad8ff", emoji: "🔍", hint: "Checking eligibility & contacts" },
  { id: "contacted", label: "Contacted", color: "#ffd88a", emoji: "✉️", hint: "First email sent" },
  { id: "talking", label: "In talks", color: "#c3b5ff", emoji: "💬", hint: "They replied!" },
  { id: "won", label: "Committed", color: "#7ee0a8", emoji: "🎉", hint: "They said yes" },
  { id: "declined", label: "Declined", color: "#ff7a7a", emoji: "🙅", hint: "Not this time" },
];
export const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<SponsorLead["stage"], (typeof STAGES)[number]>;
export const CONF_COLOR: Record<string, string> = { high: "#7ee0a8", medium: "#ffd88a", low: "#ff9a76" };

export const NEEDS = ["Cash", "In-kind goods", "Mentorship/expertise", "Media", "Venue", "Implementation partner", "Travel/scholarship"];
