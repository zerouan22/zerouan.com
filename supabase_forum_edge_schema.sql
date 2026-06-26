-- INC. Forum Edge Functions migration.
-- Run after the existing Supabase schema. It adds the columns/tables used by supabase/functions/forum-api.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists username text,
  add column if not exists bio text default '',
  add column if not exists theme text default 'dark',
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists profile_extra jsonb not null default '{}'::jsonb,
  add column if not exists artist_profile jsonb not null default '{}'::jsonb,
  add column if not exists user_group text not null default 'visitatore',
  add column if not exists is_artist boolean not null default false,
  add column if not exists last_seen_at timestamptz;

alter table public.threads
  add column if not exists media_items jsonb not null default '[]'::jsonb,
  add column if not exists tags text[] not null default '{}',
  add column if not exists moderation_status text not null default 'approved',
  add column if not exists spam_score int not null default 0;

alter table public.posts
  add column if not exists media_items jsonb not null default '[]'::jsonb,
  add column if not exists moderation_status text not null default 'approved',
  add column if not exists spam_score int not null default 0;

create table if not exists public.sound_cards (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  track_url text not null,
  platform text not null default 'link',
  preview_url text,
  title text not null check (char_length(title) between 1 and 120),
  artist text not null check (char_length(artist) between 1 and 120),
  description text not null default '',
  cover_url text,
  genres text[] not null default '{}',
  main_genre text not null default 'Altro',
  subgenres text[] not null default '{}',
  collaborators text[] not null default '{}',
  tags text[] not null default '{}',
  map_x numeric,
  map_y numeric,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sound_card_views (
  sound_card_id uuid not null references public.sound_cards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sound_card_id, user_id)
);

create table if not exists public.admin_blocks (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Blocco admin',
  location text not null default 'forum_top',
  html text not null default '',
  css text not null default '',
  is_active boolean not null default true,
  sort_order int not null default 100,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists set_sound_cards_updated_at on public.sound_cards;
create trigger set_sound_cards_updated_at
before update on public.sound_cards
for each row execute function public.set_updated_at();

create or replace function public.is_forum_staff()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'moderator')
  );
$$;

