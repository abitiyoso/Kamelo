import { occupantForSession } from "./identity";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma, User } from "@/generated/prisma";
import { db } from "./db";
import { hashToken } from "./auth";
import { paymentBalance } from "./domain.mjs";
import { MAX_PROOF_SIZE, proofMime, proofAmount } from "./proof-files.mjs";
import { z } from "zod";
export const operationalToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const safeProofSelect = {
  id: true,
  amount: true,
  date: true,
  method: true,
  reference: true,
  status: true,
  reviewNote: true,
  uploadedAt: true,
  reviewedAt: true,
} as const;
export async function tenantLinkRecord(token: string) {
  if (token.startsWith("account:")) {
    const grant = await occupantForSession();
    if (!grant || !grant.canViewBilling) return null;
    const invoice = await db.invoice.findFirst({
      where: {
        id: token.slice(8),
        stayId: grant.stayId,
        status: { not: "DRAFT" },
      },
    });
    if (!invoice) return null;
    return {
      id: "account:" + grant.id,
      invoiceId: invoice.id,
      includeAccess: false,
      expiresAt: new Date(Date.now() + 60000),
      revokedAt: null,
      tokenHash: "",
      createdAt: grant.createdAt,
      accountGrantId: grant.id,
      accountUserId: grant.userId,
    };
  }
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const link = await db.tenantLink.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  return link && !link.revokedAt && link.expiresAt > new Date()
    ? { ...link, accountGrantId: null, accountUserId: null }
    : null;
}
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === v;
  });
