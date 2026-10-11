
create type public.app_role as enum ('organiser');
create type public.event_category as enum ('Technical','Cultural','Sports','Workshop');
create type public.event_status as enum ('published','cancelled','completed');
create type public.registration_status as enum ('confirmed','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles read" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name');
  -- Bootstrap: the very first account becomes organiser. Later organisers are granted manually.
  if not exists (select 1 from public.user_roles where role = 'organiser') then
    insert into public.user_roles (user_id, role) values (new.id, 'organiser');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.app_settings (
  key text primary key,
  value text not null
);
grant select on public.app_settings to anon, authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy "settings public read" on public.app_settings for select to anon, authenticated using (true);
insert into public.app_settings values
  ('prn_regex', '^[A-Za-z0-9]{6,16}$'),
  ('prn_hint', '6–16 letters or digits, e.g. 2023IT1045');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 150),
  club_name text not null check (char_length(club_name) between 2 and 100),
  description text not null,
  event_date date not null,
  start_time time not null,
  end_time time not null,
  venue text not null,
  category public.event_category not null,
  capacity int not null check (capacity > 0 and capacity <= 100000),
  cover_image_url text,
  registration_deadline timestamptz,
  status public.event_status not null default 'published',
  confirmed_count int not null default 0,
  is_sample boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index events_date_idx on public.events(event_date);
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "events public read" on public.events for select to anon, authenticated using (true);
create policy "organisers insert" on public.events for insert to authenticated with check (public.has_role(auth.uid(),'organiser'));
create policy "organisers update" on public.events for update to authenticated using (public.has_role(auth.uid(),'organiser'));
create policy "organisers delete" on public.events for delete to authenticated using (public.has_role(auth.uid(),'organiser'));

create or replace function public.events_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.confirmed_count := 0;
    new.created_by := auth.uid();
  else
    new.confirmed_count := old.confirmed_count; -- only the counter trigger may change it
    if new.capacity < old.confirmed_count then
      raise exception 'Capacity cannot be lower than the % confirmed registrations', old.confirmed_count;
    end if;
  end if;
  return new;
end $$;
create trigger events_guard before insert or update on public.events
  for each row when (pg_trigger_depth() < 1) execute function public.events_guard();

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('CC-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  event_id uuid not null references public.events(id) on delete cascade,
  student_name text not null,
  prn text not null,
  department text not null,
  user_id uuid,
  registration_token text not null unique default encode(extensions.gen_random_bytes(24),'hex'),
  status public.registration_status not null default 'confirmed',
  registered_at timestamptz not null default now(),
  unique (event_id, prn)
);
create index registrations_event_idx on public.registrations(event_id);
grant select, update on public.registrations to authenticated;
grant all on public.registrations to service_role;
alter table public.registrations enable row level security;
create policy "organisers read regs" on public.registrations for select to authenticated using (public.has_role(auth.uid(),'organiser'));
create policy "organisers update regs" on public.registrations for update to authenticated using (public.has_role(auth.uid(),'organiser'));

create or replace function public.sync_confirmed_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare eid uuid := coalesce(new.event_id, old.event_id);
begin
  update public.events set confirmed_count =
    (select count(*) from public.registrations where event_id = eid and status = 'confirmed')
  where id = eid;
  return null;
end $$;
create trigger registrations_count after insert or update or delete on public.registrations
  for each row execute function public.sync_confirmed_count();

create or replace function public.register_for_event(_event_id uuid, _name text, _prn text, _department text)
returns table (registration_code text, token text)
language plpgsql security definer set search_path = public as $$
declare ev public.events; rx text; n text := btrim(regexp_replace(coalesce(_name,''), '\s+', ' ', 'g'));
  p text := upper(btrim(coalesce(_prn,''))); d text := btrim(coalesce(_department,''));
  r public.registrations;
