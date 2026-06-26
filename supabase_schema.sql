-- ZEROUAN FORUM - SUPABASE SCHEMA
-- Incolla questo file in Supabase SQL Editor ed eseguilo una volta.
-- Non inserire mai service_role key o password database nel frontend.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 32),
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text not null default '',
  icon text not null default '💬',
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 4 and 120),
  body text not null check (char_length(body) between 2 and 6000),
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  is_deleted boolean not null default false,
  view_count int not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_threads_category on public.threads(category_id);
create index if not exists idx_threads_activity on public.threads(last_activity_at desc);
create index if not exists idx_posts_thread on public.posts(thread_id, created_at asc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_threads_updated_at on public.threads;
create trigger set_threads_updated_at
before update on public.threads
for each row execute function public.set_updated_at();

drop trigger if exists set_posts_updated_at on public.posts;
create trigger set_posts_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1), 'Utente')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.increment_thread_views(thread_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.threads
  set view_count = view_count + 1
  where id = thread_id_input and is_deleted = false;
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
  t.title,
  t.body,
  t.is_pinned,
  t.is_locked,
  t.is_deleted,
  t.view_count,
  t.created_at,
  t.updated_at,
  t.last_activity_at,
  count(po.id) filter (where po.is_deleted = false) as reply_count
from public.threads t
join public.categories c on c.id = t.category_id
join public.profiles p on p.id = t.author_id
left join public.posts po on po.thread_id = t.id
group by t.id, c.id, p.id;

create or replace view public.post_overview as
select
  po.id,
  po.thread_id,
  po.author_id,
  p.display_name as author_name,
  po.body,
  po.is_deleted,
  po.created_at,
  po.updated_at
from public.posts po
join public.profiles p on p.id = po.author_id;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.threads enable row level security;
alter table public.posts enable row level security;

-- Reset policies safely
DROP POLICY IF EXISTS "Profiles are readable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Categories are readable by everyone" ON public.categories;
DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
DROP POLICY IF EXISTS "Threads are readable by everyone" ON public.threads;
DROP POLICY IF EXISTS "Logged users create threads" ON public.threads;
DROP POLICY IF EXISTS "Authors update own unlocked threads" ON public.threads;
DROP POLICY IF EXISTS "Admins update all threads" ON public.threads;
DROP POLICY IF EXISTS "Posts are readable by everyone" ON public.posts;
DROP POLICY IF EXISTS "Logged users create posts" ON public.posts;
DROP POLICY IF EXISTS "Authors update own posts" ON public.posts;
DROP POLICY IF EXISTS "Admins update all posts" ON public.posts;

create policy "Profiles are readable by everyone"
on public.profiles for select
using (true);

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Categories are readable by everyone"
on public.categories for select
using (true);

create policy "Admins manage categories"
on public.categories for all
to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Threads are readable by everyone"
on public.threads for select
using (is_deleted = false or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')));

create policy "Logged users create threads"
on public.threads for insert
to authenticated
with check (auth.uid() = author_id);

create policy "Authors update own unlocked threads"
on public.threads for update
to authenticated
using (auth.uid() = author_id and is_locked = false)
with check (auth.uid() = author_id);

create policy "Admins update all threads"
on public.threads for update
to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')))
with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')));

create policy "Posts are readable by everyone"
on public.posts for select
using (is_deleted = false or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')));

create policy "Logged users create posts"
on public.posts for insert
to authenticated
with check (
  auth.uid() = author_id
  and exists (select 1 from public.threads where id = thread_id and is_locked = false and is_deleted = false)
);

create policy "Authors update own posts"
on public.posts for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "Admins update all posts"
on public.posts for update
to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')))
with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator')));

insert into public.categories (name, slug, description, icon, sort_order)
values
  ('Annunci', 'annunci', 'Comunicazioni ufficiali, aggiornamenti del sito e novità importanti.', '🔔', 10),
  ('Generale', 'generale', 'Discussioni generiche su Zerouan, community, idee e vita digitale.', '💬', 20),
  ('Sviluppo Web', 'sviluppo-web', 'HTML, CSS, JavaScript, Supabase, hosting, deploy e problemi tecnici.', '⌘', 30),
  ('Musica', 'musica', 'Produzione, promozione, testi, mix, release e progetti artistici.', '🎧', 40),
  ('Design', 'design', 'Grafica, UI, cover, canvas, branding e identità visiva.', '🎨', 50),
  ('AI & Automazione', 'ai-automazione', 'Tool AI, workflow, automazioni, prompt e sperimentazioni.', '🤖', 60),
  ('Off-topic', 'off-topic', 'Tutto ciò che non rientra nelle altre sezioni.', '🙂', 70)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  sort_order = excluded.sort_order;
