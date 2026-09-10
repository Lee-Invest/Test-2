-- CreateEnum
CREATE TYPE "AddonBilling" AS ENUM ('ONE_TIME', 'MONTHLY');

-- CreateTable
CREATE TABLE "Addon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "billing" "AddonBilling" NOT NULL DEFAULT 'ONE_TIME',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Addon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddonAvailability" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AddonAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAddon" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "priceCentsAtOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAddon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Addon_slug_key" ON "Addon"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AddonAvailability_templateId_addonId_key" ON "AddonAvailability"("templateId", "addonId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderAddon_orderId_addonId_key" ON "OrderAddon"("orderId", "addonId");

-- AddForeignKey
ALTER TABLE "AddonAvailability" ADD CONSTRAINT "AddonAvailability_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChallengeTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddonAvailability" ADD CONSTRAINT "AddonAvailability_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAddon" ADD CONSTRAINT "OrderAddon_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAddon" ADD CONSTRAINT "OrderAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
