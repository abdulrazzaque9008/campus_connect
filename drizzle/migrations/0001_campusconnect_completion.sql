-- CampusConnect: organiser bootstrap hardening, event edit rules, hashed pass
-- tokens, attendance check-in and organiser-only reporting functions.
--
-- Non-destructive: no table, event or registration is dropped. Existing passes
-- keep working because their tokens are re-keyed to a SHA-256 hash in place.
-- Safe to re-run (create or replace / if not exists throughout).

-- ---------------------------------------------------------------------------
-- 1. Organiser bootstrap
-- ---------------------------------------------------------------------------
-- Previously the very first account to sign up became an organiser, so anyone
-- who found a fresh deployment first could take it over. New accounts now get
-- no role; organiser access is granted by an existing organiser (Team page) or,
-- for the very first one, by running bootstrap_organiser() in the SQL editor.
-- Existing organiser rows are untouched, so nobody is locked out.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end $$;

-- SQL editor / service role only: grant organiser access to an existing account.
create or replace function public.bootstrap_organiser(_email text)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(btrim(coalesce(_email, '')));
  if uid is null then
    raise exception 'USER_NOT_FOUND: create an account for % on the /auth page first', _email;
  end if;
  insert into public.user_roles (user_id, role) values (uid, 'organiser') on conflict (user_id, role) do nothing;
  return 'Organiser access granted to ' || _email;
end $$;
revoke all on function public.bootstrap_organiser(text) from public, anon, authenticated;
grant execute on function public.bootstrap_organiser(text) to service_role;

