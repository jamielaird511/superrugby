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
          <h1 className="text-3xl font-semibold text-black dark:text-zinc-50 mb-4">
            Admin
          </h1>
          <AdminNavTiles />
        </div>
        {children}
      </div>
    </div>
  );
}
