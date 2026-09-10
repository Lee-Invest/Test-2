-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "refundEligibleAt" TIMESTAMP(3),
ADD COLUMN     "refundedAt" TIMESTAMP(3);