create or replace function public.grant_organiser(_email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare u record;
begin
  if not public.has_role(auth.uid(), 'organiser') then raise exception 'FORBIDDEN'; end if;
  select id, email_confirmed_at into u from auth.users where lower(email) = lower(btrim(coalesce(_email, '')));
  if u.id is null then raise exception 'USER_NOT_FOUND'; end if;
  if u.email_confirmed_at is null then raise exception 'EMAIL_NOT_CONFIRMED'; end if;
  insert into public.user_roles (user_id, role) values (u.id, 'organiser') on conflict (user_id, role) do nothing;
  return u.id;
end $$;
revoke all on function public.grant_organiser(text) from public, anon;
grant execute on function public.grant_organiser(text) to authenticated;

create or replace function public.revoke_organiser(_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'organiser') then raise exception 'FORBIDDEN'; end if;
  if _user_id = auth.uid() then raise exception 'CANNOT_REVOKE_SELF'; end if;
  delete from public.user_roles where user_id = _user_id and role = 'organiser';
end $$;
revoke all on function public.revoke_organiser(uuid) from public, anon;
grant execute on function public.revoke_organiser(uuid) to authenticated;

create or replace function public.list_organisers()
returns table (user_id uuid, email text, full_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'organiser') then raise exception 'FORBIDDEN'; end if;
  return query
    select ur.user_id, u.email::text, p.full_name
    from public.user_roles ur
    join auth.users u on u.id = ur.user_id
    left join public.profiles p on p.id = ur.user_id
    where ur.role = 'organiser'
    order by u.email;
end $$;
revoke all on function public.list_organisers() from public, anon;
grant execute on function public.list_organisers() to authenticated;

-- Roles and settings are only ever changed through the functions above / SQL editor.
revoke insert, update, delete, truncate on public.user_roles from anon, authenticated;
revoke insert, update, delete, truncate on public.app_settings from anon, authenticated;
revoke insert, update, delete, truncate on public.profiles from anon;

-- ---------------------------------------------------------------------------
-- 2. Events: extra fields and server-side edit rules
-- ---------------------------------------------------------------------------
alter table public.events add column if not exists short_description text;
alter table public.events add column if not exists contact_info text;

revoke insert, update, delete, truncate on public.events from anon;

create or replace function public.events_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  starts timestamptz;
  api boolean := auth.uid() is not null; -- false for seeds / SQL editor
  content_changed boolean;
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.confirmed_count := 0;
    new.created_by := auth.uid();
    if api then
      new.status := 'published';
      new.is_sample := false;
    end if;
    content_changed := true;
  else
    -- identity and counters are owned by the database
    new.id := old.id;
    new.confirmed_count := old.confirmed_count; -- only the counter trigger may change it
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.is_sample := old.is_sample;
    -- cancelled / completed events are final: passes already issued must stay meaningful
    if old.status <> 'published' then raise exception 'EVENT_LOCKED'; end if;
    if new.capacity < old.confirmed_count then
      raise exception 'Capacity cannot be lower than the % confirmed registrations', old.confirmed_count;
    end if;
    content_changed := row(new.title, new.club_name, new.description, new.short_description, new.contact_info,
                           new.event_date, new.start_time, new.end_time, new.venue, new.category, new.capacity,
                           new.cover_image_url, new.registration_deadline)
      is distinct from row(old.title, old.club_name, old.description, old.short_description, old.contact_info,
                           old.event_date, old.start_time, old.end_time, old.venue, old.category, old.capacity,
                           old.cover_image_url, old.registration_deadline);
  end if;

  if content_changed then
    new.title := btrim(new.title);
    new.club_name := btrim(new.club_name);
    new.description := btrim(new.description);
    new.venue := btrim(new.venue);
    new.short_description := nullif(btrim(coalesce(new.short_description, '')), '');
    new.contact_info := nullif(btrim(coalesce(new.contact_info, '')), '');
    new.cover_image_url := nullif(btrim(coalesce(new.cover_image_url, '')), '');
    if char_length(new.description) not between 10 and 5000 then raise exception 'INVALID_DESCRIPTION'; end if;
    if char_length(new.venue) not between 2 and 150 then raise exception 'INVALID_VENUE'; end if;
    if char_length(coalesce(new.short_description, '')) > 200 then raise exception 'INVALID_SHORT_DESCRIPTION'; end if;
    if char_length(coalesce(new.contact_info, '')) > 200 then raise exception 'INVALID_CONTACT'; end if;
    if new.cover_image_url is not null and (char_length(new.cover_image_url) > 1000 or new.cover_image_url !~ '^https?://\S+$') then
      raise exception 'INVALID_IMAGE_URL';
    end if;

    starts := (new.event_date + new.start_time) at time zone 'Asia/Kolkata';
    if new.registration_deadline is not null and new.registration_deadline > starts then
      raise exception 'DEADLINE_AFTER_START';
    end if;
    if api then
      if tg_op = 'INSERT' and new.registration_deadline is null then raise exception 'DEADLINE_REQUIRED'; end if;
      if (tg_op = 'INSERT' or (new.event_date, new.start_time) is distinct from (old.event_date, old.start_time))
         and starts < now() then
        raise exception 'EVENT_IN_PAST';
      end if;
      if (tg_op = 'INSERT' or new.registration_deadline is distinct from old.registration_deadline)
         and new.registration_deadline < now() then
        raise exception 'DEADLINE_IN_PAST';
      end if;
    end if;
  end if;
  return new;
end $$;
-- (trigger events_guard from 0000 already calls this function)

-- Deleting an event would cascade-delete its registrations; only allow it for
-- events nobody has registered for (e.g. sample or mistaken events).
create or replace function public.events_delete_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.registrations where event_id = old.id) then
    raise exception 'EVENT_HAS_REGISTRATIONS';
  end if;
  return old;
end $$;
drop trigger if exists events_delete_guard on public.events;
create trigger events_delete_guard before delete on public.events
  for each row execute function public.events_delete_guard();

-- ---------------------------------------------------------------------------
-- 3. Registrations: hashed pass tokens + attendance
-- ---------------------------------------------------------------------------
create or replace function public.pass_token_hash(_token text)
returns text language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(_token, 'UTF8')), 'hex')
$$;

alter table public.registrations add column if not exists token_hash text;
alter table public.registrations add column if not exists checked_in_at timestamptz;
alter table public.registrations add column if not exists checked_in_by uuid references auth.users(id) on delete set null;

-- Re-key existing passes: keep only the hash, so a database reader can no
-- longer copy a student's pass. Tokens already held by students still match.
update public.registrations set token_hash = public.pass_token_hash(registration_token)
  where token_hash is null and registration_token is not null;
