import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries((fs.readFileSync(".env.local","utf8")+"\n"+fs.readFileSync(".env.test.local","utf8")).split(/\r?\n/).filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1).trim()]));
const mk = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const mode = process.argv[2] || "sync";
const mem = mk(); const { data: ms } = await mem.auth.signInWithPassword({ email: env.TEST_MEMBER_EMAIL, password: env.TEST_PASSWORD });
const { data: row } = await mem.from("project_members").select("id,project_id,school,full_name").eq("user_id", ms.user.id).limit(1).single();
if (mode === "sync") {
  const newSchool = "Sync Test High " + Math.floor(Math.random() * 1000);
  const u = await mem.from("project_members").update({ school: newSchool, phone: "555-0199" }).eq("id", row.id).select("id");
  const { data: prof } = await mem.from("profiles").select("school").eq("id", ms.user.id).single();
  console.log("member edits own contact:", u.error ? u.error.message : `${u.data.length} row`, "| profile.school synced:", prof.school === newSchool);
} else {
  const pid = row.project_id;
  const { data: pres } = await mem.from("project_members").select("id,full_name").eq("project_id", pid).eq("role", "president").single();
  const { data: ev } = await mem.from("events").select("id").eq("project_id", pid).limit(1).single();
  const a = await mem.from("tasks").insert({ project_id: pid, event_id: ev.id, title: "PERMTEST member->president", assignee_member_id: pres.id }).select("id");
  console.log("member assigns task to president:", a.error ? "BLOCKED - " + a.error.message : "ALLOWED (bug!)");
  const b = await mem.from("tasks").insert({ project_id: pid, event_id: ev.id, title: "PERMTEST member->self", assignee_member_id: row.id }).select("id");
  console.log("member assigns task to self:", b.error ? "FAILED " + b.error.message : "ok");
  const { data: presTask } = await mem.from("tasks").select("id").eq("project_id", pid).eq("assignee_member_id", pres.id).limit(1).maybeSingle();
  if (presTask) { const c = await mem.from("tasks").update({ assignee_member_id: row.id }).eq("id", presTask.id).select("id"); console.log("member takes president's task:", c.error ? "BLOCKED - " + c.error.message : "ALLOWED (bug!)"); }
  const d = await mem.from("donations").select("id").eq("project_id", pid);
  const f = await mem.from("transactions").select("id").eq("project_id", pid);
  console.log("member reads donations:", d.data?.length ?? d.error?.message, "| transactions:", f.data?.length ?? f.error?.message);
  const fo = mk(); await fo.auth.signInWithPassword({ email: env.TEST_FOUNDER_EMAIL, password: env.TEST_PASSWORD });
  const g = await fo.from("donations").select("id").eq("project_id", pid);
  console.log("president reads donations:", g.data?.length);
  await fo.from("tasks").delete().like("title", "PERMTEST%");
}
process.exit();