begin
  if char_length(n) < 2 or char_length(n) > 100 then raise exception 'INVALID_NAME'; end if;
  if char_length(d) < 2 or char_length(d) > 100 then raise exception 'INVALID_DEPARTMENT'; end if;
  select value into rx from public.app_settings where key = 'prn_regex';
  if rx is not null and p !~ rx then raise exception 'INVALID_PRN'; end if;
  select * into ev from public.events where id = _event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if ev.status <> 'published' then raise exception 'EVENT_CLOSED'; end if;
  if (ev.event_date + ev.start_time) < (now() at time zone 'Asia/Kolkata') then raise exception 'EVENT_PAST'; end if;
  if ev.registration_deadline is not null and ev.registration_deadline < now() then raise exception 'DEADLINE_PASSED'; end if;
  if exists (select 1 from public.registrations where event_id = _event_id and prn = p) then raise exception 'DUPLICATE'; end if;
  if ev.confirmed_count >= ev.capacity then raise exception 'EVENT_FULL'; end if;
  insert into public.registrations (event_id, student_name, prn, department, user_id)
    values (_event_id, n, p, d, auth.uid()) returning * into r;
  return query select r.code, r.registration_token;
end $$;
grant execute on function public.register_for_event(uuid,text,text,text) to anon, authenticated;

-- Entry pass lookup by secret token (token holder only). No PRN returned.
create or replace function public.get_pass(_token text)
returns table (registration_code text, student_name text, department text, status public.registration_status,
  event_title text, event_date date, start_time time, end_time time, venue text, club_name text, event_status public.event_status)
language sql stable security definer set search_path = public as $$
  select r.code, r.student_name, r.department, r.status, e.title, e.event_date, e.start_time, e.end_time, e.venue, e.club_name, e.status
  from public.registrations r join public.events e on e.id = r.event_id
  where r.registration_token = _token and char_length(_token) >= 32
$$;
grant execute on function public.get_pass(text) to anon, authenticated;

-- Organiser verification
create or replace function public.verify_pass(_token text)
returns table (valid boolean, reason text, registration_code text, student_name text, department text, event_title text, event_date date)
language plpgsql stable security definer set search_path = public as $$
declare rec record;
begin
  if not public.has_role(auth.uid(),'organiser') then raise exception 'FORBIDDEN'; end if;
  select r.code, r.student_name, r.department, r.status, e.title, e.event_date, e.status as est into rec
  from public.registrations r join public.events e on e.id = r.event_id where r.registration_token = _token;
  if not found then return query select false, 'Invalid or unknown pass', null::text, null::text, null::text, null::text, null::date; return; end if;
  if rec.est = 'cancelled' then return query select false, 'Event has been cancelled', rec.code, rec.student_name, rec.department, rec.title, rec.event_date; return; end if;
  if rec.status <> 'confirmed' then return query select false, 'Registration cancelled', rec.code, rec.student_name, rec.department, rec.title, rec.event_date; return; end if;
  return query select true, 'Valid entry pass', rec.code, rec.student_name, rec.department, rec.title, rec.event_date;
end $$;
grant execute on function public.verify_pass(text) to authenticated;

insert into public.events (title, club_name, description, event_date, start_time, end_time, venue, category, capacity, registration_deadline, is_sample) values
('Hackathon 2026','CSI Student Chapter','A 24-hour build sprint. Form teams of up to four, pick a campus problem and ship a working prototype. Mentors and snacks provided. (Sample event)','2026-11-14','09:00','21:00','Central Computing Lab, Block C','Technical',120,'2026-11-12 23:59+05:30',true),
('Cultural Night 2026','Cultural Committee','An evening of dance, music and drama performances by students from every department. (Sample event)','2026-11-21','18:00','22:00','Open Air Auditorium','Cultural',400,'2026-11-20 18:00+05:30',true),
('Inter-Department Football Tournament','Sports Council','Knockout football tournament between departments. Register individually; teams are formed by department. (Sample event)','2026-12-05','08:00','17:00','College Football Ground','Sports',80,'2026-12-01 23:59+05:30',true),
('Machine Learning Workshop','AI & Data Science Club','Hands-on introduction to supervised learning with Python and scikit-learn. Bring your laptop. (Sample event)','2026-10-28','10:00','16:00','Seminar Hall 2, IT Department','Workshop',60,'2026-10-26 23:59+05:30',true),
('Web Development Bootcamp','Google Developer Student Club','Two-session bootcamp covering HTML, CSS, JavaScript and deploying your first site. (Sample event)','2026-11-07','10:00','15:00','Lab 304, CSE Department','Workshop',50,'2026-11-05 23:59+05:30',true),
('Coding Competition','CodeChef JNEC Chapter','Solve algorithmic problems against the clock. Individual participation, prizes for the top three. (Sample event)','2026-10-24','14:00','17:00','Central Computing Lab, Block C','Technical',100,'2026-10-23 23:59+05:30',true);
