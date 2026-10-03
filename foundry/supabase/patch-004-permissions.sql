-- Patch 004: role permissions enforced in the database.
-- (1) Regular members can't read or write money data (fundraising, finance, sponsors).
-- (2) Task assignment follows rank: self always; leaders (head+) to equal or lower rank; members only to themselves.
-- Safe to run multiple times.

create or replace function role_rank(r text) returns int language sql immutable as $$
  select case r when 'president' then 100 when 'vice_president' then 80 when 'secretary' then 60
                when 'treasurer' then 60 when 'head' then 50 else 10 end;
$$;

-- active member who is NOT a plain 'member'
create or replace function is_leader(p uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from project_members where project_id = p and user_id = auth.uid()
                 and status = 'active' and role <> 'member');
$$;
grant execute on function is_leader, role_rank to authenticated;

-- ---------- (1) money tables: leaders only ----------
do $$
declare t text;
begin
  foreach t in array array['fundraisers','donations','transactions','merch_items','merch_sales','sponsor_leads'] loop
    execute format('drop policy if exists "%1$s member all" on %1$s;', t);
    execute format('drop policy if exists "%1$s leaders all" on %1$s;', t);
    execute format('create policy "%1$s leaders all" on %1$s for all to authenticated using (is_leader(project_id)) with check (is_leader(project_id));', t);
  end loop;
end $$;

-- ---------- (2) task assignment guard ----------
create or replace function guard_task_assignment() returns trigger
language plpgsql security definer set search_path = public as $$
declare me project_members; tgt project_members; prev project_members;
begin
  if auth.uid() is null then return new; end if;   -- service / SQL editor
  if tg_op = 'UPDATE' and new.assignee_member_id is not distinct from old.assignee_member_id then return new; end if;

  select * into me from project_members where project_id = new.project_id and user_id = auth.uid() and status = 'active';
  if me.id is null then raise exception 'Not a member of this project'; end if;

  -- may I take the task away from its current owner?
  if tg_op = 'UPDATE' and old.assignee_member_id is not null and old.assignee_member_id <> me.id then
    select * into prev from project_members where id = old.assignee_member_id;
    if prev.id is not null and not (role_rank(me.role) >= 50 and role_rank(me.role) >= role_rank(prev.role)) then
      raise exception 'You can''t reassign a task that belongs to %', prev.full_name;
    end if;
  end if;

  -- may I give it to the new person?
  if new.assignee_member_id is not null and new.assignee_member_id <> me.id then
    select * into tgt from project_members where id = new.assignee_member_id;
    if tgt.id is null or tgt.project_id <> new.project_id then raise exception 'Assignee is not in this project'; end if;
    if not (role_rank(me.role) >= 50 and role_rank(me.role) >= role_rank(tgt.role)) then
      raise exception 'You can only assign tasks to yourself%',
        case when role_rank(me.role) >= 50 then ' or people at or below your level' else '' end;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_task_assignment on tasks;
create trigger guard_task_assignment before insert or update on tasks
  for each row execute function guard_task_assignment();
