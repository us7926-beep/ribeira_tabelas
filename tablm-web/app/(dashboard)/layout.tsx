import Sidebar from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-line flex items-center px-8">
          <div className="text-sm text-muted">Ribeira Empreendimentos</div>
        </header>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
