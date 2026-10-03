// AI tasks for onboarding + home dashboard.
import type { AITask } from "./types";
import { MODULES, defaultSubmodules } from "@/lib/modules";
import type { ModuleId } from "@/lib/types";

const catalog = MODULES.map(
  (m) => `- ${m.id} (${m.name}${m.core ? ", default" : ", optional"}): ${m.tagline}\n` +
    m.submodules.map((s) => `    * ${s.id}: ${s.name} — ${s.blurb}`).join("\n")
).join("\n");

export interface OnboardQuestion { id: string; question: string; options: string[]; multi: boolean }

const FALLBACK_QUESTIONS: OnboardQuestion[] = [
  { id: "size", question: "How big is your team right now?", options: ["Just me", "2–5 people", "6–15 people", "15+ people"], multi: false },
  { id: "activities", question: "What will your project mostly do?", options: ["Host events", "Teach / tutor", "Collect donations or supplies", "Raise awareness online", "Sell merch for a cause"], multi: true },
  { id: "money", question: "Will you handle money?", options: ["No money involved", "Small donations only", "Fundraisers with goals", "Fundraisers + merch sales + expenses"], multi: false },
  { id: "socials", question: "Where will people hear about you?", options: ["Instagram", "TikTok", "School announcements", "Word of mouth", "Not sure yet"], multi: true },
  { id: "growth", question: "Are you planning to recruit more members soon?", options: ["Yes, actively", "Maybe later", "No, we're set"], multi: false },
];

function keywordStack(text: string) {
  const t = text.toLowerCase();
  const stack: { id: ModuleId; submodules: string[] }[] = MODULES.filter((m) => m.core).map((m) => ({ id: m.id, submodules: defaultSubmodules(m.id) }));
  const add = (id: ModuleId, sub: string) => {
    const s = stack.find((x) => x.id === id);
    if (s && !s.submodules.includes(sub)) s.submodules.push(sub);
  };
  if (/recruit|grow|yes, actively|15\+|6–15/.test(t)) add("hr", "recruitment");
  if (/hour|nhs|volunteer/.test(t)) add("hr", "volunteer_hours");
  if (/sponsor|business/.test(t)) add("fundraising", "sponsors");
  if (/tiktok|instagram|awareness|online/.test(t)) { add("publicity", "content_calendar"); add("publicity", "caption_ai"); }
  if (/merch|sell|expense|budget|shirt|sticker/.test(t)) stack.push({ id: "finance", submodules: defaultSubmodules("finance") });
  if (/teach|tutor|workshop|class/.test(t)) add("events", "attendance");
  return stack;
}

