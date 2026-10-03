-- Patch 005: (1) member-created events are requests until approved,
-- (2) only the president can rename (or delete) a project. Safe to run multiple times.

-- ---------- (1) event approval ----------
alter table events add column if not exists approval text not null default 'approved';  -- pending | approved | declined
alter table events add column if not exists requested_by uuid references project_members(id) on delete set null;
alter table events add column if not exists decided_by uuid references project_members(id) on delete set null;
alter table events add column if not exists decision_note text;

-- President, VP, and Head of Events approve event requests.
create or replace function can_approve_events(p uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from project_members where project_id = p and user_id = auth.uid() and status = 'active'
    and (role in ('president','vice_president') or (role = 'head' and department = 'Events')));
$$;

create or replace function my_member_id(p uuid) returns uuid
language sql security definer stable set search_path = public as $$
  select id from project_members where project_id = p and user_id = auth.uid() limit 1;
$$;
grant execute on function can_approve_events, my_member_id to authenticated;

create or replace function guard_event_approval() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    if can_approve_events(new.project_id) then
      new.approval := 'approved';
    else
      new.approval := 'pending';
      new.requested_by := my_member_id(new.project_id);
    end if;
    return new;
  end if;
  if new.approval is distinct from old.approval then
    if not can_approve_events(new.project_id) then
      raise exception 'Only the president, VP or Head of Events can approve events';
    end if;
    new.decided_by := my_member_id(new.project_id);
  end if;
  return new;
end $$;
drop trigger if exists guard_event_approval on events;
create trigger guard_event_approval before insert or update on events
  for each row execute function guard_event_approval();

-- Approved events: everyone in the project. Pending/declined: only the requester and approvers.
drop policy if exists "events member all" on events;
drop policy if exists "events read" on events;
drop policy if exists "events insert" on events;
drop policy if exists "events update" on events;
drop policy if exists "events delete" on events;
create policy "events read" on events for select to authenticated using (
  is_member(project_id) and (approval = 'approved' or can_approve_events(project_id) or requested_by = my_member_id(project_id)));
create policy "events insert" on events for insert to authenticated with check (is_member(project_id));
create policy "events update" on events for update to authenticated using (
  is_member(project_id) and (approval = 'approved' or can_approve_events(project_id) or requested_by = my_member_id(project_id)));
create policy "events delete" on events for delete to authenticated using (
  is_member(project_id) and (can_approve_events(project_id) or (approval <> 'approved' and requested_by = my_member_id(project_id))));

-- ---------- (2) project identity is the president's ----------
create or replace function guard_project_identity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if (new.name, new.tagline, new.emoji) is distinct from (old.name, old.tagline, old.emoji)
     and coalesce(member_role(new.id), '') <> 'president' then
    raise exception 'Only the president can rename the project';
  end if;
  return new;
end $$;
drop trigger if exists guard_project_identity on projects;
create trigger guard_project_identity before update on projects
  for each row execute function guard_project_identity();
-- (delete was already president-only via the "projects delete" policy)
