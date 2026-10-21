-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "incurredOn" TEXT NOT NULL,
    "due" TEXT,
    "payee" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "voidReason" TEXT NOT NULL DEFAULT '',
    "voidedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseEntry" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "paymentId" TEXT,
    "reversesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceMatch" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "paymentId" TEXT,
    "expenseEntryId" TEXT,
    "statementReference" TEXT NOT NULL,
    "statementDate" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "revokeReason" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "FinanceMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_propertyId_incurredOn_idx" ON "Expense"("propertyId", "incurredOn");

-- CreateIndex
CREATE INDEX "Expense_propertyId_status_due_idx" ON "Expense"("propertyId", "status", "due");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseEntry_reversesId_key" ON "ExpenseEntry"("reversesId");

-- CreateIndex
CREATE INDEX "ExpenseEntry_expenseId_date_idx" ON "ExpenseEntry"("expenseId", "date");

-- CreateIndex
CREATE INDEX "ExpenseEntry_paymentId_idx" ON "ExpenseEntry"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseEntry_expenseId_kind_reference_key" ON "ExpenseEntry"("expenseId", "kind", "reference");

-- CreateIndex
CREATE INDEX "FinanceMatch_propertyId_createdAt_idx" ON "FinanceMatch"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceMatch_paymentId_idx" ON "FinanceMatch"("paymentId");

-- CreateIndex
CREATE INDEX "FinanceMatch_expenseEntryId_idx" ON "FinanceMatch"("expenseEntryId");

-- CreateIndex
CREATE INDEX "Invoice_propertyId_date_idx" ON "Invoice"("propertyId", "date");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_date_idx" ON "Payment"("invoiceId", "date");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "ExpenseEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "ExpenseEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceMatch" ADD CONSTRAINT "FinanceMatch_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceMatch" ADD CONSTRAINT "FinanceMatch_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceMatch" ADD CONSTRAINT "FinanceMatch_expenseEntryId_fkey" FOREIGN KEY ("expenseEntryId") REFERENCES "ExpenseEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_amount_state_check" CHECK ("amount" > 0 AND "amount" <= 1000000000 AND "status" IN ('OPEN','VOID') AND "category" IN ('UTILITY','MAINTENANCE','STAFF','OTHER'));
ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_kind_check" CHECK (("kind"='PAYMENT' AND "delta">0 AND "paymentId" IS NULL AND "reversesId" IS NULL) OR ("kind"='REFUND' AND "delta"<0 AND "paymentId" IS NOT NULL AND "reversesId" IS NULL) OR ("kind"='REVERSAL' AND "delta"<>0 AND "reversesId" IS NOT NULL AND "paymentId" IS NULL));
ALTER TABLE "FinanceMatch" ADD CONSTRAINT "FinanceMatch_source_check" CHECK ((("paymentId" IS NOT NULL)::int + ("expenseEntryId" IS NOT NULL)::int)=1 AND "amount">0);
CREATE UNIQUE INDEX "FinanceMatch_active_payment" ON "FinanceMatch"("paymentId") WHERE "revokedAt" IS NULL AND "paymentId" IS NOT NULL;
CREATE UNIQUE INDEX "FinanceMatch_active_expense_entry" ON "FinanceMatch"("expenseEntryId") WHERE "revokedAt" IS NULL AND "expenseEntryId" IS NOT NULL;
CREATE UNIQUE INDEX "FinanceMatch_active_statement" ON "FinanceMatch"("propertyId", lower("statementReference"), "statementDate") WHERE "revokedAt" IS NULL;
CREATE TRIGGER "ExpenseEntry_immutable" BEFORE UPDATE OR DELETE ON "ExpenseEntry" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_lifecycle_history();
CREATE TRIGGER "Expense_no_delete" BEFORE DELETE ON "Expense" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_lifecycle_history();
CREATE TRIGGER "FinanceMatch_no_delete" BEFORE DELETE ON "FinanceMatch" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_lifecycle_history();
CREATE FUNCTION kamelo_preserve_expense() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.id,NEW."propertyId",NEW.description,NEW.category,NEW.amount,NEW."incurredOn",NEW.due,NEW.payee,NEW.reference,NEW.note,NEW."createdBy",NEW."createdAt") IS DISTINCT FROM ROW(OLD.id,OLD."propertyId",OLD.description,OLD.category,OLD.amount,OLD."incurredOn",OLD.due,OLD.payee,OLD.reference,OLD.note,OLD."createdBy",OLD."createdAt") THEN RAISE EXCEPTION 'Expense source records are immutable'; END IF;
 IF OLD.status='VOID' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Voided expense history is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Expense_preserve" BEFORE UPDATE ON "Expense" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_expense();
CREATE FUNCTION kamelo_preserve_finance_match() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.id,NEW."propertyId",NEW."paymentId",NEW."expenseEntryId",NEW."statementReference",NEW."statementDate",NEW.amount,NEW.note,NEW."actorId",NEW."createdAt") IS DISTINCT FROM ROW(OLD.id,OLD."propertyId",OLD."paymentId",OLD."expenseEntryId",OLD."statementReference",OLD."statementDate",OLD.amount,OLD.note,OLD."actorId",OLD."createdAt") THEN RAISE EXCEPTION 'Manual reconciliation source is immutable'; END IF;
 IF OLD."revokedAt" IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Revoked reconciliation is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "FinanceMatch_preserve" BEFORE UPDATE ON "FinanceMatch" FOR EACH ROW EXECUTE FUNCTION kamelo_preserve_finance_match();

