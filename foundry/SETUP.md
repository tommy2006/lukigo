# Lukigo — setup

## 1. Supabase (≈5 min)
1. supabase.com → **New project** (any region near you; save the DB password).
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
3. **Authentication → Sign In / Providers → Email**: turn **off** "Confirm email" (instant sign-up for the demo).
4. **Project Settings → API**: copy **Project URL** and **anon public** key into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
5. After deploying: **Authentication → URL Configuration** → set Site URL to your Vercel URL.

## 2. Vercel (≈5 min)
1. Push this `app/` folder to a GitHub repo (or set **Root Directory = app** if you push the parent folder).
2. vercel.com/new → import the repo → Framework: Next.js.
3. Add env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`.
4. Deploy. (Env var changes need a redeploy.)

## 3. Mistral Large 3 on Verda
Mistral Large 3 = 675B-param MoE (41B active), Apache-2.0.

| | GPUs | Checkpoint |
|---|---|---|
| **Minimum** | 8x H100 80GB (or 8x A100 80GB) | `mistralai/Mistral-Large-3-675B-Instruct-2512-NVFP4` |
| **Recommended** | 8x H200 141GB or 8x B200 | `mistralai/Mistral-Large-3-675B-Instruct-2512` (FP8) |

Other requirements: Ubuntu 22.04 + CUDA 12.x, >= 1 TB NVMe disk, >= 512 GB RAM, >= 64 vCPU, port 8000 open.

```bash
pip install -U vllm
export HF_TOKEN=hf_...
vllm serve mistralai/Mistral-Large-3-675B-Instruct-2512-NVFP4 --tensor-parallel-size 8 --tokenizer-mode mistral --config-format mistral --load-format mistral --max-model-len 32768 --host 0.0.0.0 --port 8000 --api-key YOUR_SECRET
```
Ready in ~30-60 min. Then set `AI_BASE_URL=http://<verda-ip>:8000/v1`, `AI_API_KEY=YOUR_SECRET`,
`AI_MODEL=mistralai/Mistral-Large-3-675B-Instruct-2512-NVFP4` (must match the served model id).

Test: `curl http://<ip>:8000/v1/models -H "Authorization: Bearer YOUR_SECRET"`

**Plan B**: `AI_BASE_URL=https://api.mistral.ai/v1`, `AI_MODEL=mistral-large-latest`, `AI_API_KEY=<La Plateforme key>`.
**Plan C**: leave `AI_BASE_URL` empty; AI features use built-in fallbacks ("offline mode").

## Demo script
1. Sign up → **Found a project** → describe idea → answer AI questions → see recommended blocks.
2. Builder: drag Finance & Merch in, toggle features, watch **Connections** light up → Launch.
3. Overview → **Load demo data** → tour Events (✨ Plan with AI), Fundraising (simulate live donation), Publicity digest, Finance.
4. Second browser/incognito: sign up as a member → **Join with code** → see limited privileges.
