-- CreateTable
CREATE TABLE "MessageThread" (
    "id" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "residentUserId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageEntry" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "encryptedBody" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageThread_assigneeId_updatedAt_idx" ON "MessageThread"("assigneeId", "updatedAt");

-- CreateIndex
CREATE INDEX "MessageThread_residentUserId_updatedAt_idx" ON "MessageThread"("residentUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "MessageThread_updatedAt_id_idx" ON "MessageThread"("updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "MessageThread_stayId_residentUserId_key" ON "MessageThread"("stayId", "residentUserId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageEntry_threadId_revision_key" ON "MessageEntry"("threadId", "revision");

-- AddForeignKey
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_residentUserId_fkey" FOREIGN KEY ("residentUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "OrgMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageEntry" ADD CONSTRAINT "MessageEntry_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_values_check" CHECK ("revision">=0 AND "status" IN ('OPEN','CLOSED'));
ALTER TABLE "MessageEntry" ADD CONSTRAINT "MessageEntry_values_check" CHECK ("revision">0 AND "kind" IN ('MESSAGE','ASSIGN','CLOSE','REOPEN') AND "actorRole" IN ('OWNER','STAFF','TENANT'));
CREATE TRIGGER "MessageEntry_immutable" BEFORE UPDATE OR DELETE ON "MessageEntry" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_lifecycle_history();
CREATE TRIGGER "MessageThread_no_delete" BEFORE DELETE ON "MessageThread" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_lifecycle_history();
CREATE FUNCTION kamelo_preserve_message_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.id,NEW."stayId",NEW."residentUserId",NEW."createdAt") IS DISTINCT FROM ROW(OLD.id,OLD."stayId",OLD."residentUserId",OLD."createdAt") THEN RAISE EXCEPTION 'Message thread source is immutable'; END IF;
 IF NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Message revisions must advance once'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "MessageThread_preserve" BEFORE UPDATE ON "MessageThread" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_message_source();
