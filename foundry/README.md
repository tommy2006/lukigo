# Lukigo — build & run your community service project

Hack4Humanity · Track A.1 (NGO Operating System).

High-school founders describe their project, an AI onboarding suggests modules, and a Scratch-style
drag-and-drop builder snaps together their own project-management app:
**People & HR · Event Manager · Fundraising Tracker · Publicity Pulse · Finance & Merch (add-on)**.

Stack: Next.js 16 (App Router) · Supabase (auth, Postgres + RLS, Realtime) · Mistral via vLLM on Verda (OpenAI-compatible) · Vercel.

- Setup (Supabase, Vercel, Verda): [SETUP.md](SETUP.md)
- Database: `supabase/schema.sql` (+ `supabase/patch-001-role-guard.sql` for existing databases)
- Local dev: `cp .env.example .env.local`, fill in keys, `npm install`, `npm run dev`

On Vercel, set **Root Directory = `foundry`**.
