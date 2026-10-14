-- CampusConnect: per-event permissions, co-organisers and organiser profiles.
--
-- Until now every organiser could manage every event. From here on an
-- organiser manages an event when they created it, were added as one of its
-- organisers, or the event has no owner (sample / seeded events).
-- Non-destructive and safe to re-run; existing organisers keep access to every
-- event that exists when this migration runs.

-- ---------------------------------------------------------------------------
-- 1. Event organisers (who may manage which event)
-- ---------------------------------------------------------------------------
create table if not exists public.event_organisers (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists event_organisers_user_idx on public.event_organisers(user_id);
alter table public.event_organisers enable row level security;
revoke all on public.event_organisers from anon, authenticated;
grant select on public.event_organisers to authenticated;
grant all on public.event_organisers to service_role;
drop policy if exists "own event roles read" on public.event_organisers;
create policy "own event roles read" on public.event_organisers for select to authenticated
  using (user_id = auth.uid());

-- Preserve current access: creators, plus every current organiser on every owned event.
insert into public.event_organisers (event_id, user_id)
  select e.id, e.created_by from public.events e join auth.users u on u.id = e.created_by
  on conflict do nothing;
insert into public.event_organisers (event_id, user_id)
  select e.id, ur.user_id from public.events e cross join public.user_roles ur
  where ur.role = 'organiser' and e.created_by is not null
  on conflict do nothing;

-- An event with no owner (seeded/sample events) or whose organisers have all
-- lost organiser access is manageable by any organiser, so nothing is orphaned.
create or replace function public.can_manage_event(_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.has_role(auth.uid(), 'organiser'), false) and exists (
    select 1 from public.events e
    where e.id = _event_id
      and (e.created_by = auth.uid()
           or exists (select 1 from public.event_organisers eo where eo.event_id = e.id and eo.user_id = auth.uid())
           or not exists (select 1 from public.event_organisers eo
                          join public.user_roles ur on ur.user_id = eo.user_id and ur.role = 'organiser'
                          where eo.event_id = e.id)))
$$;
grant execute on function public.can_manage_event(uuid) to anon, authenticated;

create or replace function public.my_managed_event_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select e.id from public.events e where public.can_manage_event(e.id)
$$;
revoke all on function public.my_managed_event_ids() from public, anon;
grant execute on function public.my_managed_event_ids() to authenticated;

-- The creator of a new event becomes its first organiser.
create or replace function public.events_add_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into public.event_organisers (event_id, user_id, added_by)
      values (new.id, new.created_by, new.created_by) on conflict do nothing;
  end if;
  return null;
end $$;
drop trigger if exists events_add_owner on public.events;
create trigger events_add_owner after insert on public.events
  for each row execute function public.events_add_owner();

-- ---------------------------------------------------------------------------
-- 2. Policies now check the specific event, not just the organiser role
-- ---------------------------------------------------------------------------
drop policy if exists "organisers update" on public.events;
create policy "organisers update" on public.events for update to authenticated
  using (public.can_manage_event(id));
drop policy if exists "organisers delete" on public.events;
create policy "organisers delete" on public.events for delete to authenticated
  using (public.can_manage_event(id));
-- ("organisers insert" is unchanged: any organiser may create events.)

drop policy if exists "organisers read regs" on public.registrations;
create policy "organisers read regs" on public.registrations for select to authenticated
  using (public.can_manage_event(event_id));
drop policy if exists "organisers update regs" on public.registrations;
create policy "organisers update regs" on public.registrations for update to authenticated
  using (public.can_manage_event(event_id));

-- ---------------------------------------------------------------------------
-- 3. Managing an event's organisers
-- ---------------------------------------------------------------------------
create or replace function public.list_event_staff(_event_id uuid)
returns table (user_id uuid, email text, full_name text, is_creator boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_manage_event(_event_id) then raise exception 'FORBIDDEN'; end if;
  return query
    select eo.user_id, u.email::text, p.full_name, eo.user_id = e.created_by
    from public.event_organisers eo
    join public.events e on e.id = eo.event_id
    join auth.users u on u.id = eo.user_id
    left join public.profiles p on p.id = eo.user_id
    where eo.event_id = _event_id
    order by (eo.user_id = e.created_by) desc, u.email;
end $$;
revoke all on function public.list_event_staff(uuid) from public, anon;
grant execute on function public.list_event_staff(uuid) to authenticated;

create or replace function public.add_event_staff(_event_id uuid, _email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare u record;
begin
  if not public.can_manage_event(_event_id) then raise exception 'FORBIDDEN'; end if;
  select id, email_confirmed_at into u from auth.users where lower(email) = lower(btrim(coalesce(_email, '')));
  if u.id is null then raise exception 'USER_NOT_FOUND'; end if;
  if u.email_confirmed_at is null then raise exception 'EMAIL_NOT_CONFIRMED'; end if;
  if not public.has_role(u.id, 'organiser') then raise exception 'NOT_ORGANISER'; end if;
  insert into public.event_organisers (event_id, user_id, added_by) values (_event_id, u.id, auth.uid())
    on conflict do nothing;
  return u.id;
end $$;
revoke all on function public.add_event_staff(uuid, text) from public, anon;
grant execute on function public.add_event_staff(uuid, text) to authenticated;

create or replace function public.remove_event_staff(_event_id uuid, _user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_event(_event_id) then raise exception 'FORBIDDEN'; end if;
  if exists (select 1 from public.events where id = _event_id and created_by = _user_id) then
    raise exception 'CANNOT_REMOVE_CREATOR';
  end if;
  delete from public.event_organisers where event_id = _event_id and user_id = _user_id;
end $$;
revoke all on function public.remove_event_staff(uuid, uuid) from public, anon;
grant execute on function public.remove_event_staff(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Verification and check-in respect per-event permissions
-- ---------------------------------------------------------------------------
drop function if exists public.verify_pass(text);
create function public.verify_pass(_token text)
returns table (result text, is_staff boolean, is_organiser boolean, registration_code text, student_name text,
  department text, event_title text, event_date date, start_time time, end_time time, venue text,
  checked_in_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare rec record; organiser boolean := coalesce(public.has_role(auth.uid(), 'organiser'), false);
  staff boolean := false; res text; matched boolean := false;
begin
  if _token is not null and char_length(_token) between 32 and 128 then
    select r.code, r.student_name, r.department, r.status, r.checked_in_at, r.event_id,
           e.title, e.event_date, e.start_time, e.end_time, e.venue, e.status as est
      into rec
      from public.registrations r join public.events e on e.id = r.event_id
      where r.token_hash = public.pass_token_hash(_token);
    matched := found;
  end if;
  if not matched then
    return query select 'invalid'::text, false, organiser, null::text, null::text, null::text, null::text,
      null::date, null::time, null::time, null::text, null::timestamptz;
    return;
  end if;
  staff := public.can_manage_event(rec.event_id);
  res := case when rec.est = 'cancelled' then 'event_cancelled'
              when rec.status <> 'confirmed' then 'registration_cancelled'
              when rec.checked_in_at is not null then 'checked_in'
              when rec.est = 'completed' then 'event_completed'
              else 'valid' end;
  return query select res, staff, organiser,
    case when staff then rec.code end,
    case when staff then rec.student_name else public.mask_name(rec.student_name) end,
    case when staff then rec.department end,
    rec.title, rec.event_date, rec.start_time, rec.end_time, rec.venue, rec.checked_in_at;
end $$;
grant execute on function public.verify_pass(text) to anon, authenticated;

create or replace function public.check_in_pass(_token text)
returns table (result text, checked_in_at timestamptz, student_name text, registration_code text)
language plpgsql volatile security definer set search_path = public as $$
declare h text; rec record; ev uuid;
begin
  if not coalesce(public.has_role(auth.uid(), 'organiser'), false) then raise exception 'FORBIDDEN'; end if;
  if _token is null or char_length(_token) not between 32 and 128 then
    return query select 'invalid'::text, null::timestamptz, null::text, null::text; return;
  end if;
  h := public.pass_token_hash(_token);
  select r.event_id into ev from public.registrations r where r.token_hash = h;
  if ev is null then
    return query select 'invalid'::text, null::timestamptz, null::text, null::text; return;
  end if;
  if not public.can_manage_event(ev) then
    return query select 'forbidden'::text, null::timestamptz, null::text, null::text; return;
  end if;
  -- Conditional UPDATE: two simultaneous scans of one pass can only succeed once.
  update public.registrations r set checked_in_at = now(), checked_in_by = auth.uid()
    from public.events e
    where e.id = r.event_id and r.token_hash = h and r.status = 'confirmed'
      and r.checked_in_at is null and e.status = 'published'
    returning r.checked_in_at as ts, r.student_name as sn, r.code as rc into rec;
  if found then
    return query select 'checked_in'::text, rec.ts, rec.sn, rec.rc; return;
  end if;
  select r.status, r.checked_in_at as ts, r.student_name as sn, r.code as rc, e.status as est into rec
    from public.registrations r join public.events e on e.id = r.event_id where r.token_hash = h;
  return query select
    case when rec.ts is not null then 'already_checked_in'
         when rec.est = 'cancelled' then 'event_cancelled'
         when rec.status <> 'confirmed' then 'registration_cancelled'
         when rec.est = 'completed' then 'event_completed'
         else 'invalid' end,
    rec.ts, rec.sn, rec.rc;
end $$;
revoke all on function public.check_in_pass(text) from public, anon;
grant execute on function public.check_in_pass(text) to authenticated;

-- Dashboard aggregates: only events the caller manages.
create or replace function public.registration_department_breakdown()
returns table (department text, registrations bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'organiser') then raise exception 'FORBIDDEN'; end if;
  return query select r.department, count(*) from public.registrations r
    where r.status = 'confirmed' and r.event_id in (select public.my_managed_event_ids())
    group by r.department order by 2 desc, 1;
end $$;

create or replace function public.event_attendance_counts()
returns table (event_id uuid, checked_in bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'organiser') then raise exception 'FORBIDDEN'; end if;
  return query select r.event_id, count(*) from public.registrations r
    where r.checked_in_at is not null and r.event_id in (select public.my_managed_event_ids())
    group by r.event_id;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Organiser profile
-- ---------------------------------------------------------------------------
-- Profiles change only through update_my_profile(), which always uses the
-- signed-in user's id; the row id can never be chosen by the browser.
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;

create or replace function public.update_my_profile(_full_name text)
returns text language plpgsql security definer set search_path = public as $$
declare n text := btrim(regexp_replace(coalesce(_full_name, ''), '\s+', ' ', 'g'));
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  if char_length(n) not between 2 and 100 then raise exception 'INVALID_NAME'; end if;
  insert into public.profiles (id, full_name) values (auth.uid(), n)
    on conflict (id) do update set full_name = excluded.full_name;
  return n;
end $$;
revoke all on function public.update_my_profile(text) from public, anon;
grant execute on function public.update_my_profile(text) to authenticated;

create or replace function public.my_organiser_stats()
returns table (events_created bigint, events_managed bigint, upcoming bigint, past_unclosed bigint,
  completed bigint, cancelled bigint, registrations bigint, checked_in bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'organiser') then raise exception 'FORBIDDEN'; end if;
  return query
    with m as (select e.* from public.events e where e.id in (select public.my_managed_event_ids()))
    select
      (select count(*) from public.events e where e.created_by = auth.uid()),
      (select count(*) from m),
      (select count(*) from m where m.status = 'published'
         and ((m.event_date + m.start_time) at time zone 'Asia/Kolkata') >= now()),
      (select count(*) from m where m.status = 'published'
         and ((m.event_date + m.start_time) at time zone 'Asia/Kolkata') < now()),
      (select count(*) from m where m.status = 'completed'),
      (select count(*) from m where m.status = 'cancelled'),
      (select coalesce(sum(m.confirmed_count), 0)::bigint from m),
      (select count(*) from public.registrations r
         where r.checked_in_at is not null and r.event_id in (select m.id from m));
end $$;
revoke all on function public.my_organiser_stats() from public, anon;
grant execute on function public.my_organiser_stats() to authenticated;
