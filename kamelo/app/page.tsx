import { ApprovedLanding } from "@/components/marketing/approved-landing";
import { approvedMarkup } from "@/lib/marketing/approved-markup";
import { plans } from "@/lib/plans";
import "./marketing.css";

export const viewport = { themeColor: "#123e31" };

export const metadata = {
  title: "Kamelo by ELENIO — Kelola Kos & Guest House Lebih Mudah",
  description:
    "Kelola kamar, penghuni, tagihan, dan pekerjaan harian kos atau guest house bersama Kamelo. Tersedia pilihan CCTV & AI serta Smart Room sesuai kebutuhan.",
  openGraph: {
    type: "website",
    title: "Kamelo — Kelola Kos & Guest House Lebih Mudah",
    description:
      "Kamar, penghuni, tagihan, dan pekerjaan harian dalam satu platform.",
  },
  twitter: { card: "summary" },
};
export default function Home() {
  const markup = approvedMarkup.replace(
    /\[\[(price|rooms|properties|users):(free|starter|plus)\]\]/g,
    (_, field, id) => {
      const plan = plans.find((plan) => plan.id === id)!;
      const value = plan[field as "price" | "rooms" | "properties" | "users"];
      return field === "price"
        ? "Rp" + new Intl.NumberFormat("id-ID").format(value)
        : String(value);
    },
  );
  return <ApprovedLanding markup={markup} />;
}
