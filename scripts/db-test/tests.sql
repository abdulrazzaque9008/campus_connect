-- CampusConnect database test suite. Run with scripts/db-test/run.sh.
-- Every check raises an exception on failure (ON_ERROR_STOP aborts the run).
\set ON_ERROR_STOP 1
\set QUIET 1

-- helpers -------------------------------------------------------------------
create or replace function t.expect_error(_sql text, _needle text) returns void language plpgsql as $$
begin
  begin
    execute _sql;
  exception when others then
    if position(_needle in sqlerrm) > 0 then
      raise notice 'ok - rejected with "%"', _needle;
      return;
    end if;
    raise exception 'expected error containing "%", got "%" for: %', _needle, sqlerrm, _sql;
  end;
  raise exception 'expected error containing "%" but it succeeded: %', _needle, _sql;
end $$;
create or replace function t.ok(_cond boolean, _msg text) returns void language plpgsql as $$
begin
  if _cond is not true then raise exception 'FAILED: %', _msg; end if;
  raise notice 'ok - %', _msg;
end $$;
create or replace function t.get(_k text) returns text language sql as $$ select v from t.kv where k = _k $$;
create or replace function t.put(_k text, _v text) returns void language sql as $$
  insert into t.kv values (_k, _v) on conflict (k) do update set v = excluded.v $$;
grant execute on all functions in schema t to anon, authenticated;
set client_min_messages = notice;

-- users -------------------------------------------------------------------------
insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values
  ('first@example.edu', now(), '{"full_name":"First Signup"}'),
  ('student@example.edu', now(), '{}'),
  ('unconfirmed@example.edu', null, '{}');
select t.ok((select count(*) from public.user_roles) = 0, 'first signup no longer becomes organiser automatically');
select t.ok((select count(*) from public.profiles) = 3, 'profiles are still created for new accounts');

select t.put('org', (select id::text from auth.users where email = 'first@example.edu'));
select t.put('stu', (select id::text from auth.users where email = 'student@example.edu'));

-- legacy pass from before the migration
select t.ok((select count(*) from public.registrations where registration_token is not null) = 0,
  'plaintext tokens removed from the database');
select t.ok((select count(*) from public.get_pass(t.get('legacy_token'))) = 1, 'pre-migration pass still resolves');

-- bootstrap ---------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', t.get('stu'), false);
select t.expect_error($$select public.bootstrap_organiser('student@example.edu')$$, 'permission denied');
select t.expect_error($$insert into public.user_roles (user_id, role) values (auth.uid(), 'organiser')$$, 'permission denied');
select t.expect_error($$select public.grant_organiser('student@example.edu')$$, 'FORBIDDEN');
reset role;
select t.ok(public.bootstrap_organiser('FIRST@example.edu ') like 'Organiser access granted%', 'bootstrap_organiser works from SQL editor');
select t.expect_error($$select public.bootstrap_organiser('nobody@example.edu')$$, 'USER_NOT_FOUND');

set role authenticated;
select set_config('request.jwt.claim.sub', t.get('org'), false);
select t.expect_error($$select public.grant_organiser('unconfirmed@example.edu')$$, 'EMAIL_NOT_CONFIRMED');
select t.expect_error($$select public.grant_organiser('nobody@example.edu')$$, 'USER_NOT_FOUND');
select t.expect_error($$select public.revoke_organiser(auth.uid())$$, 'CANNOT_REVOKE_SELF');
select t.ok((select count(*) from public.list_organisers()) = 1, 'organiser can list organisers');
select public.grant_organiser('student@example.edu');
select t.ok(public.has_role(t.get('stu')::uuid, 'organiser'), 'organiser can grant access');
select public.revoke_organiser(t.get('stu')::uuid);
select t.ok(not public.has_role(t.get('stu')::uuid, 'organiser'), 'organiser can revoke access');

-- event creation / editing --------------------------------------------------------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t.expect_error($$insert into public.events (title, club_name, description, event_date, start_time, end_time, venue, category, capacity, registration_deadline)
  values ('Anon event', 'Club', 'Ten chars plus', current_date + 10, '10:00', '12:00', 'Hall', 'Technical', 10, now() + interval '1 day')$$, 'permission denied');

set role authenticated;
select set_config('request.jwt.claim.sub', t.get('stu'), false);
select t.expect_error($$insert into public.events (title, club_name, description, event_date, start_time, end_time, venue, category, capacity, registration_deadline)
  values ('Student event', 'Club', 'Ten chars plus', current_date + 10, '10:00', '12:00', 'Hall', 'Technical', 10, now() + interval '1 day')$$, 'row-level security');
