-- CreateTable
CREATE TABLE "SupportCase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportEntry" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "encryptedBody" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportCase_organizationId_updatedAt_idx" ON "SupportCase"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "SupportCase_status_updatedAt_idx" ON "SupportCase"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "SupportCase_assigneeId_idx" ON "SupportCase"("assigneeId");

-- CreateIndex
CREATE INDEX "SupportEntry_caseId_createdAt_idx" ON "SupportEntry"("caseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportEntry_caseId_revision_key" ON "SupportEntry"("caseId", "revision");

-- AddForeignKey
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportEntry" ADD CONSTRAINT "SupportEntry_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_values_check" CHECK ("revision">0 AND "priority" IN ('NORMAL','HIGH') AND "category" IN ('ACCOUNT','BILLING','OPERATIONS','INTEGRATION','OTHER') AND "status" IN ('OPEN','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED'));
ALTER TABLE "SupportEntry" ADD CONSTRAINT "SupportEntry_values_check" CHECK ("revision">0 AND "actorRole" IN ('OWNER','PLATFORM_ADMIN') AND "kind" IN ('CREATE','REPLY','CLAIM','STATUS','REOPEN') AND "status" IN ('OPEN','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED'));
CREATE TRIGGER "SupportEntry_immutable" BEFORE UPDATE OR DELETE ON "SupportEntry" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_lifecycle_history();
CREATE TRIGGER "SupportCase_no_delete" BEFORE DELETE ON "SupportCase" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_lifecycle_history();
CREATE FUNCTION kamelo_preserve_support_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.id,NEW."organizationId",NEW.subject,NEW.category,NEW.priority,NEW."createdBy",NEW."createdAt") IS DISTINCT FROM ROW(OLD.id,OLD."organizationId",OLD.subject,OLD.category,OLD.priority,OLD."createdBy",OLD."createdAt") THEN RAISE EXCEPTION 'Support source records are immutable'; END IF;
 IF NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Support revisions must advance once'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "SupportCase_preserve" BEFORE UPDATE ON "SupportCase" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_support_source();
