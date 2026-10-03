# Lukigo — build & run your community service project

Hack4Humanity · Track A.1 (NGO Operating System).

High-school founders describe their project, an AI onboarding suggests modules, and a Scratch-style
drag-and-drop builder snaps together their own project-management app:
**People & HR · Event Manager · Fundraising Tracker · Publicity Pulse · Finance & Merch (add-on)**.

Stack: Next.js 16 (App Router) · Supabase (auth, Postgres + RLS, Realtime) · Mistral via vLLM on Verda (OpenAI-compatible) · Vercel.

- Setup (Supabase, Vercel, Verda): [SETUP.md](SETUP.md)
- Database: `supabase/schema.sql`, then `supabase/patch-001` … `patch-005` in order
- Local dev: `cp .env.example .env.local`, fill in keys, `npm install`, `npm run dev`

On Vercel, set **Root Directory = `foundry`**.

See the [main README](../README.md) for the full overview and how to try it.
