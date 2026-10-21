import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { verified } from "./identity";
import { lifecycleDate, lifecycleAudit } from "./lifecycle";
import { encryptSecret, decryptSecret } from "./secrets";
import { localToday } from "./operations";
import { openingReceiptWrite } from "./opening-receipts";
import { stableHash } from "./lifecycle-rules.mjs";
import { tenantOpeningReminders } from "./opening-reminders";
type Tx = Prisma.TransactionClient;
export async function openingTenantActor(tx: Tx, token: string) {
  const s = await tx.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (
    !s ||
    s.expires <= new Date() ||
    s.contextType !== "STAY" ||
    !s.occupantAccessId ||
    !verified(s.user)
  )
    throw Error("Akses saldo awal tidak tersedia.");
  const grant = await tx.occupantAccess.findFirst({
    where: {
      id: s.occupantAccessId,
      userId: s.userId,
      status: "ACTIVE",
      revokedAt: null,
      canViewBilling: true,
    },
    include: { stay: { include: { room: { include: { property: true } } } } },
  });
  if (!grant) throw Error("Akses saldo awal tidak tersedia.");
  return {
    userId: s.userId,
    grant,
    organizationId: grant.stay.room.property.organizationId,
  };
}
type Actor = Awaited<ReturnType<typeof openingTenantActor>>;
const shareWhere = (a: Actor) => ({
  grantId: a.grant.id,
  userId: a.userId,
  stayId: a.grant.stayId,
  revokedAt: null,
});
export async function tenantOpeningSource(tx: Tx, a: Actor, id: string) {
  const share = await tx.openingShare.findFirst({
    where: { ...shareWhere(a), receivableId: id },
    include: { receivable: { include: { batch: true } } },
  });
  if (
    !share ||
    share.receivable.guestId !== a.grant.stay.guestId ||
    share.receivable.propertyId !== a.grant.stay.room.propertyId
  )
    throw Error("Saldo awal tidak tersedia.");
  return share;
}
const proofSelect = {
  id: true,
  amount: true,
  date: true,
  method: true,
  reference: true,
  status: true,
  encryptedTenantNote: true,
  encryptedReviewNote: true,
  uploadedAt: true,
  reviewedAt: true,
  receipt: { select: { reversal: { select: { id: true } } } },
} as const;
const publicProof = (p: any) => {
  const { encryptedTenantNote, encryptedReviewNote, receipt, ...safe } = p;
  return {
    ...safe,
    tenantNote: decryptSecret(encryptedTenantNote),
    reviewNote: encryptedReviewNote ? decryptSecret(encryptedReviewNote) : "",
    receiptCorrected: Boolean(receipt?.reversal),
  };
};
export async function tenantOpeningRead(
  tx: Tx,
  a: Actor,
  id: string | null,
  page: number,
  reminderPage = 1,
) {
  if (id) {
    const s = await tenantOpeningSource(tx, a, id),
      r = s.receivable,
      paid =
        (
          await tx.openingReceipt.aggregate({
            where: { receivableId: id },
            _sum: { delta: true },
          })
        )._sum.delta || 0;
    const where = { receivableId: id, uploadedBy: a.userId };
    return {
      detail: {
        id: r.id,
        reference: r.reference,
        amount: r.amount,
        due: r.due,
        asOf: r.batch.asOf,
        status: r.status,
        paid,
        remaining: r.status === "VOID" ? 0 : r.amount - paid,
        reminders: await tenantOpeningReminders(tx, s.id, reminderPage),
        proofs: (
          await tx.openingProof.findMany({
            where,
            select: proofSelect,
            orderBy: [{ uploadedAt: "desc" }, { id: "desc" }],
            take: 20,
            skip: (page - 1) * 20,
          })
        ).map(publicProof),
        totalProofs: await tx.openingProof.count({ where }),
        page,
      },
    };
  }
  const where = shareWhere(a),
    shares = await tx.openingShare.findMany({
      where,
      select: {
        receivable: {
          select: {
            id: true,
            guestId: true,
            propertyId: true,
            reference: true,
            amount: true,
            due: true,
            status: true,
            batch: { select: { asOf: true } },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      skip: (page - 1) * 20,
    }),
    ids = shares.map((s) => s.receivable.id);
  const payments = await tx.openingReceipt.groupBy({
    by: ["receivableId"],
    where: { receivableId: { in: ids } },
    _sum: { delta: true },
  });
  return {
    rows: shares
      .filter(
        (s) =>
          s.receivable.guestId === a.grant.stay.guestId &&
          s.receivable.propertyId === a.grant.stay.room.propertyId,
      )
      .map(({ receivable: r }) => ({
        id: r.id,
        reference: r.reference,
        amount: r.amount,
        due: r.due,
        asOf: r.batch.asOf,
        status: r.status,
        remaining:
          r.status === "VOID"
            ? 0
            : r.amount -
              (payments.find((p) => p.receivableId === r.id)?._sum.delta || 0),
      })),
    page,
    total: await tx.openingShare.count({ where }),
  };
}
export async function ownerOpeningEvidence(
  tx: Tx,
  ids: string[],
  id: string,
  page: number,
  proofId: string | null,
) {
  const row = await tx.openingReceivable.findFirst({
    where: { id, propertyId: { in: ids } },
  });
  if (!row) throw Error("Saldo tidak ditemukan.");
  const candidates = await tx.occupantAccess.findMany({
    where: {
      status: "ACTIVE",
      revokedAt: null,
      canViewBilling: true,
      stay: { guestId: row.guestId, room: { propertyId: row.propertyId } },
      user: {
        emailVerifiedAt: { not: null },
        accountStatus: { notIn: ["PENDING", "SUSPENDED", "CLOSED"] },
      },
    },
    select: {
      id: true,
      user: { select: { name: true, email: true } },
      stay: { select: { start: true, room: { select: { number: true } } } },
    },
    orderBy: { id: "asc" },
    take: 21,
  });
  const active = await tx.openingShare.findFirst({
    where: { receivableId: id, revokedAt: null },
  });
  const target = active
    ? await tx.user.findUnique({
        where: { id: active.userId },
        select: { name: true, email: true },
      })
    : null;
  const where = { receivableId: id };
  const proofs = (
    await tx.openingProof.findMany({
      where,
      select: proofSelect,
      orderBy: [{ uploadedAt: "desc" }, { id: "desc" }],
      take: 20,
      skip: (page - 1) * 20,
    })
  ).map(publicProof);
  let review = null;
  if (proofId) {
    const p = await tx.openingProof.findFirst({
      where: { id: proofId, receivableId: id },
      select: proofSelect,
    });
    if (!p) throw Error("Bukti tidak ditemukan.");
    const receipts = await tx.openingReceipt.findMany({
      where: {
        receivableId: id,
        kind: "RECEIPT",
        delta: p.amount,
        date: p.date,
        method: p.method,
        reference: p.reference,
        reversal: null,
        proof: null,
      },
      select: { id: true, reference: true, date: true, delta: true },
      take: 21,
      orderBy: { id: "asc" },
    });
    review = { ...publicProof(p), matchingReceipts: receipts.slice(0, 20) };
  }
  return {
    active: active ? { id: active.id, target } : null,
    candidates: candidates.slice(0, 20),
    tooManyCandidates: candidates.length > 20,
    proofs,
    page,
    totalProofs: await tx.openingProof.count({ where }),
    review,
  };
}
export async function openingEvidenceWrite(
  tx: Tx,
  a: { organizationId: string; userId: string },
  body: Record<string, unknown>,
) {
  if (body.confirmed !== true)
    throw Error("Konfirmasi keputusan terlebih dahulu.");
  const id = z.string().min(1).max(100).parse(body.receivableId),
    row = await tx.openingReceivable.findFirst({
      where: { id, property: { organizationId: a.organizationId } },
    });
  if (!row) throw Error("Saldo tidak ditemukan.");
  if (body.action === "shareOpening") {
    const g = await tx.occupantAccess.findFirst({
      where: {
        id: z.string().min(1).max(100).parse(body.grantId),
        status: "ACTIVE",
        revokedAt: null,
        canViewBilling: true,
        stay: { guestId: row.guestId, room: { propertyId: row.propertyId } },
        user: {
          emailVerifiedAt: { not: null },
          accountStatus: { notIn: ["PENDING", "SUSPENDED", "CLOSED"] },
        },
      },
    });
    if (!g || row.status !== "OPEN")
      throw Error("Akun penghuni tidak sesuai atau belum siap menerima saldo.");
    if (
      await tx.openingShare.count({
        where: { receivableId: id, revokedAt: null },
      })
    )
      throw Error("Cabut pembagian aktif sebelum memilih akun lain.");
    const s = await tx.openingShare.create({
      data: {
        receivableId: id,
        grantId: g.id,
        userId: g.userId,
        stayId: g.stayId,
        actorId: a.userId,
      },
    });
    await lifecycleAudit(
      tx,
      a.organizationId,
      a.userId,
      "OPENING_SHARED",
      s.id,
      { receivableId: id },
    );
    return { id: s.id };
  }
  if (body.action === "revokeOpening") {
    const s = await tx.openingShare.findFirst({
      where: {
        id: z.string().parse(body.shareId),
        receivableId: id,
        revokedAt: null,
      },
    });
    if (!s) throw Error("Pembagian sudah dicabut.");
    await tx.openingShare.update({
      where: { id: s.id },
      data: { revokedAt: new Date(), revokedBy: a.userId },
    });
    await lifecycleAudit(
      tx,
      a.organizationId,
      a.userId,
      "OPENING_SHARE_REVOKED",
      s.id,
      { receivableId: id },
    );
    return { id: s.id };
  }
  const p = await tx.openingProof.findFirst({
    where: {
      id: z.string().parse(body.proofId),
      receivableId: id,
      status: "PENDING",
    },
  });
  if (!p) throw Error("Bukti tidak ditemukan atau sudah diperiksa.");
  const decision = z.enum(["APPROVED", "REJECTED"]).parse(body.decision),
    note = z.string().trim().min(10).max(1000).parse(body.note);
  let receiptId: string | null = null;
  if (decision === "APPROVED") {
    if (body.existingReceiptId) {
      const receipt = await tx.openingReceipt.findFirst({
        where: {
          id: z.string().parse(body.existingReceiptId),
          receivableId: id,
          kind: "RECEIPT",
          delta: p.amount,
          date: p.date,
          method: p.method,
          reference: p.reference,
          reversal: null,
          proof: null,
        },
      });
      if (!receipt)
        throw Error(
          "Penerimaan tidak cocok dengan bukti atau sudah ditautkan.",
        );
      receiptId = receipt.id;
    } else
      receiptId = (
        await openingReceiptWrite(tx, a, {
          action: "receipt",
          receivableId: id,
          amount: p.amount,
          date: p.date,
          method: p.method,
          reference: p.reference,
          note,
          confirmed: true,
        })
      ).id;
  }
  await tx.openingProof.update({
    where: { id: p.id },
    data: {
      status: decision,
      encryptedReviewNote: encryptSecret(note),
      reviewedAt: new Date(),
      reviewedBy: a.userId,
      receiptId,
    },
  });
  await lifecycleAudit(
    tx,
    a.organizationId,
    a.userId,
    "OPENING_PROOF_" + decision,
    p.id,
    { receivableId: id, receiptId },
  );
  return { id: p.id, receiptId };
}
export const openingUploadFields = z.object({
  receivableId: z.string().min(1).max(100),
  key: z.string().uuid(),
  amount: z.coerce.number().int().min(1).max(1000000000),
  date: lifecycleDate,
  method: z.enum(["TRANSFER", "QRIS", "CASH", "OTHER"]),
  reference: z.string().trim().min(3).max(100),
  note: z.string().trim().max(1000).default(""),
});
export async function recordOpeningProof(
  tx: Tx,
  token: string,
  input: z.infer<typeof openingUploadFields>,
  file: {
    storageKey: string;
    mimeType: string;
    fileSize: number;
    contentHash: string;
  },
) {
  let a = await openingTenantActor(tx, token);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${a.organizationId}))`;
  a = await openingTenantActor(tx, token);
  const share = await tenantOpeningSource(tx, a, input.receivableId),
    r = share.receivable;
  const fingerprint = stableHash({
    ...input,
    contentHash: file.contentHash,
    mimeType: file.mimeType,
  });
  const previous = await tx.openingProof.findUnique({
    where: {
      uploadedBy_requestKey: { uploadedBy: a.userId, requestKey: input.key },
    },
  });
  if (previous) {
    if (previous.requestHash !== fingerprint)
      throw Error("Kunci unggahan telah digunakan untuk data berbeda.");
    return { id: previous.id, reused: true };
  }
  if (
    r.status !== "OPEN" ||
    r.batch.status !== "OPEN" ||
    input.date < r.batch.asOf ||
    input.date > localToday()
  )
    throw Error("Saldo atau tanggal bukti tidak menerima unggahan.");
  const paid =
    (
      await tx.openingReceipt.aggregate({
        where: { receivableId: r.id },
        _sum: { delta: true },
      })
    )._sum.delta || 0;
  if (input.amount > r.amount - paid)
    throw Error(
      "Nominal bukti melebihi sisa saldo. Jika dana sudah dicatat manual, hubungi pengelola.",
    );
  if (
    (await tx.openingProof.count({
      where: { receivableId: r.id, status: "PENDING" },
    })) >= 5
  )
    throw Error("Masih ada lima bukti menunggu pemeriksaan.");
  const p = await tx.openingProof.create({
    data: {
      receivableId: r.id,
      shareId: share.id,
      uploadedBy: a.userId,
      requestKey: input.key,
      requestHash: fingerprint,
      amount: input.amount,
      date: input.date,
      method: input.method,
      reference: input.reference,
      encryptedTenantNote: encryptSecret(input.note),
      ...file,
    },
  });
  await lifecycleAudit(
    tx,
    a.organizationId,
    a.userId,
    "OPENING_PROOF_UPLOADED",
    p.id,
    { receivableId: r.id, amount: p.amount },
  );
  return { id: p.id, reused: false };
}
