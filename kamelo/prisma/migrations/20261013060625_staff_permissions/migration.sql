-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canControlDevices" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canRecordPayments" BOOLEAN NOT NULL DEFAULT false;