alter table public.registrations alter column registration_token drop default;
alter table public.registrations alter column registration_token drop not null;
update public.registrations set registration_token = null where registration_token is not null;
alter table public.registrations alter column token_hash set not null;
create unique index if not exists registrations_token_hash_key on public.registrations(token_hash);

-- Organisers may read the list (RLS still limits rows to organisers) and change
-- only the status column. Token hashes are never readable through the API.
revoke all on public.registrations from anon, authenticated;
grant select (id, code, event_id, student_name, prn, department, user_id, status, registered_at, checked_in_at)
  on public.registrations to authenticated;
grant update (status) on public.registrations to authenticated;

create or replace function public.registrations_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  -- re-confirming would bypass the capacity check in register_for_event
  if old.status = 'cancelled' and new.status = 'confirmed' then raise exception 'REGISTRATION_FINAL'; end if;
  return new;
end $$;
drop trigger if exists registrations_guard on public.registrations;
create trigger registrations_guard before update on public.registrations
  for each row execute function public.registrations_guard();

-- Recount seats only when it can change (not on check-in).
drop trigger if exists registrations_count on public.registrations;
create trigger registrations_count after insert or delete or update of status, event_id on public.registrations
  for each row execute function public.sync_confirmed_count();

create or replace function public.register_for_event(_event_id uuid, _name text, _prn text, _department text)
returns table (registration_code text, token text)
language plpgsql security definer set search_path = public as $$
declare ev public.events; rx text; n text := btrim(regexp_replace(coalesce(_name,''), '\s+', ' ', 'g'));
  p text := upper(btrim(coalesce(_prn,''))); d text := btrim(coalesce(_department,''));
  tok text := encode(extensions.gen_random_bytes(24), 'hex');
  c text; cname text; attempt int := 0;
begin
  if char_length(n) < 2 or char_length(n) > 100 then raise exception 'INVALID_NAME'; end if;
  if char_length(d) < 2 or char_length(d) > 100 then raise exception 'INVALID_DEPARTMENT'; end if;
  select value into rx from public.app_settings where key = 'prn_regex';
  if rx is not null and p !~ rx then raise exception 'INVALID_PRN'; end if;
  -- row lock serialises concurrent registrations for the same event
  select * into ev from public.events where id = _event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if ev.status <> 'published' then raise exception 'EVENT_CLOSED'; end if;
  if (ev.event_date + ev.start_time) < (now() at time zone 'Asia/Kolkata') then raise exception 'EVENT_PAST'; end if;
  if ev.registration_deadline is not null and ev.registration_deadline < now() then raise exception 'DEADLINE_PASSED'; end if;
  if exists (select 1 from public.registrations where event_id = _event_id and prn = p) then raise exception 'DUPLICATE'; end if;
  if ev.confirmed_count >= ev.capacity then raise exception 'EVENT_FULL'; end if;
  loop
    attempt := attempt + 1;
    c := 'CC-' || upper(encode(extensions.gen_random_bytes(4), 'hex'));
    begin
      insert into public.registrations (code, event_id, student_name, prn, department, user_id, token_hash)
        values (c, _event_id, n, p, d, auth.uid(), public.pass_token_hash(tok));
      exit;
    exception when unique_violation then
      get stacked diagnostics cname = constraint_name;
      if cname = 'registrations_event_id_prn_key' then raise exception 'DUPLICATE'; end if;
      if attempt >= 5 then raise; end if; -- registration code collision: retry with a new code
    end;
  end loop;
  return query select c, tok;
end $$;
grant execute on function public.register_for_event(uuid,text,text,text) to anon, authenticated;

