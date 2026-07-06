-- Migration 011: Friend federation - server-side friend_id triggers (clobber-proof)
--
-- The client-invoked link_my_friend_id() RPC (migration 010) copies the Friend
-- OIDC sub into app_metadata.friend_id AFTER login. That works, but it depends
-- on the client callback firing and it does not land friend_id in the FIRST
-- session JWT. More importantly, GoTrue REWRITES auth.users.raw_app_meta_data
-- with {provider, providers} AFTER creating the identity row, so any AFTER
-- trigger on auth.identities alone would be clobbered.
--
-- The durable fix (proven live on Locals, project dpumgcxpwfigtpotayjq, commit
-- f736ceb): a BEFORE INSERT/UPDATE trigger on auth.users that re-injects
-- friend_id from the user's custom:friend identity into NEW before the row is
-- written. It fires on the very GoTrue update that would clobber, so friend_id
-- survives AND is present in the first minted JWT. An AFTER trigger on
-- auth.identities seeds it on identity create/update. Both are idempotent.
--
-- The link_my_friend_id() RPC (010) remains as a client-side fallback; the
-- callback guard skips it once friend_id is already present (the common case
-- with these triggers). Recipe: friend-idp-federation-recipe-2026-07-04.md.

-- Seed: copy friend_id when the custom:friend identity is created/updated.
create or replace function public.friend_copy_friend_id()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  fid text;
begin
  if new.provider = 'custom:friend' then
    fid := coalesce(new.identity_data->>'sub', new.provider_id);
    if fid is not null and fid <> '' then
      update auth.users u
         set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
                                 || jsonb_build_object('friend_id', fid)
       where u.id = new.user_id
         and coalesce(u.raw_app_meta_data->>'friend_id', '') is distinct from fid;
    end if;
  end if;
  return new;
end;
$fn$;

drop trigger if exists friend_copy_friend_id_on_identity on auth.identities;
create trigger friend_copy_friend_id_on_identity
  after insert or update on auth.identities
  for each row execute function public.friend_copy_friend_id();

-- Durable: re-inject friend_id into NEW on every auth.users write, so GoTrue's
-- post-identity {provider,providers} rewrite cannot drop it and it lands in the
-- first JWT. BEFORE trigger mutates NEW in place (no recursion).
create or replace function public.friend_inject_friend_id()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  fid text;
begin
  select coalesce(i.identity_data->>'sub', i.provider_id)
    into fid
    from auth.identities i
   where i.user_id = new.id
     and i.provider = 'custom:friend'
   order by i.updated_at desc nulls last
   limit 1;
  if fid is not null and fid <> '' then
    new.raw_app_meta_data = coalesce(new.raw_app_meta_data, '{}'::jsonb)
                            || jsonb_build_object('friend_id', fid);
  end if;
  return new;
end;
$fn$;

drop trigger if exists friend_inject_friend_id_on_user on auth.users;
create trigger friend_inject_friend_id_on_user
  before insert or update on auth.users
  for each row execute function public.friend_inject_friend_id();
