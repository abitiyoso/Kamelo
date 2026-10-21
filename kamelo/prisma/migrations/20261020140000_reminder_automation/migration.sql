-- CreateTable
CREATE TABLE "ReminderPolicy" (
    "propertyId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "hour" INTEGER NOT NULL DEFAULT 9,
    "leadDays" INTEGER NOT NULL DEFAULT 0,
    "intervalDays" INTEGER NOT NULL DEFAULT 3,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "actorId" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderPolicy_pkey" PRIMARY KEY ("propertyId")
);

-- CreateTable
CREATE TABLE "ReminderDelivery" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "receivableId" TEXT,
    "shareId" TEXT,
    "grantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "scheduledOn" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "due" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "policyRevision" INTEGER NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "emailOutboxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReminderPolicy_enabled_propertyId_idx" ON "ReminderPolicy"("enabled", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderDelivery_dedupeKey_key" ON "ReminderDelivery"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderDelivery_emailOutboxId_key" ON "ReminderDelivery"("emailOutboxId");

-- CreateIndex
CREATE INDEX "ReminderDelivery_propertyId_createdAt_id_idx" ON "ReminderDelivery"("propertyId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ReminderDelivery_grantId_status_createdAt_id_idx" ON "ReminderDelivery"("grantId", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ReminderDelivery_invoiceId_channel_createdAt_idx" ON "ReminderDelivery"("invoiceId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "ReminderDelivery_receivableId_channel_createdAt_idx" ON "ReminderDelivery"("receivableId", "channel", "createdAt");

-- AddForeignKey
ALTER TABLE "ReminderPolicy" ADD CONSTRAINT "ReminderPolicy_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReminderPolicy" ADD CONSTRAINT "ReminderPolicy_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "OpeningReceivable"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "OpeningShare"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "OccupantAccess"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_emailOutboxId_fkey" FOREIGN KEY ("emailOutboxId") REFERENCES "EmailOutbox"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "ReminderPolicy" ADD CONSTRAINT "ReminderPolicy_bounds" CHECK (hour BETWEEN 0 AND 23 AND "leadDays" BETWEEN 0 AND 30 AND "intervalDays" BETWEEN 1 AND 30 AND revision>0);
ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_shape" CHECK (
  (("invoiceId" IS NOT NULL AND "receivableId" IS NULL AND "shareId" IS NULL) OR ("invoiceId" IS NULL AND "receivableId" IS NOT NULL AND "shareId" IS NOT NULL))
  AND amount BETWEEN 1 AND 1000000000 AND "policyRevision">0 AND "emailHash" ~ '^[a-f0-9]{64}$'
  AND "scheduledOn" ~ '^\d{4}-\d{2}-\d{2}$' AND due ~ '^\d{4}-\d{2}-\d{2}$'
  AND ((channel='PORTAL' AND status='PUBLISHED' AND "emailOutboxId" IS NULL AND reason='') OR (channel='EMAIL' AND "emailOutboxId" IS NOT NULL AND ((status='QUEUED' AND reason='') OR (status='CANCELLED' AND length(reason)>0))))
);
CREATE FUNCTION reminder_delivery_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_org text; v_stay text; v_guest text; v_property text; v_amount bigint; v_due text; v_reference text;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Reminder audit history cannot be deleted'; END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.channel='EMAIL' AND OLD.status='QUEUED' AND NEW.status='CANCELLED' AND length(NEW.reason)>0
      AND (to_jsonb(OLD)-'status'-'reason')=(to_jsonb(NEW)-'status'-'reason') THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Reminder snapshots are immutable';
  END IF;
  SELECT p."organizationId" INTO v_org FROM "ReminderPolicy" policy JOIN "Property" p ON p.id=policy."propertyId"
    JOIN "OrgMembership" m ON m."organizationId"=p."organizationId" AND m."userId"=policy."actorId" AND m.role='OWNER' AND m.status='ACTIVE' AND m."revokedAt" IS NULL
    JOIN "User" owner_user ON owner_user.id=m."userId" AND owner_user."accountStatus" NOT IN ('PENDING','SUSPENDED','CLOSED')
    WHERE policy."propertyId"=NEW."propertyId" AND policy.enabled AND policy.revision=NEW."policyRevision" AND (NEW.channel='PORTAL' OR policy."emailEnabled");
  IF v_org IS NULL THEN RAISE EXCEPTION 'Inactive reminder policy'; END IF;
  SELECT a."stayId",s."guestId",r."propertyId" INTO v_stay,v_guest,v_property FROM "OccupantAccess" a
    JOIN "Stay" s ON s.id=a."stayId" JOIN "Room" r ON r.id=s."roomId" JOIN "User" u ON u.id=a."userId"
    WHERE a.id=NEW."grantId" AND a."userId"=NEW."userId" AND a.status='ACTIVE' AND a."revokedAt" IS NULL AND a."canViewBilling"
      AND u."emailVerifiedAt" IS NOT NULL AND u."accountStatus" NOT IN ('PENDING','SUSPENDED','CLOSED');
  IF v_property IS DISTINCT FROM NEW."propertyId" THEN RAISE EXCEPTION 'Invalid reminder recipient'; END IF;
  IF NEW."invoiceId" IS NOT NULL THEN
    SELECT i.total-COALESCE((SELECT SUM(amount) FROM "Payment" WHERE "invoiceId"=i.id),0),i.due,i.number INTO v_amount,v_due,v_reference FROM "Invoice" i
      WHERE i.id=NEW."invoiceId" AND i."stayId"=v_stay AND i."guestId"=v_guest AND i."propertyId"=v_property AND i.status NOT IN ('DRAFT','VOID')
      AND NOT EXISTS(SELECT 1 FROM "PaymentProof" b WHERE b."invoiceId"=i.id AND b.status='PENDING');
  ELSE
    SELECT r.amount-COALESCE((SELECT SUM(delta) FROM "OpeningReceipt" WHERE "receivableId"=r.id),0),r.due,r.reference INTO v_amount,v_due,v_reference
      FROM "OpeningReceivable" r JOIN "OpeningBalanceBatch" b ON b.id=r."batchId" JOIN "OpeningShare" sh ON sh."receivableId"=r.id
      WHERE r.id=NEW."receivableId" AND r."guestId"=v_guest AND r."propertyId"=v_property AND r.status='OPEN' AND b.status='OPEN'
      AND sh.id=NEW."shareId" AND sh."grantId"=NEW."grantId" AND sh."userId"=NEW."userId" AND sh."stayId"=v_stay AND sh."revokedAt" IS NULL
      AND NOT EXISTS(SELECT 1 FROM "OpeningProof" proof WHERE proof."receivableId"=r.id AND proof.status='PENDING');
  END IF;
  IF v_amount IS DISTINCT FROM NEW.amount::bigint OR v_due IS DISTINCT FROM NEW.due OR v_reference IS DISTINCT FROM NEW.reference THEN RAISE EXCEPTION 'Reminder source changed'; END IF;
  IF NEW.channel='EMAIL' AND NOT EXISTS(SELECT 1 FROM "EmailOutbox" e WHERE e.id=NEW."emailOutboxId" AND e."userId"=NEW."userId" AND e."organizationId"=v_org AND e.template='payment_reminder' AND e."dedupeKey"=NEW."dedupeKey" AND e."expiresAt" IS NOT NULL) THEN RAISE EXCEPTION 'Invalid reminder outbox'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reminder_delivery_guard BEFORE INSERT OR UPDATE OR DELETE ON "ReminderDelivery" FOR EACH ROW EXECUTE FUNCTION reminder_delivery_guard();