select t.expect_error($$select public.registration_department_breakdown()$$, 'FORBIDDEN');
select t.expect_error($$select public.event_attendance_counts()$$, 'FORBIDDEN');
select t.expect_error($$select public.list_organisers()$$, 'FORBIDDEN');

select set_config('request.jwt.claim.sub', t.get('org'), false);
insert into public.events (title, club_name, description, short_description, contact_info, event_date, start_time, end_time, venue, category, capacity, registration_deadline, status, confirmed_count, is_sample)
  values ('  Robotics Expo  ', 'Robotics Club', 'A full description of the expo.', 'Short teaser', 'robotics@example.edu',
          current_date + 10, '10:00', '12:00', 'Main Hall', 'Technical', 3, now() + interval '2 days', 'cancelled', 99, true);
select t.put('ev', (select id::text from public.events where title = 'Robotics Expo'));
select t.ok((select status = 'published' and confirmed_count = 0 and not is_sample and created_by = auth.uid()
  from public.events where id = t.get('ev')::uuid), 'insert forces status/counter/sample/creator and trims title');

select t.expect_error($$insert into public.events (title, club_name, description, event_date, start_time, end_time, venue, category, capacity, registration_deadline)
  values ('Late deadline', 'Club', 'Ten chars plus', current_date + 10, '10:00', '12:00', 'Hall', 'Technical', 10, ((current_date + 10) + time '10:30') at time zone 'Asia/Kolkata')$$, 'DEADLINE_AFTER_START');
select t.expect_error($$insert into public.events (title, club_name, description, event_date, start_time, end_time, venue, category, capacity, registration_deadline)
  values ('Past event', 'Club', 'Ten chars plus', current_date - 1, '10:00', '12:00', 'Hall', 'Technical', 10, now() - interval '3 days')$$, 'EVENT_IN_PAST');
select t.expect_error($$insert into public.events (title, club_name, description, event_date, start_time, end_time, venue, category, capacity)
  values ('No deadline', 'Club', 'Ten chars plus', current_date + 10, '10:00', '12:00', 'Hall', 'Technical', 10)$$, 'DEADLINE_REQUIRED');
select t.expect_error($$insert into public.events (title, club_name, description, event_date, start_time, end_time, venue, category, capacity, registration_deadline)
  values ('Old deadline', 'Club', 'Ten chars plus', current_date + 10, '10:00', '12:00', 'Hall', 'Technical', 10, now() - interval '1 hour')$$, 'DEADLINE_IN_PAST');
select t.expect_error($$insert into public.events (title, club_name, description, event_date, start_time, end_time, venue, category, capacity, registration_deadline)
  values ('Zero seats', 'Club', 'Ten chars plus', current_date + 10, '10:00', '12:00', 'Hall', 'Technical', 0, now() + interval '1 day')$$, 'check constraint');
select t.expect_error($$insert into public.events (title, club_name, description, event_date, start_time, end_time, venue, category, capacity, registration_deadline)
  values ('Backwards', 'Club', 'Ten chars plus', current_date + 10, '12:00', '10:00', 'Hall', 'Technical', 10, now() + interval '1 day')$$, 'check constraint');
select t.expect_error($$insert into public.events (title, club_name, description, event_date, start_time, end_time, venue, category, capacity, registration_deadline, cover_image_url)
  values ('Bad image', 'Club', 'Ten chars plus', current_date + 10, '10:00', '12:00', 'Hall', 'Technical', 10, now() + interval '1 day', 'javascript:alert(1)')$$, 'INVALID_IMAGE_URL');

update public.events set title = 'Robotics Expo 2026', capacity = 4 where id = t.get('ev')::uuid;
select t.ok((select title from public.events where id = t.get('ev')::uuid) = 'Robotics Expo 2026', 'organiser can edit an event');

-- students cannot edit (RLS hides the row from the update)
select set_config('request.jwt.claim.sub', t.get('stu'), false);
update public.events set title = 'Hacked' where id = t.get('ev')::uuid;
select set_config('request.jwt.claim.sub', t.get('org'), false);
select t.ok((select title from public.events where id = t.get('ev')::uuid) = 'Robotics Expo 2026', 'non-organiser update has no effect');

