-- Migration 012: Friend cross-app read - reverse-resolve a Friend sub to the
-- local Glovebox user.
--
-- The friend-context READ endpoint (roam-backend FastAPI POST /friend-context)
-- receives the person's canonical Ecodia Friend id (the custom:friend OIDC
-- `sub`) and must map it to their local Glovebox user id to read that person's
-- own trips + saved places. friend_id lives in
-- auth.users.raw_app_meta_data->>'friend_id' (populated by the migration
-- 010/011 federation triggers). auth.users is not exposed over PostgREST, so
-- this SECURITY DEFINER function is the reverse lookup, callable ONLY by the
-- service role the endpoint holds. Mirrors the security-definer shape of
-- link_my_friend_id() (migration 010). Idempotent + re-runnable.

create or replace function public.resolve_friend_user(p_friend_sub text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select u.id
    from auth.users u
   where p_friend_sub is not null
     and p_friend_sub <> ''
     and u.raw_app_meta_data->>'friend_id' = p_friend_sub
   order by u.created_at asc
   limit 1;
$$;

-- Only the service role (held by the server-to-server friend-context endpoint)
-- may run it. Never exposed to anon or authenticated browser sessions.
revoke all on function public.resolve_friend_user(text) from public, anon, authenticated;
grant execute on function public.resolve_friend_user(text) to service_role;

comment on function public.resolve_friend_user(text) is
  'Friend cross-app read: reverse-resolve a custom:friend OIDC sub to the local Glovebox user id via auth.users.raw_app_meta_data->>friend_id. Security definer, service_role only.';
