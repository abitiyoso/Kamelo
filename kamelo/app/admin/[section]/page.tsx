import Admin from "../page";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  if (!["organizations", "subscriptions"].includes((await params).section))
    notFound();
  return <Admin />;
}
