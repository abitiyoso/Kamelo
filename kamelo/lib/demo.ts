export function demoProperty(hotel = false) {
  const prefix = hotel ? "hotel" : "kos";
  const count = hotel ? 12 : 20;
  const rooms = Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i + 1}`,
    number: String(i + 1).padStart(2, "0"),
    rate: hotel ? 350000 : 1500000,
    operational: "READY",
    stays:
      i < (hotel ? 7 : 16)
        ? [
            {
              id: `stay-${prefix}-${i + 1}`,
              roomId: `${prefix}-${i + 1}`,
              status: hotel ? (i < 4 ? "CHECKED_IN" : "CONFIRMED") : "ACTIVE",
              start: hotel
                ? i < 4
                  ? "2026-10-12"
                  : i === 4
                    ? "2026-10-13"
                    : "2026-10-15"
                : "2026-10-01",
              end: hotel
                ? i === 0
                  ? "2026-10-13"
                  : i < 4
                    ? "2026-10-15"
                    : i === 4
                      ? "2026-10-14"
                      : "2026-10-17"
                : null,
              rate: hotel ? 350000 : 1500000,
              billingDay: hotel ? 10 : [1, 5, 10, 12, 15, 20][i % 6],
              guest: {
                id: `guest-${i}`,
                name: [
                  "Andi Pratama",
                  "Siti Rahma",
                  "Budi Santoso",
                  "Dewi Lestari",
                  "Rizky Saputra",
                  "Nadia Putri",
                  "Agus Wijaya",
                ][i % 7],
                phone: "",
              },
            },
          ]
        : [],
  }));
  const invoices = rooms.slice(0, 6).map((r, i) => ({
    id: `invoice-${prefix}-${i}`,
    number: `DEMO-2026-${String(i + 1).padStart(3, "0")}`,
    room: r,
    guest: r.stays[0].guest,
    stayId: r.stays[0].id,
    date: "2026-10-01",
    due: hotel
      ? "2026-10-10"
      : `2026-10-${String(r.stays[0].billingDay).padStart(2, "0")}`,
    total: hotel ? 700000 : 1500000,
    status: "UNPAID",
    items: [
      {
        label: hotel ? "Sewa 2 malam" : "Sewa kamar Oktober",
        amount: hotel ? 700000 : 1500000,
      },
    ],
    payments:
      i < 3
        ? [
            {
              id: `p-${i}`,
              amount: hotel ? 700000 : 1500000,
              date: "2026-10-05",
              method: "TRANSFER",
            },
          ]
        : i === 3
          ? [
              {
                id: `p-${i}`,
                amount: 500000,
                date: "2026-10-05",
                method: "CASH",
              },
            ]
          : [],
  }));
  return {
    id: prefix,
    name: hotel ? "Guest House Harmoni" : "Kos Melati",
    type: hotel ? "HOTEL" : "KOS",
    city: hotel ? "Bandung" : "Yogyakarta",
    rooms,
    guests: rooms.flatMap((r) => r.stays.map((s) => s.guest)),
    invoices,
    devices: [
      {
        id: "lamp",
        name: "Lampu kamar 01",
        roomId: rooms[0].id,
        online: true,
        provider: "MOCK",
        state: { power: true },
        capabilities: { power: { type: "boolean" } },
        syncedAt: "2026-10-13T02:00:00Z",
      },
      {
        id: "ac",
        name: "AC kamar 02",
        roomId: rooms[1].id,
        online: false,
        provider: "MOCK",
        state: { power: false },
        capabilities: { power: { type: "boolean" } },
        syncedAt: "2026-10-12T02:00:00Z",
      },
    ],
  };
}
