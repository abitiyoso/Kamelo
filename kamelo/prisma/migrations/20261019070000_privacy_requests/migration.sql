-- CreateTable
CREATE TABLE "PrivacyRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyEntry" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "encryptedBody" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrivacyRequest_requesterId_updatedAt_idx" ON "PrivacyRequest"("requesterId", "updatedAt");

-- CreateIndex
CREATE INDEX "PrivacyRequest_status_updatedAt_idx" ON "PrivacyRequest"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "PrivacyRequest_updatedAt_id_idx" ON "PrivacyRequest"("updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PrivacyEntry_requestId_revision_key" ON "PrivacyEntry"("requestId", "revision");

-- AddForeignKey
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacyEntry" ADD CONSTRAINT "PrivacyEntry_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PrivacyRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_values_check" CHECK ("revision">0 AND "kind" IN ('COPY','CORRECTION','DELETION','CLOSE_ACCOUNT') AND "status" IN ('SUBMITTED','IN_REVIEW','NEEDS_INFORMATION','RESPONDED','DECLINED','CANCELLED'));
ALTER TABLE "PrivacyEntry" ADD CONSTRAINT "PrivacyEntry_values_check" CHECK ("revision">0 AND "kind" IN ('CREATE','REPLY','REVIEW','REOPEN','CANCEL') AND "actorRole" IN ('ACCOUNT','PLATFORM_ADMIN') AND "status" IN ('SUBMITTED','IN_REVIEW','NEEDS_INFORMATION','RESPONDED','DECLINED','CANCELLED'));
CREATE UNIQUE INDEX "PrivacyRequest_one_open_kind" ON "PrivacyRequest"("requesterId","kind") WHERE "status" IN ('SUBMITTED','IN_REVIEW','NEEDS_INFORMATION');
CREATE TRIGGER "PrivacyEntry_immutable" BEFORE UPDATE OR DELETE ON "PrivacyEntry" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_lifecycle_history();
CREATE TRIGGER "PrivacyRequest_no_delete" BEFORE DELETE ON "PrivacyRequest" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_lifecycle_history();
CREATE FUNCTION kamelo_preserve_privacy_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.id,NEW."requesterId",NEW.kind,NEW."createdAt") IS DISTINCT FROM ROW(OLD.id,OLD."requesterId",OLD.kind,OLD."createdAt") THEN RAISE EXCEPTION 'Privacy request sources are immutable'; END IF;
 IF NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Privacy revisions must advance once'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "PrivacyRequest_preserve" BEFORE UPDATE ON "PrivacyRequest" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_privacy_source();
