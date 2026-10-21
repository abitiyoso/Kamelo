import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { encryptSecret } from "./secrets";
import { lifecycleAudit } from "./lifecycle";
import { supportNext } from "./support-rules.mjs";
const message = z.string().trim().min(10).max(4000);
export async function supportWrite(
  tx: Prisma.TransactionClient,
  user: { id: string; role: string },
  organizationId: string,
  body: Record<string, unknown>,
) {
  const action = String(body.action);
  const text = message.parse(body.message);
  if (body.confirmed !== true)
    throw Error("Periksa isi bantuan sebelum membagikannya.");
  let c;
  if (action === "create") {
    if (user.role !== "OWNER")
      throw Error("Tiket baru dibuat oleh owner organisasi.");
    c = await tx.supportCase.create({
      data: {
        organizationId,
        subject: z.string().trim().min(5).max(160).parse(body.subject),
        category: z
          .enum(["ACCOUNT", "BILLING", "OPERATIONS", "INTEGRATION", "OTHER"])
          .parse(body.category),
        priority: z.enum(["NORMAL", "HIGH"]).parse(body.priority),
        createdBy: user.id,
      },
    });
  } else {
    const caseId = z.string().min(1).max(100).parse(body.caseId);
    const found = await tx.supportCase.findFirst({
      where: { id: caseId, organizationId },
    });
    if (!found) throw Error("Tiket bantuan tidak ditemukan.");
    const revision = z.number().int().positive().parse(body.revision);
    if (revision !== found.revision)
      throw Error("Tiket berubah. Muat ulang detail sebelum mengirim kembali.");
    const status = supportNext(
      user.role,
      action,
      found.status,
      String(body.status || ""),
    );
    if (action === "claim" && found.assigneeId && found.assigneeId !== user.id)
      throw Error("Tiket sudah ditangani admin lain.");
    if (action === "claim" && found.assigneeId === user.id)
      throw Error("Anda sudah menjadi penanggung jawab tiket.");
    c = await tx.supportCase.update({
      where: { id: caseId },
      data: {
        status,
        revision: { increment: 1 },
        ...(action === "claim" ? { assigneeId: user.id } : {}),
      },
    });
  }
  await tx.supportEntry.create({
    data: {
      caseId: c.id,
      kind: action.toUpperCase(),
      actorId: user.id,
      actorRole: user.role,
      encryptedBody: encryptSecret(text),
      status: c.status,
      revision: c.revision,
    },
  });
  await lifecycleAudit(
    tx,
    organizationId,
    user.id,
    "SUPPORT_" + action.toUpperCase(),
    c.id,
    { revision: c.revision, status: c.status },
  );
  return { caseId: c.id, revision: c.revision };
}
