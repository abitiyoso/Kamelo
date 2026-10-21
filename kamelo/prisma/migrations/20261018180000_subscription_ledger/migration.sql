-- CreateTable
CREATE TABLE "SaaSBillingProfile" (
    "organizationId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "encryptedTaxId" TEXT,
    "reference" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaaSBillingProfile_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "SubscriptionInvoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "monthlyPrice" INTEGER NOT NULL,
    "months" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "due" TEXT NOT NULL,
    "billingSnapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "voidReason" TEXT NOT NULL DEFAULT '',
    "activatedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionEntry" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "receiptId" TEXT,
    "reversesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "kind" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionInvoice_number_key" ON "SubscriptionInvoice"("number");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_organizationId_createdAt_idx" ON "SubscriptionInvoice"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_organizationId_periodStart_periodEnd_idx" ON "SubscriptionInvoice"("organizationId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_status_due_idx" ON "SubscriptionInvoice"("status", "due");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionEntry_reversesId_key" ON "SubscriptionEntry"("reversesId");

-- CreateIndex
CREATE INDEX "SubscriptionEntry_invoiceId_createdAt_idx" ON "SubscriptionEntry"("invoiceId", "createdAt");

-- CreateIndex
CREATE INDEX "SubscriptionEntry_receiptId_idx" ON "SubscriptionEntry"("receiptId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionEntry_invoiceId_kind_reference_key" ON "SubscriptionEntry"("invoiceId", "kind", "reference");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_organizationId_createdAt_idx" ON "SubscriptionEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_invoiceId_idx" ON "SubscriptionEvent"("invoiceId");

-- AddForeignKey
ALTER TABLE "SaaSBillingProfile" ADD CONSTRAINT "SaaSBillingProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEntry" ADD CONSTRAINT "SubscriptionEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEntry" ADD CONSTRAINT "SubscriptionEntry_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "SubscriptionEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEntry" ADD CONSTRAINT "SubscriptionEntry_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "SubscriptionEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_amounts_check" CHECK ("months" BETWEEN 1 AND 12 AND "monthlyPrice" > 0 AND "total" = "monthlyPrice" * "months" AND "total" <= 1000000000);
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_period_check" CHECK ("periodEnd" > "periodStart");
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_status_check" CHECK ("status" IN ('ISSUED','VOID'));
ALTER TABLE "SubscriptionEntry" ADD CONSTRAINT "SubscriptionEntry_kind_check" CHECK (("kind" = 'RECEIPT' AND "delta" > 0 AND "receiptId" IS NULL AND "reversesId" IS NULL) OR ("kind" = 'REFUND' AND "delta" < 0 AND "receiptId" IS NOT NULL AND "reversesId" IS NULL) OR ("kind" = 'REVERSAL' AND "delta" <> 0 AND "reversesId" IS NOT NULL AND "receiptId" IS NULL));
CREATE TRIGGER "SubscriptionEntry_immutable" BEFORE UPDATE OR DELETE ON "SubscriptionEntry" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_lifecycle_history();
CREATE TRIGGER "SubscriptionEvent_immutable" BEFORE UPDATE OR DELETE ON "SubscriptionEvent" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_lifecycle_history();
CREATE TRIGGER "SubscriptionInvoice_no_delete" BEFORE DELETE ON "SubscriptionInvoice" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_lifecycle_history();
CREATE FUNCTION kamelo_preserve_subscription_invoice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."organizationId", NEW."number", NEW."plan", NEW."monthlyPrice", NEW."months", NEW."total", NEW."periodStart", NEW."periodEnd", NEW."due", NEW."billingSnapshot", NEW."createdBy", NEW."createdAt") IS DISTINCT FROM ROW(OLD."organizationId", OLD."number", OLD."plan", OLD."monthlyPrice", OLD."months", OLD."total", OLD."periodStart", OLD."periodEnd", OLD."due", OLD."billingSnapshot", OLD."createdBy", OLD."createdAt") THEN
    RAISE EXCEPTION 'Issued subscription invoice fields are immutable';
  END IF;
  IF (OLD.status = 'VOID' AND NEW IS DISTINCT FROM OLD) OR (OLD."activatedAt" IS NOT NULL AND NEW."activatedAt" IS DISTINCT FROM OLD."activatedAt") THEN RAISE EXCEPTION 'Closed subscription history cannot be rewritten'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "SubscriptionInvoice_preserve" BEFORE UPDATE ON "SubscriptionInvoice" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_subscription_invoice();