export const coreTasks: Record<string, AITask> = {
  onboard_questions: {
    system:
      "You are Foundry, a friendly co-founder coach helping a high-school student set up a community service project. " +
      "Given their description, write 4-5 short multiple-choice questions that will help decide which project-management modules they need. " +
      "Keep language simple and encouraging. Each question has 3-5 options.",
    prompt: (i: { description: string }) =>
      `Project description: """${i.description}"""\n\nAvailable modules:\n${catalog}\n\n` +
      `Return {"intro": "one warm sentence reacting to their idea", "questions": [{"id": "snake_case", "question": "...", "options": ["..."], "multi": true|false}]}`,
    fallback: (i: { description: string }) => ({
      intro: i.description ? "Love this idea — let's figure out what you'll need to run it." : "Let's figure out what you'll need.",
      questions: FALLBACK_QUESTIONS,
    }),
  },

  recommend_modules: {
    system:
      "You are Foundry, helping a high-school student design the operating system for their community service project. " +
      "Choose modules and submodules that fit their needs — not too many for small teams. Module ids and submodule ids MUST come from the catalog. " +
      "The four default modules (hr, events, fundraising, publicity) are usually included; add 'finance' only if they handle money beyond simple donations or sell merch.",
    maxTokens: 1600,
    prompt: (i: { description: string; answers: { question: string; answer: string }[] }) =>
      `Catalog:\n${catalog}\n\nDescription: """${i.description}"""\nAnswers:\n${(i.answers || []).map((a) => `- ${a.question}: ${a.answer}`).join("\n")}\n\n` +
      `Return {"name": "catchy project name (keep theirs if given)", "tagline": "max 10 words", "emoji": "one emoji", "cause": "education|environment|health|hunger|animals|community|arts|other", ` +
      `"stack": [{"id": "module_id", "submodules": ["sub_id"], "reason": "one sentence why, addressed to the founder"}], ` +
      `"first_steps": ["3 concrete first actions for this week"]}`,
    fallback: (i: { description: string; answers: { question: string; answer: string }[] }) => {
      const text = `${i.description} ${(i.answers || []).map((a) => a.answer).join(" ")}`;
      const stack = keywordStack(text).map((s) => ({ ...s, reason: MODULES.find((m) => m.id === s.id)!.tagline }));
      const t = (i.description || "").toLowerCase();
      const themes: [RegExp, string, string, string, string][] = [
        [/cod(e|ing)|program|computer|tech/, "CodeBridge", "Opening doors to tech, one kid at a time.", "💻", "education"],
        [/tutor|teach|homework|literacy|read/, "Bright Minds Tutoring", "Students teaching students.", "📚", "education"],
        [/beach|clean|ocean|litter|plastic|tree|environment|climate/, "Green Tide", "Cleaner shores, greener futures.", "🌊", "environment"],
        [/food|hunger|meal|shelter|pantry/, "Full Plates Project", "No neighbor goes hungry.", "🥫", "hunger"],
        [/animal|pet|dog|cat|shelter/, "Paws Forward", "Helping animals find their way home.", "🐾", "animals"],
        [/health|mental|wellness|blood/, "Well Together", "Health and hope for our community.", "💚", "health"],
        [/art|music|paint|theater/, "Art for All", "Creativity belongs to everyone.", "🎨", "arts"],
      ];
      const th = themes.find(([re]) => re.test(t));
      return {
        name: th?.[1] ?? "Project Spark",
        tagline: th?.[2] ?? "Students making a difference, together.",
        emoji: th?.[3] ?? "🌱",
        cause: th?.[4] ?? "community",
        stack,
        first_steps: ["Invite 2–3 friends with your join code", "Create your first event and break it into tasks", "Set a fundraising goal for your first campaign"],
      };
    },
  },

  home_summary: {
    system:
      "You are Foundry, a concise, upbeat assistant for a high-school student who belongs to several community service projects. " +
      "Summarize what they've done and what's due for each project. Be specific (use task names and dates), 1-2 sentences per project. Flag overdue items gently.",
    prompt: (i: HomeSummaryInput) =>
      `Today is ${i.today}. Student: ${i.user_name}.\nProjects:\n${JSON.stringify(i.projects, null, 1)}\n\n` +
      `Return {"headline": "one short motivating sentence about their week", "projects": [{"project_id": "...", "summary": "...", "focus": "the single most important next action"}]}`,
    fallback: (i: HomeSummaryInput) => ({
      headline:
        i.projects.reduce((n, p) => n + p.due.length, 0) > 0
          ? `You have ${i.projects.reduce((n, p) => n + p.due.length, 0)} open tasks across ${i.projects.length} project${i.projects.length === 1 ? "" : "s"}. You've got this.`
          : "Nothing urgent on your plate — a great time to plan something new.",
      projects: i.projects.map((p) => {
        const overdue = p.due.filter((d) => d.due_date && d.due_date < i.today);
        return {
          project_id: p.project_id,
          summary:
            `You've completed ${p.done.length} task${p.done.length === 1 ? "" : "s"} recently` +
            (p.due.length ? ` and have ${p.due.length} still open${overdue.length ? ` (${overdue.length} overdue)` : ""}.` : " and nothing open — nice."),
          focus: (overdue[0] || p.due[0])?.title ?? (p.upcoming_events[0] ? `Prep for ${p.upcoming_events[0].name}` : "Check in with your team"),
        };
      }),
    }),
  },
};

export interface HomeSummaryInput {
  today: string;
  user_name: string;
  projects: {
    project_id: string;
    name: string;
    role: string;
    done: { title: string }[];
    due: { title: string; due_date: string | null; event?: string | null }[];
    upcoming_events: { name: string; starts_at: string | null }[];
  }[];
}
