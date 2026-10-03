// AI tasks used by module pages (Events, Fundraising, Publicity, Finance...). Owned by the module-pages agent.
import type { AITask } from "./types";

// ---------- input shapes ----------
export interface EventPlanInput { name: string; type?: string; description?: string | null; date?: string | null; team_size?: number; location?: string | null }
export interface PlannedTask { title: string; category: string; priority: "low" | "medium" | "high"; days_before: number }
export interface ThankYouInput { project: string; cause?: string | null; donors: { name: string; amount: number; message?: string | null; campaign?: string | null }[] }
export interface DigestInput { project: string; today: string; posts: { platform: string | null; content: string; posted_at: string; likes: number; comments: number; shares: number; status?: string; event?: string | null }[]; upcoming_events: { name: string; starts_at: string | null }[]; accounts: { platform: string; handle: string; followers: number }[] }
export interface CaptionsInput { project: string; event: { name: string; type?: string; description?: string | null; starts_at?: string | null; location?: string | null }; platforms: string[] }
export interface FinanceReportInput { project: string; total_in: number; total_out: number; balance: number; by_category: { category: string; kind: string; amount: number }[]; events: { name: string; budget: number; spent: number }[]; merch: { name: string; stock: number; sold: number }[] }
export interface EventReviewInput { name: string; tasks_total: number; tasks_done: number; blocked: string[]; overdue: string[]; notes?: string | null }

const CATEGORIES = ["venue", "content", "logistics", "marketing", "supplies", "volunteers", "general"];

function planTemplate(i: EventPlanInput): PlannedTask[] {
  const t = `${i.type || ""} ${i.name} ${i.description || ""}`.toLowerCase();
  const base: PlannedTask[] = [
    { title: "Define goals & success metric for the event", category: "general", priority: "high", days_before: 28 },
    { title: "Book the venue & confirm date with school/admin", category: "venue", priority: "high", days_before: 25 },
    { title: "Draft a simple budget", category: "general", priority: "medium", days_before: 24 },
    { title: "Make the event flyer / poster", category: "marketing", priority: "medium", days_before: 18 },
    { title: "Post announcement on Instagram & TikTok", category: "marketing", priority: "medium", days_before: 14 },
    { title: "Recruit volunteers and assign shifts", category: "volunteers", priority: "high", days_before: 14 },
    { title: "Buy / collect supplies", category: "supplies", priority: "medium", days_before: 7 },
    { title: "Plan the run-of-show (minute-by-minute schedule)", category: "logistics", priority: "medium", days_before: 7 },
    { title: "Reminder post + countdown story", category: "marketing", priority: "low", days_before: 2 },
    { title: "Volunteer briefing / walkthrough", category: "volunteers", priority: "medium", days_before: 1 },
    { title: "Set up venue (tables, signs, sign-in sheet)", category: "venue", priority: "high", days_before: 0 },
  ];
  if (/teach|tutor|workshop|class|lesson/.test(t)) {
    base.push(
      { title: "Write the lesson plan / workshop slides", category: "content", priority: "high", days_before: 14 },
      { title: "Print handouts & worksheets", category: "supplies", priority: "medium", days_before: 3 },
      { title: "Rehearse the session with a teammate", category: "content", priority: "medium", days_before: 2 },
    );
  }
  if (/fundrais|bake|sale|donat|gala|charity/.test(t)) {
    base.push(
      { title: "Set up the online donation page (GoFundMe/Givebutter)", category: "general", priority: "high", days_before: 21 },
      { title: "Prepare cash box, card reader & donation QR code", category: "logistics", priority: "high", days_before: 3 },
      { title: "Pitch 3 local businesses for sponsorship", category: "general", priority: "medium", days_before: 20 },
    );
  }
  if (/drive|collect|clean|food|cloth/.test(t)) {
    base.push(
      { title: "Arrange drop-off bins & storage", category: "logistics", priority: "high", days_before: 10 },
      { title: "Coordinate pickup with the receiving charity", category: "logistics", priority: "high", days_before: 5 },
    );
  }
  if (/outreach|awareness|speak|talk/.test(t)) {
    base.push({ title: "Prepare talking points & a 1-page info sheet", category: "content", priority: "medium", days_before: 10 });
  }
  base.push({ title: "Post-event thank-you post & photo recap", category: "marketing", priority: "low", days_before: -1 });
  return base.sort((a, b) => b.days_before - a.days_before);
}

