import AdminNav from "@/components/admin/admin-nav";

export const metadata = { title: "Admin" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full bg-background">
      <AdminNav />
      <div className="min-w-0 flex-1">
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}