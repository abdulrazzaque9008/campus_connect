-- Runs between migration 0000 and 0001: issues a pass the *old* way (plaintext
-- token) so the test suite can prove that pre-existing passes keep working.
create schema if not exists t;
grant usage on schema t to anon, authenticated;
create table if not exists t.kv (k text primary key, v text);
grant all on t.kv to anon, authenticated;

insert into t.kv
select 'legacy_token', token
from public.register_for_event(
  (select id from public.events where title = 'Hackathon 2026'), 'Legacy Student', 'LEGACY001', 'Civil Engineering');
