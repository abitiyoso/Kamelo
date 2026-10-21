-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountStatus" TEXT NOT NULL DEFAULT 'LEGACY_ACTIVE',
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "contextType" TEXT NOT NULL DEFAULT 'ORG',
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "membershipId" TEXT,
ADD COLUMN     "occupantAccessId" TEXT,
ADD COLUMN     "userAgent" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "OrgMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "propertyIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "canRecordPayments" BOOLEAN NOT NULL DEFAULT false,
    "canControlDevices" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OrgMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccupantAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "canViewBilling" BOOLEAN NOT NULL DEFAULT true,
    "canControlDevices" BOOLEAN NOT NULL DEFAULT false,
    "includeAccess" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OccupantAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "propertyIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stayId" TEXT,
    "canRecordPayments" BOOLEAN NOT NULL DEFAULT false,
    "canControlDevices" BOOLEAN NOT NULL DEFAULT false,
    "includeAccess" BOOLEAN NOT NULL DEFAULT false,
    "tokenHash" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "template" TEXT NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgMembership_organizationId_status_idx" ON "OrgMembership"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMembership_userId_organizationId_key" ON "OrgMembership"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "OccupantAccess_stayId_status_idx" ON "OccupantAccess"("stayId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OccupantAccess_userId_stayId_key" ON "OccupantAccess"("userId", "stayId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityChallenge_tokenHash_key" ON "IdentityChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "IdentityChallenge_userId_purpose_createdAt_idx" ON "IdentityChallenge"("userId", "purpose", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_state_idx" ON "Invitation"("organizationId", "state");

-- CreateIndex
CREATE INDEX "Invitation_recipientEmail_state_idx" ON "Invitation"("recipientEmail", "state");

-- CreateIndex
CREATE UNIQUE INDEX "EmailOutbox_dedupeKey_key" ON "EmailOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "EmailOutbox_status_nextAttemptAt_idx" ON "EmailOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "EmailOutbox_userId_createdAt_idx" ON "EmailOutbox"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Session_userId_expires_idx" ON "Session"("userId", "expires");

-- AddForeignKey
ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccupantAccess" ADD CONSTRAINT "OccupantAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccupantAccess" ADD CONSTRAINT "OccupantAccess_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityChallenge" ADD CONSTRAINT "IdentityChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Compatibility backfill: preserve existing privileges, never assert email verification.
INSERT INTO "OrgMembership" (id,"userId","organizationId",role,status,"propertyIds","canRecordPayments","canControlDevices","createdAt")
SELECT 'legacy_' || md5(id), id, "organizationId", role, 'ACTIVE', "propertyIds", "canRecordPayments", "canControlDevices", CURRENT_TIMESTAMP
FROM "User" WHERE role IN ('OWNER','STAFF') ON CONFLICT ("userId","organizationId") DO NOTHING;
UPDATE "Session" s SET "membershipId"=m.id FROM "OrgMembership" m WHERE m."userId"=s."userId";
