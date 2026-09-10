-- CreateTable
CREATE TABLE "TradingPlatform" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "features" TEXT[],
    "badges" TEXT[],
    "accessUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingPlatform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAvailability" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "unavailableReason" TEXT,

    CONSTRAINT "PlatformAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TradingPlatform_slug_key" ON "TradingPlatform"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAvailability_templateId_platformId_key" ON "PlatformAvailability"("templateId", "platformId");

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "platformId" TEXT,
ADD COLUMN     "platformFeeCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "platformId" TEXT;

-- AddForeignKey
ALTER TABLE "PlatformAvailability" ADD CONSTRAINT "PlatformAvailability_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChallengeTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformAvailability" ADD CONSTRAINT "PlatformAvailability_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "TradingPlatform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "TradingPlatform"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "TradingPlatform"("id") ON DELETE SET NULL ON UPDATE CASCADE;
