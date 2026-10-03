-- =====================================================================
-- Foundry — Supabase schema. Paste the whole file into the SQL Editor and Run.
-- Safe to re-run (drops & recreates app tables).
-- =====================================================================

create extension if not exists pgcrypto;

drop table if exists merch_sales, merch_items, transactions, social_posts, social_accounts,
  donations, fundraisers, tasks, events, project_members, projects, profiles cascade;

-- ---------- profiles (1 per auth user) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  school text,
  grade text,
  avatar_color text default '#f59e8b',
  created_at timestamptz default now()
);

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  -- link any HR roster rows that were pre-created with this email
  update project_members set user_id = new.id where user_id is null and lower(email) = lower(new.email);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- projects ----------
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tagline text,
  description text,
  cause text,
  emoji text default '🌱',
  color text default '#f59e8b',
  join_code text unique default upper(substr(md5(random()::text), 1, 6)),
  -- builder output: { "stack": [ { "id": "hr", "submodules": ["roster", ...] }, ... ] }
  modules jsonb not null default '{"stack":[]}'::jsonb,
  webhook_secret text default encode(gen_random_bytes(12), 'hex'),
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ---------- project_members (= HR roster; user_id null until they sign up) ----------
create table project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  school text,
  grade text,
  role text not null default 'member',   -- president | vice_president | secretary | treasurer | head | member
  department text,                        -- e.g. 'Events', 'Publicity', 'Finance', 'HR'
  title text,                             -- free-text display title, e.g. 'Head of Logistics'
  status text not null default 'active',  -- active | inactive | alumni
  hours numeric default 0,
  notes text,
  joined_at timestamptz default now(),
  unique (project_id, user_id)
);

-- ---------- helper functions for RLS (security definer avoids recursion) ----------
create or replace function is_member(p uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from project_members where project_id = p and user_id = auth.uid() and status = 'active');
$$;

create or replace function member_role(p uuid) returns text
language sql security definer stable set search_path = public as $$
  select role from project_members where project_id = p and user_id = auth.uid() limit 1;
$$;

create or replace function can_manage_hr(p uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from project_members where project_id = p and user_id = auth.uid()
    and (role in ('president','vice_president') or (role = 'head' and department = 'HR')));
$$;

-- create project + make caller president, atomically
create or replace function create_project(p_name text, p_tagline text, p_description text, p_cause text,
  p_emoji text, p_color text, p_modules jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid; prof profiles;
begin
  insert into projects (name, tagline, description, cause, emoji, color, modules, created_by)
  values (p_name, p_tagline, p_description, p_cause, coalesce(p_emoji,'🌱'), coalesce(p_color,'#f59e8b'), coalesce(p_modules,'{"stack":[]}'::jsonb), auth.uid())
  returning id into pid;
  select * into prof from profiles where id = auth.uid();
  insert into project_members (project_id, user_id, full_name, email, school, grade, role, title, department)
  values (pid, auth.uid(), coalesce(prof.full_name,'Founder'), prof.email, prof.school, prof.grade, 'president', 'Founder & President', 'Leadership');
  return pid;
end $$;

-- join by code
create or replace function join_project(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid; prof profiles;
begin
  select id into pid from projects where join_code = upper(trim(p_code));
  if pid is null then raise exception 'No project with that code'; end if;
  perform set_config('app.bypass_guard', 'on', true);
  select * into prof from profiles where id = auth.uid();
  -- claim a pre-created roster row by email, else insert
  update project_members set user_id = auth.uid(), status = 'active'
    where project_id = pid and user_id is null and lower(email) = lower(prof.email);
  if not found then
    insert into project_members (project_id, user_id, full_name, email, school, grade, role)
    values (pid, auth.uid(), coalesce(prof.full_name,'Member'), prof.email, prof.school, prof.grade, 'member')
    on conflict (project_id, user_id) do update set status = 'active';
  end if;
  perform set_config('app.bypass_guard', 'off', true);
  return pid;
end $$;

-- ---------- events & tasks ----------
create table events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  type text default 'other',          -- fundraiser | teaching | outreach | meeting | drive | other
  description text,
  starts_at timestamptz,
  location text,
  status text default 'planning',     -- idea | planning | ready | live | done | cancelled
  budget numeric default 0,
  lead_member_id uuid references project_members(id) on delete set null,
  created_at timestamptz default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  title text not null,
  description text,
  category text default 'general',    -- venue | content | logistics | marketing | supplies | volunteers | general
  status text default 'todo',         -- todo | in_progress | blocked | done
  priority text default 'medium',     -- low | medium | high
  assignee_member_id uuid references project_members(id) on delete set null,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- ---------- fundraising ----------
create table fundraisers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  event_id uuid references events(id) on delete set null,
  name text not null,
  goal numeric default 0,
  platform text default 'manual',     -- manual | gofundme | givebutter | stripe | paypal | zeffy
  platform_url text,
  starts_on date,
  ends_on date,
  status text default 'active',       -- draft | active | closed
  created_at timestamptz default now()
);

create table donations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  fundraiser_id uuid references fundraisers(id) on delete set null,
  donor_name text default 'Anonymous',
  amount numeric not null,
  message text,
  source text default 'manual',
  created_at timestamptz default now()
);

