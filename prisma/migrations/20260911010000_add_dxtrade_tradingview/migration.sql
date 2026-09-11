-- Idempotent migration: safe to re-run.
-- Adds DXtrade and TradingView as selectable execution platforms, plus
-- PlatformAvailability rows (allowed, no fee) for every existing challenge
-- template so they're purchasable immediately.

INSERT INTO "TradingPlatform" ("id", "slug", "name", "tagline", "features", "badges", "active", "sortOrder", "createdAt", "updatedAt") VALUES
  ('platform-dxtrader', 'dxtrade', 'DXtrade', 'Modern multi-asset execution with a fast, customizable web terminal.', ARRAY['Advanced Order Types', 'Customizable Layout', 'Desktop + Mobile + Web'], ARRAY['WEB'], true, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('platform-tradingview', 'tradingview', 'TradingView', 'Best-in-class charting, connected directly to your account.', ARRAY['Advanced Charting', 'Community Scripts', 'Web + Mobile'], ARRAY['WEB', 'MOBILE'], true, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "PlatformAvailability" ("id", "templateId", "platformId", "allowed", "feeCents")
SELECT 'pa-' || t.id || '-' || p.id, t.id, p.id, true, 0
FROM "ChallengeTemplate" t
CROSS JOIN "TradingPlatform" p
WHERE p.id IN ('platform-dxtrader', 'platform-tradingview')
  AND NOT EXISTS (
    SELECT 1 FROM "PlatformAvailability" pa WHERE pa."templateId" = t.id AND pa."platformId" = p.id
  );
