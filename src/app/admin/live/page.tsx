import LiveBoard from "@/components/admin/live-board";

export const metadata = { title: "Live" };
export const dynamic = "force-dynamic";

export default function LivePage() {
  return <LiveBoard />;
}