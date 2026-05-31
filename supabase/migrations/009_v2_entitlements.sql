-- Migration: v2 tiered entitlements
--
-- v2 native rebuild ships duration-pass + lifetime IAP model (see
-- v2-billing-model-spec.md). The existing user_entitlements table is binary
-- (one row per user means "unlocked") and is kept for the v1 (Cap) clients
-- and as the grandfather source for legacy roam_unlimited buyers. This
-- migration adds the tiered substrate for v2 native clients.
--
-- Reads: app/services/entitlements.py via supabase service-role client.
-- Writes: app/services/entitlements.py from app/api/entitlement.py
--         (POST /entitlement/redeem) and from app/api/stripe.py
--         (POST /stripe/webhook) for the new SKUs.

-- ── entitlements (v2 tiered) ─────────────────────────────────────────────────

create table if not exists public.entitlements (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  tier             text not null check (tier in ('month', 'season', 'lifetime')),
  expires_at       timestamptz,  -- null for lifetime
  source_platform  text not null check (source_platform in ('ios', 'android', 'web')),
  product_id       text not null,  -- e.g. glovebox_pass_month, roam_unlimited
  transaction_id   text not null,  -- platform-stable purchase identifier
  granted_at       timestamptz not null default now(),
  raw_receipt      jsonb,           -- full verified payload for audit
  created_at       timestamptz not null default now()
);

-- Idempotency on (platform, transaction_id) — redeeming the same receipt
-- twice from a flaky client is a no-op. Composite because Apple, Google, and
-- Stripe transaction-id spaces are not globally unique.
create unique index if not exists entitlements_platform_txn_idx
  on public.entitlements (source_platform, transaction_id);

-- Hot path: "is this user entitled right now?" → (user_id, expires_at).
-- Lifetime rows sort to the top because expires_at is null and nulls sort
-- last under default DESC.
create index if not exists entitlements_user_expiry_idx
  on public.entitlements (user_id, expires_at desc nulls first);

alter table public.entitlements enable row level security;

drop policy if exists "Users can read own v2 entitlements" on public.entitlements;
create policy "Users can read own v2 entitlements"
  on public.entitlements for select
  using (auth.uid() = user_id);

-- Writes are server-only (service role bypasses RLS). No client-side insert/
-- update policies, on purpose.
