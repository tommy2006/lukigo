// Public webhook for donation platforms (GoFundMe/Givebutter/Stripe via Zapier, etc.).
// POST { project_id, secret, fundraiser_id?, donor_name?, amount, message?, source? } -> { ok, id }
// Auth = the project's webhook_secret, checked inside the security-definer RPC `record_donation`.
// NOTE: finance auto-income is NOT created here (anon key can't write `transactions` under RLS).
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400, headers: cors });
  const amount = Number(b.amount);
  if (!b.project_id || !b.secret || !(amount > 0)) {
    return NextResponse.json({ ok: false, error: "project_id, secret and a positive amount are required" }, { status: 400, headers: cors });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500, headers: cors });

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc("record_donation", {
    p_project: String(b.project_id),
    p_secret: String(b.secret),
    p_fundraiser: b.fundraiser_id || null,
    p_donor: b.donor_name ? String(b.donor_name).slice(0, 120) : null,
    p_amount: amount,
    p_message: b.message ? String(b.message).slice(0, 500) : null,
    p_source: b.source ? String(b.source).slice(0, 40) : "webhook",
  });
  if (error) {
    const bad = /bad secret/i.test(error.message);
    return NextResponse.json({ ok: false, error: bad ? "invalid project_id or secret" : error.message }, { status: bad ? 401 : 500, headers: cors });
  }
  return NextResponse.json({ ok: true, id: data }, { headers: cors });
}
