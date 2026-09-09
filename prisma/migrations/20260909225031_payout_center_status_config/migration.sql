-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PayoutStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "PayoutStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "PayoutStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "PayoutStatus" ADD VALUE 'AVAILABLE';

-- AlterTable
ALTER TABLE "ChallengeTemplate" ADD COLUMN     "minPayoutCents" INTEGER NOT NULL DEFAULT 3000,
ADD COLUMN     "payoutCycleDays" INTEGER NOT NULL DEFAULT 14;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "rejectionReason" TEXT;
