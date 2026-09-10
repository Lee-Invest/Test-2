-- Idempotent migration: safe to re-run.

ALTER TABLE "TradingPlatform" ADD COLUMN IF NOT EXISTS "downloadUrl" TEXT;
ALTER TABLE "TradingPlatform" ADD COLUMN IF NOT EXISTS "webUrl" TEXT;
ALTER TABLE "TradingPlatform" ADD COLUMN IF NOT EXISTS "setupSteps" TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS "ChallengeProgram" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "phaseCount" INTEGER NOT NULL DEFAULT 2,
    "payoutModel" TEXT NOT NULL DEFAULT 'Profit split',
    "bestFor" TEXT NOT NULL DEFAULT '',
    "mostPopular" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChallengeProgram_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  CREATE UNIQUE INDEX "ChallengeProgram_slug_key" ON "ChallengeProgram"("slug");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "PaymentMethod" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  CREATE UNIQUE INDEX "PaymentMethod_key_key" ON "PaymentMethod"("key");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SavedConfiguration" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "platformId" TEXT,
    "programId" TEXT,
    "addonIds" TEXT[] NOT NULL DEFAULT '{}',
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedConfiguration_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  CREATE UNIQUE INDEX "SavedConfiguration_shareToken_key" ON "SavedConfiguration"("shareToken");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "SavedConfiguration_userId_idx" ON "SavedConfiguration"("userId");
DO $$ BEGIN
  ALTER TABLE "SavedConfiguration" ADD CONSTRAINT "SavedConfiguration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "MultiAccountDiscount" (
    "id" TEXT NOT NULL,
    "accountIndex" INTEGER NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "MultiAccountDiscount_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  CREATE UNIQUE INDEX "MultiAccountDiscount_accountIndex_key" ON "MultiAccountDiscount"("accountIndex");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "programId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ChallengeProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "programId" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "platformLogin" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "platformServerName" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "platformPasswordDisplay" TEXT;
DO $$ BEGIN
  ALTER TABLE "Account" ADD CONSTRAINT "Account_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ChallengeProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed data: the existing 2-Step behavior as a real program row, plus the
-- payment methods architecture with "card" pre-enabled (matches the
-- existing simulated checkout) and the rest present but disabled until an
-- admin turns them on.
INSERT INTO "ChallengeProgram" ("id", "name", "slug", "description", "phaseCount", "payoutModel", "bestFor", "mostPopular", "active", "sortOrder", "updatedAt")
VALUES ('program-2step', '2-Step Challenge', '2-step', 'Classic evaluation for traders who prefer a structured, two-phase path to a funded account.', 2, 'Profit split', 'Structured traders', true, true, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "PaymentMethod" ("id", "key", "label", "enabled", "sortOrder", "updatedAt") VALUES
  ('pm-card', 'card', 'Credit / Debit Card', true, 0, CURRENT_TIMESTAMP),
  ('pm-apple-pay', 'apple_pay', 'Apple Pay', false, 1, CURRENT_TIMESTAMP),
  ('pm-google-pay', 'google_pay', 'Google Pay', false, 2, CURRENT_TIMESTAMP),
  ('pm-paypal', 'paypal', 'PayPal', false, 3, CURRENT_TIMESTAMP),
  ('pm-crypto', 'crypto', 'Crypto', false, 4, CURRENT_TIMESTAMP),
  ('pm-bank-transfer', 'bank_transfer', 'Bank Transfer', false, 5, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "MultiAccountDiscount" ("id", "accountIndex", "discountPct", "active") VALUES
  ('mad-2', 2, 10.00, true),
  ('mad-3', 3, 15.00, true)
ON CONFLICT ("accountIndex") DO NOTHING;

-- Platform download/web access + "how to connect" steps, only filled in
-- where still empty (never overwrites an admin's own edits on a re-run).
UPDATE "TradingPlatform" SET
  "downloadUrl" = 'https://www.metatrader4.com/en/download',
  "webUrl" = 'https://www.metatrader4.com/en/trading-platform/web-trading-platform',
  "setupSteps" = ARRAY['Download and install MetaTrader 4', 'Choose "Login to an existing account"', 'Enter your Login ID, Password, and Server from your dashboard', 'Verify your account balance matches your dashboard']
WHERE "slug" = 'mt4' AND "downloadUrl" IS NULL;

UPDATE "TradingPlatform" SET
  "downloadUrl" = 'https://www.metatrader5.com/en/download',
  "webUrl" = 'https://www.metatrader5.com/en/trading-platform/web-trading-platform',
  "setupSteps" = ARRAY['Download and install MetaTrader 5', 'Choose "Login to an existing account"', 'Enter your Login ID, Password, and Server from your dashboard', 'Verify your account balance matches your dashboard']
WHERE "slug" = 'mt5' AND "downloadUrl" IS NULL;

UPDATE "TradingPlatform" SET
  "webUrl" = 'https://ctrader.com/webtrader/',
  "setupSteps" = ARRAY['Open cTrader (desktop, web, or mobile)', 'Choose "Add existing account"', 'Enter your Login ID, Password, and Server from your dashboard', 'Connect and verify your account balance']
WHERE "slug" = 'ctrader' AND "webUrl" IS NULL;

UPDATE "TradingPlatform" SET
  "webUrl" = 'https://match-trader.com/platform',
  "setupSteps" = ARRAY['Open Match-Trader in your browser', 'Log in with your Login ID and Password from your dashboard', 'Select your Server if prompted', 'Verify your account balance matches your dashboard']
WHERE "slug" = 'match-trader' AND "webUrl" IS NULL;
