import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMenuByQrToken, getSessionByQrToken } from "@/lib/queries";
import CustomerMenu from "@/components/customer/customer-menu";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ qrToken: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { qrToken } = await params;
  const payload = getMenuByQrToken(qrToken);
  return { title: payload ? payload.restaurant.name : "Table not found" };
}

export default async function CustomerTablePage({ params }: Props) {
  const { qrToken } = await params;
  const payload = getMenuByQrToken(qrToken);
  if (!payload) notFound();
  const sessionInitial = getSessionByQrToken(qrToken);
  return <CustomerMenu qrToken={qrToken} payload={payload} sessionInitial={sessionInitial} />;
}