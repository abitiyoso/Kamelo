-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL,
    "consentReference" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interest" TEXT NOT NULL DEFAULT '',
    "roomId" TEXT,
    "requestedStart" TEXT,
    "requestedEnd" TEXT,
    "budget" INTEGER,
    "stage" TEXT NOT NULL DEFAULT 'NEW',
    "surveyAt" TIMESTAMP(3),
    "followUpAt" TIMESTAMP(3),
    "offerRent" INTEGER,
    "offerTerms" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "lossReason" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "convertedStayId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectActivity" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_convertedStayId_key" ON "Prospect"("convertedStayId");

-- CreateIndex
CREATE INDEX "Prospect_propertyId_stage_createdAt_idx" ON "Prospect"("propertyId", "stage", "createdAt");

-- CreateIndex
CREATE INDEX "Prospect_propertyId_followUpAt_idx" ON "Prospect"("propertyId", "followUpAt");

-- CreateIndex
CREATE INDEX "Prospect_roomId_idx" ON "Prospect"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "ProspectActivity_prospectId_revision_key" ON "ProspectActivity"("prospectId", "revision");

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_convertedStayId_fkey" FOREIGN KEY ("convertedStayId") REFERENCES "Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectActivity" ADD CONSTRAINT "ProspectActivity_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_stage_check" CHECK ("stage" IN ('NEW','SURVEY','OFFER','LOST','CONVERTED'));
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_conversion_check" CHECK (("stage" = 'CONVERTED') = ("convertedStayId" IS NOT NULL));
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_amount_check" CHECK (("budget" IS NULL OR "budget" BETWEEN 0 AND 1000000000) AND ("offerRent" IS NULL OR "offerRent" BETWEEN 0 AND 1000000000));
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_revision_check" CHECK ("revision" > 0);
ALTER TABLE "ProspectActivity" ADD CONSTRAINT "ProspectActivity_revision_check" CHECK ("revision" > 0);
CREATE TRIGGER "ProspectActivity_immutable" BEFORE UPDATE OR DELETE ON "ProspectActivity" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_lifecycle_history();

