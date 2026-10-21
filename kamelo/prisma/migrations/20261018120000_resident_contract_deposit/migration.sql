-- CreateTable
CREATE TABLE "ResidentProfile" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "encryptedEmergencyContact" TEXT,
    "emergencyConsent" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResidentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractVersion" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "rent" INTEGER NOT NULL,
    "depositRequired" INTEGER NOT NULL,
    "terms" TEXT NOT NULL,
    "signatureReference" TEXT NOT NULL DEFAULT '',
    "snapshotHash" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositAccount" (
    "id" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepositAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reversesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepositEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositAdjustment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "inspectionNote" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepositAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomTransfer" (
    "id" TEXT NOT NULL,
    "fromStayId" TEXT NOT NULL,
    "toStayId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifecycleCommand" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LifecycleCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResidentProfile_guestId_key" ON "ResidentProfile"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_stayId_key" ON "Contract"("stayId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractVersion_contractId_revision_key" ON "ContractVersion"("contractId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "DepositAccount_stayId_key" ON "DepositAccount"("stayId");

-- CreateIndex
CREATE UNIQUE INDEX "DepositEntry_reversesId_key" ON "DepositEntry"("reversesId");

-- CreateIndex
CREATE INDEX "DepositEntry_accountId_createdAt_idx" ON "DepositEntry"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "DepositAdjustment_accountId_status_idx" ON "DepositAdjustment"("accountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RoomTransfer_toStayId_key" ON "RoomTransfer"("toStayId");

-- CreateIndex
CREATE INDEX "RoomTransfer_fromStayId_idx" ON "RoomTransfer"("fromStayId");

-- CreateIndex
CREATE UNIQUE INDEX "LifecycleCommand_organizationId_key_key" ON "LifecycleCommand"("organizationId", "key");

-- CreateIndex
CREATE INDEX "Guest_propertyId_idx" ON "Guest"("propertyId");

-- CreateIndex
CREATE INDEX "Stay_guestId_idx" ON "Stay"("guestId");

-- CreateIndex
CREATE INDEX "Invoice_guestId_idx" ON "Invoice"("guestId");

-- AddForeignKey
ALTER TABLE "ResidentProfile" ADD CONSTRAINT "ResidentProfile_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositAccount" ADD CONSTRAINT "DepositAccount_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositEntry" ADD CONSTRAINT "DepositEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "DepositAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositEntry" ADD CONSTRAINT "DepositEntry_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "DepositEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositAdjustment" ADD CONSTRAINT "DepositAdjustment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "DepositAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomTransfer" ADD CONSTRAINT "RoomTransfer_fromStayId_fkey" FOREIGN KEY ("fromStayId") REFERENCES "Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomTransfer" ADD CONSTRAINT "RoomTransfer_toStayId_fkey" FOREIGN KEY ("toStayId") REFERENCES "Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleCommand" ADD CONSTRAINT "LifecycleCommand_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Financial and agreement histories are append-only, including at the database boundary.
ALTER TABLE "DepositEntry" ADD CONSTRAINT "DepositEntry_nonzero_delta" CHECK (delta <> 0),
 ADD CONSTRAINT "DepositEntry_valid_kind" CHECK (kind IN ('RECEIPT','REFUND','DEDUCTION','REVERSAL','TRANSFER_IN','TRANSFER_OUT'));
ALTER TABLE "DepositAdjustment" ADD CONSTRAINT "DepositAdjustment_positive_amount" CHECK (amount > 0);
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_nonnegative_amounts" CHECK (rent >= 0 AND "depositRequired" >= 0),
 ADD CONSTRAINT "ContractVersion_dates" CHECK ("end" > start);
CREATE FUNCTION kamelo_preserve_lifecycle_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Lifecycle history is append-only; record a new version or reversal'; END $$;
CREATE TRIGGER "ContractVersion_immutable" BEFORE UPDATE OR DELETE ON "ContractVersion" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_lifecycle_history();
CREATE TRIGGER "DepositEntry_immutable" BEFORE UPDATE OR DELETE ON "DepositEntry" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_lifecycle_history();
