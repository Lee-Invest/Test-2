-- Idempotent migration: safe to re-run.
--
-- Fixes a real bug: TradingPlatform/Addon rows were seeded with an
-- auto-generated cuid as their id, but lib/static-platforms.ts and
-- lib/static-addons.ts (used by the pricing page to avoid a live DB round
-- trip) hardcode ids like 'platform-mt4' / 'addon-swap-free'. Since
-- /api/checkout looks these up by id, any purchase that selected a
-- platform or add-on would fail with "no longer available" even though it
-- looked selectable on the page. This re-points each row's id to match the
-- static files exactly; every foreign key referencing TradingPlatform.id /
-- Addon.id was created with ON UPDATE CASCADE, so this updates
-- PlatformAvailability, Order, Account, AddonAvailability, and OrderAddon
-- automatically.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('platform-mt4', 'mt4'),
    ('platform-mt5', 'mt5'),
    ('platform-ctrader', 'ctrader'),
    ('platform-match-trader', 'match-trader')
  ) AS t(new_id, slug)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM "TradingPlatform" WHERE id = r.new_id)
       AND EXISTS (SELECT 1 FROM "TradingPlatform" WHERE slug = r.slug) THEN
      UPDATE "TradingPlatform" SET id = r.new_id WHERE slug = r.slug;
    END IF;
  END LOOP;
END $$;

-- Retire the original 3 add-ons (kept, just deactivated, to preserve
-- history on any past order that referenced them) and seed the 4 new ones
-- with fixed ids. If the old rows still hold the exact ids the new set
-- needs (unlikely — they were auto-generated cuids), this would only ever
-- no-op via ON CONFLICT, never duplicate or crash.
UPDATE "Addon" SET active = false
WHERE slug IN ('priority-support', 'performance-analytics', 'reset-protection');

INSERT INTO "Addon" ("id", "slug", "name", "description", "priceCents", "billing", "active", "sortOrder", "createdAt", "updatedAt") VALUES
  ('addon-swap-free', 'swap-free', 'Swap Free Account', 'No overnight swap/rollover fees on any position — trade multi-day without the carry cost.', 1900, 'ONE_TIME', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('addon-biweekly-payout', 'biweekly-payout', 'Bi-Weekly Payout', 'Once funded, request a payout every two weeks instead of the standard cycle.', 2900, 'ONE_TIME', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('addon-weekly-payout', 'weekly-payout', 'Weekly Payout', 'Once funded, request a payout every week instead of the standard cycle.', 4900, 'ONE_TIME', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('addon-monthly-payout', 'monthly-payout', 'Monthly Payout', 'Once funded, request a payout once a month on a fixed schedule.', 1500, 'ONE_TIME', true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Enable every payment method, including crypto, per request.
UPDATE "PaymentMethod" SET enabled = true;
