-- Run once in the existing project's SQL editor. Original archives/photos stay untouched.
begin;
create table public.papershelf_blog_settings (
  id boolean primary key default true check (id),
  owner_id uuid not null references auth.users(id),
  topics text[] not null default '{}',
  version integer not null default 1 check (version > 0)
);
alter table public.papershelf_blog_settings enable row level security;
revoke all on public.papershelf_blog_settings from anon, authenticated;
grant select on public.papershelf_blog_settings to authenticated;
grant update(topics, version) on public.papershelf_blog_settings to authenticated;
create policy blog_settings_owner on public.papershelf_blog_settings for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create table public.papershelf_posts (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{1,200}$'),
  owner_id uuid not null references auth.users(id),
  entry jsonb not null,
  status text not null default 'draft' check (status in ('draft','published')),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(entry) = 'object'),
  check (entry ?& array['id','title','body','date','kind','topics','images','url']),
  check (entry->>'id' = id),
  check (length(entry->>'title') between 1 and 180),
  check (length(entry->>'body') <= 200000),
  check (jsonb_typeof(entry->'images') = 'array'),
  check (jsonb_typeof(entry->'topics') = 'array')
);
alter table public.papershelf_posts enable row level security;
revoke all on public.papershelf_posts from anon, authenticated;
grant select on public.papershelf_posts to anon, authenticated;
grant insert, update, delete on public.papershelf_posts to authenticated;
create index papershelf_posts_published on public.papershelf_posts(updated_at desc) where status = 'published';
create index papershelf_posts_owner on public.papershelf_posts(owner_id);
create policy blog_read_published on public.papershelf_posts for select to anon, authenticated using (status = 'published');
create policy blog_owner on public.papershelf_posts for all to authenticated
using (owner_id = (select auth.uid()) and exists (select 1 from public.papershelf_blog_settings where owner_id = (select auth.uid())))
with check (owner_id = (select auth.uid()) and exists (select 1 from public.papershelf_blog_settings where owner_id = (select auth.uid())));

-- SECURITY INVOKER: caller privileges and RLS remain in effect.
create function public.papershelf_blog_save(p_changes jsonb, p_topics text[] default null, p_topics_version integer default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare change jsonb; expected integer; affected integer;
begin
  if auth.uid() is null or not exists (select 1 from public.papershelf_blog_settings where owner_id = auth.uid()) then
    raise exception 'Only the blog owner can write' using errcode = '42501';
  end if;
  if jsonb_typeof(p_changes) <> 'array' then raise exception 'Invalid changes'; end if;
  if p_topics is not null then
    update public.papershelf_blog_settings set topics = p_topics, version = version + 1
      where owner_id = auth.uid() and version = p_topics_version;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Topic version conflict' using errcode = '40001'; end if;
  end if;
  -- Stable lock order for batch topic changes/imports.
  for change in select value from jsonb_array_elements(p_changes) order by value->>'id' loop
    expected := (change->>'expected_version')::integer;
    if coalesce((change->>'delete')::boolean, false) then
      delete from public.papershelf_posts where id = change->>'id' and owner_id = auth.uid() and version = expected;
    elsif expected = 0 then
      insert into public.papershelf_posts(id, owner_id, entry, status)
      values(change->>'id', auth.uid(), change->'entry', coalesce(change->>'status','draft')) on conflict (id) do nothing;
    else
      update public.papershelf_posts set entry = change->'entry', status = change->>'status', version = version + 1, updated_at = now()
      where id = change->>'id' and owner_id = auth.uid() and version = expected;
    end if;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Post version conflict' using errcode = '40001'; end if;
  end loop;
end $$;
revoke all on function public.papershelf_blog_save(jsonb,text[],integer) from public, anon;
grant execute on function public.papershelf_blog_save(jsonb,text[],integer) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('papershelf-blog-photos','papershelf-blog-photos',false,5242880,array['image/png','image/jpeg','image/webp','image/gif','image/avif']);
create policy blog_photo_owner_read on storage.objects for select to authenticated using (
  bucket_id = 'papershelf-blog-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.papershelf_blog_settings where owner_id = (select auth.uid()))
);
create policy blog_photo_owner_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'papershelf-blog-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.papershelf_blog_settings where owner_id = (select auth.uid()))
);
-- No UPDATE/DELETE photo policies: immutable blobs protect drafts on another device.
create policy blog_photo_published on storage.objects for select to anon, authenticated using (
  bucket_id = 'papershelf-blog-photos' and exists (
    select 1 from public.papershelf_posts p where p.status = 'published'
    and p.owner_id::text = split_part(name,'/',1)
    and p.entry->'images' @> jsonb_build_array(split_part(name,'/',2))
    and name = p.owner_id::text || '/' || split_part(name,'/',2)
  )
);
-- Bootstrap only a server-confirmed email chosen by the owner in the SQL editor.
-- Neither user_metadata nor an email supplied by the browser grants privileges.
create schema if not exists papershelf_private;
revoke all on schema papershelf_private from public, anon, authenticated;
create table papershelf_private.owner_bootstrap (
  id boolean primary key default true check(id),
  email text not null check (email = lower(email))
);
create function papershelf_private.claim_blog_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null and exists (
    select 1 from papershelf_private.owner_bootstrap where email = lower(new.email)
  ) then
    insert into public.papershelf_blog_settings(owner_id) values(new.id) on conflict(id) do nothing;
  end if;
  return new;
end $$;
revoke all on function papershelf_private.claim_blog_owner() from public, anon, authenticated;
create trigger papershelf_claim_blog_owner after insert or update of email, email_confirmed_at on auth.users
for each row execute function papershelf_private.claim_blog_owner();
commit;
-- Seed papershelf_private.owner_bootstrap(email) through the SQL editor, not the public client.
