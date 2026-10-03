# Lukigo

**Build your community project. Then run it.**

Lukigo helps high-school students found, run and join community service projects. A student describes their idea in plain words. Lukigo's AI suggests the tools the project needs. The student snaps those tools together like Scratch blocks, and the result is their own project management app. It covers the team, events, volunteers, money, sponsors, partners and social media.

**Try it now: [lukigo.vercel.app](https://lukigo.vercel.app)**

*Hack4Humanity, Track A, Challenge 1: NGO Operating System.*

---

## The problem

Most student-led service projects start with a group chat and a spreadsheet, and many fade within a semester:
- Tasks have no owner.
- Volunteers don't know when to show up.
- Nobody knows how much money came in.
- The founder burns out from holding everything in their head.

Ready-made NGO software is built for adults with budgets. It isn't built for a 16-year-old starting a tutoring club, who doesn't yet know they'll need a volunteer-hours log or a sponsor pipeline.

## What Lukigo does

### 1. AI onboarding (optional, about 3 minutes)
1. The founder describes the project in their own words and says where it's based.
2. The AI asks 4–5 multiple-choice questions written for that project.
3. It recommends a starter kit: which modules and features to use, a sentence for each explaining why, a name, a tagline, and the first three things to do this week.

### 2. The Builder: snap together your own app
Modules are colourful blocks that snap under a **Project Core** block, like Scratch. Drag them in, reorder them, and open any block to switch individual features on or off. Each feature has a plain-English explanation for first-time founders.

Modules share data, and the **Connections** panel shows it live. When two modules that work together are both attached, their link lights up and adds a feature. For example:
- **People & HR → Event Manager:** assign team members to event tasks.
- **Fundraising → Finance:** donations land in the ledger automatically.
- **Sponsor Finder → Fundraising and Finance:** a committed sponsor's money flows into both.
- **Volunteer Shifts → People & HR:** confirmed shifts add service hours to each member's record.

### 3. The workspace
After launching, the project gets a workspace with a sidebar of exactly the modules that were picked:

| Module | What it does |
|---|---|
| 🧑‍🤝‍🧑 **People & HR** | Roster with contacts, an org chart, roles and permissions, a recruitment pipeline and a volunteer-hours leaderboard |
| 🎪 **Event Manager** | Events with prep checklists (venue, content, logistics…), task owners, progress per person, a calendar, **✨ Plan with AI** (drafts a full task list), and a post-event AI review |
| 💸 **Fundraising Tracker** | Campaign goals, a **live donation feed** (works with GoFundMe, Givebutter and similar sites through a webhook), a donor list and AI thank-you notes |
| 📣 **Publicity Pulse** | An AI "Today on your socials" summary, engagement charts, a content calendar and an AI caption writer |
| 🧾 **Finance & Merch** *(add-on)* | Income and expense ledger, cashflow chart, event budgets vs. actual spending, merch stock and sales, and an AI finance report |
| 🤝 **Sponsor Finder** *(add-on)* | A sponsorship brief, **AI search for real sponsors** in your region, a drag-and-drop outreach board (Saved → Contacted → In talks → Committed) and an AI letter writer |
| 🗓️ **Volunteer Shifts** *(add-on)* | Sign-up sheets, check-in, leader-confirmed service hours, weekly availability, **✨ Fill with AI** staffing and printable hour certificates |
| 🏫 **Partners & Beneficiaries** *(add-on)* | Partner directory, agreements (what each side gives and gets), an activity log and AI proposals. An optional **Beneficiary management** feature tracks the people you serve, their needs, consent and feedback. It's off by default, because pure awareness campaigns don't need it |

### 4. Also built in
- **Home page for students in several projects:** an AI summary of your week across all your projects, a card per project showing your role and task progress, a combined to-do list, upcoming events, and a project switcher in the sidebar.
- **✨ Ask Lukigo assistant:** a chat window on every project page for any member. It answers practical questions ("what should I focus on this week?") and gives volunteering best practices, using your role, your tasks and your project's events. Safety advice for minors is built in.
- **🧭 Project Portal (Discover):** a public page where anyone can search listed projects by keyword or by AI ("teach kids coding on weekends"), filter by cause and role, and ask to join as Member, Contributor, Volunteer, Donor or Mentor/Partner. Leaders accept or decline requests.
- **Location-aware AI:** every AI feature is told where the project is based. A Helsinki project gets Finnish foundations as sponsor suggestions; a Singapore project gets Singapore merch makers.

## Roles and permissions

Every project has a real chain of responsibility. The rules are enforced **in the database** (Postgres row-level security and triggers), not just hidden in the interface:

| Role | Can do |
|---|---|
| 👑 **President** (founder) | Everything, including renaming or deleting the project and changing its modules |
| **Vice President** | Everything except renaming or deleting the project |
| **Secretary / Treasurer** | Secretary: events, publicity, shifts, partners. Treasurer: fundraising, finance, sponsors |
| **Department Head** | Full control of their own department's module, and can assign tasks to people at their level or below |
| **Member** | Sees the project, updates their own tasks and contact details, signs up for shifts, and *requests* new events |

Some of the safeguards:
- A member can't assign a task to a leader, or take a leader's task.
- Donor, finance and sponsor data is visible to leaders only.
- Events a member creates are **requests**. Only the requester and the approvers (President, VP, Head of Events) see them until one approves.
- Members can't change their own role.

## What makes it impressive

- **Students build their own tool instead of adapting to one.** The Scratch-style builder, with live data links between modules, turns "which software do we need?" into a 2-minute, visual and reversible choice.
- **AI throughout, with a fallback for every feature:**
  - **Where:** onboarding, module recommendations, event planning, sponsor search, letters, the social summary, staffing, partner emails, the finance report, portal search, the home summary and the assistant.
  - **Fallback:** each AI feature has a built-in answer if the model is down or rate-limited, so the app never breaks during a demo.
- **Swappable AI provider:** the code talks to any OpenAI-compatible endpoint. It runs on Groq today, has been set up for Mistral's API, and has deployment notes for **self-hosting Mistral Large 3 on Verda GPUs** with vLLM. If a model is retired, it finds the provider's best available model automatically.
- **It runs on real data:**
  - Supabase Postgres with row-level security, realtime donations and a donation webhook.
  - One account per person across many projects, kept in sync.
  - Permissions checked by end-to-end tests against the live database.
- **Built for teenagers:** plain-English tips at every step, safety guidance for minors, consent tracking for beneficiaries, and service-hour certificates for school.
- **Two team prototypes merged into one:** our teammate's sponsor-finder and project-portal prototype (`index.html`, *Kết Nối Tài Trợ*) became the Sponsor Finder module and the Project Portal.

## How judges can try it (about 5 minutes)

1. Open **[lukigo.vercel.app](https://lukigo.vercel.app)** and click **Start a project**, then sign up. Any email works; no confirmation is needed.
2. **Found a project:** describe an idea (or tap an example), enter a city, answer the AI's questions and look at the recommended starter kit.
3. **Builder:** drag **Finance & Merch** or **Sponsor Finder** in from the shelf, open a block to toggle features, and watch **Connections** light up. Click **Launch project**.
4. **Overview:** click **✨ Load demo data**. This fills the project with a team, events, tasks, donations, social posts, transactions, shifts and partners for any modules you picked. Then try:
   - **Event Manager:** open an event and click **✨ Plan with AI**.
   - **Fundraising:** click **Simulate donation** and watch the live feed update.
   - **Sponsor Finder:** **✨ Find sponsors**, then drag one to **Committed** and see it appear in Finance.
   - **Volunteer Shifts:** **✨ Fill with AI**, or print an hours certificate.
   - **✨ Ask Lukigo** (bottom right): ask "How do I keep volunteers coming back?"
5. **See the permissions:**
   1. Copy the invite code from the sidebar.
   2. In a private window, sign up as a second person and use **Join with code**.
   3. As that member: the money modules are hidden, you can only assign tasks to yourself, and **Request an event** sends it to the President for approval.
6. **Portal:** as the President, click **List my project** on the Overview. Then open **🧭 Discover** (even while logged out) and try the AI search.

## Tech

- **Frontend:** Next.js 16 (App Router, React 19, TypeScript), Tailwind CSS v4, Framer Motion, dnd-kit.
- **Backend:**
  - Supabase: email auth, Postgres with row-level security and security-definer functions, and realtime.
  - Next.js API routes for the AI tasks, the assistant and the donation webhook.
- **AI:** OpenAI-compatible chat API, currently Groq `openai/gpt-oss-120b`. Swap providers with 3 environment variables, with no code changes.
- **Hosting:** Vercel.

```
lukigo/
├── foundry/                  ← the Lukigo app (Next.js)
│   ├── src/app/              ← pages: /, /login, /home, /onboarding, /build, /discover, /p/[id]/*
│   ├── src/lib/modules.ts    ← module and feature registry + data links
│   ├── src/lib/roles.ts      ← role and permission rules (mirrored in SQL)
│   ├── src/lib/ai/           ← AI client, location context, tasks with offline fallbacks
│   ├── supabase/             ← schema.sql + patch-001…005
│   └── SETUP.md              ← Supabase / Vercel / AI provider setup
└── index.html                ← original "Kết Nối Tài Trợ" prototype (merged into Lukigo)
```

### Run it yourself
1. Create a Supabase project and run `foundry/supabase/schema.sql`, then `patch-001` to `patch-005` in order. Turn off email confirmation for quick sign-ups.
2. In `foundry/`, run `cp .env.example .env.local`. Fill in the Supabase URL and publishable key, and optionally the `AI_*` variables.
3. Run `npm install`, then `npm run dev`. On Vercel, set **Root Directory = `foundry`**.

Full details are in [`foundry/SETUP.md`](foundry/SETUP.md).
