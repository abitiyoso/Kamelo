-- AlterTable
ALTER TABLE "OpeningReceipt" ADD COLUMN     "refundOfId" TEXT;

-- CreateTable
CREATE TABLE "FinancialDocument" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "paymentId" TEXT,
    "openingReceiptId" TEXT,
    "number" TEXT NOT NULL,
    "encryptedSnapshot" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialDocumentReview" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "reviewOn" TEXT,
    "encryptedNote" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialDocumentReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialDocument_paymentId_key" ON "FinancialDocument"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialDocument_openingReceiptId_key" ON "FinancialDocument"("openingReceiptId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialDocument_number_key" ON "FinancialDocument"("number");

-- CreateIndex
CREATE INDEX "FinancialDocument_propertyId_issuedAt_id_idx" ON "FinancialDocument"("propertyId", "issuedAt", "id");

-- CreateIndex
CREATE INDEX "FinancialDocumentReview_action_reviewOn_idx" ON "FinancialDocumentReview"("action", "reviewOn");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialDocumentReview_documentId_revision_key" ON "FinancialDocumentReview"("documentId", "revision");

-- AddForeignKey
ALTER TABLE "FinancialDocument" ADD CONSTRAINT "FinancialDocument_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "FinancialDocument" ADD CONSTRAINT "FinancialDocument_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "FinancialDocument" ADD CONSTRAINT "FinancialDocument_openingReceiptId_fkey" FOREIGN KEY ("openingReceiptId") REFERENCES "OpeningReceipt"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "FinancialDocumentReview" ADD CONSTRAINT "FinancialDocumentReview_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FinancialDocument"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OpeningReceipt" ADD CONSTRAINT "OpeningReceipt_refundOfId_fkey" FOREIGN KEY ("refundOfId") REFERENCES "OpeningReceipt"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

DO $$ DECLARE c RECORD; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='"OpeningReceipt"'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%kind%' LOOP
  EXECUTE format('ALTER TABLE "OpeningReceipt" DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
ALTER TABLE "OpeningReceipt" ADD CONSTRAINT "OpeningReceipt_kind_shape" CHECK (
 (kind='RECEIPT' AND delta>0 AND "reversesId" IS NULL AND "refundOfId" IS NULL) OR
 (kind='REFUND' AND delta<0 AND "reversesId" IS NULL AND "refundOfId" IS NOT NULL) OR
 (kind='REVERSAL' AND "reversesId" IS NOT NULL AND "refundOfId" IS NULL));
CREATE INDEX "OpeningReceipt_refundOfId_idx" ON "OpeningReceipt"("refundOfId");
CREATE UNIQUE INDEX "OpeningReceipt_refund_reference" ON "OpeningReceipt"("receivableId",lower(btrim(reference))) WHERE kind='REFUND';
CREATE OR REPLACE FUNCTION "guard_opening_receipt"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r RECORD; original RECORD; paid BIGINT; refunded BIGINT;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Opening receipt history is immutable'; END IF;
 SELECT ar.*,b."asOf",b.status AS batch_status INTO r FROM "OpeningReceivable" ar JOIN "OpeningBalanceBatch" b ON b.id=ar."batchId" WHERE ar.id=NEW."receivableId" FOR UPDATE OF ar;
 IF r.id IS NULL OR r.status<>'OPEN' OR r.batch_status<>'OPEN' OR NEW.date<r."asOf" OR NEW.date>to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD') THEN RAISE EXCEPTION 'Opening source or date unavailable'; END IF;
 IF NEW.kind='REFUND' THEN
  SELECT * INTO original FROM "OpeningReceipt" WHERE id=NEW."refundOfId";
  IF original.id IS NULL OR original.kind<>'RECEIPT' OR original."receivableId"<>NEW."receivableId" OR NEW.date<original.date OR EXISTS(SELECT 1 FROM "OpeningReceipt" WHERE "reversesId"=original.id) THEN RAISE EXCEPTION 'Refund requires the exact active original receipt'; END IF;
  SELECT COALESCE(-SUM(f.delta),0) INTO refunded FROM "OpeningReceipt" f WHERE f."refundOfId"=original.id AND NOT EXISTS(SELECT 1 FROM "OpeningReceipt" rev WHERE rev."reversesId"=f.id);
  IF -NEW.delta>original.delta-refunded THEN RAISE EXCEPTION 'Refund exceeds original retained funds'; END IF;
 ELSIF NEW.kind='REVERSAL' THEN
  SELECT * INTO original FROM "OpeningReceipt" WHERE id=NEW."reversesId";
  IF original.id IS NULL OR original.kind NOT IN ('RECEIPT','REFUND') OR original."receivableId"<>NEW."receivableId" OR NEW.delta<>-original.delta OR NEW.date<>original.date OR NEW.method<>original.method OR NEW.reference<>original.reference THEN RAISE EXCEPTION 'Reversal must exactly offset the original entry'; END IF;
  IF EXISTS(SELECT 1 FROM "FinanceMatch" WHERE "openingReceiptId"=original.id AND "revokedAt" IS NULL) THEN RAISE EXCEPTION 'Revoke statement match before correcting entry'; END IF;
  IF original.kind='RECEIPT' AND EXISTS(SELECT 1 FROM "OpeningReceipt" f WHERE f."refundOfId"=original.id AND NOT EXISTS(SELECT 1 FROM "OpeningReceipt" rev WHERE rev."reversesId"=f.id)) THEN RAISE EXCEPTION 'Correct linked refunds first'; END IF;
 END IF;
 SELECT COALESCE(SUM(delta),0) INTO paid FROM "OpeningReceipt" WHERE "receivableId"=NEW."receivableId";
 IF paid+NEW.delta<0 OR paid+NEW.delta>r.amount THEN RAISE EXCEPTION 'Opening receipt exceeds source balance'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION "guard_opening_match"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry RECORD;
BEGIN
 IF TG_OP='UPDATE' AND NEW."openingReceiptId" IS DISTINCT FROM OLD."openingReceiptId" THEN RAISE EXCEPTION 'Opening match source is immutable'; END IF;
 IF TG_OP='INSERT' AND NEW."openingReceiptId" IS NOT NULL THEN
  SELECT e.*,r."propertyId" INTO entry FROM "OpeningReceipt" e JOIN "OpeningReceivable" r ON r.id=e."receivableId" WHERE e.id=NEW."openingReceiptId" FOR UPDATE OF r;
  IF entry.id IS NULL OR entry.kind NOT IN ('RECEIPT','REFUND') OR entry."propertyId"<>NEW."propertyId" OR abs(entry.delta)<>NEW.amount OR EXISTS(SELECT 1 FROM "OpeningReceipt" WHERE "reversesId"=entry.id) THEN RAISE EXCEPTION 'Opening match amount, source or state mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;
ALTER TABLE "FinancialDocument" ADD CONSTRAINT "FinancialDocument_shape" CHECK ((("paymentId" IS NOT NULL)::int+("openingReceiptId" IS NOT NULL)::int)=1 AND "snapshotHash" ~ '^[a-f0-9]{64}$' AND length("encryptedSnapshot")>0);
ALTER TABLE "FinancialDocumentReview" ADD CONSTRAINT "FinancialDocumentReview_shape" CHECK (revision>0 AND action IN ('KEEP','HOLD','REVIEW') AND (action<>'REVIEW' OR "reviewOn" IS NOT NULL) AND ("reviewOn" IS NULL OR ("reviewOn" ~ '^\d{4}-\d{2}-\d{2}$' AND "reviewOn"::date IS NOT NULL)));
CREATE FUNCTION financial_document_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE org text; entry RECORD;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Financial document audit history is immutable'; END IF;
 IF TG_TABLE_NAME='FinancialDocument' THEN
  SELECT "organizationId" INTO org FROM "Property" WHERE id=NEW."propertyId";
  IF NEW."paymentId" IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM "Payment" p JOIN "Invoice" i ON i.id=p."invoiceId" WHERE p.id=NEW."paymentId" AND i."propertyId"=NEW."propertyId" AND i.status NOT IN ('DRAFT','VOID')) THEN RAISE EXCEPTION 'Invalid payment document source'; END IF;
  ELSE
   IF NOT EXISTS(SELECT 1 FROM "OpeningReceipt" e JOIN "OpeningReceivable" r ON r.id=e."receivableId" WHERE e.id=NEW."openingReceiptId" AND r."propertyId"=NEW."propertyId" AND e.kind='RECEIPT' AND NOT EXISTS(SELECT 1 FROM "OpeningReceipt" rev WHERE rev."reversesId"=e.id)) THEN RAISE EXCEPTION 'Invalid opening document source'; END IF;
  END IF;
 ELSE
  SELECT p."organizationId" INTO org FROM "FinancialDocument" d JOIN "Property" p ON p.id=d."propertyId" WHERE d.id=NEW."documentId" FOR UPDATE OF d;
  IF NEW.revision<>COALESCE((SELECT MAX(revision) FROM "FinancialDocumentReview" WHERE "documentId"=NEW."documentId"),0)+1 THEN RAISE EXCEPTION 'Retention revision changed'; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM "OrgMembership" m JOIN "User" u ON u.id=m."userId" WHERE m."userId"=NEW."actorId" AND m."organizationId"=org AND m.role='OWNER' AND m.status='ACTIVE' AND m."revokedAt" IS NULL AND u."accountStatus" NOT IN ('PENDING','SUSPENDED','CLOSED')) THEN RAISE EXCEPTION 'Owner authority required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER financial_document_guard BEFORE INSERT OR UPDATE OR DELETE ON "FinancialDocument" FOR EACH ROW EXECUTE FUNCTION financial_document_guard();
CREATE TRIGGER financial_document_review_guard BEFORE INSERT OR UPDATE OR DELETE ON "FinancialDocumentReview" FOR EACH ROW EXECUTE FUNCTION financial_document_guard();