-- Entry pass for the token holder. No PRN returned.
drop function if exists public.get_pass(text);
create function public.get_pass(_token text)
returns table (registration_code text, student_name text, department text, status public.registration_status,
  event_title text, event_date date, start_time time, end_time time, venue text, club_name text,
  event_status public.event_status, event_id uuid, checked_in_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.code, r.student_name, r.department, r.status, e.title, e.event_date, e.start_time, e.end_time,
         e.venue, e.club_name, e.status, e.id, r.checked_in_at
  from public.registrations r join public.events e on e.id = r.event_id
  where char_length(_token) between 32 and 128 and r.token_hash = public.pass_token_hash(_token)
$$;
grant execute on function public.get_pass(text) to anon, authenticated;

-- "Priya Sharma" -> "Priya S." for the public verification view.
create or replace function public.mask_name(_n text)
returns text language sql immutable set search_path = public as $$
  select case when cardinality(parts) > 1 then parts[1] || ' ' || left(parts[cardinality(parts)], 1) || '.' else parts[1] end
  from (select regexp_split_to_array(btrim(coalesce(_n, '')), '\s+') as parts) s
$$;

-- What the QR code opens. Anyone may call it; organisers get full details,
-- everyone else a masked name. Never returns the PRN.
drop function if exists public.verify_pass(text);
create function public.verify_pass(_token text)
returns table (result text, is_staff boolean, registration_code text, student_name text, department text,
  event_title text, event_date date, start_time time, end_time time, venue text, checked_in_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare rec record; staff boolean := coalesce(public.has_role(auth.uid(), 'organiser'), false); res text;
  matched boolean := false;
begin
  if _token is not null and char_length(_token) between 32 and 128 then
    select r.code, r.student_name, r.department, r.status, r.checked_in_at,
           e.title, e.event_date, e.start_time, e.end_time, e.venue, e.status as est
      into rec
      from public.registrations r join public.events e on e.id = r.event_id
      where r.token_hash = public.pass_token_hash(_token);
    matched := found;
  end if;
  if not matched then
    return query select 'invalid'::text, staff, null::text, null::text, null::text, null::text,
      null::date, null::time, null::time, null::text, null::timestamptz;
    return;
  end if;
  res := case when rec.est = 'cancelled' then 'event_cancelled'
              when rec.status <> 'confirmed' then 'registration_cancelled'
              when rec.checked_in_at is not null then 'checked_in'
              when rec.est = 'completed' then 'event_completed'
              else 'valid' end;
  return query select res, staff,
    case when staff then rec.code end,
    case when staff then rec.student_name else public.mask_name(rec.student_name) end,
    case when staff then rec.department end,
    rec.title, rec.event_date, rec.start_time, rec.end_time, rec.venue, rec.checked_in_at;
end $$;
grant execute on function public.verify_pass(text) to anon, authenticated;

-- Organiser-only, atomic check-in. The conditional UPDATE means two
-- simultaneous scans of one pass can only succeed once.
create or replace function public.check_in_pass(_token text)
returns table (result text, checked_in_at timestamptz, student_name text, registration_code text)
language plpgsql volatile security definer set search_path = public as $$
declare h text; rec record;
begin
  if not coalesce(public.has_role(auth.uid(), 'organiser'), false) then raise exception 'FORBIDDEN'; end if;
  if _token is null or char_length(_token) not between 32 and 128 then
    return query select 'invalid'::text, null::timestamptz, null::text, null::text; return;
  end if;
  h := public.pass_token_hash(_token);
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
  if not found then
    return query select 'invalid'::text, null::timestamptz, null::text, null::text; return;
  end if;
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

-- ---------------------------------------------------------------------------
-- 4. Organiser dashboard aggregates (computed in the database, so they are not
--    truncated by the API's row limit)
-- ---------------------------------------------------------------------------
create or replace function public.registration_department_breakdown()
returns table (department text, registrations bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'organiser') then raise exception 'FORBIDDEN'; end if;
  return query select r.department, count(*) from public.registrations r
    where r.status = 'confirmed' group by r.department order by 2 desc, 1;
end $$;
revoke all on function public.registration_department_breakdown() from public, anon;
grant execute on function public.registration_department_breakdown() to authenticated;

create or replace function public.event_attendance_counts()
returns table (event_id uuid, checked_in bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'organiser') then raise exception 'FORBIDDEN'; end if;
  return query select r.event_id, count(*) from public.registrations r
    where r.checked_in_at is not null group by r.event_id;
end $$;
revoke all on function public.event_attendance_counts() from public, anon;
grant execute on function public.event_attendance_counts() to authenticated;