create or replace function public.recalculate_user_group(user_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  viewed_count int;
  reply_count int;
  thread_count int;
  artist_flag boolean;
begin
  select count(*) into viewed_count from public.sound_card_views where user_id = user_id_input;
  select count(*) into reply_count from public.posts where author_id = user_id_input and moderation_status = 'approved';
  select count(*) into thread_count from public.threads where author_id = user_id_input and moderation_status = 'approved';
  select coalesce(is_artist, false) into artist_flag from public.profiles where id = user_id_input;

  update public.profiles
  set user_group = case
    when artist_flag then 'artist'
    when thread_count >= 50 then 'scrittore'
    when reply_count >= 20 then 'critico'
    when viewed_count >= 10 then 'ascoltatore'
    else 'visitatore'
  end
  where id = user_id_input;
end;
$$;

create or replace function public.recalculate_all_user_groups()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row record;
begin
  for row in select id from public.profiles loop
    perform public.recalculate_user_group(row.id);
  end loop;
end;
$$;

create or replace view public.thread_overview as
select
  t.id,
  t.category_id,
  c.name as category_name,
  c.slug as category_slug,
  c.icon as category_icon,
  t.author_id,
  p.display_name as author_name,
  p.avatar_url as author_avatar_url,
  p.role as author_role,
  p.user_group as author_user_group,
  p.is_artist as author_is_artist,
  t.title,
  t.body,
  t.media_items,
  t.tags,
  t.is_pinned,
  t.is_locked,
  t.is_deleted,
  t.view_count,
  t.created_at,
  t.updated_at,
  t.last_activity_at,
  count(po.id) filter (where po.is_deleted = false and po.moderation_status = 'approved') as reply_count
from public.threads t
join public.categories c on c.id = t.category_id
join public.profiles p on p.id = t.author_id
left join public.posts po on po.thread_id = t.id
where t.moderation_status = 'approved' or public.is_forum_staff()
group by t.id, c.id, p.id;

create or replace view public.post_overview as
select
  po.id,
  po.thread_id,
  po.author_id,
  p.display_name as author_name,
  p.avatar_url as author_avatar_url,
  p.role as author_role,
  p.user_group as author_user_group,
  p.is_artist as author_is_artist,
  po.body,
  po.media_items,
  po.is_deleted,
  po.created_at,
  po.updated_at
from public.posts po
join public.profiles p on p.id = po.author_id
where po.moderation_status = 'approved' or public.is_forum_staff();

create or replace view public.forum_stats as
select
  (select count(*) from public.profiles) as users_count,
  (select count(*) from public.threads where is_deleted = false and moderation_status = 'approved') as threads_count,
  (select count(*) from public.posts where is_deleted = false and moderation_status = 'approved') as posts_count,
  (select count(*) from public.threads where jsonb_array_length(media_items) > 0)
  + (select count(*) from public.posts where jsonb_array_length(media_items) > 0)
  + (select count(*) from public.sound_cards where is_hidden = false) as media_count;

create or replace view public.active_users as
select id, display_name, username, avatar_url, role, user_group, is_artist, last_seen_at, 0 as points
from public.profiles
where last_seen_at > now() - interval '15 minutes'
order by last_seen_at desc;

create or replace view public.category_overview as
select
  c.*,
  count(t.id) filter (where t.is_deleted = false and t.moderation_status = 'approved') as thread_count,
  count(p.id) filter (where p.is_deleted = false and p.moderation_status = 'approved') as post_count
from public.categories c
left join public.threads t on t.category_id = c.id
left join public.posts p on p.thread_id = t.id
group by c.id;

create or replace view public.popular_tags as
select tag, count(*) as usage_count
from (
  select unnest(tags) as tag from public.threads where moderation_status = 'approved'
  union all
  select unnest(tags) as tag from public.sound_cards where is_hidden = false
) x
where tag <> ''
group by tag
order by usage_count desc, tag asc;

create or replace view public.user_of_month as
select
  p.id,
  p.display_name,
  p.avatar_url,
  count(distinct t.id) as threads_count,
  count(distinct po.id) as posts_count,
  count(distinct t.id) * 5 + count(distinct po.id) * 2 as month_points
from public.profiles p
left join public.threads t on t.author_id = p.id and t.created_at >= date_trunc('month', now()) and t.moderation_status = 'approved'
left join public.posts po on po.author_id = p.id and po.created_at >= date_trunc('month', now()) and po.moderation_status = 'approved'
group by p.id
order by month_points desc, p.display_name asc;

alter table public.sound_cards enable row level security;
alter table public.sound_card_views enable row level security;
alter table public.admin_blocks enable row level security;
alter table public.site_settings enable row level security;
alter table public.notifications enable row level security;
alter table public.content_reports enable row level security;
alter table public.moderation_events enable row level security;

-- From this point, sensitive writes should go through the forum-api Edge Function.
-- The function uses the service role, validates the JWT, checks roles, logs moderation,
-- and writes sanitized payloads.
drop policy if exists "Logged users create threads" on public.threads;
drop policy if exists "Authors update own unlocked threads" on public.threads;
drop policy if exists "Admins update all threads" on public.threads;
drop policy if exists "Logged users create posts" on public.posts;
drop policy if exists "Authors update own posts" on public.posts;
drop policy if exists "Admins update all posts" on public.posts;
drop policy if exists "Admins manage categories" on public.categories;

drop policy if exists "Sound cards readable" on public.sound_cards;
create policy "Sound cards readable" on public.sound_cards for select using (is_hidden = false or public.is_forum_staff());

drop policy if exists "Own sound card views readable" on public.sound_card_views;
create policy "Own sound card views readable" on public.sound_card_views for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Active admin blocks readable" on public.admin_blocks;
create policy "Active admin blocks readable" on public.admin_blocks for select using (is_active = true or public.is_forum_staff());

drop policy if exists "Site settings readable" on public.site_settings;
create policy "Site settings readable" on public.site_settings for select using (true);

drop policy if exists "Own notifications readable" on public.notifications;
create policy "Own notifications readable" on public.notifications for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Reports insertable by users" on public.content_reports;
create policy "Reports insertable by users" on public.content_reports for insert to authenticated with check (auth.uid() = reporter_id);

drop policy if exists "Reports readable by staff" on public.content_reports;
create policy "Reports readable by staff" on public.content_reports for select to authenticated using (public.is_forum_staff());

drop policy if exists "Moderation events readable by staff" on public.moderation_events;
create policy "Moderation events readable by staff" on public.moderation_events for select to authenticated using (public.is_forum_staff());
