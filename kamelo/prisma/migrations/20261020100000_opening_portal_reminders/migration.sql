CREATE TABLE "OpeningReminder" (
 "id" TEXT PRIMARY KEY,
 "receivableId" TEXT NOT NULL REFERENCES "OpeningReceivable"("id") ON DELETE RESTRICT,
 "shareId" TEXT NOT NULL REFERENCES "OpeningShare"("id") ON DELETE RESTRICT,
 "amount" INTEGER NOT NULL CHECK ("amount" BETWEEN 1 AND 1000000000),
 "due" TEXT NOT NULL,
 "reference" TEXT NOT NULL,
 "actorId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "OpeningReminder_receivableId_createdAt_id_idx" ON "OpeningReminder"("receivableId","createdAt","id");
CREATE INDEX "OpeningReminder_shareId_createdAt_id_idx" ON "OpeningReminder"("shareId","createdAt","id");
CREATE FUNCTION opening_reminder_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Reminder history is immutable'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM "OpeningReceivable" r JOIN "OpeningShare" s ON s."receivableId"=r.id
   JOIN "OccupantAccess" g ON g.id=s."grantId"
   JOIN "User" u ON u.id=s."userId"
   JOIN "Stay" t ON t.id=s."stayId" JOIN "Room" room ON room.id=t."roomId"
   WHERE r.id=NEW."receivableId" AND s.id=NEW."shareId" AND r.status='OPEN'
     AND s."revokedAt" IS NULL AND g.status='ACTIVE' AND g."revokedAt" IS NULL AND g."canViewBilling"
     AND g."userId"=s."userId" AND g."stayId"=s."stayId"
     AND t."guestId"=r."guestId" AND room."propertyId"=r."propertyId"
     AND u."emailVerifiedAt" IS NOT NULL AND u."accountStatus" NOT IN ('PENDING','SUSPENDED','CLOSED')
     AND NEW.amount=r.amount-COALESCE((SELECT SUM(e.delta) FROM "OpeningReceipt" e WHERE e."receivableId"=r.id),0)
     AND NEW.due=r.due AND NEW.reference=r.reference
 ) THEN RAISE EXCEPTION 'Reminder source or recipient changed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER opening_reminder_guard BEFORE INSERT OR UPDATE OR DELETE ON "OpeningReminder" FOR EACH ROW EXECUTE FUNCTION opening_reminder_guard();
