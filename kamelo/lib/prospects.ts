import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { lifecycleDate, lifecycleWrite, lifecycleAudit } from "./lifecycle";
import { localToday } from "./operations";

const id = z.string().min(1).max(100);
const amount = z.number().int().min(0).max(1000000000);
const optionalDate = lifecycleDate.nullable().default(null);
const moment = z.iso.datetime({ offset: true }).nullable().default(null);
const fields = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().regex(/^(?:\+62|62|0)8\d{7,12}$/),
  email: z.union([z.literal(""), z.email().max(254)]).default(""),
  source: z.enum([
    "WEBSITE",
    "WHATSAPP",
    "INSTAGRAM",
    "REFERRAL",
    "WALK_IN",
    "OTHER",
  ]),
  interest: z.string().trim().max(300).default(""),
  roomId: id.nullable().default(null),
  requestedStart: optionalDate,
  requestedEnd: optionalDate,
  budget: amount.nullable().default(null),
  followUpAt: moment,
  notes: z.string().trim().max(2000).default(""),
});
export async function prospectWrite(
  tx: Prisma.TransactionClient,
  user: { id: string; organizationId: string },
  property: { id: string; type: string },
  body: Record<string, unknown>,
) {
  const action = String(body.action);
  async function activity(
    prospectId: string,
    revision: number,
    kind: string,
    note: string,
    metadata: Prisma.InputJsonObject = {},
  ) {
    await tx.prospectActivity.create({
      data: { prospectId, revision, kind, note, metadata, actorId: user.id },
    });
    await lifecycleAudit(
      tx,
      user.organizationId,
      user.id,
      "PROSPECT_" + kind,
      prospectId,
      { revision },
    );
  }
  async function validateInterest(p: z.infer<typeof fields>) {
    if (
      p.requestedEnd &&
      (!p.requestedStart || p.requestedEnd <= p.requestedStart)
    )
      throw Error("Tanggal akhir harus setelah tanggal mulai.");
    if (
      p.roomId &&
      !(await tx.room.count({
        where: { id: p.roomId, propertyId: property.id },
      }))
    )
      throw Error("Kamar tidak ditemukan pada properti ini.");
  }
  if (action === "prospectCreate") {
    const p = fields
      .extend({
        confirmed: z.literal(true),
        consentReference: z.string().trim().min(5).max(300),
      })
      .parse(body);
    await validateInterest(p);
    const { confirmed, ...data } = p;
    const row = await tx.prospect.create({
      data: {
        ...data,
        followUpAt: p.followUpAt ? new Date(p.followUpAt) : null,
        propertyId: property.id,
        createdBy: user.id,
      },
    });
    await activity(
      row.id,
      1,
      "CREATED",
      "Prospek dicatat dengan persetujuan kontak.",
    );
    return { prospectId: row.id };
  }
  const key = z
    .object({ prospectId: id, revision: z.number().int().min(1) })
    .parse(body);
  const row = await tx.prospect.findFirst({
    where: { id: key.prospectId, propertyId: property.id },
  });
  if (!row) throw Error("Prospek tidak ditemukan.");
  if (row.revision !== key.revision)
    throw Error("Prospek telah berubah. Muat ulang sebelum menyimpan.");
  if (row.stage === "CONVERTED")
    throw Error(
      "Prospek sudah menjadi penghuni. Kelola melalui Database Penghuni.",
    );
  const revision = row.revision + 1;
  if (action === "prospectUpdate") {
    const p = fields.parse(body);
    await validateInterest(p);
    await tx.prospect.update({
      where: { id: row.id },
      data: {
        ...p,
        followUpAt: p.followUpAt ? new Date(p.followUpAt) : null,
        revision,
      },
    });
    await activity(
      row.id,
      revision,
      "UPDATED",
      "Kontak, minat kamar, atau tindak lanjut diperbarui.",
      {
        before: {
          name: row.name,
          phone: row.phone,
          email: row.email,
          source: row.source,
          roomId: row.roomId,
          requestedStart: row.requestedStart,
          requestedEnd: row.requestedEnd,
          budget: row.budget,
          notes: row.notes,
        },
        after: p,
      },
    );
  } else if (action === "prospectNote") {
    const p = z
      .object({ note: z.string().trim().min(3).max(2000), followUpAt: moment })
      .parse(body);
    await tx.prospect.update({
      where: { id: row.id },
      data: {
        revision,
        followUpAt: p.followUpAt ? new Date(p.followUpAt) : null,
      },
    });
    await activity(row.id, revision, "FOLLOW_UP", p.note, {
      followUpAt: p.followUpAt,
    });
  } else if (action === "prospectStage") {
    const p = z
      .object({
        stage: z.enum(["NEW", "SURVEY", "OFFER", "LOST"]),
        surveyAt: moment,
        offerRent: amount.nullable().default(null),
        offerTerms: z.string().trim().max(2000).default(""),
        lossReason: z.string().trim().max(500).default(""),
      })
      .parse(body);
    if (row.stage === p.stage && p.stage !== "OFFER")
      throw Error("Tahap prospek tidak berubah.");
    if (row.stage === "LOST" && p.stage !== "NEW")
      throw Error("Buka kembali prospek ke tahap Baru terlebih dahulu.");
    if (
      p.stage === "SURVEY" &&
      (!p.surveyAt || new Date(p.surveyAt) <= new Date())
    )
      throw Error("Isi jadwal survei yang akan datang.");
    if (
      p.stage === "OFFER" &&
      (p.offerRent === null || p.offerTerms.length < 10)
    )
      throw Error("Isi tarif dan rincian penawaran.");
    if (p.stage === "LOST" && p.lossReason.length < 5)
      throw Error("Isi alasan prospek tidak dilanjutkan.");
    await tx.prospect.update({
      where: { id: row.id },
      data: {
        stage: p.stage,
        revision,
        ...(p.stage === "SURVEY" ? { surveyAt: new Date(p.surveyAt!) } : {}),
        ...(p.stage === "OFFER"
          ? { offerRent: p.offerRent, offerTerms: p.offerTerms }
          : {}),
        lossReason: p.stage === "LOST" ? p.lossReason : "",
        ...(p.stage === "LOST" ? { followUpAt: null } : {}),
      },
    });
    await activity(
      row.id,
      revision,
      "STAGE_CHANGED",
      "Tahap prospek diperbarui.",
      { from: row.stage, ...p },
    );
  } else if (action === "prospectConvert") {
    const p = z
      .object({
        confirmed: z.literal(true),
        guestId: id.nullable().default(null),
        roomId: id,
        start: lifecycleDate,
        end: lifecycleDate.optional(),
        rate: amount,
        billingDay: z.number().int().min(1).max(31),
      })
      .parse(body);
    if (row.stage !== "OFFER" || row.offerRent === null)
      throw Error("Siapkan penawaran sebelum membuat masa tinggal.");
    if (p.rate !== row.offerRent)
      throw Error(
        "Tarif berbeda dari penawaran. Perbarui penawaran terlebih dahulu.",
      );
    if (p.start < localToday())
      throw Error(
        "Konversi prospek menggunakan tanggal mulai hari ini atau setelahnya.",
      );
    let guestId = p.guestId;
    if (guestId) {
      if (
        !(await tx.guest.count({
          where: { id: guestId, propertyId: property.id },
        }))
      )
        throw Error("Profil penghuni tidak ditemukan pada properti ini.");
    } else {
      const guest = await tx.guest.create({
        data: { propertyId: property.id, name: row.name, phone: row.phone },
      });
      guestId = guest.id;
      await tx.residentProfile.create({ data: { guestId, email: row.email } });
    }
    // Reuse the same overlap, room readiness, property type and occupancy rules as returning residents.
    const result = await lifecycleWrite(tx, user, property, {
      action: "returnStay",
      guestId,
      roomId: p.roomId,
      start: p.start,
      end: p.end,
      rate: p.rate,
      billingDay: p.billingDay,
    });
    if (!("stayId" in result) || typeof result.stayId !== "string")
      throw Error("Masa tinggal belum dapat dibuat.");
    const stayId = result.stayId;
    await tx.prospect.update({
      where: { id: row.id },
      data: {
        stage: "CONVERTED",
        convertedStayId: stayId,
        followUpAt: null,
        revision,
      },
    });
    await activity(
      row.id,
      revision,
      "CONVERTED",
      "Masa tinggal dibuat. Kontrak, tagihan, dan undangan dikelola melalui alur masing-masing.",
      {
        guestId,
        stayId,
        existingProfile: Boolean(p.guestId),
        roomId: p.roomId,
        start: p.start,
        end: p.end || null,
        rate: p.rate,
      },
    );
    return { prospectId: row.id, stayId, guestId };
  } else throw Error("Tindakan prospek tidak dikenal.");
  return { prospectId: row.id };
}