-- registration --------------------------------------------------------------------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t.put('tok1', (select token from public.register_for_event(t.get('ev')::uuid, '  Priya   Sharma ', '2023it1045', 'Information Technology')));
select t.ok(t.get('tok1') ~ '^[0-9a-f]{48}$', 'registration returns a 192-bit random token');
select t.expect_error($$select public.register_for_event(t.get('ev')::uuid, 'Someone Else', ' 2023IT1045 ', 'Civil Engineering')$$, 'DUPLICATE');
select t.expect_error($$select public.register_for_event(t.get('ev')::uuid, 'Bad Prn', 'no!', 'Civil Engineering')$$, 'INVALID_PRN');
select t.expect_error($$select public.register_for_event(t.get('ev')::uuid, 'X', '2023IT2000', 'Civil Engineering')$$, 'INVALID_NAME');
select t.put('tok2', (select token from public.register_for_event(t.get('ev')::uuid, 'Rahul Patil', '2023IT1046', 'Computer Science')));
select t.put('tok3', (select token from public.register_for_event(t.get('ev')::uuid, 'Sneha Kulkarni', '2023IT1047', 'Computer Science')));
select t.put('tok4', (select token from public.register_for_event(t.get('ev')::uuid, 'Amit Deshmukh', '2023IT1048', 'Civil Engineering')));
select t.expect_error($$select public.register_for_event(t.get('ev')::uuid, 'Late Comer', '2023IT1049', 'Civil Engineering')$$, 'EVENT_FULL');
select t.ok((select confirmed_count from public.events where id = t.get('ev')::uuid) = 4, 'seat counter matches registrations');

-- anon / students cannot read registrations
select t.expect_error($$select prn from public.registrations$$, 'permission denied');
select t.ok((select count(*) from public.get_pass(t.get('tok1'))) = 1, 'token holder can load their pass');
select t.ok((select count(*) from public.get_pass('nottherighttokennottherighttoken00')) = 0, 'unknown token returns nothing');
select t.ok((select count(*) from public.get_pass(t.get('tok1')::text || 'x')) = 0, 'tampered token returns nothing');
reset role;
select t.ok(not exists (select 1 from information_schema.routines r join information_schema.parameters p
  on p.specific_name = r.specific_name where r.routine_name in ('get_pass', 'verify_pass') and p.parameter_name ilike '%prn%'),
  'pass functions never return the PRN');

set role authenticated;
select set_config('request.jwt.claim.sub', t.get('stu'), false);
select t.ok((select count(*) from public.registrations) = 0, 'non-organiser sees no registrations');
select set_config('request.jwt.claim.sub', t.get('org'), false);
select t.ok((select count(*) from public.registrations where event_id = t.get('ev')::uuid) = 4, 'organiser sees registrations');
select t.ok((select prn from public.registrations where student_name = 'Priya Sharma') = '2023IT1045', 'name normalised and PRN upper-cased');
select t.expect_error($$select token_hash from public.registrations$$, 'permission denied');
select t.expect_error($$update public.registrations set prn = 'CHANGED1' where student_name = 'Rahul Patil'$$, 'permission denied');
select t.expect_error($$update public.registrations set checked_in_at = now() where student_name = 'Rahul Patil'$$, 'permission denied');

-- capacity cannot drop below confirmed registrations
select t.expect_error($$update public.events set capacity = 3 where id = t.get('ev')::uuid$$, 'Capacity cannot be lower');

-- cancelling a registration frees a seat; it cannot be re-confirmed
update public.registrations set status = 'cancelled' where student_name = 'Amit Deshmukh';
select t.ok((select confirmed_count from public.events where id = t.get('ev')::uuid) = 3, 'cancelling a registration frees a seat');
select t.expect_error($$update public.registrations set status = 'confirmed' where student_name = 'Amit Deshmukh'$$, 'REGISTRATION_FINAL');

-- verification + check-in -----------------------------------------------------------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t.ok((select result = 'valid' and not is_staff and student_name = 'Priya S.' and department is null and registration_code is null
  from public.verify_pass(t.get('tok1'))), 'public verification: valid, masked name, no department/code');
select t.ok((select result from public.verify_pass('0000000000000000000000000000000000000000')) = 'invalid', 'unknown token is invalid');
select t.ok((select result from public.verify_pass('short')) = 'invalid', 'malformed token is invalid');
select t.ok((select result from public.verify_pass(null)) = 'invalid', 'null token is invalid');
select t.expect_error($$select public.check_in_pass(t.get('tok1'))$$, 'permission denied');

set role authenticated;
select set_config('request.jwt.claim.sub', t.get('stu'), false);
select t.expect_error($$select public.check_in_pass(t.get('tok1'))$$, 'FORBIDDEN');
select t.ok((select result from public.verify_pass(t.get('tok1'))) = 'valid' and
  (select not is_staff from public.verify_pass(t.get('tok1'))), 'signed-in non-organiser gets the public view');

select set_config('request.jwt.claim.sub', t.get('org'), false);
select t.ok((select is_staff and student_name = 'Priya Sharma' and department = 'Information Technology' and registration_code like 'CC-%'
  from public.verify_pass(t.get('tok1'))), 'organiser verification shows full name, department, code');
