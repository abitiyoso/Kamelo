CREATE TABLE "OpeningShare" (
 id TEXT PRIMARY KEY,"receivableId" TEXT NOT NULL REFERENCES "OpeningReceivable"(id) ON DELETE RESTRICT,
 "grantId" TEXT NOT NULL REFERENCES "OccupantAccess"(id) ON DELETE RESTRICT,
 "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
 "stayId" TEXT NOT NULL REFERENCES "Stay"(id) ON DELETE RESTRICT,
 "actorId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "revokedAt" TIMESTAMP(3),"revokedBy" TEXT,
 CHECK (("revokedAt" IS NULL)=("revokedBy" IS NULL))
);
CREATE INDEX "OpeningShare_receivableId_createdAt_idx" ON "OpeningShare"("receivableId","createdAt");
CREATE INDEX "OpeningShare_grantId_userId_stayId_idx" ON "OpeningShare"("grantId","userId","stayId");
CREATE UNIQUE INDEX "OpeningShare_active_source" ON "OpeningShare"("receivableId") WHERE "revokedAt" IS NULL;
CREATE TABLE "OpeningProof" (
 id TEXT PRIMARY KEY,"receivableId" TEXT NOT NULL REFERENCES "OpeningReceivable"(id) ON DELETE RESTRICT,
 "shareId" TEXT NOT NULL REFERENCES "OpeningShare"(id) ON DELETE RESTRICT,
 "uploadedBy" TEXT NOT NULL,"requestKey" TEXT NOT NULL,"requestHash" TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 1000000000),
 date TEXT NOT NULL CHECK(date ~ '^\d{4}-\d{2}-\d{2}$' AND date>='1900-01-01' AND date::date IS NOT NULL),
 method TEXT NOT NULL CHECK(method IN ('TRANSFER','CASH','QRIS','OTHER')),
 reference TEXT NOT NULL CHECK(length(btrim(reference)) BETWEEN 3 AND 100),
 "encryptedTenantNote" TEXT NOT NULL,"storageKey" TEXT NOT NULL UNIQUE,"contentHash" TEXT NOT NULL,
 "mimeType" TEXT NOT NULL CHECK("mimeType" IN ('image/png','image/jpeg','image/webp','application/pdf')),
 "fileSize" INTEGER NOT NULL CHECK("fileSize" BETWEEN 1 AND 5242880),
 "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
 "encryptedReviewNote" TEXT,"reviewedAt" TIMESTAMP(3),"reviewedBy" TEXT,
 "receiptId" TEXT UNIQUE REFERENCES "OpeningReceipt"(id) ON DELETE RESTRICT,
 CHECK((status='PENDING' AND "encryptedReviewNote" IS NULL AND "reviewedAt" IS NULL AND "reviewedBy" IS NULL AND "receiptId" IS NULL) OR
 (status='REJECTED' AND "encryptedReviewNote" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "reviewedBy" IS NOT NULL AND "receiptId" IS NULL) OR
 (status='APPROVED' AND "encryptedReviewNote" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "reviewedBy" IS NOT NULL AND "receiptId" IS NOT NULL)),
 UNIQUE("uploadedBy","requestKey")
);
CREATE INDEX "OpeningProof_receivableId_status_uploadedAt_id_idx" ON "OpeningProof"("receivableId",status,"uploadedAt",id);
CREATE UNIQUE INDEX "OpeningProof_active_content" ON "OpeningProof"("receivableId","contentHash") WHERE status IN ('PENDING','APPROVED');
CREATE FUNCTION "guard_opening_share"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Sharing history cannot be deleted'; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD."revokedAt" IS NOT NULL OR NEW."revokedAt" IS NULL OR (to_jsonb(NEW)-'revokedAt'-'revokedBy') IS DISTINCT FROM (to_jsonb(OLD)-'revokedAt'-'revokedBy') THEN RAISE EXCEPTION 'Only one-way sharing revocation is allowed'; END IF;
 ELSE
  IF NEW."revokedAt" IS NOT NULL OR NOT EXISTS(SELECT 1 FROM "OpeningReceivable" r JOIN "OpeningBalanceBatch" b ON b.id=r."batchId" JOIN "OccupantAccess" g ON g.id=NEW."grantId" JOIN "Stay" s ON s.id=g."stayId" JOIN "Room" room ON room.id=s."roomId" WHERE r.id=NEW."receivableId" AND r.status='OPEN' AND b.status='OPEN' AND g."userId"=NEW."userId" AND g."stayId"=NEW."stayId" AND g.status='ACTIVE' AND g."revokedAt" IS NULL AND g."canViewBilling" AND s."guestId"=r."guestId" AND room."propertyId"=r."propertyId") THEN RAISE EXCEPTION 'Sharing recipient does not match source resident'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "OpeningShare_guard" BEFORE INSERT OR UPDATE OR DELETE ON "OpeningShare" FOR EACH ROW EXECUTE FUNCTION "guard_opening_share"();
CREATE FUNCTION "guard_opening_proof"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Proof history cannot be deleted'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'PENDING' OR NOT EXISTS(SELECT 1 FROM "OpeningShare" s WHERE s.id=NEW."shareId" AND s."receivableId"=NEW."receivableId" AND s."userId"=NEW."uploadedBy" AND s."revokedAt" IS NULL) THEN RAISE EXCEPTION 'Proof must start pending for its shared recipient'; END IF;
 ELSE
  IF OLD.status<>'PENDING' OR NEW.status NOT IN ('APPROVED','REJECTED') OR (to_jsonb(NEW)-'status'-'encryptedReviewNote'-'reviewedAt'-'reviewedBy'-'receiptId') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'encryptedReviewNote'-'reviewedAt'-'reviewedBy'-'receiptId') THEN RAISE EXCEPTION 'Only final proof review is allowed'; END IF;
  IF NEW.status='APPROVED' AND NOT EXISTS(SELECT 1 FROM "OpeningReceipt" r WHERE r.id=NEW."receiptId" AND r."receivableId"=NEW."receivableId" AND r.kind='RECEIPT' AND r.delta=NEW.amount AND r.date=NEW.date AND r.method=NEW.method AND r.reference=NEW.reference AND NOT EXISTS(SELECT 1 FROM "OpeningReceipt" rev WHERE rev."reversesId"=r.id)) THEN RAISE EXCEPTION 'Approved proof must link the exact active receipt'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "OpeningProof_guard" BEFORE INSERT OR UPDATE OR DELETE ON "OpeningProof" FOR EACH ROW EXECUTE FUNCTION "guard_opening_proof"();
CREATE FUNCTION "guard_opening_proof_source"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM "OpeningProof" WHERE "receivableId"=OLD.id) THEN RAISE EXCEPTION 'Source with proof history cannot be voided'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "OpeningReceivable_proof_history" BEFORE UPDATE ON "OpeningReceivable" FOR EACH ROW EXECUTE FUNCTION "guard_opening_proof_source"();
