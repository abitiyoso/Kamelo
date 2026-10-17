-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "billingAutomation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "operationsLastRunAt" TIMESTAMP(3);
