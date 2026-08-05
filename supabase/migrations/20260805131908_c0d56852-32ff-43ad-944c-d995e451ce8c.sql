create or replace function public.can_view_announcement_media(_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_announcements a
    where a.active
      and a.starts_at <= now()
      and (a.ends_at is null or a.ends_at > now())
      and (
        a.target_scope = 'all'
        or public.get_user_restaurant_id(auth.uid()) = any (a.target_restaurant_ids)
      )
      and (
        coalesce(a.media_url, '') like '%' || _name || '%'
        or coalesce(a.media_poster, '') like '%' || _name || '%'
        or coalesce(a.slides::text, '') like '%' || _name || '%'
      )
  )
$$;

drop policy if exists "platform_media_read_announcements" on storage.objects;

create policy "platform_media_read_announcements"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'platform-media'
  and name like 'announcements/%'
  and public.can_view_announcement_media(name)
);