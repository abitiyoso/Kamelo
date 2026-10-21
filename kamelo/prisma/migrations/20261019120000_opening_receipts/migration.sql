CREATE TABLE "OpeningReceipt" (
 "id" TEXT PRIMARY KEY,
 "receivableId" TEXT NOT NULL REFERENCES "OpeningReceivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "kind" TEXT NOT NULL CHECK (kind IN ('RECEIPT','REVERSAL')),
 "delta" INTEGER NOT NULL CHECK (delta BETWEEN -1000000000 AND 1000000000 AND delta<>0),
 "date" TEXT NOT NULL CHECK (date ~ '^\d{4}-\d{2}-\d{2}$' AND date>='1900-01-01' AND date::date IS NOT NULL),
 "method" TEXT NOT NULL CHECK (method IN ('TRANSFER','CASH','QRIS','OTHER')),
 "reference" TEXT NOT NULL CHECK (length(btrim(reference)) BETWEEN 3 AND 100),
 "encryptedNote" TEXT NOT NULL,
 "actorId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "reversesId" TEXT UNIQUE REFERENCES "OpeningReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CHECK ((kind='RECEIPT' AND delta>0 AND "reversesId" IS NULL) OR (kind='REVERSAL' AND delta<0 AND "reversesId" IS NOT NULL))
);
CREATE INDEX "OpeningReceipt_receivableId_createdAt_id_idx" ON "OpeningReceipt"("receivableId","createdAt",id);
CREATE INDEX "OpeningReceipt_date_idx" ON "OpeningReceipt"(date);
CREATE UNIQUE INDEX "OpeningReceipt_source_reference" ON "OpeningReceipt"("receivableId",lower(btrim(reference))) WHERE kind='RECEIPT';
CREATE FUNCTION "guard_opening_receipt"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r RECORD; original RECORD; paid BIGINT;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Opening receipt history is immutable'; END IF;
 SELECT ar.*,b."asOf",b.status AS batch_status INTO r FROM "OpeningReceivable" ar JOIN "OpeningBalanceBatch" b ON b.id=ar."batchId" WHERE ar.id=NEW."receivableId" FOR UPDATE OF ar;
 IF r.id IS NULL OR r.status<>'OPEN' OR r.batch_status<>'OPEN' OR NEW.date<r."asOf" THEN RAISE EXCEPTION 'Opening source or date unavailable'; END IF;
 IF NEW.kind='REVERSAL' THEN
  SELECT * INTO original FROM "OpeningReceipt" WHERE id=NEW."reversesId";
  IF original.id IS NULL OR original.kind<>'RECEIPT' OR original."receivableId"<>NEW."receivableId" OR NEW.delta<>-original.delta OR NEW.date<>original.date OR NEW.method<>original.method OR NEW.reference<>original.reference THEN RAISE EXCEPTION 'Reversal must exactly offset its original receipt'; END IF;
  IF EXISTS(SELECT 1 FROM "FinanceMatch" WHERE "openingReceiptId"=original.id AND "revokedAt" IS NULL) THEN RAISE EXCEPTION 'Revoke statement match before correcting receipt'; END IF;
 END IF;
 SELECT COALESCE(SUM(delta),0) INTO paid FROM "OpeningReceipt" WHERE "receivableId"=NEW."receivableId";
 IF paid+NEW.delta<0 OR paid+NEW.delta>r.amount THEN RAISE EXCEPTION 'Opening receipt exceeds source balance'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "OpeningReceipt_guard" BEFORE INSERT OR UPDATE OR DELETE ON "OpeningReceipt" FOR EACH ROW EXECUTE FUNCTION "guard_opening_receipt"();
CREATE FUNCTION "guard_opening_void_receipts"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM "OpeningReceipt" WHERE "receivableId"=OLD.id) THEN RAISE EXCEPTION 'Opening source with receipt history cannot be voided'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "OpeningReceivable_receipt_history" BEFORE UPDATE ON "OpeningReceivable" FOR EACH ROW EXECUTE FUNCTION "guard_opening_void_receipts"();
ALTER TABLE "FinanceMatch" ADD COLUMN "openingReceiptId" TEXT REFERENCES "OpeningReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceMatch" DROP CONSTRAINT "FinanceMatch_source_check";
ALTER TABLE "FinanceMatch" ADD CONSTRAINT "FinanceMatch_source_check" CHECK ((("paymentId" IS NOT NULL)::int + ("expenseEntryId" IS NOT NULL)::int + ("openingReceiptId" IS NOT NULL)::int)=1 AND amount>0);
CREATE INDEX "FinanceMatch_openingReceiptId_idx" ON "FinanceMatch"("openingReceiptId");
CREATE UNIQUE INDEX "FinanceMatch_active_opening_receipt" ON "FinanceMatch"("openingReceiptId") WHERE "revokedAt" IS NULL AND "openingReceiptId" IS NOT NULL;
CREATE FUNCTION "guard_opening_match"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry RECORD;
BEGIN
 IF TG_OP='UPDATE' AND NEW."openingReceiptId" IS DISTINCT FROM OLD."openingReceiptId" THEN RAISE EXCEPTION 'Opening match source is immutable'; END IF;
 IF TG_OP='INSERT' AND NEW."openingReceiptId" IS NOT NULL THEN
  SELECT e.*,r."propertyId" INTO entry FROM "OpeningReceipt" e JOIN "OpeningReceivable" r ON r.id=e."receivableId" WHERE e.id=NEW."openingReceiptId" FOR UPDATE OF r;
  IF entry.id IS NULL OR entry.kind<>'RECEIPT' OR entry."propertyId"<>NEW."propertyId" OR entry.delta<>NEW.amount OR EXISTS(SELECT 1 FROM "OpeningReceipt" WHERE "reversesId"=entry.id) THEN RAISE EXCEPTION 'Opening match amount, source or state mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "FinanceMatch_opening_guard" BEFORE INSERT OR UPDATE ON "FinanceMatch" FOR EACH ROW EXECUTE FUNCTION "guard_opening_match"();