export async function billingToolsAction(
  tx: Prisma.TransactionClient,
  user: User,
  propertyId: string,
  body: Record<string, unknown>,
  origin: string,
) {
  if (body.action === "tenantLink") {
    const invoice = await tx.invoice.findFirst({
      where: {
        id: z.string().parse(body.invoiceId),
        propertyId,
        status: { notIn: ["VOID", "DRAFT"] },
      },
    });
    if (!invoice)
      throw new Error("Tagihan belum diterbitkan atau tidak ditemukan.");
    const token = randomBytes(32).toString("hex"),
      expiresAt = new Date(Date.now() + 14 * 86400000);
    // Explicit creation rotates old links so an owner can invalidate an accidentally shared link.
    await tx.tenantLink.updateMany({
      where: { invoiceId: invoice.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const link = await tx.tenantLink.create({
      data: {
        invoiceId: invoice.id,
        tokenHash: hashToken(token),
        expiresAt,
        includeAccess: user.role === "OWNER" || user.canControlDevices,
      },
    });
    await tx.audit.create({
      data: {
        organizationId: user.organizationId,
        actorId: user.id,
        action: "TENANT_LINK_CREATED",
        targetId: invoice.id,
        metadata: {
          linkId: link.id,
          expiresAt: expiresAt.toISOString(),
          includeAccess: link.includeAccess,
        },
      },
    });
    return {
      url: new URL("/tenant/" + token, origin).toString(),
      expiresAt: expiresAt.toISOString(),
    };
  }
  if (body.action === "reviewProof") {
    if (user.role !== "OWNER" && !user.canRecordPayments)
      throw new Error("Izin verifikasi pembayaran belum diberikan.");
    const input = z
      .object({
        proofId: z.string().min(1),
        decision: z.enum(["APPROVE", "REJECT"]),
        reviewNote: z.string().trim().max(500).default(""),
        confirmed: z.boolean().optional(),
      })
      .parse(body);
    const proof = await tx.paymentProof.findFirst({
      where: { id: input.proofId, invoice: { propertyId } },
      include: { invoice: { include: { payments: true } } },
    });
    if (!proof) throw new Error("Bukti pembayaran tidak ditemukan.");
    if (proof.status === "APPROVED" && input.decision === "APPROVE")
      return {
        proofId: proof.id,
        paymentId: proof.paymentId,
        alreadyReviewed: true,
      };
    if (proof.status !== "PENDING")
      throw new Error("Bukti ini sudah diproses.");
    let paymentId: string | undefined;
    if (input.decision === "APPROVE") {
      if (input.confirmed !== true)
        throw new Error(
          "Konfirmasikan bahwa dana sudah diterima sebelum menyetujui bukti.",
        );
      if (["DRAFT", "VOID"].includes(proof.invoice.status))
        throw new Error("Tagihan tidak tersedia untuk pembayaran.");
      const paid = proof.invoice.payments.reduce((sum, p) => sum + p.amount, 0);
      paymentBalance(proof.invoice.total, paid, proof.amount);
      const payment = await tx.payment.create({
        data: {
          invoiceId: proof.invoiceId,
          amount: proof.amount,
          date: proof.date,
          method: proof.method,
          reference: proof.reference,
          actorId: user.id,
        },
      });
      paymentId = payment.id;
      await tx.audit.create({
        data: {
          organizationId: user.organizationId,
          actorId: user.id,
          action: "PAYMENT_RECORDED",
          targetId: payment.id,
          metadata: {
            invoiceId: proof.invoiceId,
            amount: proof.amount,
            proofId: proof.id,
          },
        },
      });
    } else if (input.reviewNote.length < 3)
      throw new Error("Tuliskan alasan penolakan bukti.");
    await tx.paymentProof.update({
      where: { id: proof.id },
      data: {
        status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED",
        reviewNote: input.reviewNote,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        paymentId,
      },
    });
    await tx.audit.create({
      data: {
        organizationId: user.organizationId,
        actorId: user.id,
        action:
          input.decision === "APPROVE"
            ? "PAYMENT_PROOF_APPROVED"
            : "PAYMENT_PROOF_REJECTED",
        targetId: proof.id,
        metadata: { invoiceId: proof.invoiceId, amount: proof.amount },
      },
    });
    return { proofId: proof.id, paymentId };
  }
  throw new Error("Tindakan tidak tersedia.");
}
function storagePath(key: string) {
  if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("Berkas tidak tersedia.");
  return path.join(
    process.env.PROOF_STORAGE_DIR ||
      path.join(process.cwd(), "storage", "payment-proofs"),
    key,
  );
}
export async function proofFile(key: string) {
  return readFile(storagePath(key));
}
export async function storeProofBytes(bytes: Buffer) {
  const key = randomUUID(),
    target = storagePath(key);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
  return key;
}
export async function removeProofFile(key: string) {
  await unlink(storagePath(key)).catch(() => {});
}
export async function limitedFormData(request: Request) {
  const maximum = MAX_PROOF_SIZE + 65536,
    declared = Number(request.headers.get("content-length") || 0);
  if (declared > maximum) throw new Error("Ukuran bukti maksimal 5 MB.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Berkas belum dipilih.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw new Error("Ukuran bukti maksimal 5 MB.");
    }
    chunks.push(value);
  }
  return new Request(request.url, {
    method: "POST",
    headers: { "content-type": request.headers.get("content-type") || "" },
    body: Buffer.concat(chunks),
  }).formData();
}
export async function uploadProof(token: string, form: FormData) {
  const link = await tenantLinkRecord(token);
  if (!link) throw new Error("Tautan tidak valid atau sudah kedaluwarsa.");
  const file = form.get("file");
  if (!(file instanceof File) || !file.size || file.size > MAX_PROOF_SIZE)
    throw new Error("Pilih foto atau PDF maksimal 5 MB.");
  const bytes = Buffer.from(await file.arrayBuffer()),
    mimeType = proofMime(bytes);
  if (file.type && file.type !== mimeType)
    throw new Error("Jenis berkas tidak sesuai dengan isinya.");
  const input = z
    .object({
      date,
      method: z.enum(["TRANSFER", "QRIS", "CASH", "OTHER"]),
      reference: z.string().trim().max(100).default(""),
    })
    .parse(Object.fromEntries(form));
  if (input.date > operationalToday())
    throw new Error("Tanggal pembayaran tidak boleh di masa depan.");
  const amount = proofAmount(form.get("amount"));
  const storageKey = randomUUID(),
    target = storagePath(storageKey);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
  try {
    return await db.$transaction(
      async (tx) => {
        const scoped = await tx.invoice.findUniqueOrThrow({
          where: { id: link.invoiceId },
          include: { property: true },
        });
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scoped.property.organizationId}))`;
        const invoice = await tx.invoice.findUniqueOrThrow({
          where: { id: link.invoiceId },
          include: { property: true },
        });
        const current = link.accountGrantId
          ? await tx.occupantAccess
              .findFirst({
                where: {
                  id: link.accountGrantId,
                  userId: link.accountUserId!,
                  stayId: invoice.stayId,
                  status: "ACTIVE",
                  revokedAt: null,
                  canViewBilling: true,
                },
              })
              .then((g) =>
                g
                  ? {
                      revokedAt: g.revokedAt,
                      expiresAt: new Date(Date.now() + 60000),
                    }
                  : null,
              )
          : await tx.tenantLink.findUnique({ where: { id: link.id } });
        if (!current || current.revokedAt || current.expiresAt <= new Date())
          throw new Error("Tautan tidak valid atau sudah kedaluwarsa.");
        const payments = await tx.payment.findMany({
          where: { invoiceId: invoice.id },
          select: { amount: true },
        });
        if (["DRAFT", "VOID"].includes(invoice.status))
          throw new Error("Tagihan ini tidak menerima bukti pembayaran.");
        paymentBalance(
          invoice.total,
          payments.reduce((s, p) => s + p.amount, 0),
          amount,
        );
        if (
          (await tx.paymentProof.count({
            where: { invoiceId: invoice.id, status: "PENDING" },
          })) >= 5
        )
          throw new Error(
            "Masih ada bukti menunggu verifikasi. Hubungi pengelola terlebih dahulu.",
          );
        const contentHash = createHash("sha256").update(bytes).digest("hex");
        if (
          await tx.paymentProof.count({
            where: {
              invoiceId: invoice.id,
              contentHash,
              status: { in: ["PENDING", "APPROVED"] },
            },
          })
        )
          throw new Error(
            "Bukti yang sama sedang diverifikasi atau sudah disetujui.",
          );
        const proof = await tx.paymentProof.create({
          data: {
            invoiceId: invoice.id,
            ...input,
            amount,
            storageKey,
            mimeType,
            fileSize: bytes.length,
            contentHash,
          },
        });
        await tx.audit.create({
          data: {
            organizationId: invoice.property.organizationId,
            actorId: link.accountUserId || "tenant-link:" + link.id,
            action: "PAYMENT_PROOF_UPLOADED",
            targetId: proof.id,
            metadata: { invoiceId: invoice.id, amount },
          },
        });
        return { id: proof.id, status: proof.status };
      },
      { timeout: 15000 },
    );
  } catch (error) {
    await unlink(target).catch(() => {});
    throw error;
  }
}
