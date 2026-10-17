-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "planExpiresAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
