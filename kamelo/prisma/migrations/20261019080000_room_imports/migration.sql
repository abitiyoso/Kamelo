CREATE TABLE "RoomImportBatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorId" TEXT NOT NULL,
  "roomCount" INTEGER NOT NULL CHECK ("roomCount" BETWEEN 1 AND 100),
  "roomSnapshots" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMMITTED' CHECK ("status" IN ('COMMITTED', 'ROLLED_BACK')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rolledBackAt" TIMESTAMP(3),
  "rolledBackBy" TEXT,
  CONSTRAINT "RoomImportBatch_rollback_state" CHECK (
    ("status" = 'COMMITTED' AND "rolledBackAt" IS NULL AND "rolledBackBy" IS NULL) OR
    ("status" = 'ROLLED_BACK' AND "rolledBackAt" IS NOT NULL AND "rolledBackBy" IS NOT NULL)
  )
);
CREATE INDEX "RoomImportBatch_propertyId_createdAt_id_idx" ON "RoomImportBatch"("propertyId", "createdAt", "id");
CREATE FUNCTION "protect_room_import_batch"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Import history cannot be deleted'; END IF;
  IF OLD."status" <> 'COMMITTED' OR NEW."status" <> 'ROLLED_BACK' OR
     (to_jsonb(NEW) - 'status' - 'rolledBackAt' - 'rolledBackBy') IS DISTINCT FROM
     (to_jsonb(OLD) - 'status' - 'rolledBackAt' - 'rolledBackBy') THEN
    RAISE EXCEPTION 'Only one-way import rollback is permitted';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "RoomImportBatch_immutable" BEFORE UPDATE OR DELETE ON "RoomImportBatch" FOR EACH ROW EXECUTE FUNCTION "protect_room_import_batch"();