-- public webhook entry point (called by /api/webhooks/donations with the project's secret)
create or replace function record_donation(p_project uuid, p_secret text, p_fundraiser uuid,
  p_donor text, p_amount numeric, p_message text, p_source text) returns uuid
language plpgsql security definer set search_path = public as $$
declare did uuid;
begin
  if not exists (select 1 from projects where id = p_project and webhook_secret = p_secret) then
    raise exception 'bad secret';
  end if;
  insert into donations (project_id, fundraiser_id, donor_name, amount, message, source)
  values (p_project, p_fundraiser, coalesce(p_donor,'Anonymous'), p_amount, p_message, coalesce(p_source,'webhook'))
  returning id into did;
  -- Fundraising -> Finance link: auto-log income when the Finance module is attached
  if exists (select 1 from projects, jsonb_array_elements(modules->'stack') s
             where id = p_project and s->>'id' = 'finance') then
    insert into transactions (project_id, kind, category, amount, description, fundraiser_id)
    values (p_project, 'income', 'donation', p_amount, 'Donation — ' || coalesce(p_donor,'Anonymous'), p_fundraiser);
  end if;
  return did;
end $$;

-- ---------- publicity ----------
create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  platform text not null,             -- instagram | tiktok | facebook | x | linkedin | youtube
  handle text not null,
  followers int default 0,
  created_at timestamptz default now()
);

create table social_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  account_id uuid references social_accounts(id) on delete set null,
  event_id uuid references events(id) on delete set null,
  platform text,
  content text not null,
  url text,
  status text default 'posted',       -- idea | scheduled | posted
  posted_at timestamptz default now(),
  likes int default 0,
  comments int default 0,
  shares int default 0,
  created_at timestamptz default now()
);

-- ---------- finance & merch ----------
create table transactions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  kind text not null,                 -- income | expense
  category text default 'other',      -- donation | merch | sponsorship | venue | supplies | marketing | food | transport | other
  amount numeric not null,
  description text,
  occurred_on date default current_date,
  event_id uuid references events(id) on delete set null,
  fundraiser_id uuid references fundraisers(id) on delete set null,
  recorded_by uuid references project_members(id) on delete set null,
  created_at timestamptz default now()
);

create table merch_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  price numeric default 0,
  unit_cost numeric default 0,
  stock int default 0,
  emoji text default '👕',
  created_at timestamptz default now()
);

create table merch_sales (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  item_id uuid references merch_items(id) on delete set null,
  quantity int not null default 1,
  unit_price numeric not null,
  buyer text,
  sold_on date default current_date,
  created_at timestamptz default now()
);

-- ---------- RLS ----------
alter table profiles enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table events enable row level security;
alter table tasks enable row level security;
alter table fundraisers enable row level security;
alter table donations enable row level security;
alter table social_accounts enable row level security;
alter table social_posts enable row level security;
alter table transactions enable row level security;
alter table merch_items enable row level security;
alter table merch_sales enable row level security;

create policy "profiles read" on profiles for select to authenticated using (true);
create policy "profiles self write" on profiles for update to authenticated using (id = auth.uid());
create policy "profiles self insert" on profiles for insert to authenticated with check (id = auth.uid());

create policy "projects read" on projects for select to authenticated using (is_member(id));
create policy "projects update" on projects for update to authenticated
  using (member_role(id) in ('president','vice_president'));
create policy "projects delete" on projects for delete to authenticated using (member_role(id) = 'president');

create policy "members read" on project_members for select to authenticated using (is_member(project_id));
create policy "members insert" on project_members for insert to authenticated with check (can_manage_hr(project_id));
create policy "members update" on project_members for update to authenticated
  using (can_manage_hr(project_id) or user_id = auth.uid());
create policy "members delete" on project_members for delete to authenticated using (can_manage_hr(project_id));

-- generic: any active member can read/write module data (fine-grained checks happen in the app via lib/roles.ts)
do $$
declare t text;
begin
  foreach t in array array['events','tasks','fundraisers','donations','social_accounts','social_posts','transactions','merch_items','merch_sales'] loop
    execute format('create policy "%1$s member all" on %1$s for all to authenticated using (is_member(project_id)) with check (is_member(project_id));', t);
  end loop;
end $$;

-- ---------- Realtime (live donation feed etc.) ----------
do $$ begin
  begin alter publication supabase_realtime add table donations; exception when others then null; end;
  begin alter publication supabase_realtime add table tasks; exception when others then null; end;
  begin alter publication supabase_realtime add table transactions; exception when others then null; end;
end $$;

grant execute on function create_project, join_project, record_donation, is_member, member_role, can_manage_hr to anon, authenticated;

-- Patch 001: stop members from changing their own role/department/title/status.
-- Members may still edit their own contact fields. Safe to run multiple times.
create or replace function guard_member_privileges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and coalesce(current_setting('app.bypass_guard', true), '') <> 'on'
     and not can_manage_hr(new.project_id) then
    if new.role is distinct from old.role
       or new.department is distinct from old.department
       or new.title is distinct from old.title
       or new.status is distinct from old.status
       or new.user_id is distinct from old.user_id
       or new.project_id is distinct from old.project_id then
      raise exception 'Only the president, VP or Head of HR can change roles or status';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_member_privileges on project_members;
create trigger guard_member_privileges before update on project_members
  for each row execute function guard_member_privileges();