export const moduleTasks: Record<string, AITask> = {
  event_plan: {
    system:
      "You are Foundry's event planner, helping high-school students run community service events. " +
      `Break the event into 10-16 concrete, small, actionable prep tasks. Each task has a category from: ${CATEGORIES.join(", ")}. ` +
      "days_before is how many days before the event the task should be done (0 = day of, -1 = day after). Return JSON only.",
    maxTokens: 1600,
    prompt: (i: EventPlanInput) =>
      `Event: ${i.name}\nType: ${i.type || "other"}\nDescription: ${i.description || "(none)"}\nDate: ${i.date || "TBD"}\nLocation: ${i.location || "TBD"}\nTeam size: ${i.team_size || "unknown"}\n\n` +
      `Return {"summary": "one encouraging sentence", "tasks": [{"title": "...", "category": "...", "priority": "low|medium|high", "days_before": 14}]}`,
    fallback: (i: EventPlanInput) => ({
      summary: `Here's a starter checklist for ${i.name}. Edit anything that doesn't fit — and assign owners so nothing slips.`,
      tasks: planTemplate(i),
    }),
  },

  event_review: {
    system: "You help high-school students reflect after a community service event. Be honest, kind, and specific. Return JSON.",
    prompt: (i: EventReviewInput) =>
      `Event: ${i.name}\nTasks done: ${i.tasks_done}/${i.tasks_total}\nBlocked: ${i.blocked.join("; ") || "none"}\nOverdue: ${i.overdue.join("; ") || "none"}\nTeam notes: ${i.notes || "(none)"}\n\n` +
      `Return {"went_well": ["..."], "improve": ["..."], "next_time": ["..."]}`,
    fallback: (i: EventReviewInput) => {
      const pct = i.tasks_total ? Math.round((i.tasks_done / i.tasks_total) * 100) : 0;
      return {
        went_well: [`The team finished ${i.tasks_done} of ${i.tasks_total} prep tasks (${pct}%).`, "You got the event on the calendar and organized — that's the hardest part."],
        improve: [
          ...(i.blocked.length ? [`Unblock earlier: ${i.blocked.slice(0, 3).join(", ")}`] : []),
          ...(i.overdue.length ? [`${i.overdue.length} task(s) ran late — try assigning owners sooner.`] : []),
          "Write down attendance & money raised right after the event while it's fresh.",
        ],
        next_time: ["Start prep 4 weeks out", "Give every task one owner and a due date", "Post a recap within 48 hours"],
      };
    },
  },

  thank_you: {
    system:
      "You write short, warm, personal thank-you notes from high-school students running a community service project to their donors. " +
      "2-3 sentences each, mention the amount's impact concretely, no clichés. Return JSON.",
    maxTokens: 1500,
    prompt: (i: ThankYouInput) =>
      `Project: ${i.project} (cause: ${i.cause || "community"})\nDonors:\n${i.donors.map((d) => `- ${d.name}: $${d.amount}${d.campaign ? ` to "${d.campaign}"` : ""}${d.message ? ` — they wrote: "${d.message}"` : ""}`).join("\n")}\n\n` +
      `Return {"notes": [{"donor": "name", "text": "the note"}]}`,
    fallback: (i: ThankYouInput) => ({
      notes: i.donors.map((d) => ({
        donor: d.name,
        text:
          `Dear ${d.name.split(" ")[0] || "friend"}, thank you so much for your $${Number(d.amount).toLocaleString()} gift${d.campaign ? ` to ${d.campaign}` : ""}! ` +
          `Every dollar goes straight into ${i.project}'s work, and support like yours is what lets a team of students make a real difference. ` +
          `We'll keep you posted on what your gift makes possible. — The ${i.project} team`,
      })),
    }),
  },

  publicity_digest: {
    system:
      "You are a social media analyst for a student-run community service project. Summarize what happened on their socials, " +
      "call out the best-performing post, and give 2-3 concrete, specific suggestions (tie to upcoming events). Short, friendly. Return JSON.",
    maxTokens: 1200,
    prompt: (i: DigestInput) =>
      `Today: ${i.today}. Project: ${i.project}\nAccounts: ${JSON.stringify(i.accounts)}\nPosts (last 7 days):\n${JSON.stringify(i.posts, null, 1)}\nUpcoming events: ${JSON.stringify(i.upcoming_events)}\n\n` +
      `Return {"headline": "one punchy sentence", "summary": "2-3 sentences", "highlights": ["..."], "suggestions": ["..."]}`,
    fallback: (i: DigestInput) => {
      const posted = i.posts.filter((p) => (p.status ?? "posted") === "posted");
      const eng = (p: DigestInput["posts"][number]) => (p.likes || 0) + 2 * (p.comments || 0) + 3 * (p.shares || 0);
      const total = posted.reduce((n, p) => n + (p.likes || 0) + (p.comments || 0) + (p.shares || 0), 0);
      const best = [...posted].sort((a, b) => eng(b) - eng(a))[0];
      const todays = posted.filter((p) => p.posted_at?.slice(0, 10) === i.today);
      const next = i.upcoming_events[0];
      return {
        headline: posted.length
          ? `${posted.length} post${posted.length === 1 ? "" : "s"} this week pulled in ${total.toLocaleString()} interactions.`
          : "Your socials are quiet this week — time to post something!",
        summary: posted.length
          ? `${todays.length ? `You posted ${todays.length} time${todays.length === 1 ? "" : "s"} today. ` : "Nothing went out today yet. "}` +
            (best ? `Your top post on ${best.platform || "socials"} ("${best.content.slice(0, 60)}${best.content.length > 60 ? "…" : ""}") got ${best.likes} likes, ${best.comments} comments and ${best.shares} shares.` : "")
          : "Add your accounts and log a few posts so Foundry can track how people react.",
        highlights: best ? [`Top post: ${best.platform || "post"} — ${eng(best)} weighted engagement`, `${i.accounts.reduce((n, a) => n + (a.followers || 0), 0).toLocaleString()} total followers across ${i.accounts.length} account(s)`] : [],
        suggestions: [
          ...(next ? [`Start a countdown for ${next.name}${next.starts_at ? ` (${next.starts_at.slice(0, 10)})` : ""} — post a teaser today.`] : []),
          best ? `Do more like your top post — people clearly liked it.` : "Introduce your team with a photo post — faces get engagement.",
          "Reply to every comment within a day to boost reach.",
        ],
      };
    },
  },

  captions: {
    system:
      "You write social media captions for student-run community service projects. Tailor each caption to the platform's style " +
      "(Instagram: warm + hashtags, TikTok: hooky + short, X: punchy, Facebook/LinkedIn: informative). Return JSON.",
    maxTokens: 1200,
    prompt: (i: CaptionsInput) =>
      `Project: ${i.project}\nEvent: ${JSON.stringify(i.event)}\nPlatforms: ${i.platforms.join(", ")}\n\nReturn {"captions": [{"platform": "...", "text": "..."}]}`,
    fallback: (i: CaptionsInput) => {
      const when = i.event.starts_at ? new Date(i.event.starts_at).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) : "soon";
      const where = i.event.location ? ` at ${i.event.location}` : "";
      const tag = "#" + i.project.replace(/[^a-z0-9]/gi, "");
      const texts: Record<string, string> = {
        instagram: `✨ ${i.event.name} is happening ${when}${where}! ${i.event.description ? i.event.description.slice(0, 120) + " " : ""}Bring a friend and come make a difference with us 💛\n\n${tag} #communityservice #studentsforchange`,
        tiktok: `POV: you spend ${when} doing something that actually matters 👀 ${i.event.name}${where}. Link in bio! ${tag}`,
        x: `${i.event.name} — ${when}${where}. Students making real change. Join us. ${tag}`,
        facebook: `We're excited to invite you to ${i.event.name} on ${when}${where}. ${i.event.description || ""} Everyone is welcome — share with someone who'd want to help!`,
        linkedin: `Our student team is hosting ${i.event.name} on ${when}${where}. ${i.event.description || ""} Proud of what this group is building.`,
        youtube: `${i.event.name} — what we're doing and why it matters. Join us ${when}${where}!`,
      };
      const plats = i.platforms.length ? i.platforms : ["instagram", "tiktok"];
      return { captions: plats.map((p) => ({ platform: p, text: texts[p] || texts.instagram })) };
    },
  },

  parse_posts: {
    system: "Extract social media posts from pasted text (e.g. copied from an analytics export or notes). Return JSON.",
    prompt: (i: { text: string; today: string }) =>
      `Today: ${i.today}\nText:\n"""${i.text}"""\n\nReturn {"posts": [{"platform": "instagram|tiktok|facebook|x|linkedin|youtube", "content": "...", "likes": 0, "comments": 0, "shares": 0, "posted_at": "YYYY-MM-DD"}]}`,
    fallback: (i: { text: string; today: string }) => ({
      posts: (i.text || "")
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const low = line.toLowerCase();
          const platform = ["instagram", "tiktok", "facebook", "linkedin", "youtube"].find((p) => low.includes(p)) || (/\b(x|twitter)\b/.test(low) ? "x" : "instagram");
          const num = (re: RegExp) => Number(line.match(re)?.[1]?.replace(/,/g, "") || 0);
          return {
            platform,
            content: line.replace(/\d[\d,]*\s*(likes?|comments?|shares?)/gi, "").replace(/\b(instagram|tiktok|facebook|linkedin|youtube|twitter)\b[:\-]?/gi, "").trim() || line,
            likes: num(/(\d[\d,]*)\s*likes?/i),
            comments: num(/(\d[\d,]*)\s*comments?/i),
            shares: num(/(\d[\d,]*)\s*shares?/i),
            posted_at: line.match(/\d{4}-\d{2}-\d{2}/)?.[0] || i.today,
          };
        }),
    }),
  },

  finance_report: {
    system:
      "You are a friendly treasurer coach writing a plain-English finance summary for a student-run community service project, " +
      "suitable to show a teacher advisor. Be concrete with numbers. Return JSON.",
    maxTokens: 1200,
    prompt: (i: FinanceReportInput) => `Data:\n${JSON.stringify(i, null, 1)}\n\nReturn {"summary": "2-3 sentences", "highlights": ["..."], "concerns": ["..."]}`,
    fallback: (i: FinanceReportInput) => {
      const income = i.by_category.filter((c) => c.kind === "income").sort((a, b) => b.amount - a.amount);
      const expense = i.by_category.filter((c) => c.kind === "expense").sort((a, b) => b.amount - a.amount);
      const over = i.events.filter((e) => e.budget > 0 && e.spent > e.budget);
      const low = i.merch.filter((m) => m.stock <= 3);
      const $ = (n: number) => "$" + Math.round(n).toLocaleString();
      return {
        summary: `${i.project} has brought in ${$(i.total_in)} and spent ${$(i.total_out)}, leaving a balance of ${$(i.balance)}.` +
          (income[0] ? ` Most income came from ${income[0].category} (${$(income[0].amount)}).` : "") +
          (expense[0] ? ` The biggest cost was ${expense[0].category} (${$(expense[0].amount)}).` : ""),
        highlights: [
          ...(i.balance >= 0 ? ["You're in the green — income covers spending."] : []),
          ...income.slice(0, 2).map((c) => `${c.category}: ${$(c.amount)} in`),
          ...i.merch.filter((m) => m.sold > 0).slice(0, 2).map((m) => `${m.name}: ${m.sold} sold`),
        ],
        concerns: [
          ...(i.balance < 0 ? [`Balance is negative (${$(i.balance)}) — pause spending or run a fundraiser.`] : []),
          ...over.map((e) => `${e.name} is over budget by ${$(e.spent - e.budget)}.`),
          ...low.map((m) => `${m.name} is low on stock (${m.stock} left).`),
          ...(i.total_in === 0 ? ["No income logged yet — record donations and sales so the books stay accurate."] : []),
        ],
      };
    },
  },
};
