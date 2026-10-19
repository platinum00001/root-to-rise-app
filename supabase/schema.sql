-- Root to Rise v1 — Supabase schema
-- Run in Supabase Dashboard > SQL Editor (or `supabase db push`). Safe to re-run.
-- Every table uses Row Level Security so each signed-in user can only read/write
-- their own rows. The anon key used by the website cannot bypass RLS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  state        text check (state in ('MA','NH')),
  zip          text check (zip ~ '^[0-9]{5}$'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ------------------------------------------------------ eligibility_answers
create table if not exists public.eligibility_answers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  answers       jsonb not null,
  results       jsonb,
  rules_version text,
  -- Answers are only ever saved after the member ticks a separate, unchecked-by-default
  -- "save my answers" box. Health-related answers (pregnancy, disability, Medicare,
  -- recovery status, ...) are stripped unless a second box is also ticked.
  save_consent         boolean not null default false check (save_consent),
  includes_health_data boolean not null default false,
  consented_at         timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
-- Upgrade path for databases created from an earlier draft of this file:
alter table public.eligibility_answers add column if not exists save_consent boolean not null default true;
alter table public.eligibility_answers add column if not exists includes_health_data boolean not null default false;
alter table public.eligibility_answers add column if not exists consented_at timestamptz not null default now();
create index if not exists eligibility_answers_user_idx on public.eligibility_answers (user_id, created_at desc);

-- ---------------------------------------------------- notification_consent
-- Stores opt-in consent only. The v1 website never sends email.
create table if not exists public.notification_consent (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  email             text,
  opted_in          boolean not null default false,   -- never defaults to true
  consent_text      text,                              -- exact wording the user agreed to
  consented_at      timestamptz,
  unsubscribed_at   timestamptz,
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  updated_at        timestamptz not null default now()
);

-- ------------------------------------------------------------ updated_at
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
drop trigger if exists consent_updated_at on public.notification_consent;
create trigger consent_updated_at before update on public.notification_consent
  for each row execute function public.set_updated_at();

-- ------------------------------------------- auto-create profile on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------- RLS
alter table public.profiles             enable row level security;
alter table public.eligibility_answers  enable row level security;
alter table public.notification_consent enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_delete_own" on public.profiles for delete to authenticated using (id = auth.uid());

drop policy if exists "answers_select_own" on public.eligibility_answers;
drop policy if exists "answers_insert_own" on public.eligibility_answers;
drop policy if exists "answers_update_own" on public.eligibility_answers;
drop policy if exists "answers_delete_own" on public.eligibility_answers;
create policy "answers_select_own" on public.eligibility_answers for select to authenticated using (user_id = auth.uid());
create policy "answers_insert_own" on public.eligibility_answers for insert to authenticated with check (user_id = auth.uid());
create policy "answers_update_own" on public.eligibility_answers for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "answers_delete_own" on public.eligibility_answers for delete to authenticated using (user_id = auth.uid());

drop policy if exists "consent_select_own" on public.notification_consent;
drop policy if exists "consent_insert_own" on public.notification_consent;
drop policy if exists "consent_update_own" on public.notification_consent;
drop policy if exists "consent_delete_own" on public.notification_consent;
create policy "consent_select_own" on public.notification_consent for select to authenticated using (user_id = auth.uid());
create policy "consent_insert_own" on public.notification_consent for insert to authenticated with check (user_id = auth.uid());
create policy "consent_update_own" on public.notification_consent for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "consent_delete_own" on public.notification_consent for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------ one-click unsubscribe
-- Lets someone who is NOT signed in unsubscribe using the secret token from
-- their link. It can only turn notifications OFF and reveals nothing.
create or replace function public.unsubscribe_by_token(p_token uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.notification_consent
     set opted_in = false, unsubscribed_at = now()
   where unsubscribe_token = p_token and opted_in = true;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.unsubscribe_by_token(uuid) from public;
grant execute on function public.unsubscribe_by_token(uuid) to anon, authenticated;

-- Table privileges (RLS still applies). anon gets nothing on the tables.
revoke all on public.profiles, public.eligibility_answers, public.notification_consent from anon;
grant select, insert, update, delete on public.profiles, public.eligibility_answers, public.notification_consent to authenticated;
