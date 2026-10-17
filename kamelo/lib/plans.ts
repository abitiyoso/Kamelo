export const plans = [
  {
    id: "free",
    name: "Gratis",
    price: 0,
    rooms: 5,
    properties: 1,
    users: 1,
    recurring: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: 49000,
    rooms: 20,
    properties: 1,
    users: 2,
    recurring: true,
  },
  {
    id: "plus",
    name: "Plus",
    price: 99000,
    rooms: 50,
    properties: 3,
    users: 5,
    recurring: true,
  },
] as const;
export const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
