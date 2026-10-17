import { PrismaClient } from "../generated/prisma/index.js";
import { demoProperty } from "../lib/demo.ts";
const db = new PrismaClient();
try {
  for (const hotel of [false, true]) {
    const source = demoProperty(hotel),
      organizationId = "demo-org-" + source.id,
      propertyId = "demo-property-" + source.id;
    await db.organization.upsert({
      where: { id: organizationId },
      update: {},
      create: {
        id: organizationId,
        name: "DEMO " + source.name,
        plan: "starter",
      },
    });
    await db.property.upsert({
      where: { id: propertyId },
      update: {},
      create: {
        id: propertyId,
        organizationId,
        name: "DEMO " + source.name,
        type: source.type,
        city: source.city,
      },
    });
    for (const r of source.rooms) {
      const roomId = "demo-room-" + r.id;
      await db.room.upsert({
        where: { id: roomId },
        update: {},
        create: { id: roomId, propertyId, number: r.number, rate: r.rate },
      });
      for (const s of r.stays) {
        const guestId = "demo-guest-" + r.id;
        await db.guest.upsert({
          where: { id: guestId },
          update: {},
          create: { id: guestId, propertyId, name: s.guest.name, phone: "" },
        });
        await db.stay.upsert({
          where: { id: "demo-" + s.id },
          update: {},
          create: {
            id: "demo-" + s.id,
            roomId,
            guestId,
            start: s.start,
            end: s.end,
            rate: s.rate,
            billingDay: s.billingDay,
            status: s.status,
          },
        });
      }
    }
    for (const i of source.invoices) {
      const invoiceId = "demo-" + i.id;
      await db.invoice.upsert({
        where: { id: invoiceId },
        update: {},
        create: {
          id: invoiceId,
          propertyId,
          roomId: "demo-room-" + i.room.id,
          guestId: "demo-guest-" + i.room.id,
          stayId: "demo-" + i.stayId,
          number: source.id.toUpperCase() + "-" + i.number,
          date: i.date,
          due: i.due,
          items: i.items,
          total: i.total,
        },
      });
      for (const p of i.payments)
        await db.payment.upsert({
          where: { id: source.id + "-" + p.id },
          update: {},
          create: {
            ...p,
            id: source.id + "-" + p.id,
            invoiceId,
            actorId: "demo-seed",
          },
        });
    }
    for (const d of source.devices)
      await db.device.upsert({
        where: { id: "demo-" + source.id + "-" + d.id },
        update: {},
        create: {
          id: "demo-" + source.id + "-" + d.id,
          propertyId,
          roomId: "demo-room-" + d.roomId,
          name: d.name,
          online: d.online,
          capabilities: d.capabilities,
          state: d.state,
        },
      });
  }
  console.log(
    "Repeatable isolated Kos Melati and Guest House Harmoni database seeds complete. No login credentials created.",
  );
} finally {
  await db.$disconnect();
}
