-- Run after setup while signed out in the browser and again after an admin change.
-- These queries are read-only and help confirm counts/order in SQL Editor.

select
  count(*) as all_projects,
  count(*) filter (where published) as published_projects,
  count(*) filter (where project_type = 'BUILT') as built_projects,
  count(*) filter (where project_type = 'CONCEPT') as concept_projects,
  count(*) filter (where is_home_featured) as home_featured_projects
from public.projects;

select project_type, sort_order, slug, name, published, is_home_featured, home_order
from public.projects
order by sort_order, created_at;

select p.slug, p.name, count(i.id) as image_count,
       min(i.sort_order) as first_order, max(i.sort_order) as last_order
from public.projects p
left join public.project_images i on i.project_id = p.id
group by p.id, p.slug, p.name, p.sort_order
order by p.sort_order;

select key, value, updated_at
from public.site_settings
where key = 'cms_ready';

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'projects';
