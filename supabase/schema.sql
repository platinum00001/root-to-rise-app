-- Root to Rise community app — Supabase schema (schema: rtr_app)
-- Lives in its OWN schema so it never touches other sites' tables in the shared
-- "james-sites" project. Safe to re-run. Every table uses Row Level Security:
-- a signed-in member can only read/write their own rows; the public (anon) key
-- cannot read any table. Admin/partner powers come from rows in rtr_app.admins /
-- rtr_app.partner_staff and are only used through narrow SECURITY DEFINER
-- functions that return aggregates (never individual members' data).
--
-- After running: Supabase Dashboard > Project Settings > Data API > Exposed schemas
-- must include "rtr_app" (see docs/DEPLOY-GUIDE.md).

create extension if not exists pgcrypto with schema extensions;
create schema if not exists rtr_app;

-- ---------------------------------------------------------------- profiles
-- One row per person who has signed in to THIS app (created by the site on first sign-in;
-- there is deliberately no trigger on auth.users, because that login table is shared
-- with other sites).
create table if not exists rtr_app.profiles (
  id           uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  state        text check (state in ('MA','NH')),
  zip          text check (zip ~ '^[0-9]{5}$'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ------------------------------------------------------ eligibility_answers
-- Only saved after the member ticks an unchecked-by-default "save my answers" box.
-- Health-related answers are stripped in the browser unless a SECOND box is ticked.
create table if not exists rtr_app.eligibility_answers (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  answers              jsonb not null,
  results              jsonb,
  rules_version        text,
  save_consent         boolean not null default false check (save_consent),
  includes_health_data boolean not null default false,
  consented_at         timestamptz not null default now(),
  created_at           timestamptz not null default now()
);
create index if not exists rtr_elig_user_idx on rtr_app.eligibility_answers (user_id, created_at desc);

-- ---------------------------------------------------- notification_consent
-- Opt-in consent only (never defaults to true). The website itself sends no email.
create table if not exists rtr_app.notification_consent (
  user_id           uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  email             text,
  opted_in          boolean not null default false,
  consent_text      text,
  consented_at      timestamptz,
  unsubscribed_at   timestamptz,
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------- offer_code_requests
-- A member asks for a code for a partner offer (offer ids come from data/offers.json).
create table if not exists rtr_app.offer_code_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  offer_id    text not null check (offer_id ~ '^[a-z0-9-]{1,80}$'),
  code        text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  status      text not null default 'issued' check (status in ('issued','redeemed','cancelled')),
  created_at  timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users (id) on delete set null
);
create index if not exists rtr_codes_user_idx on rtr_app.offer_code_requests (user_id, created_at desc);
create unique index if not exists rtr_codes_one_open_per_offer
  on rtr_app.offer_code_requests (user_id, offer_id) where status = 'issued';

-- ------------------------------------------------------- admins & partners
create table if not exists rtr_app.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);
create table if not exists rtr_app.partner_staff (
  user_id    uuid not null references auth.users (id) on delete cascade,
  offer_id   text not null check (offer_id ~ '^[a-z0-9-]{1,80}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, offer_id)
);

-- ------------------------------------------------------------ helpers
create or replace function rtr_app.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists rtr_profiles_updated_at on rtr_app.profiles;
create trigger rtr_profiles_updated_at before update on rtr_app.profiles
  for each row execute function rtr_app.set_updated_at();
drop trigger if exists rtr_consent_updated_at on rtr_app.notification_consent;
create trigger rtr_consent_updated_at before update on rtr_app.notification_consent
  for each row execute function rtr_app.set_updated_at();

create or replace function rtr_app.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from rtr_app.admins where user_id = auth.uid())
$$;

-- ------------------------------------------------------------------- RLS
alter table rtr_app.profiles             enable row level security;
alter table rtr_app.eligibility_answers  enable row level security;
alter table rtr_app.notification_consent enable row level security;
alter table rtr_app.offer_code_requests  enable row level security;
alter table rtr_app.admins               enable row level security;
alter table rtr_app.partner_staff        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles','eligibility_answers','notification_consent'] loop
    execute format('drop policy if exists %I on rtr_app.%I', t||'_select_own', t);
    execute format('drop policy if exists %I on rtr_app.%I', t||'_insert_own', t);
    execute format('drop policy if exists %I on rtr_app.%I', t||'_update_own', t);
    execute format('drop policy if exists %I on rtr_app.%I', t||'_delete_own', t);
  end loop;
end $$;

create policy profiles_select_own on rtr_app.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_own on rtr_app.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on rtr_app.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_delete_own on rtr_app.profiles for delete to authenticated using (id = (select auth.uid()));

create policy eligibility_answers_select_own on rtr_app.eligibility_answers for select to authenticated using (user_id = (select auth.uid()));
create policy eligibility_answers_insert_own on rtr_app.eligibility_answers for insert to authenticated with check (user_id = (select auth.uid()));
create policy eligibility_answers_delete_own on rtr_app.eligibility_answers for delete to authenticated using (user_id = (select auth.uid()));

create policy notification_consent_select_own on rtr_app.notification_consent for select to authenticated using (user_id = (select auth.uid()));
create policy notification_consent_insert_own on rtr_app.notification_consent for insert to authenticated with check (user_id = (select auth.uid()));
create policy notification_consent_update_own on rtr_app.notification_consent for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notification_consent_delete_own on rtr_app.notification_consent for delete to authenticated using (user_id = (select auth.uid()));

-- Codes: members read and delete their own; codes are CREATED/REDEEMED only via functions below.
drop policy if exists codes_select_own on rtr_app.offer_code_requests;
drop policy if exists codes_delete_own on rtr_app.offer_code_requests;
create policy codes_select_own on rtr_app.offer_code_requests for select to authenticated using (user_id = (select auth.uid()));
create policy codes_delete_own on rtr_app.offer_code_requests for delete to authenticated using (user_id = (select auth.uid()));

-- admins / partner_staff: a person can see only whether THEY are listed. Managed in SQL editor.
drop policy if exists admins_select_self on rtr_app.admins;
drop policy if exists partner_select_self on rtr_app.partner_staff;
create policy admins_select_self on rtr_app.admins for select to authenticated using (user_id = (select auth.uid()));
create policy partner_select_self on rtr_app.partner_staff for select to authenticated using (user_id = (select auth.uid()));

-- ------------------------------------------------------------ functions
-- Issue (or return the existing open) code for an offer.
create or replace function rtr_app.request_offer_code(p_offer_id text)
returns rtr_app.offer_code_requests
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r rtr_app.offer_code_requests; c text; i int;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if uid is null then raise exception 'Please sign in first' using errcode = '28000'; end if;
  if p_offer_id !~ '^[a-z0-9-]{1,80}$' then raise exception 'Unknown offer'; end if;
  select * into r from rtr_app.offer_code_requests where user_id = uid and offer_id = p_offer_id and status = 'issued';
  if found then return r; end if;
  if (select count(*) from rtr_app.offer_code_requests where user_id = uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Too many code requests today. Please try again tomorrow.';
  end if;
  loop
    c := '';
    for i in 1..8 loop
      c := c || substr(alphabet, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 32), 1);
    end loop;
    begin
      insert into rtr_app.offer_code_requests (user_id, offer_id, code) values (uid, p_offer_id, c) returning * into r;
      return r;
    exception when unique_violation then
      -- extremely unlikely code collision (or race on the open-code index): retry / return existing
      select * into r from rtr_app.offer_code_requests where user_id = uid and offer_id = p_offer_id and status = 'issued';
      if found then return r; end if;
    end;
  end loop;
end $$;

-- Staff lookup: returns only offer + status, never who the member is.
create or replace function rtr_app.lookup_code(p_code text)
returns table (offer_id text, status text, issued_at timestamptz, redeemed_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first' using errcode = '28000'; end if;
  return query
    select r.offer_id, r.status, r.created_at, r.redeemed_at
      from rtr_app.offer_code_requests r
     where r.code = upper(trim(p_code))
       and (rtr_app.is_admin() or exists (select 1 from rtr_app.partner_staff p where p.user_id = auth.uid() and p.offer_id = r.offer_id));
end $$;

-- Admin, or partner staff for that offer, marks a code redeemed (once).
create or replace function rtr_app.redeem_code(p_code text)
returns text
language plpgsql security definer set search_path = '' as $$
declare r rtr_app.offer_code_requests;
begin
  if auth.uid() is null then raise exception 'Please sign in first' using errcode = '28000'; end if;
  select * into r from rtr_app.offer_code_requests where code = upper(trim(p_code)) for update;
  if not found then return 'not_found'; end if;
  if not (rtr_app.is_admin() or exists (select 1 from rtr_app.partner_staff p where p.user_id = auth.uid() and p.offer_id = r.offer_id)) then
    return 'not_found';  -- don't reveal codes to people without access
  end if;
  if r.status = 'redeemed' then return 'already_redeemed'; end if;
  if r.status <> 'issued' then return 'not_valid'; end if;
  update rtr_app.offer_code_requests set status = 'redeemed', redeemed_at = now(), redeemed_by = auth.uid() where id = r.id;
  return 'redeemed';
end $$;

-- Aggregate counts for the staff dashboard / funders. Admins only. No personal data.
create or replace function rtr_app.admin_stats()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not rtr_app.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'generated_at', now(),
    'totals', jsonb_build_object(
      'member_signups',            (select count(*) from rtr_app.profiles),
      'eligibility_checks_saved',  (select count(*) from rtr_app.eligibility_answers),
      'members_with_saved_checks', (select count(distinct user_id) from rtr_app.eligibility_answers),
      'offer_optins_active',       (select count(*) from rtr_app.notification_consent where opted_in),
      'offer_unsubscribes',        (select count(*) from rtr_app.notification_consent where not opted_in and unsubscribed_at is not null),
      'codes_issued',              (select count(*) from rtr_app.offer_code_requests),
      'codes_redeemed',            (select count(*) from rtr_app.offer_code_requests where status = 'redeemed')),
    'by_month', coalesce((select jsonb_agg(m order by m->>'month') from (
        select jsonb_build_object('month', mon,
          'member_signups', (select count(*) from rtr_app.profiles where to_char(created_at,'YYYY-MM') = mon),
          'eligibility_checks_saved', (select count(*) from rtr_app.eligibility_answers where to_char(created_at,'YYYY-MM') = mon),
          'codes_issued', (select count(*) from rtr_app.offer_code_requests where to_char(created_at,'YYYY-MM') = mon),
          'codes_redeemed', (select count(*) from rtr_app.offer_code_requests where to_char(redeemed_at,'YYYY-MM') = mon)) as m
        from (select distinct to_char(d,'YYYY-MM') as mon from (
          select created_at as d from rtr_app.profiles union all select created_at from rtr_app.eligibility_answers
          union all select created_at from rtr_app.offer_code_requests union all select redeemed_at from rtr_app.offer_code_requests where redeemed_at is not null) x) months) y), '[]'::jsonb),
    'codes_by_offer', coalesce((select jsonb_agg(jsonb_build_object('offer_id', offer_id, 'issued', n, 'redeemed', rd) order by offer_id)
        from (select offer_id, count(*) n, count(*) filter (where status = 'redeemed') rd from rtr_app.offer_code_requests group by offer_id) z), '[]'::jsonb)
  );
end $$;

-- What can the signed-in person do on the staff page?
create or replace function rtr_app.my_roles()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('admin', rtr_app.is_admin(),
    'partner_offers', coalesce((select jsonb_agg(offer_id) from rtr_app.partner_staff where user_id = auth.uid()), '[]'::jsonb))
$$;

-- Member deletes everything this app stored about them (login itself is shared; see privacy page).
create or replace function rtr_app.delete_my_data()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Please sign in first' using errcode = '28000'; end if;
  delete from rtr_app.offer_code_requests where user_id = uid;
  delete from rtr_app.eligibility_answers where user_id = uid;
  delete from rtr_app.notification_consent where user_id = uid;
  delete from rtr_app.partner_staff where user_id = uid;
  delete from rtr_app.profiles where id = uid;
end $$;

-- One-click unsubscribe for people who are NOT signed in, using the secret token.
create or replace function rtr_app.unsubscribe_by_token(p_token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update rtr_app.notification_consent set opted_in = false, unsubscribed_at = now()
   where unsubscribe_token = p_token and opted_in = true;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Public health check (used to confirm the API can see this schema). Reveals nothing.
create or replace function rtr_app.health() returns jsonb
language sql stable set search_path = '' as $$ select jsonb_build_object('ok', true, 'schema', 'rtr_app', 'version', 'v1-live') $$;

-- ------------------------------------------------------------ privileges
revoke all on all tables in schema rtr_app from anon, authenticated, public;
revoke all on all functions in schema rtr_app from anon, authenticated, public;
grant usage on schema rtr_app to anon, authenticated, service_role;
grant select, insert, update, delete on rtr_app.profiles, rtr_app.notification_consent to authenticated;
grant select, insert, delete on rtr_app.eligibility_answers to authenticated;
grant select, delete on rtr_app.offer_code_requests to authenticated;
grant select on rtr_app.admins, rtr_app.partner_staff to authenticated;
grant all on all tables in schema rtr_app to service_role;
grant execute on function rtr_app.unsubscribe_by_token(uuid), rtr_app.health() to anon, authenticated;
grant execute on function rtr_app.request_offer_code(text), rtr_app.lookup_code(text), rtr_app.redeem_code(text),
  rtr_app.admin_stats(), rtr_app.my_roles(), rtr_app.delete_my_data(), rtr_app.is_admin() to authenticated;
alter default privileges in schema rtr_app revoke execute on functions from public;
