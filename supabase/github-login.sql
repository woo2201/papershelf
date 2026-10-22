-- Apply after setup.sql. OAuth identities are written by Supabase Auth, not by clients.
begin;
alter table papershelf_private.owner_bootstrap add column github_id text check (github_id ~ '^[0-9]+$');
drop trigger papershelf_claim_blog_owner on auth.users;
drop function papershelf_private.claim_blog_owner();

create function papershelf_private.claim_github_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
declare existing_owner uuid;
begin
  if new.provider <> 'github' or not exists (
    select 1 from papershelf_private.owner_bootstrap where github_id = new.provider_id
  ) then return new; end if;

  select owner_id into existing_owner from public.papershelf_blog_settings where id = true for update;
  if existing_owner is null then
    insert into public.papershelf_blog_settings(owner_id) values(new.user_id) on conflict(id) do nothing;
  elsif existing_owner <> new.user_id then
    -- GitHub normally links to the existing user when the verified email matches.
    -- Only an empty blog may be rebound to a different Auth UUID. Existing content stays owned by its original account.
    if not exists(select 1 from public.papershelf_posts)
       and not exists(select 1 from storage.objects where bucket_id = 'papershelf-blog-photos') then
      update public.papershelf_blog_settings set owner_id = new.user_id where id = true;
    end if;
  end if;
  return new;
end $$;
revoke all on function papershelf_private.claim_github_owner() from public, anon, authenticated;
create trigger papershelf_claim_github_owner after insert or update of provider_id, provider, user_id on auth.identities
for each row execute function papershelf_private.claim_github_owner();
commit;
-- Set owner_bootstrap.github_id via SQL using the owner's verified GitHub numeric ID.
-- Do not derive authorization from auth.users.raw_user_meta_data or a browser-supplied username.
