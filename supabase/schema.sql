-- Bay Area Flight Deals: initial database structure
-- Run this entire file once in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.deals (
  id text primary key default gen_random_uuid()::text,
  provider text not null default 'manual',
  provider_reference text,
  origin text not null check (origin in ('SFO', 'SJC', 'OAK')),
  destination_airport text not null,
  destination_city text not null,
  destination_country text not null,
  region text,
  price integer not null check (price > 0),
  currency text not null default 'USD',
  typical_price integer check (typical_price > 0),
  percent_below_typical numeric(5,2),
  score numeric(5,2) not null default 0 check (score between 0 and 100),
  airline text not null,
  nonstop boolean not null default false,
  outbound_date date,
  return_date date,
  booking_url text,
  baggage_notes text,
  fare_restrictions text,
  status text not null default 'candidate' check (
    status in ('candidate', 'needs_review', 'verified', 'rejected', 'post_generated', 'published', 'expired')
  ),
  discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  verified_price integer,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deals_status_score_idx on public.deals (status, score desc);
create index if not exists deals_route_idx on public.deals (origin, destination_airport);
create unique index if not exists deals_provider_reference_idx
  on public.deals (provider, provider_reference)
  where provider_reference is not null;

create table if not exists public.fare_observations (
  id uuid primary key default gen_random_uuid(),
  deal_id text references public.deals(id) on delete set null,
  provider text not null,
  origin text not null check (origin in ('SFO', 'SJC', 'OAK')),
  destination_airport text not null,
  price integer not null check (price > 0),
  currency text not null default 'USD',
  airline text,
  nonstop boolean,
  outbound_date date,
  return_date date,
  booking_url text,
  observed_at timestamptz not null default now(),
  raw_payload jsonb
);

create index if not exists fare_observations_route_time_idx
  on public.fare_observations (origin, destination_airport, observed_at desc);

create table if not exists public.airport_comparisons (
  id uuid primary key default gen_random_uuid(),
  deal_id text not null references public.deals(id) on delete cascade,
  airport text not null check (airport in ('SFO', 'SJC', 'OAK')),
  price integer check (price > 0),
  checked_at timestamptz not null default now(),
  unique (deal_id, airport)
);

create table if not exists public.instagram_posts (
  id uuid primary key default gen_random_uuid(),
  deal_id text not null references public.deals(id) on delete cascade,
  caption text not null,
  story_copy text,
  image_path text,
  status text not null default 'draft' check (
    status in ('draft', 'approved', 'publishing', 'published', 'failed')
  ),
  generated_at timestamptz not null default now(),
  approved_at timestamptz,
  published_at timestamptz,
  instagram_media_id text,
  instagram_permalink text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists instagram_posts_deal_idx on public.instagram_posts (deal_id, created_at desc);

create table if not exists public.publishing_attempts (
  id uuid primary key default gen_random_uuid(),
  instagram_post_id uuid not null references public.instagram_posts(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null default false,
  provider_response jsonb,
  error_message text
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists deals_set_updated_at on public.deals;
create trigger deals_set_updated_at
before update on public.deals
for each row execute function public.set_updated_at();

drop trigger if exists instagram_posts_set_updated_at on public.instagram_posts;
create trigger instagram_posts_set_updated_at
before update on public.instagram_posts
for each row execute function public.set_updated_at();

alter table public.deals enable row level security;
alter table public.fare_observations enable row level security;
alter table public.airport_comparisons enable row level security;
alter table public.instagram_posts enable row level security;
alter table public.publishing_attempts enable row level security;

-- No public policies are created intentionally. The application will access
-- these internal operations tables only through its protected server backend.
