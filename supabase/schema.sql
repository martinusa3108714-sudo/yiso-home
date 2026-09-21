-- YISO INTERIOR CMS / Supabase schema
-- Run this entire file once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_en text not null default '',
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  project_type text not null check (project_type in ('BUILT', 'CONCEPT')),
  year text not null,
  location text not null default '',
  category text not null default '',
  short_description text not null default '',
  intro_title text not null default '',
  detail_description text not null default '',
  project_scope text not null default '',
  cover_image_url text not null,
  cover_storage_path text,
  cover_alt text not null default '',
  published boolean not null default false,
  is_home_featured boolean not null default false,
  home_order smallint check (home_order between 1 and 3),
  sort_order integer not null default 1000 check (sort_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_fields_consistent check (
    (is_home_featured and published and home_order is not null)
    or (not is_home_featured and home_order is null)
  )
);

create unique index if not exists projects_home_order_unique
  on public.projects(home_order)
  where is_home_featured;
create index if not exists projects_public_order_idx
  on public.projects(published, project_type, sort_order);

create table if not exists public.project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  image_url text not null,
  storage_path text,
  alt_text text not null default '',
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  sort_order integer not null default 1 check (sort_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, storage_path)
);

create index if not exists project_images_order_idx
  on public.project_images(project_id, sort_order);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings(key, value)
values ('cms_ready', 'false'::jsonb)
on conflict (key) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists project_images_set_updated_at on public.project_images;
create trigger project_images_set_updated_at
before update on public.project_images
for each row execute function public.set_updated_at();

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

create or replace function public.is_yiso_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

revoke all on function public.is_yiso_admin() from public;
grant execute on function public.is_yiso_admin() to anon, authenticated;

create or replace function public.enforce_home_featured_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  featured_count integer;
begin
  if new.is_home_featured then
    if not new.published then
      raise exception 'HOME featured projects must be published';
    end if;
    if new.home_order is null or new.home_order not between 1 and 3 then
      raise exception 'HOME order must be 1, 2, or 3';
    end if;
    select count(*) into featured_count
      from public.projects
      where is_home_featured and id <> new.id;
    if featured_count >= 3 then
      raise exception 'Only three HOME featured projects are allowed';
    end if;
  else
    new.home_order = null;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_home_featured_limit on public.projects;
create trigger projects_home_featured_limit
before insert or update on public.projects
for each row execute function public.enforce_home_featured_limit();

alter table public.admin_users enable row level security;
alter table public.projects enable row level security;
alter table public.project_images enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "admins can read own role" on public.admin_users;
create policy "admins can read own role"
on public.admin_users for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "public reads published projects" on public.projects;
create policy "public reads published projects"
on public.projects for select
to anon, authenticated
using (published or public.is_yiso_admin());

drop policy if exists "admins insert projects" on public.projects;
create policy "admins insert projects"
on public.projects for insert
to authenticated
with check (public.is_yiso_admin());

drop policy if exists "admins update projects" on public.projects;
create policy "admins update projects"
on public.projects for update
to authenticated
using (public.is_yiso_admin())
with check (public.is_yiso_admin());

drop policy if exists "admins delete projects" on public.projects;
create policy "admins delete projects"
on public.projects for delete
to authenticated
using (public.is_yiso_admin());

drop policy if exists "public reads published project images" on public.project_images;
create policy "public reads published project images"
on public.project_images for select
to anon, authenticated
using (
  public.is_yiso_admin()
  or exists (
    select 1 from public.projects
    where projects.id = project_images.project_id and projects.published
  )
);

drop policy if exists "admins insert project images" on public.project_images;
create policy "admins insert project images"
on public.project_images for insert
to authenticated
with check (public.is_yiso_admin());

drop policy if exists "admins update project images" on public.project_images;
create policy "admins update project images"
on public.project_images for update
to authenticated
using (public.is_yiso_admin())
with check (public.is_yiso_admin());

drop policy if exists "admins delete project images" on public.project_images;
create policy "admins delete project images"
on public.project_images for delete
to authenticated
using (public.is_yiso_admin());

drop policy if exists "public reads cms status" on public.site_settings;
create policy "public reads cms status"
on public.site_settings for select
to anon, authenticated
using (key = 'cms_ready' or public.is_yiso_admin());

drop policy if exists "admins insert settings" on public.site_settings;
create policy "admins insert settings"
on public.site_settings for insert
to authenticated
with check (public.is_yiso_admin());

drop policy if exists "admins update settings" on public.site_settings;
create policy "admins update settings"
on public.site_settings for update
to authenticated
using (public.is_yiso_admin())
with check (public.is_yiso_admin());

revoke all on public.admin_users, public.projects, public.project_images, public.site_settings from anon, authenticated;
grant select on public.projects, public.project_images, public.site_settings to anon;
grant select on public.admin_users, public.projects, public.project_images, public.site_settings to authenticated;
grant insert, update, delete on public.projects, public.project_images, public.site_settings to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('projects', 'projects', true, 12582912, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public reads project webp" on storage.objects;
create policy "public reads project webp"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'projects');

drop policy if exists "admins upload project webp" on storage.objects;
create policy "admins upload project webp"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'projects'
  and public.is_yiso_admin()
  and lower(storage.extension(name)) = 'webp'
);

drop policy if exists "admins update project webp" on storage.objects;
create policy "admins update project webp"
on storage.objects for update
to authenticated
using (bucket_id = 'projects' and public.is_yiso_admin())
with check (
  bucket_id = 'projects'
  and public.is_yiso_admin()
  and lower(storage.extension(name)) = 'webp'
);

drop policy if exists "admins delete project webp" on storage.objects;
create policy "admins delete project webp"
on storage.objects for delete
to authenticated
using (bucket_id = 'projects' and public.is_yiso_admin());

insert into public.admin_users(user_id)
values ('a38f37f4-f7a8-4769-9ced-59d5babc31a9')
on conflict (user_id) do nothing;
