import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { verified } from "./identity";
import { activeStay } from "./operations";
import { encryptSecret } from "./secrets";
import { lifecycleAudit } from "./lifecycle";
type Tx = Prisma.TransactionClient;
export type MessageActor = {
  userId: string;
  role: "OWNER" | "STAFF" | "TENANT";
  organizationId: string;
  propertyIds: string[];
  membershipId?: string;
  stayId?: string;
};
export async function messageActor(
  tx: Tx,
  token: string,
): Promise<MessageActor> {
  const s = await tx.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (
    !s ||
    s.expires <= new Date() ||
    ["PENDING", "SUSPENDED", "CLOSED"].includes(s.user.accountStatus)
  )
    throw Error("Akses pesan tidak tersedia.");
  if (s.contextType === "ORG") {
    const m = await tx.orgMembership.findFirst({
      where: {
        userId: s.userId,
        status: "ACTIVE",
        ...(s.membershipId
          ? { id: s.membershipId }
          : { organizationId: s.user.organizationId }),
      },
    });
    if (!m || !["OWNER", "STAFF"].includes(m.role))
      throw Error("Akses pesan tidak tersedia.");
    return {
      userId: s.userId,
      role: m.role as "OWNER" | "STAFF",
      organizationId: m.organizationId,
      propertyIds: m.propertyIds,
      membershipId: m.id,
    };
  }
  if (s.contextType === "STAY" && verified(s.user)) {
    const g = await tx.occupantAccess.findFirst({
      where: {
        id: s.occupantAccessId || "",
        userId: s.userId,
        status: "ACTIVE",
        revokedAt: null,
      },
      include: {
        stay: {
          include: {
            room: {
              select: { property: { select: { organizationId: true } } },
            },
          },
        },
      },
    });
    if (g)
      return {
        userId: s.userId,
        role: "TENANT",
        organizationId: g.stay.room.property.organizationId,
        propertyIds: [],
        stayId: g.stayId,
      };
  }
  throw Error("Akses pesan tidak tersedia.");
}
export function threadScope(a: MessageActor): Prisma.MessageThreadWhereInput {
  return a.role === "TENANT"
    ? { stayId: a.stayId, residentUserId: a.userId }
    : {
        stay: {
          room: {
            property: { organizationId: a.organizationId },
            ...(a.role === "STAFF"
              ? { propertyId: { in: a.propertyIds } }
              : {}),
          },
        },
        ...(a.role === "STAFF" ? { assigneeId: a.membershipId } : {}),
      };
}
export const threadSelect = {
  id: true,
  stayId: true,
  status: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
  assigneeId: true,
  assignee: { select: { user: { select: { name: true } } } },
  residentUser: { select: { name: true } },
  stay: {
    select: {
      status: true,
      start: true,
      end: true,
      room: {
        select: {
          number: true,
          propertyId: true,
          property: { select: { name: true, organizationId: true } },
        },
      },
    },
  },
} as const;
export async function messageWrite(
  tx: Tx,
  a: MessageActor,
  body: Record<string, unknown>,
) {
  const action = z
    .enum(["start", "send", "assign", "close", "reopen"])
    .parse(body.action);
  const text = z.string().trim().min(1).max(4000).parse(body.message);
  if (body.confirmed !== true)
    throw Error("Periksa isi pesan sebelum mengirim.");
  let thread;
  if (action === "start") {
    if (a.role === "STAFF")
      throw Error("Owner perlu menugaskan percakapan kepada staf.");
    const stayId =
      a.role === "TENANT"
        ? a.stayId
        : z.string().min(1).max(100).parse(body.stayId);
    const residentUserId =
      a.role === "TENANT"
        ? a.userId
        : z.string().min(1).max(100).parse(body.residentUserId);
    const stay = await tx.stay.findFirst({
      where: {
        id: stayId,
        room: { property: { organizationId: a.organizationId } },
      },
    });
    if (!stay || !activeStay(stay)) throw Error("Masa tinggal tidak aktif.");
    const grant = await tx.occupantAccess.findFirst({
      where: {
        stayId,
        userId: residentUserId,
        status: "ACTIVE",
        revokedAt: null,
      },
      include: { user: true },
    });
    if (!grant || !verified(grant.user))
      throw Error("Akun penghuni belum memiliki akses aktif terverifikasi.");
    thread = await tx.messageThread.findUnique({
      where: { stayId_residentUserId: { stayId: stayId!, residentUserId } },
    });
    if (!thread)
      thread = await tx.messageThread.create({
        data: { stayId: stayId!, residentUserId },
      });
  } else {
    const threadId = z.string().min(1).max(100).parse(body.threadId);
    thread = await tx.messageThread.findFirst({
      where: { id: threadId, ...threadScope(a) },
    });
  }
  if (!thread) throw Error("Percakapan tidak ditemukan.");
  const stay = await tx.stay.findUniqueOrThrow({
    where: { id: thread.stayId },
  });
  if (!["close", "assign"].includes(action) && !activeStay(stay))
    throw Error("Masa tinggal selesai. Riwayat pesan hanya dapat dibaca.");
  if (["send", "start", "reopen"].includes(action)) {
    const grant = await tx.occupantAccess.findFirst({
      where: {
        stayId: thread.stayId,
        userId: thread.residentUserId,
        status: "ACTIVE",
        revokedAt: null,
      },
      include: { user: true },
    });
    if (!grant || !verified(grant.user))
      throw Error("Akses akun penghuni tidak lagi aktif.");
  }
  if (["start", "send"].includes(action) && thread.status !== "OPEN")
    throw Error("Buka kembali percakapan sebelum mengirim pesan.");
  const update: Prisma.MessageThreadUpdateInput = {
    revision: { increment: 1 },
  };
  if (["assign", "close", "reopen"].includes(action)) {
    if (z.number().int().nonnegative().parse(body.revision) !== thread.revision)
      throw Error(
        "Percakapan berubah. Muat ulang sebelum mengubah penanganan.",
      );
    if (action === "assign") {
      if (a.role !== "OWNER") throw Error("Hanya owner dapat menugaskan staf.");
      const assigneeId = z
        .string()
        .max(100)
        .nullable()
        .parse(body.assigneeId || null);
      if (assigneeId) {
        const m = await tx.orgMembership.findFirst({
          where: {
            id: assigneeId,
            organizationId: a.organizationId,
            role: "STAFF",
            status: "ACTIVE",
            propertyIds: {
              has: (
                await tx.room.findUniqueOrThrow({ where: { id: stay.roomId } })
              ).propertyId,
            },
          },
          include: { user: true },
        });
        if (
          !m ||
          ["PENDING", "SUSPENDED", "CLOSED"].includes(m.user.accountStatus)
        )
          throw Error("Staf tidak memiliki akses ke properti ini.");
        update.assignee = { connect: { id: assigneeId } };
      } else update.assignee = { disconnect: true };
    } else {
      if (action === "close" && a.role === "TENANT")
        throw Error("Pengelola menutup percakapan setelah ditangani.");
      const status = action === "close" ? "CLOSED" : "OPEN";
      if (thread.status === status)
        throw Error("Status percakapan sudah sama.");
      update.status = status;
    }
  }
  const saved = await tx.messageThread.update({
    where: { id: thread.id },
    data: update,
  });
  await tx.messageEntry.create({
    data: {
      threadId: thread.id,
      revision: saved.revision,
      kind: ["start", "send"].includes(action)
        ? "MESSAGE"
        : action.toUpperCase(),
      actorId: a.userId,
      actorRole: a.role,
      encryptedBody: encryptSecret(text),
    },
  });
  await lifecycleAudit(
    tx,
    a.organizationId,
    a.userId,
    "MESSAGE_" + action.toUpperCase(),
    thread.id,
    { revision: saved.revision },
  );
  return { threadId: thread.id, revision: saved.revision };
}
