-- Patch 002: Sponsor Finder module + public Project Portal (discover & join requests).
-- Safe to run multiple times.

-- ---------- project listing fields (portal) + sponsor brief ----------
alter table projects add column if not exists is_listed boolean not null default false;
alter table projects add column if not exists location text;
alter table projects add column if not exists skills text[] not null default '{}';
alter table projects add column if not exists looking_for text;
-- [{ "k": "member"|"contributor"|"volunteer"|"donor"|"partner", "on": true, "slots": 0 }]  (slots 0 = unlimited)
alter table projects add column if not exists open_roles jsonb not null default
  '[{"k":"member","on":true,"slots":0},{"k":"contributor","on":true,"slots":0},{"k":"volunteer","on":true,"slots":0},{"k":"donor","on":true,"slots":0},{"k":"partner","on":true,"slots":0}]'::jsonb;
-- { org_type, beneficiaries, budget, needs: [], achievements, timeline, region }
alter table projects add column if not exists sponsor_brief jsonb not null default '{}'::jsonb;

alter table project_members add column if not exists portal_role text;  -- which portal role they joined through

-- ---------- join requests ----------
create table if not exists join_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',          -- member | contributor | volunteer | donor | partner
  message text,
  status text not null default 'pending',       -- pending | accepted | declined | withdrawn
  created_at timestamptz default now(),
  decided_at timestamptz
);
create unique index if not exists join_requests_one_pending on join_requests (project_id, user_id) where status = 'pending';
alter table join_requests enable row level security;

drop policy if exists "jr read" on join_requests;
drop policy if exists "jr insert" on join_requests;
drop policy if exists "jr withdraw" on join_requests;
create policy "jr read" on join_requests for select to authenticated using (user_id = auth.uid() or can_manage_hr(project_id));
create policy "jr insert" on join_requests for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
create policy "jr withdraw" on join_requests for update to authenticated using (user_id = auth.uid()) with check (status = 'withdrawn');

-- Safe public listing (never exposes join_code / webhook_secret). Callable without login.
create or replace function discover_projects() returns table (
  id uuid, name text, tagline text, description text, cause text, emoji text, color text,
  location text, skills text[], looking_for text, open_roles jsonb, modules jsonb,
  member_count bigint, role_counts jsonb, created_at timestamptz
) language sql security definer stable set search_path = public as $$
  select p.id, p.name, p.tagline, p.description, p.cause, p.emoji, p.color, p.location, p.skills, p.looking_for,
         p.open_roles, p.modules,
         (select count(*) from project_members m where m.project_id = p.id and m.status = 'active'),
         coalesce((select jsonb_object_agg(r.role, r.n) from (
            select coalesce(m.portal_role, 'member') as role, count(*) as n from project_members m
            where m.project_id = p.id and m.status = 'active' group by 1) r), '{}'::jsonb),
         p.created_at
  from projects p where p.is_listed order by p.created_at desc;
$$;


-- Leaders accept/decline. Accepting adds them to the roster.
create or replace function decide_join_request(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r join_requests; prof profiles; label text;
begin
  select * into r from join_requests where id = p_id;
  if r.id is null then raise exception 'Request not found'; end if;
  if not can_manage_hr(r.project_id) then raise exception 'Only the president, VP or Head of HR can review requests'; end if;
  update join_requests set status = case when p_accept then 'accepted' else 'declined' end, decided_at = now() where id = p_id;
  if p_accept then
    perform set_config('app.bypass_guard', 'on', true);
    select * into prof from profiles where id = r.user_id;
    label := case r.role when 'contributor' then 'Contributor' when 'volunteer' then 'Volunteer'
                         when 'donor' then 'Donor' when 'partner' then 'Mentor / Partner' else null end;
    insert into project_members (project_id, user_id, full_name, email, school, grade, role, title, portal_role, notes)
    values (r.project_id, r.user_id, coalesce(prof.full_name, 'Member'), prof.email, prof.school, prof.grade, 'member', label, r.role, r.message)
    on conflict (project_id, user_id) do update set status = 'active', title = excluded.title, portal_role = excluded.portal_role;
    perform set_config('app.bypass_guard', 'off', true);
  end if;
end $$;

-- ---------- sponsor pipeline ----------
create table if not exists sponsor_leads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  type text,                   -- foundation | corporate | government | multilateral | ngo | competition | local_business | other
  country text,
  focus text,
  fit text,                    -- why it fits (AI or manual)
  approach text,               -- how to approach
  typical_amount text,
  cycle text,
  website text,
  fit_score int default 0,
  confidence text,             -- high | medium | low
  source text default 'manual',-- manual | ai
  stage text not null default 'idea',  -- idea | research | contacted | talking | won | declined
  assignee_member_id uuid references project_members(id) on delete set null,
  contact_name text,
  contact_email text,
  amount_asked numeric,
  amount_committed numeric,
  deadline date,
  next_step text,
  draft text,
  log jsonb not null default '[]'::jsonb,  -- [{ t, by, text }]
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table sponsor_leads enable row level security;
drop policy if exists "sponsor_leads member all" on sponsor_leads;
create policy "sponsor_leads member all" on sponsor_leads for all to authenticated
  using (is_member(project_id)) with check (is_member(project_id));

grant execute on function discover_projects to anon, authenticated;
grant execute on function decide_join_request to authenticated;
