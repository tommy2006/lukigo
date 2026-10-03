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

-- join_project must be allowed to claim/activate the caller's own row
create or replace function join_project(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid; prof profiles;
begin
  select id into pid from projects where join_code = upper(trim(p_code));
  if pid is null then raise exception 'No project with that code'; end if;
  perform set_config('app.bypass_guard', 'on', true);
  select * into prof from profiles where id = auth.uid();
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
