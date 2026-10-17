import { demoProperty } from "./demo";
import type { TenantData } from "./tenant-types";
export function getDemoTenantData(hotel = false): TenantData {
  const property = demoProperty(hotel),
    invoice = property.invoices[3];
  const paid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  return {
    branding: "Kamelo by ELENIO",
    invoice: {
      number: invoice.number,
      customerName: invoice.guest.name,
      roomNumber: invoice.room.number,
      propertyName: property.name,
      date: invoice.date,
      due: invoice.due,
      total: invoice.total,
      paid,
      balance: invoice.total - paid,
      status: invoice.status,
      items: invoice.items,
      proofs: [],
    },
    access: {
      mode: "SIMULATION",
      status: "PENDING",
      validFrom: invoice.room.stays[0].start,
      validUntil: invoice.room.stays[0].end,
    },
  };
}