select t.ok((select result from public.check_in_pass(t.get('tok1'))) = 'checked_in', 'organiser can check in a valid pass');
select t.ok((select result from public.check_in_pass(t.get('tok1'))) = 'already_checked_in', 'second scan reports already checked in');
select t.ok((select result from public.verify_pass(t.get('tok1'))) = 'checked_in', 'verification shows checked-in status');
select t.ok((select checked_in_at is not null from public.get_pass(t.get('tok1'))), 'pass shows check-in time');
select t.ok((select result from public.check_in_pass(t.get('tok4'))) = 'registration_cancelled', 'cancelled registration cannot check in');
select t.ok((select result from public.check_in_pass('ffffffffffffffffffffffffffffffffffffffffffffffff')) = 'invalid', 'unknown token cannot check in');
select t.ok((select checked_in from public.event_attendance_counts() where event_id = t.get('ev')::uuid) = 1, 'attendance count');
select t.ok((select sum(registrations) from public.registration_department_breakdown()) =
  (select count(*) from public.registrations where status = 'confirmed'), 'department breakdown counts confirmed registrations');
select t.ok((select confirmed_count from public.events where id = t.get('ev')::uuid) = 3, 'check-in does not change seat count');

-- event lifecycle --------------------------------------------------------------------
select t.expect_error($$delete from public.events where id = t.get('ev')::uuid$$, 'EVENT_HAS_REGISTRATIONS');
update public.events set status = 'cancelled' where id = t.get('ev')::uuid;
select t.expect_error($$update public.events set status = 'published' where id = t.get('ev')::uuid$$, 'EVENT_LOCKED');
select t.expect_error($$update public.events set title = 'Renamed' where id = t.get('ev')::uuid$$, 'EVENT_LOCKED');
select t.ok((select result from public.verify_pass(t.get('tok2'))) = 'event_cancelled', 'cancelled event invalidates passes');
select t.ok((select result from public.check_in_pass(t.get('tok2'))) = 'event_cancelled', 'cannot check in to a cancelled event');
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t.expect_error($$select public.register_for_event(t.get('ev')::uuid, 'After Cancel', '2023IT1050', 'Civil Engineering')$$, 'EVENT_CLOSED');

-- deleting an unused event is allowed
set role authenticated;
select set_config('request.jwt.claim.sub', t.get('org'), false);
insert into public.events (title, club_name, description, event_date, start_time, end_time, venue, category, capacity, registration_deadline)
  values ('Throwaway', 'Club', 'Ten chars plus', current_date + 10, '10:00', '12:00', 'Hall', 'Technical', 10, now() + interval '1 day');
delete from public.events where title = 'Throwaway';
select t.ok(not exists (select 1 from public.events where title = 'Throwaway'), 'event without registrations can be deleted');

-- completed events are locked too
update public.events set status = 'completed' where title = 'Coding Competition';
select t.expect_error($$update public.events set capacity = 500 where title = 'Coding Competition'$$, 'EVENT_LOCKED');

-- deadline / started checks (seeded directly as the database owner) ----------------------
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into public.events (title, club_name, description, event_date, start_time, end_time, venue, category, capacity, registration_deadline)
  values ('Deadline gone', 'Club', 'Ten chars plus', current_date + 5, '10:00', '12:00', 'Hall', 'Technical', 10, now() - interval '1 minute'),
         ('Already started', 'Club', 'Ten chars plus', (now() at time zone 'Asia/Kolkata')::date - 1, '00:00', '23:59', 'Hall', 'Technical', 10, null);
set role anon;
select t.expect_error($$select public.register_for_event((select id from public.events where title = 'Deadline gone'), 'Late Person', '2023IT1051', 'Civil Engineering')$$, 'DEADLINE_PASSED');
select t.expect_error($$select public.register_for_event((select id from public.events where title = 'Already started'), 'Late Person', '2023IT1051', 'Civil Engineering')$$, 'EVENT_PAST');
select t.expect_error($$select public.register_for_event('00000000-0000-0000-0000-000000000000', 'Late Person', '2023IT1051', 'Civil Engineering')$$, 'EVENT_NOT_FOUND');
reset role;

-- event for the concurrency tests in run.sh
insert into public.events (title, club_name, description, event_date, start_time, end_time, venue, category, capacity, registration_deadline)
  values ('Race test', 'Club', 'Ten chars plus', current_date + 10, '10:00', '12:00', 'Hall', 'Technical', 5, now() + interval '1 day');
select t.put('race_ev', (select id::text from public.events where title = 'Race test'));
\echo 'ALL FUNCTIONAL TESTS PASSED'
