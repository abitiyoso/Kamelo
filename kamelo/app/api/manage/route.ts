import {closeStayLifecycle} from "@/lib/lifecycle";
import {transferredPeriodInvoice} from "@/lib/stay-billing";
import { runPropertyOperations } from "@/lib/automation";
import {
  operationsAction,
  operationActions,
  ticketInclude,
} from "@/lib/operations";
import { NextRequest, NextResponse } from "next/server";
import { subscriptionEvent } from "@/lib/subscriptions";
import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, rateLimit, sessionIdentity } from "@/lib/auth";
import { plans } from "@/lib/plans";
import {
  assertCapacity,
  amount,
  paymentBalance,
  nights,
  billingDate,
} from "@/lib/domain.mjs";
import { MockTuyaProvider, SmartDevice } from "@/lib/iot";
import { validOrigin } from "@/lib/origin";
import { hashPassword } from "@/lib/auth";
import { propertyMetrics } from "@/lib/metrics";
import { billingToolsAction, safeProofSelect } from "@/lib/tenant";
import { syncRoomAccess } from "@/lib/smart-access";
import { encryptSecret } from "@/lib/secrets";
const accessSelect = {
  id: true,
  stayId: true,
  status: true,
  validFrom: true,
  validUntil: true,
} as const;
const id = z.string().min(1).max(100),
  money = z.number().int().min(0).max(1000000000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === v;
  });
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export async function GET(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user)
      return NextResponse.json({ error: "Silakan masuk." }, { status: 401 });
    if (!["OWNER", "STAFF"].includes(user.role))
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    const canReadFinance = user.role === "OWNER" || user.canRecordPayments;
    // Reconcile simulation dates on owner/staff reads as well as stay events.
    // No real hardware commands are issued by this provider.
    const lockRooms = await db.device.findMany({
      where: {
        kind: "LOCK",
        provider: "MOCK",
        roomId: { not: null },
        property: {
          organizationId: user.organizationId,
          ...(user.role === "STAFF" ? { id: { in: user.propertyIds } } : {}),
        },
      },
      select: { roomId: true },
    });
    if (lockRooms.length)
      await db.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.organizationId}))`;
          for (const roomId of new Set(lockRooms.map((d) => d.roomId!)))
            await syncRoomAccess(
              tx,
              roomId,
              today(),
              "owner-access-refresh",
              user.organizationId,
            );
        },
        { timeout: 15000 },
      );
    const page = Math.min(
      10000,
      Math.max(0, Number(req.nextUrl.searchParams.get("page")) || 0),
    );
    const roomFilter = req.nextUrl.searchParams.get("roomId") || undefined;
    const overdueOnly = req.nextUrl.searchParams.get("filter") === "OVERDUE";
    const overdueRows =
      overdueOnly && canReadFinance
        ? await db.$queryRaw<{ id: string }[]>`
      SELECT i.id FROM "Invoice" i JOIN "Property" p ON p.id=i."propertyId"
      LEFT JOIN "Payment" pay ON pay."invoiceId"=i.id
      WHERE p."organizationId"=${user.organizationId} AND i.status NOT IN ('DRAFT','VOID') AND i.due < ${today()}
      GROUP BY i.id HAVING i.total > COALESCE(SUM(pay.amount),0)`
        : [];
    const invoiceFilter = {
      ...(roomFilter ? { roomId: roomFilter } : {}),
      ...(overdueOnly ? { id: { in: overdueRows.map((r) => r.id) } } : {}),
    };
    const rows = await db.property.findMany({
      where: {
        organizationId: user.organizationId,
        ...(user.role === "STAFF" ? { id: { in: user.propertyIds } } : {}),
      },
      include: {
        rooms: { include: { stays: { include: { guest: true } } } },
        guests: { take: 100 },
        invoices: {
          where: canReadFinance ? invoiceFilter : { id: { in: [] } },
          take: 50,
          skip: Math.floor(page) * 50,
          orderBy: overdueOnly
            ? [{ due: "asc" }, { id: "asc" }]
            : [{ date: "desc" }, { id: "desc" }],
          include: {
            guest: true,
            room: true,
            payments: true,
            proofs: { select: safeProofSelect },
          },
        },
        devices: { include: { accesses: { select: accessSelect } } },
        tickets: {
          where: user.role === "STAFF" ? { assigneeId: user.id } : {},
          include: ticketInclude,
          orderBy: { updatedAt: "desc" },
        },
      },
    });
    const properties = await Promise.all(
      rows.map(async ({ encryptedWifiPassword, ...property }) => ({
        contractExpiring: user.role === "OWNER"? await db.contract.count({where:{status:"ACTIVE",stay:{room:{propertyId:property.id},end:{gte:today(),lte:new Date(Date.parse(today()+"T00:00:00Z")+30*86400000).toISOString().slice(0,10)}}}}):undefined,
        hasWifiPassword: Boolean(encryptedWifiPassword),
        ...property,
        summary: canReadFinance
          ? await propertyMetrics(
              property.id,
              today(),
              roomFilter,
              overdueOnly ? overdueRows.map((r) => r.id) : undefined,
            )
          : undefined,
        pendingProofInvoices: canReadFinance
          ? await db.invoice.findMany({
              where: {
                propertyId: property.id,
                proofs: { some: { status: "PENDING" } },
              },
              orderBy: { date: "asc" },
              include: {
                guest: true,
                room: true,
                payments: true,
                proofs: { select: safeProofSelect },
              },
            })
          : [],
        ...(!canReadFinance
          ? {
              guests: [],
              rooms: property.rooms.map((room) => ({
                ...room,
                rate: 0,
                stays: room.stays.map((stay) => ({
                  ...stay,
                  rate: 0,
                  guest: { ...stay.guest, name: "Penghuni", phone: "" },
                })),
              })),
            }
          : {}),
        ...(user.role !== "OWNER" && !user.canControlDevices
          ? { devices: [] }
          : {}),
      })),
    );
    const invoiceId = req.nextUrl.searchParams.get("invoiceId");
    const selectedInvoice =
      invoiceId && canReadFinance
        ? await db.invoice.findFirst({
            where: {
              id: invoiceId,
              propertyId: { in: properties.map((p) => p.id) },
            },
            include: {
              guest: true,
              room: true,
              payments: true,
              proofs: { select: safeProofSelect },
            },
          })
        : null;
    if (invoiceId && !selectedInvoice)
      return NextResponse.json(
        { error: "Tagihan tidak ditemukan atau akses ditolak." },
        { status: 403 },
      );
    const effectivePlan =
      user.organization.subscriptionStatus === "ACTIVE" &&
      (!user.organization.planExpiresAt ||
        user.organization.planExpiresAt > new Date())
        ? user.organization.plan
        : "free";
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        platformAdmin: user.platformAdmin,
        canRecordPayments: user.canRecordPayments,
        canControlDevices: user.canControlDevices,
      },
      selectedInvoice,
      plan: effectivePlan,
      subscriptionStatus:
        effectivePlan === user.organization.plan
          ? user.organization.subscriptionStatus
          : "EXPIRED",
      properties,
      team: user.role === "OWNER" ? (await db.orgMembership.findMany({where:{organizationId:user.organizationId,status:"ACTIVE"},include:{user:{select:{id:true,name:true,email:true,emailVerifiedAt:true}}}})).map(m=>({...m.user,role:m.role,propertyIds:m.propertyIds,canRecordPayments:m.canRecordPayments,canControlDevices:m.canControlDevices})) : [],
      upgrades:
        user.role === "OWNER"
          ? await db.upgrade.findMany({
              where: { organizationId: user.organizationId },
              orderBy: { createdAt: "desc" },
            })
          : [],
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Layanan sementara tidak tersedia. Coba kembali atau hubungi ELENIO.",
      },
      { status: 503 },
    );
  }
}
export async function POST(req: NextRequest) {
  try {
    if (!validOrigin(req))
      return NextResponse.json(
        { error: "Permintaan tidak diizinkan." },
        { status: 403 },
      );
    const user = await currentUser();
    if (!user)
      return NextResponse.json({ error: "Silakan masuk." }, { status: 401 });
    const body = await req.json();
    const billingSession = body.action === "activate" ? await sessionIdentity() : null;
    if(user.role === "PLATFORM_ADMIN" && body.action !== "activate")return NextResponse.json({error:"Gunakan workspace organisasi untuk operasional."},{status:403});
    await rateLimit("manage:" + user.id, 100);
    const result = await db.$transaction(
      async (tx) => {
        // All writes for an organization share a lock: capacity, booking, recurring and payment checks are atomic.
        const lockOrganization = body.action === "activate"
          ? (await tx.upgrade.findUnique({ where: { id: id.parse(body.requestId) }, select: { organizationId: true } }))?.organizationId || user.organizationId
          : user.organizationId;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockOrganization}))`;
        if(user.membershipId){const m=await tx.orgMembership.findUnique({where:{id:user.membershipId}});if(!m||m.status!=="ACTIVE"||m.userId!==user.id||m.role!==user.role||m.canRecordPayments!==user.canRecordPayments||m.canControlDevices!==user.canControlDevices||JSON.stringify([...m.propertyIds].sort())!==JSON.stringify([...user.propertyIds].sort()))throw Error("Hak akses berubah. Silakan masuk kembali.")}
        const org = await tx.organization.findUniqueOrThrow({
          where: { id: user.organizationId },
        });
        const effectivePlan =
          org.subscriptionStatus === "ACTIVE" &&
          (!org.planExpiresAt || org.planExpiresAt > new Date())
            ? org.plan
            : "free";
        const plan = plans.find((p) => p.id === effectivePlan) ?? plans[0];
        const audit = async (
          action: string,
          targetId: string,
          metadata: Prisma.InputJsonValue = {},
        ) =>
          tx.audit.create({
            data: {
              organizationId: org.id,
              actorId: user.id,
              action,
              targetId,
              metadata,
            },
          });
        const owner = () => {
          if (user.role !== "OWNER")
            throw new Error("Hanya pemilik yang dapat melakukan tindakan ini.");
        };
        if(body.action === "teamAdd") throw new Error("Gunakan undangan staf. Pembuatan akun dengan berbagi kata sandi telah dinonaktifkan.");
        if(body.action === "teamAssign"){
          owner();const input=z.object({userId:id,propertyIds:z.array(id).max(3),canRecordPayments:z.boolean().optional(),canControlDevices:z.boolean().optional()}).parse(body);
          const member=await tx.orgMembership.findFirst({where:{userId:input.userId,organizationId:org.id,role:"STAFF",status:"ACTIVE"},include:{user:true}});if(!member)throw Error("Staf tidak ditemukan.");
          const count=await tx.property.count({where:{id:{in:input.propertyIds},organizationId:org.id}});if(count!==new Set(input.propertyIds).size)throw Error("Properti tidak valid.");
          const grants={propertyIds:input.propertyIds,canRecordPayments:input.canRecordPayments??member.canRecordPayments,canControlDevices:input.canControlDevices??member.canControlDevices};
          await tx.orgMembership.update({where:{id:member.id},data:grants});
          if(member.user.organizationId===org.id&&member.user.role==="STAFF")await tx.user.update({where:{id:member.userId},data:grants});
          await tx.session.deleteMany({where:{userId:member.userId}});await audit("STAFF_ASSIGNMENT_UPDATED",member.userId,grants);return {ok:true};
        }
        if (body.action === "property") {
          owner();
          const input = z
            .object({
              name: z.string().trim().min(2).max(100),
              type: z.enum(["KOS", "HOTEL"]),
              city: z.string().max(100).default(""),
              count: z.number().int().min(1).max(50),
              rate: money,
            })
            .parse(body);
          const count = await tx.property.count({
            where: { organizationId: org.id },
          });
          if (count >= plan.properties)
            throw new Error("Batas properti paket tercapai.");
          const roomCount = await tx.room.count({
            where: { property: { organizationId: org.id } },
          });
          assertCapacity(roomCount, input.count, plan.rooms);
          const property = await tx.property.create({
            data: {
              organizationId: org.id,
              name: input.name,
              type: input.type,
              city: input.city,
              rooms: {
                create: Array.from({ length: input.count }, (_, i) => ({
                  number: String(i + 1).padStart(2, "0"),
                  rate: input.rate,
                })),
              },
            },
          });
          await audit("PROPERTY_CREATED", property.id);
          return property;
        }
        if (body.action === "upgrade") {
          owner();
          const desired = z.enum(["starter", "plus"]).parse(body.plan);
          const existing = await tx.upgrade.findFirst({
            where: {
              organizationId: org.id,
              plan: desired,
              status: "REQUESTED",
            },
          });
          if (existing) return existing;
          const r = await tx.upgrade.create({
            data: { organizationId: org.id, plan: desired },
          });
          await audit("UPGRADE_REQUESTED", r.id, { plan: desired });
          return r;
        }
        if (body.action === "activate") {
          if (!user.platformAdmin)
            throw new Error("Akses administrator platform diperlukan.");
          const freshAdmin = await tx.user.findUnique({ where: { id: user.id }, select: { platformAdmin: true, accountStatus: true } });
          if (!freshAdmin?.platformAdmin || ["PENDING", "SUSPENDED", "CLOSED"].includes(freshAdmin.accountStatus)) throw Error("Akses administrator telah berubah.");
          const freshSession = billingSession ? await tx.session.findUnique({ where: { token: billingSession.token } }) : null;
          if (!freshSession || freshSession.userId !== user.id || freshSession.expires <= new Date()) throw Error("Sesi administrator telah berakhir.");
          const request = await tx.upgrade.findUniqueOrThrow({
            where: { id: id.parse(body.requestId) },
          });
          if (request.status !== "REQUESTED")
            throw new Error("Permintaan sudah diproses.");
          const previousEntitlement = await tx.organization.findUniqueOrThrow({ where: { id: request.organizationId }, select: { plan: true, subscriptionStatus: true, planExpiresAt: true } });
          await tx.organization.update({
            where: { id: request.organizationId },
            data: {
              plan: request.plan,
              subscriptionStatus: "ACTIVE",
              planExpiresAt: null,
            },
          });
          await tx.upgrade.update({
            where: { id: request.id },
            data: { status: "ACTIVATED" },
          });
          await subscriptionEvent(tx, request.organizationId, user.id, "LEGACY_MANUAL_ACTIVATION", "Aktivasi manual melalui alur lama; tidak menjadi bukti pembayaran langganan.", { plan: request.plan, requestId: request.id, before: { ...previousEntitlement, planExpiresAt: previousEntitlement.planExpiresAt?.toISOString() || null } });
          await tx.audit.create({
            data: {
              organizationId: request.organizationId,
              actorId: user.id,
              action: "PLAN_ACTIVATED",
              targetId: request.id,
              metadata: { plan: request.plan },
            },
          });
          return { ok: true };
        }
        const requestedPropertyId = id.parse(body.propertyId);
        if (
          user.role === "STAFF" &&
          !user.propertyIds.includes(requestedPropertyId)
        )
          throw new Error("Properti tidak ditemukan atau akses ditolak.");
        const property = await tx.property.findFirst({
          where: { id: requestedPropertyId, organizationId: org.id },
        });
        if (!property)
          throw new Error("Properti tidak ditemukan atau akses ditolak.");
        if (body.action === "operationsConfig") {
          owner();
          const enabled = z.boolean().parse(body.enabled);
          if (enabled && (!plan.recurring || property.type !== "KOS"))
            throw new Error(
              "Otomasi tagihan memerlukan kos dengan paket berbayar.",
            );
          await tx.property.update({
            where: { id: property.id },
            data: { billingAutomation: enabled },
          });
          await audit("OPERATIONS_CONFIG_UPDATED", property.id, { enabled });
          return { ok: true };
        }
        if (body.action === "operationsRun") {
          owner();
          return runPropertyOperations(tx, property.id);
        }
        if (operationActions.includes(body.action))
          return operationsAction(
            tx,
            user,
            property,
            body,
            process.env.APP_URL || req.nextUrl.origin,
          );
        if (body.action === "tenantLink" || body.action === "reviewProof")
          return billingToolsAction(
            tx,
            user,
            property.id,
            body,
            process.env.APP_URL || req.nextUrl.origin,
          );
        if (body.action === "tenantSettings") {
          owner();
          const input = z
            .object({
              stayId: id,
              name: z.string().trim().min(2).max(100),
              phone: z.string().regex(/^(?:\+62|62|0)8\d{7,12}$/),
              rate: money,
              billingDay: z.number().int().min(1).max(31),
            })
            .parse(body);
          const stay = await tx.stay.findFirst({
            where: { id: input.stayId, room: { propertyId: property.id } },
          });
          if (!stay || property.type !== "KOS")
            throw new Error("Penghuni kos tidak ditemukan.");
          if(input.rate!==stay.rate&&await tx.contract.count({where:{stayId:stay.id,status:"ACTIVE"}}))throw Error("Tarif terikat kontrak yang disepakati. Perubahan tarif memerlukan revisi kontrak terjadwal.");
          await tx.guest.update({
            where: { id: stay.guestId },
            data: { name: input.name, phone: input.phone },
          });
          await tx.stay.update({
            where: { id: stay.id },
            data: { rate: input.rate, billingDay: input.billingDay },
          });
          await audit("TENANT_BILLING_SETTINGS_UPDATED", stay.id, {
            rate: input.rate,
            billingDay: input.billingDay,
          });
          return { ok: true };
        }
        if (body.action === "propertyUpdate") {
          owner();
          const input = z
            .object({
              name: z.string().trim().min(2).max(100),
              city: z.string().max(100),
            })
            .parse(body);
          await tx.property.update({ where: { id: property.id }, data: input });
          await audit("PROPERTY_UPDATED", property.id);
          return { ok: true };
        }
        if (body.action === "room") {
          owner();
          const input = z
            .object({ number: z.string().trim().min(1).max(20), rate: money })
            .parse(body);
          const count = await tx.room.count({
            where: { property: { organizationId: org.id } },
          });
          assertCapacity(count, 1, plan.rooms);
          const room = await tx.room.create({
            data: { propertyId: property.id, ...input },
          });
          await audit("ROOM_CREATED", room.id);
          return room;
        }
        if (body.action === "roomReadiness") {
          const input = z
            .object({
              roomId: id,
              operational: z.enum(["READY", "CLEANING", "MAINTENANCE"]),
            })
            .parse(body);
          const room = await tx.room.findFirst({
            where: { id: input.roomId, propertyId: property.id },
          });
          if (!room) throw new Error("Kamar tidak ditemukan.");
          await tx.room.update({
            where: { id: room.id },
            data: { operational: input.operational },
          });
          await audit("ROOM_READINESS_UPDATED", room.id, {
            operational: input.operational,
          });
          return { ok: true };
        }
        if (body.action === "roomUpdate") {
          owner();
          const input = z
            .object({
              roomId: id,
              number: z.string().trim().min(1).max(20),
              rate: money,
              operational: z.enum(["READY", "CLEANING", "MAINTENANCE"]),
            })
            .parse(body);
          const room = await tx.room.findFirst({
            where: { id: input.roomId, propertyId: property.id },
          });
          if (!room) throw new Error("Kamar tidak ditemukan.");
          await tx.room.update({
            where: { id: room.id },
            data: {
              number: input.number,
              rate: input.rate,
              operational: input.operational,
            },
          });
          await audit("ROOM_UPDATED", room.id);
          return { ok: true };
        }
        if (body.action === "stay") {
          const input = z
            .object({
              roomId: id,
              name: z.string().trim().min(2).max(100),
              phone: z.string().regex(/^(?:\+62|62|0)8\d{7,12}$/),
              start: date,
              end: date.optional(),
              rate: money,
              billingDay: z.number().int().min(1).max(31).default(1),
            })
            .parse(body);
          const room = await tx.room.findFirst({
            where: { id: input.roomId, propertyId: property.id },
          });
          if (!room || room.operational !== "READY")
            throw new Error("Kamar belum siap.");
          if (property.type === "HOTEL") {
            if (!input.end) throw new Error("Tanggal check-out wajib diisi.");
            nights(input.start, input.end);
          }
          if (input.end) nights(input.start, input.end);
          const conflict = await tx.stay.findFirst({
            where: {
              roomId: room.id,
              status: { in: ["ACTIVE", "CONFIRMED", "CHECKED_IN"] },
              start: { lt: input.end ?? "9999-12-31" },
              OR: [{ end: null }, { end: { gt: input.start } }],
            },
          });
          if (conflict)
            throw new Error(
              "Kamar sudah dihuni atau dipesan pada tanggal tersebut.",
            );
          const guest = await tx.guest.create({
            data: {
              propertyId: property.id,
              name: input.name,
              phone: input.phone,
            },
          });
          const stay = await tx.stay.create({
            data: {
              roomId: room.id,
              guestId: guest.id,
              start: input.start,
              end: input.end,
              rate: input.rate,
              billingDay: input.billingDay,
              status: property.type === "KOS" ? "ACTIVE" : "CONFIRMED",
            },
          });
          await audit("STAY_CREATED", stay.id);
          await syncRoomAccess(tx, room.id, today(), user.id, org.id);
          return stay;
        }
        if (body.action === "transition") {
          const input = z
            .object({
              stayId: id,
              status: z.enum(["CHECKED_IN", "CHECKED_OUT", "CANCELLED"]),
            })
            .parse(body);
          const stay = await tx.stay.findFirst({
            where: { id: input.stayId, room: { propertyId: property.id } },
            include: { room: true },
          });
          if (!stay) throw new Error("Reservasi tidak ditemukan.");
          const allowed =
            input.status === "CHECKED_IN"
              ? stay.status === "CONFIRMED"
              : input.status === "CHECKED_OUT"
                ? ["ACTIVE", "CHECKED_IN"].includes(stay.status)
                : stay.status === "CONFIRMED" ||
                  (property.type === "KOS" &&
                    stay.status === "ACTIVE" &&
                    stay.start > today());
          if (!allowed) throw new Error("Perubahan status tidak valid.");
          if (input.status === "CHECKED_OUT" && stay.start > today())
            throw new Error(
              "Masa tinggal belum dimulai. Batalkan reservasi mendatang terlebih dahulu.",
            );
          if (input.status === "CHECKED_IN") {
            if (
              stay.start > today() ||
              (stay.end && stay.end <= today()) ||
              stay.room.operational !== "READY"
            )
              throw new Error("Periksa tanggal dan kesiapan kamar.");
            const current = await tx.stay.count({
              where: {
                roomId: stay.roomId,
                status: { in: ["ACTIVE", "CHECKED_IN"] },
              },
            });
            if (current) throw new Error("Kamar masih terisi.");
          }
          await tx.stay.update({
            where: { id: stay.id },
            data: {
              status: input.status,
              ...(input.status === "CHECKED_OUT" && property.type === "KOS"
                ? { end: today() }
                : {}),
            },
          });
          if (["CHECKED_OUT","CANCELLED"].includes(input.status))await closeStayLifecycle(tx,stay.id,input.status,user.id,org.id);
          await audit(input.status, stay.id);
          await syncRoomAccess(tx, stay.roomId, today(), user.id, org.id);
          return { ok: true };
        }
        if (body.action === "invoice" || body.action === "recurring") {
          const input = z
            .object({
              stayId: id,
              due: date,
              items: z
                .array(
                  z.object({
                    label: z.string().min(1).max(100),
                    amount: z.number().int().min(-1000000000).max(1000000000),
                  }),
                )
                .min(1)
                .max(20),
              period: z
                .string()
                .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
                .optional(),
            })
            .parse(body);
          const stay = await tx.stay.findFirst({
            where: { id: input.stayId, room: { propertyId: property.id } },
          });
          if (!stay) throw new Error("Penghuni tidak ditemukan.");
          let due = input.due,
            items = input.items;
          if (body.action === "recurring") {
            if (
              !plan.recurring ||
              property.type !== "KOS" ||
              stay.status !== "ACTIVE"
            )
              throw new Error(
                "Tagihan berulang memerlukan paket berbayar dan penghuni kos aktif.",
              );
            if (!input.period) throw new Error("Periode wajib diisi.");
            const transferred=await transferredPeriodInvoice(tx,stay.id,input.period);
            if(transferred)return transferred;
            const [y, m] = input.period.split("-").map(Number);
            due = billingDate(y, m, stay.billingDay);
            if (due < stay.start || (stay.end && due >= stay.end))
              throw new Error("Periode di luar masa huni.");
            const existing = await tx.invoice.findUnique({
              where: {
                stayId_period: { stayId: stay.id, period: input.period },
              },
            });
            if (existing) return existing;
            items = [
              { label: "Sewa kamar " + input.period, amount: stay.rate },
            ];
          }
          const total = amount(items);
          if (total > 1000000000)
            throw new Error("Total tagihan maksimal Rp1 miliar.");
          const draft = body.draft === true && body.action !== "recurring";
          const invoice = await tx.invoice.create({
            data: {
              propertyId: property.id,
              roomId: stay.roomId,
              guestId: stay.guestId,
              stayId: stay.id,
              number: "KH-" + crypto.randomUUID().slice(0, 12).toUpperCase(),
              date: today(),
              due,
              total,
              items,
              status: draft ? "DRAFT" : "UNPAID",
              period: body.action === "recurring" ? input.period : null,
            },
          });
          await audit(
            draft ? "INVOICE_DRAFTED" : "INVOICE_ISSUED",
            invoice.id,
            { total },
          );
          return invoice;
        }
        if (body.action === "draftEdit" || body.action === "issue") {
          const invoice = await tx.invoice.findFirst({
            where: {
              id: id.parse(body.invoiceId),
              propertyId: property.id,
              status: "DRAFT",
            },
          });
          if (!invoice)
            throw new Error("Hanya draft yang dapat diubah atau diterbitkan.");
          if (body.action === "issue") {
            await tx.invoice.update({
              where: { id: invoice.id },
              data: { status: "UNPAID", date: today() },
            });
            await audit("INVOICE_ISSUED", invoice.id);
            return { ok: true };
          }
          const input = z
            .object({
              due: date,
              items: z
                .array(
                  z.object({
                    label: z.string().min(1).max(100),
                    amount: z.number().int().min(-1000000000).max(1000000000),
                  }),
                )
                .min(1)
                .max(20),
            })
            .parse(body);
          const total = amount(input.items);
          if (total > 1000000000) throw new Error("Total maksimal Rp1 miliar.");
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { ...input, total },
          });
          await audit("INVOICE_DRAFT_UPDATED", invoice.id);
          return { ok: true };
        }
        if (body.action === "payment" || body.action === "void") {
          if (
            body.action === "payment" &&
            user.role === "STAFF" &&
            !user.canRecordPayments
          )
            throw new Error(
              "Izin mencatat pembayaran belum diberikan oleh pemilik.",
            );
          const invoice = await tx.invoice.findFirst({
            where: { id: id.parse(body.invoiceId), propertyId: property.id },
            include: { payments: true },
          });
          if (
            !invoice ||
            invoice.status === "VOID" ||
            (body.action === "payment" && invoice.status === "DRAFT")
          )
            throw new Error("Tagihan tidak tersedia atau belum diterbitkan.");
          const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
          if (body.action === "void") {
            owner();
            if (paid)
              throw new Error(
                "Tagihan dengan pembayaran tidak dapat dibatalkan.",
              );
            const reason = z.string().trim().min(5).max(200).parse(body.reason);
            await tx.invoice.update({
              where: { id: invoice.id },
              data: { status: "VOID" },
            });
            await audit("INVOICE_VOIDED", invoice.id, { reason });
            return { ok: true };
          }
          const input = z
            .object({
              amount: money.positive(),
              date,
              method: z.enum(["CASH", "TRANSFER", "QRIS", "OTHER"]),
              reference: z.string().max(100).default(""),
              confirmed: z.literal(true),
            })
            .parse(body);
          if (input.date > today())
            throw new Error("Tanggal pembayaran tidak boleh di masa depan.");
          paymentBalance(invoice.total, paid, input.amount);
          const payment = await tx.payment.create({
            data: {
              invoiceId: invoice.id,
              amount: input.amount,
              date: input.date,
              method: input.method,
              reference: input.reference,
              actorId: user.id,
            },
          });
          await audit("PAYMENT_RECORDED", payment.id, {
            amount: input.amount,
            invoiceId: invoice.id,
          });
          return payment;
        }
        if (body.action === "mockDevice") {
          owner();
          const d = await tx.device.create({
            data: {
              propertyId: property.id,
              name: "Lampu simulasi",
              capabilities: { power: { type: "boolean" } },
              state: { power: false },
            },
          });
          await audit("MOCK_DEVICE_CREATED", d.id);
          return d;
        }
        if (body.action === "mockLock") {
          owner();
          const input = z
            .object({
              roomId: id,
              name: z
                .string()
                .trim()
                .min(2)
                .max(100)
                .default("Kunci kamar simulasi"),
            })
            .parse(body);
          const room = await tx.room.findFirst({
            where: { id: input.roomId, propertyId: property.id },
          });
          if (!room) throw new Error("Kamar tidak ditemukan.");
          encryptSecret("configuration-check");
          const device = await tx.device.create({
            data: {
              propertyId: property.id,
              roomId: room.id,
              name: input.name,
              kind: "LOCK",
              provider: "MOCK",
              automationEnabled: true,
              capabilities: { access_active: { type: "boolean" } },
              state: { access_active: false },
            },
          });
          const synchronization = await syncRoomAccess(
            tx,
            room.id,
            today(),
            user.id,
            org.id,
          );
          await audit("MOCK_LOCK_CREATED", device.id, {
            roomId: room.id,
            mode: "SIMULATION",
          });
          return { id: device.id, synchronization };
        }
        if (body.action === "automation" || body.action === "syncAccess") {
          if (body.action === "automation") owner();
          else if (user.role !== "OWNER" && !user.canControlDevices)
            throw new Error("Izin kontrol perangkat belum diberikan.");
          const device = await tx.device.findFirst({
            where: { id: id.parse(body.deviceId), propertyId: property.id },
          });
          if (
            !device ||
            device.kind !== "LOCK" ||
            device.provider !== "MOCK" ||
            !device.roomId
          )
            throw new Error("Petakan kunci simulasi ke kamar terlebih dahulu.");
          if (body.action === "automation") {
            const enabled = z.boolean().parse(body.enabled);
            if (enabled) encryptSecret("configuration-check");
            await tx.device.update({
              where: { id: device.id },
              data: { automationEnabled: enabled },
            });
            await audit("SMART_ACCESS_AUTOMATION_UPDATED", device.id, {
              enabled,
              mode: "SIMULATION",
            });
          }
          return syncRoomAccess(tx, device.roomId, today(), user.id, org.id);
        }
        if (body.action === "device") {
          if (user.role !== "OWNER" && !user.canControlDevices)
            throw new Error(
              "Izin kontrol perangkat belum diberikan oleh pemilik.",
            );
          const d = await tx.device.findFirst({
            where: { id: id.parse(body.deviceId), propertyId: property.id },
          });
          if (!d || d.provider !== "MOCK")
            throw new Error("Perangkat tidak tersedia.");
          if (d.kind === "LOCK")
            throw new Error("Kunci dikelola melalui otomasi masa tinggal.");
          const command = z
            .object({
              code: z.string(),
              value: z.union([z.boolean(), z.number()]),
            })
            .parse(body.command);
          const provider = new MockTuyaProvider([d as unknown as SmartDevice]);
          try {
            const result = await provider.sendDeviceCommand(d.id, command);
            await tx.device.update({
              where: { id: d.id },
              data: { state: result.state, syncedAt: new Date() },
            });
            await audit("MOCK_COMMAND_CONFIRMED", d.id, { command });
            return result;
          } catch (e) {
            await audit("MOCK_COMMAND_FAILED", d.id, { code: command.code });
            return {
              commandError: e instanceof Error ? e.message : "Perintah gagal.",
            };
          }
        }
        if (body.action === "mapDevice") {
          owner();
          const d = await tx.device.findFirst({
            where: { id: id.parse(body.deviceId), propertyId: property.id },
          });
          const room = await tx.room.findFirst({
            where: { id: id.parse(body.roomId), propertyId: property.id },
          });
          if (!d || !room)
            throw new Error("Kamar atau perangkat tidak ditemukan.");
          await tx.device.update({
            where: { id: d.id },
            data: { roomId: room.id },
          });
          await audit("DEVICE_MAPPED", d.id, { roomId: room.id });
          if (d.roomId)
            await syncRoomAccess(tx, d.roomId, today(), user.id, org.id);
          await syncRoomAccess(tx, room.id, today(), user.id, org.id);
          return { ok: true };
        }
        throw new Error("Tindakan tidak tersedia.");
      },
      { timeout: 15000 },
    );
    if (result && typeof result === "object" && "commandError" in result)
      return NextResponse.json({ error: result.commandError }, { status: 400 });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const message =
      e instanceof z.ZodError
        ? "Periksa semua isian formulir."
        : e instanceof Prisma.PrismaClientKnownRequestError
          ? "Data duplikat atau perubahan bersamaan. Muat ulang dan coba kembali."
          : e instanceof Error
            ? e.message
            : "Layanan tidak tersedia.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
