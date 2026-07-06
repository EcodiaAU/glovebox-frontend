-- Migration 010: Friend IdP federation (One Ecodia)
--
-- Glovebox federates into the shared Ecodia consumer identity (Friend IdP,
-- project eionabtkzyjnipwfdsfy) via a custom OIDC provider (custom:friend).
-- Glovebox still mints its OWN local session on login, so auth.uid() keeps
-- returning the local user id and every existing RLS policy keeps working
-- unchanged (NO policy rewrite). Cross-app "one person" is achieved because
-- the local user is linked to the canonical Friend sub.
--
-- This RPC copies the Friend OIDC subject into the local user's
-- server-controlled app_metadata.friend_id on first federated login, so a
-- Glovebox user is resolvable to the canonical Friend person. The web app
-- calls it from the OAuth callback on the Friend path (see
-- src/app/(app)/auth/callback/page.tsx).
--
-- Recipe: backend/drafts/one-ecodia/friend-idp-federation-recipe-2026-07-04.md (sec 3+4).
-- Applied via the Supabase management query API (runs as the admin role, which
-- can update auth.users); tracked here for provenance. Idempotent + re-runnable.

create or replace function public.link_my_friend_id()
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_sub text;
begin
  if v_uid is null then
    return null;
  end if;

  -- Find this user's Friend OIDC identity. Match on the custom provider
  -- identifier OR the Friend issuer (belt and braces against the exact
  -- provider string Supabase stores for a custom OIDC identity).
  select i.identity_data->>'sub'
    into v_sub
    from auth.identities i
   where i.user_id = v_uid
     and (
       i.provider ilike '%friend%'
       or i.identity_data->>'iss' = 'https://eionabtkzyjnipwfdsfy.supabase.co/auth/v1'
     )
   order by i.created_at desc
   limit 1;

  if v_sub is null then
    return null;
  end if;

  -- Copy the canonical Friend id into server-controlled app_metadata.
  -- The is-distinct-from guard makes this idempotent and prevents any
  -- recursive-update churn once friend_id already matches.
  update auth.users u
     set raw_app_meta_data =
           coalesce(u.raw_app_meta_data, '{}'::jsonb)
           || jsonb_build_object('friend_id', v_sub)
   where u.id = v_uid
     and (u.raw_app_meta_data->>'friend_id') is distinct from v_sub;

  return v_sub;
end;
$$;

-- Only an authenticated caller may run it, and it only ever touches the
-- caller's OWN row (auth.uid()). Never exposed to anon.
revoke all on function public.link_my_friend_id() from public, anon;
grant execute on function public.link_my_friend_id() to authenticated;

comment on function public.link_my_friend_id() is
  'One Ecodia / Friend federation: copies the caller''s Friend OIDC sub into app_metadata.friend_id. Security definer, scoped to auth.uid() own row.';
