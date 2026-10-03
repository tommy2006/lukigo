-- Patch 003: (1) keep a person's contact details in sync everywhere,
-- (2) Volunteer Shifts module, (3) Partners module + Beneficiary management.
-- Safe to run multiple times.

-- =====================================================================
-- 1. Contact-detail sync: profile <-> every roster row of the same user
-- =====================================================================
create or replace function sync_member_contact() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 or new.user_id is null then return new; end if;
  if (new.full_name, new.email, new.phone, new.school, new.grade)
     is not distinct from (old.full_name, old.email, old.phone, old.school, old.grade) then return new; end if;
  update profiles set full_name = new.full_name, email = coalesce(new.email, email), school = new.school, grade = new.grade
    where id = new.user_id;
  update project_members set full_name = new.full_name, email = new.email, phone = new.phone, school = new.school, grade = new.grade
    where user_id = new.user_id and id <> new.id;
  return new;
end $$;
drop trigger if exists sync_member_contact on project_members;
create trigger sync_member_contact after update on project_members
  for each row execute function sync_member_contact();

create or replace function sync_profile_contact() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  update project_members set full_name = coalesce(new.full_name, full_name), school = new.school, grade = new.grade
    where user_id = new.id;
  return new;
end $$;
drop trigger if exists sync_profile_contact on profiles;
create trigger sync_profile_contact after update on profiles
  for each row execute function sync_profile_contact();

-- =====================================================================
-- 2. Volunteer Shifts
-- =====================================================================
alter table project_members add column if not exists availability jsonb not null default '{}'::jsonb; -- {"mon":["am","pm"],...}

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  event_id uuid references events(id) on delete set null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  slots int not null default 3,
  lead_member_id uuid references project_members(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists shift_signups (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references shifts(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  member_id uuid not null references project_members(id) on delete cascade,
  status text not null default 'signed_up',   -- signed_up | checked_in | completed | no_show
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  hours numeric,
  created_at timestamptz default now(),
  unique (shift_id, member_id)
);

alter table shifts enable row level security;
alter table shift_signups enable row level security;
drop policy if exists "shifts member all" on shifts;
create policy "shifts member all" on shifts for all to authenticated using (is_member(project_id)) with check (is_member(project_id));
drop policy if exists "signups member all" on shift_signups;
create policy "signups member all" on shift_signups for all to authenticated using (is_member(project_id)) with check (is_member(project_id));

-- Leaders mark a signup completed; hours are added to the member's service-hour total exactly once.
create or replace function complete_shift_signup(p_signup uuid, p_hours numeric) returns void
language plpgsql security definer set search_path = public as $$
declare s shift_signups; prev numeric;
begin
  select * into s from shift_signups where id = p_signup;
  if s.id is null then raise exception 'Signup not found'; end if;
  if coalesce(member_role(s.project_id), '') not in ('president','vice_president','secretary','head','treasurer') then
    raise exception 'Only project leaders can confirm hours';
  end if;
  prev := case when s.status = 'completed' then coalesce(s.hours, 0) else 0 end;
  update shift_signups set status = 'completed', hours = p_hours, checked_out_at = coalesce(checked_out_at, now()) where id = p_signup;
  update project_members set hours = greatest(0, coalesce(hours, 0) - prev + p_hours) where id = s.member_id;
end $$;
grant execute on function complete_shift_signup to authenticated;

-- =====================================================================
-- 3. Partners + Beneficiaries
-- =====================================================================
create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  kind text default 'ngo',            -- school | ngo | business | government | community | media | other
  status text default 'prospect',     -- prospect | active | paused | ended
  contact_name text, contact_email text, contact_phone text, website text,
  gives text,                         -- what they provide us
  gets text,                          -- what we provide them
  agreement_start date, agreement_end date,
  owner_member_id uuid references project_members(id) on delete set null,
  notes text,
  log jsonb not null default '[]'::jsonb,   -- [{t, by, text, event}]
  created_at timestamptz default now()
);

create table if not exists beneficiaries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,                 -- person, class, family group, shelter...
  kind text default 'group',          -- individual | group | organization | community
  people_count int default 1,
  location text,
  contact_name text, contact_info text,
  partner_id uuid references partners(id) on delete set null,   -- e.g. reached via a school / NGO
  needs text,
  consent boolean not null default false,   -- consent to store details / take photos
  status text default 'active',       -- active | paused | completed
  last_contact date, next_contact date,
  notes text,
  feedback jsonb not null default '[]'::jsonb, -- [{t, by, text, rating}]
  created_at timestamptz default now()
);

alter table partners enable row level security;
alter table beneficiaries enable row level security;
drop policy if exists "partners member all" on partners;
create policy "partners member all" on partners for all to authenticated using (is_member(project_id)) with check (is_member(project_id));
drop policy if exists "beneficiaries member all" on beneficiaries;
create policy "beneficiaries member all" on beneficiaries for all to authenticated using (is_member(project_id)) with check (is_member(project_id));
