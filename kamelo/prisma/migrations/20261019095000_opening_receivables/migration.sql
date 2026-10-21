CREATE TABLE "OpeningBalanceBatch" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "propertyId" TEXT NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "asOf" TEXT NOT NULL CHECK ("asOf" ~ '^\d{4}-\d{2}-\d{2}$' AND "asOf" >= '1900-01-01' AND "asOf"::date IS NOT NULL),
 "encryptedSourceNote" TEXT NOT NULL,
 "recordCount" INTEGER NOT NULL CHECK ("recordCount" BETWEEN 1 AND 50),
 "status" TEXT NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN','VOID')),
 "actorId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "voidedAt" TIMESTAMP(3), "voidedBy" TEXT, "encryptedVoidReason" TEXT,
 CONSTRAINT "OpeningBalanceBatch_void_state" CHECK (
  ("status"='OPEN' AND "voidedAt" IS NULL AND "voidedBy" IS NULL AND "encryptedVoidReason" IS NULL) OR
  ("status"='VOID' AND "voidedAt" IS NOT NULL AND "voidedBy" IS NOT NULL AND "encryptedVoidReason" IS NOT NULL))
);
CREATE INDEX "OpeningBalanceBatch_propertyId_createdAt_id_idx" ON "OpeningBalanceBatch"("propertyId","createdAt","id");
CREATE TABLE "OpeningReceivable" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "propertyId" TEXT NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "batchId" TEXT NOT NULL REFERENCES "OpeningBalanceBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "guestId" TEXT NOT NULL REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "reference" TEXT NOT NULL CHECK ("reference" ~ '^[A-Za-z0-9][A-Za-z0-9 ._:/#-]{2,99}$'),
 "sourceKey" TEXT NOT NULL CHECK ("sourceKey"=upper(regexp_replace(btrim("reference"),' +',' ','g'))),
 "amount" INTEGER NOT NULL CHECK ("amount" BETWEEN 1 AND 1000000000),
 "due" TEXT NOT NULL CHECK ("due" ~ '^\d{4}-\d{2}-\d{2}$' AND "due">='1900-01-01' AND "due"::date IS NOT NULL),
 "status" TEXT NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN','VOID')),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "OpeningReceivable_live_reference_key" ON "OpeningReceivable"("propertyId","sourceKey") WHERE "status"='OPEN';
CREATE INDEX "OpeningReceivable_propertyId_status_due_idx" ON "OpeningReceivable"("propertyId","status","due");
CREATE INDEX "OpeningReceivable_batchId_idx" ON "OpeningReceivable"("batchId");
CREATE INDEX "OpeningReceivable_guestId_idx" ON "OpeningReceivable"("guestId");
CREATE FUNCTION "protect_opening_history"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'OPEN' THEN RAISE EXCEPTION 'Opening history starts open'; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Opening balance history cannot be deleted'; END IF;
 IF TG_TABLE_NAME='OpeningBalanceBatch' THEN
  IF OLD.status<>'OPEN' OR NEW.status<>'VOID' OR
   (to_jsonb(NEW)-'status'-'voidedAt'-'voidedBy'-'encryptedVoidReason') IS DISTINCT FROM
   (to_jsonb(OLD)-'status'-'voidedAt'-'voidedBy'-'encryptedVoidReason') THEN
    RAISE EXCEPTION 'Only one-way opening batch void is allowed';
  END IF;
 ELSE
  IF OLD.status<>'OPEN' OR NEW.status<>'VOID' OR
   (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN
    RAISE EXCEPTION 'Opening source rows are immutable';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "OpeningBalanceBatch_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "OpeningBalanceBatch" FOR EACH ROW EXECUTE FUNCTION "protect_opening_history"();
CREATE TRIGGER "OpeningReceivable_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "OpeningReceivable" FOR EACH ROW EXECUTE FUNCTION "protect_opening_history"();
CREATE FUNCTION "check_opening_batch"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target TEXT; expected INTEGER; batch_state TEXT; property_id TEXT; actual INTEGER;
BEGIN
 IF TG_TABLE_NAME='OpeningBalanceBatch' THEN target := NEW.id; ELSE target := NEW."batchId"; END IF;
 SELECT "recordCount",status,"propertyId" INTO expected,batch_state,property_id FROM "OpeningBalanceBatch" WHERE id=target;
 SELECT COUNT(*) INTO actual FROM "OpeningReceivable" WHERE "batchId"=target;
 IF actual<>expected OR EXISTS(SELECT 1 FROM "OpeningReceivable" r JOIN "Guest" g ON g.id=r."guestId" WHERE r."batchId"=target AND (r.status<>batch_state OR r."propertyId"<>property_id OR g."propertyId"<>property_id)) THEN
  RAISE EXCEPTION 'Opening batch count, state or property scope mismatch';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "OpeningBalanceBatch_consistent" AFTER INSERT OR UPDATE ON "OpeningBalanceBatch" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "check_opening_batch"();
CREATE CONSTRAINT TRIGGER "OpeningReceivable_consistent" AFTER INSERT OR UPDATE ON "OpeningReceivable" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "check_opening_batch"();
