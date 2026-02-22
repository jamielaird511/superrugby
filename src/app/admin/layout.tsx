import AdminHeader from "@/components/admin/AdminHeader";
import AdminNavTiles from "@/components/admin/AdminNavTiles";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <AdminHeader />
          <AdminNavTiles />
        </div>
        {children}
      </div>
    </div>
  );
}
