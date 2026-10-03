"use client";
import { supabase } from "./supabase";
import type { Member, StackItem } from "./types";

const day = (n: number) => new Date(Date.now() + n * 864e5);
const iso = (n: number) => day(n).toISOString();
const date = (n: number) => day(n).toISOString().slice(0, 10);

/** Fill a project with realistic sample data so every module has something to show. */
export async function seedDemo(projectId: string, stack: StackItem[], meId?: string) {
  const sb = supabase();
  const has = (id: string) => stack.some((s) => s.id === id);

  // --- team ---
  const people = [
    { full_name: "Maya Chen", email: "maya@example.edu", role: "vice_president", department: "Leadership", title: "Vice President", grade: "12", hours: 34 },
    { full_name: "Jordan Okafor", email: "jordan@example.edu", role: "head", department: "Events", title: "Head of Events", grade: "11", hours: 28 },
    { full_name: "Priya Raman", email: "priya@example.edu", role: "treasurer", department: "Finance", title: "Treasurer", grade: "11", hours: 19 },
    { full_name: "Leo Martins", email: "leo@example.edu", role: "head", department: "Publicity", title: "Head of Publicity", grade: "10", hours: 22 },
    { full_name: "Sofia Alvarez", email: "sofia@example.edu", role: "head", department: "HR", title: "Head of HR", grade: "11", hours: 15 },
    { full_name: "Ethan Park", email: "ethan@example.edu", role: "member", department: "Events", title: null, grade: "9", hours: 9 },
    { full_name: "Aisha Bello", email: "aisha@example.edu", role: "member", department: "Outreach", title: null, grade: "10", hours: 12 },
  ];
  const { data: mem, error: me } = await sb.from("project_members")
    .insert(people.map((p) => ({ ...p, project_id: projectId, school: "Lincoln High School", phone: "555-01" + Math.floor(10 + Math.random() * 89) })))
    .select();
  if (me) throw me;
  const m = (mem as Member[]) || [];
  const ids = [...(meId ? [meId] : []), ...m.map((x) => x.id)];
  const pick = (i: number) => ids[i % ids.length] ?? null;

  // --- events + tasks ---
  if (has("events")) {
    const { data: evs } = await sb.from("events").insert([
      { project_id: projectId, name: "Spring Bake Sale Fundraiser", type: "fundraiser", starts_at: iso(9), location: "Cafeteria", status: "planning", budget: 150, lead_member_id: pick(1), description: "Bake sale at lunch, all proceeds to the library tutoring fund." },
      { project_id: projectId, name: "Coding Workshop #3", type: "teaching", starts_at: iso(4), location: "Public Library Room B", status: "ready", budget: 40, lead_member_id: pick(0), description: "Intro to Scratch for 6th–8th graders." },
      { project_id: projectId, name: "Book Drive", type: "drive", starts_at: iso(21), location: "Main hallway", status: "idea", budget: 30, lead_member_id: pick(6) },
      { project_id: projectId, name: "Coding Workshop #2", type: "teaching", starts_at: iso(-10), location: "Public Library Room B", status: "done", budget: 40, lead_member_id: pick(0) },
    ]).select();
    const [bake, work, drive] = (evs as { id: string }[]) || [];
    const T = (event_id: string, title: string, category: string, status: string, a: number, due: number, priority = "medium") =>
      ({ project_id: projectId, event_id, title, category, status, assignee_member_id: pick(a), due_date: date(due), priority, completed_at: status === "done" ? iso(-1) : null });
    if (bake) await sb.from("tasks").insert([
      T(bake.id, "Book cafeteria tables with front office", "venue", "done", 1, -2, "high"),
      T(bake.id, "Sign-up sheet for bakers", "volunteers", "done", 4, -1),
      T(bake.id, "Design flyer", "marketing", "in_progress", 3, 2),
      T(bake.id, "Instagram countdown posts", "marketing", "todo", 3, 6),
      T(bake.id, "Buy napkins, plates, price labels", "supplies", "todo", 5, 7),
      T(bake.id, "Cash box + Venmo QR code", "logistics", "todo", 2, 8, "high"),
      T(bake.id, "Allergy labels for every item", "content", "blocked", 6, 7),
    ]);
    if (work) await sb.from("tasks").insert([
      T(work.id, "Finalize Scratch lesson slides", "content", "done", 0, 1, "high"),
      T(work.id, "Confirm room with librarian", "venue", "done", 1, 0),
      T(work.id, "Charge 10 loaner laptops", "logistics", "in_progress", 5, 3),
      T(work.id, "Print certificates", "supplies", "todo", 6, 3),
    ]);
    if (drive) await sb.from("tasks").insert([
      T(drive.id, "Contact receiving shelter", "logistics", "todo", 6, 10, "high"),
      T(drive.id, "Get drop-off boxes", "supplies", "todo", 5, 14),
    ]);

    // --- fundraising ---
    if (has("fundraising")) {
      const { data: frs } = await sb.from("fundraisers").insert([
        { project_id: projectId, event_id: bake?.id, name: "Bake Sale Online Pre-orders", goal: 600, platform: "givebutter", platform_url: "https://givebutter.com/example", status: "active", starts_on: date(-5), ends_on: date(9) },
        { project_id: projectId, name: "Laptops for Kids", goal: 2500, platform: "gofundme", platform_url: "https://gofundme.com/example", status: "active", starts_on: date(-20), ends_on: date(40) },
      ]).select();
      const [f1, f2] = (frs as { id: string }[]) || [];
      const donors = [["Mrs. Patel", 50, f2], ["Anonymous", 20, f1], ["Rotary Club", 500, f2], ["Kevin L.", 15, f1], ["The Nguyen Family", 100, f2], ["Lincoln PTA", 250, f2], ["Sam W.", 10, f1], ["Grandma Rose", 40, f1]] as const;
      const dons = donors.map(([donor_name, amount, f], i) => ({ project_id: projectId, fundraiser_id: f?.id, donor_name, amount, source: i % 2 ? "givebutter" : "gofundme", created_at: iso(-i * 1.7), message: i === 2 ? "Proud to support young leaders!" : null }));
      await sb.from("donations").insert(dons);
      if (has("finance")) await sb.from("transactions").insert(dons.map((d) => ({ project_id: projectId, kind: "income", category: "donation", amount: d.amount, description: `Donation — ${d.donor_name}`, occurred_on: d.created_at.slice(0, 10), fundraiser_id: d.fundraiser_id })));
    }

    // --- publicity ---
    if (has("publicity")) {
      const { data: accs } = await sb.from("social_accounts").insert([
        { project_id: projectId, platform: "instagram", handle: "@codebridge.kids", followers: 412 },
        { project_id: projectId, platform: "tiktok", handle: "@codebridge", followers: 1280 },
      ]).select();
      const [ig, tt] = (accs as { id: string }[]) || [];
      await sb.from("social_posts").insert([
        { project_id: projectId, account_id: ig?.id, platform: "instagram", event_id: work?.id, content: "Workshop #2 recap: 18 kids built their first game in Scratch! 🎮 Thanks to our amazing volunteers.", posted_at: iso(-0.2), likes: 87, comments: 12, shares: 5 },
        { project_id: projectId, account_id: tt?.id, platform: "tiktok", event_id: bake?.id, content: "POV: you're taste-testing 40 cookies for the bake sale 🍪 #fundraiser", posted_at: iso(-0.4), likes: 640, comments: 48, shares: 31 },
        { project_id: projectId, account_id: ig?.id, platform: "instagram", event_id: bake?.id, content: "SAVE THE DATE: Spring Bake Sale, cafeteria, all proceeds fund laptops for kids 💻", posted_at: iso(-2), likes: 54, comments: 6, shares: 9 },
        { project_id: projectId, account_id: tt?.id, platform: "tiktok", content: "Meet the team behind CodeBridge ✨", posted_at: iso(-5), likes: 310, comments: 22, shares: 4 },
        { project_id: projectId, account_id: ig?.id, platform: "instagram", event_id: bake?.id, content: "Countdown: 1 week until the bake sale!", posted_at: iso(2), status: "scheduled", likes: 0, comments: 0, shares: 0 },
      ]);
    }

    // --- finance & merch ---
    if (has("finance")) {
      await sb.from("transactions").insert([
        { project_id: projectId, kind: "expense", category: "supplies", amount: 38.5, description: "Baking ingredients", occurred_on: date(-3), event_id: bake?.id },
        { project_id: projectId, kind: "expense", category: "marketing", amount: 22, description: "Flyer printing", occurred_on: date(-2), event_id: bake?.id },
        { project_id: projectId, kind: "expense", category: "supplies", amount: 31, description: "Certificates & snacks", occurred_on: date(-11), event_id: work?.id },
        { project_id: projectId, kind: "income", category: "sponsorship", amount: 200, description: "Joe's Pizza sponsorship", occurred_on: date(-15) },
        { project_id: projectId, kind: "expense", category: "supplies", amount: 120, description: "Merch order: 40 stickers + 20 tees", occurred_on: date(-18) },
      ]);
      const { data: items } = await sb.from("merch_items").insert([
        { project_id: projectId, name: "CodeBridge Tee", price: 15, unit_cost: 5, stock: 14, emoji: "👕" },
        { project_id: projectId, name: "Sticker pack", price: 3, unit_cost: 0.5, stock: 31, emoji: "✨" },
      ]).select();
      const [tee, stk] = (items as { id: string }[]) || [];
      await sb.from("merch_sales").insert([
        { project_id: projectId, item_id: tee?.id, quantity: 6, unit_price: 15, buyer: "Spirit week booth", sold_on: date(-6) },
        { project_id: projectId, item_id: stk?.id, quantity: 9, unit_price: 3, buyer: "Spirit week booth", sold_on: date(-6) },
      ]);
      await sb.from("transactions").insert([
        { project_id: projectId, kind: "income", category: "merch", amount: 90, description: "6× CodeBridge Tee", occurred_on: date(-6) },
        { project_id: projectId, kind: "income", category: "merch", amount: 27, description: "9× Sticker pack", occurred_on: date(-6) },
      ]);
    }
    // --- volunteer shifts ---
    if (has("shifts")) {
      const at = (d: number, h: number) => { const x = day(d); x.setHours(h, 0, 0, 0); return x.toISOString(); };
      const { data: sh } = await sb.from("shifts").insert([
        { project_id: projectId, event_id: bake?.id, title: "Bake sale table", starts_at: at(9, 11), ends_at: at(9, 13), location: "Cafeteria", slots: 3 },
        { project_id: projectId, event_id: bake?.id, title: "Setup & signage crew", starts_at: at(9, 9), ends_at: at(9, 11), location: "Cafeteria", slots: 2 },
        { project_id: projectId, event_id: work?.id, title: "Workshop helpers", starts_at: at(4, 14), ends_at: at(4, 16), location: "Public Library Room B", slots: 4 },
        { project_id: projectId, title: "Coding Workshop #2 helpers", starts_at: at(-10, 14), ends_at: at(-10, 16), location: "Public Library Room B", slots: 3 },
      ]).select();
      const [s1, , s3, s4] = (sh as { id: string }[]) || [];
      const S = (shift_id: string | undefined, i: number, status = "signed_up", hours: number | null = null) => shift_id ? { shift_id, project_id: projectId, member_id: pick(i), status, hours } : null;
      await sb.from("shift_signups").insert([S(s1?.id, 1), S(s1?.id, 6), S(s3?.id, 0), S(s3?.id, 5), S(s3?.id, 7), S(s4?.id, 1, "completed", 2), S(s4?.id, 6, "completed", 2), S(s4?.id, 7)].filter((x): x is NonNullable<typeof x> => !!x && !!x.member_id));
      const avail = { sat: ["am", "pm"], sun: ["pm"], wed: ["eve"] };
      for (const x of m.slice(0, 5)) await sb.from("project_members").update({ availability: avail }).eq("id", x.id);
    }
  }

  // --- partners & beneficiaries ---
  if (has("partners")) {
    const { data: ps } = await sb.from("partners").insert([
      { project_id: projectId, name: "City Public Library", kind: "government", status: "active", contact_name: "Ms. Lan", contact_email: "library@example.org",
        gives: "Room B every Saturday + projector", gets: "Free coding classes for library members; logo on our posts", agreement_start: date(-60), agreement_end: date(120), owner_member_id: pick(1),
        log: [{ t: Date.now() - 12 * 864e5, by: "Maya Chen", text: "Hosted Coding Workshop #2", event: "Coding Workshop #2" }, { t: Date.now() - 3 * 864e5, by: "Dana Founder", text: "Confirmed room for Workshop #3" }] },
      { project_id: projectId, name: "Hoa Khanh Middle School", kind: "school", status: "active", contact_name: "Mr. Tuan (IT teacher)", gives: "Recruits students, lends 10 laptops", gets: "Weekly lessons for Grade 6",
        agreement_start: date(-45), agreement_end: date(25), owner_member_id: pick(2), log: [{ t: Date.now() - 20 * 864e5, by: "Jordan Okafor", text: "Kick-off meeting with the principal" }] },
      { project_id: projectId, name: "Joe's Pizza", kind: "business", status: "prospect", contact_name: "Joe", gives: "Pizza for volunteers?", gets: "Shout-out on Instagram", log: [] },
    ]).select();
    const [lib, school] = (ps as { id: string }[]) || [];
    await sb.from("beneficiaries").insert([
      { project_id: projectId, name: "Grade 6 coding class", kind: "group", people_count: 18, location: "Hoa Khanh Middle School", partner_id: school?.id, contact_name: "Mr. Tuan",
        needs: "Weekly 1h Scratch lesson, loaner laptops", consent: true, last_contact: date(-6), next_contact: date(1),
        feedback: [{ t: Date.now() - 6 * 864e5, by: "Maya Chen", text: "Kids loved making their own games — want more art/sound tools.", rating: 5 }] },
      { project_id: projectId, name: "Saturday library learners", kind: "community", people_count: 12, location: "City Public Library", partner_id: lib?.id,
        needs: "Beginner-friendly sessions, printed handouts", consent: true, last_contact: date(-10), next_contact: date(-1),
        feedback: [{ t: Date.now() - 10 * 864e5, by: "Ethan Park", text: "Parents asked for a take-home practice sheet.", rating: 4 }] },
    ]);
  }
}
