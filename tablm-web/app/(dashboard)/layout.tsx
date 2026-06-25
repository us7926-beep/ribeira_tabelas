import Sidebar from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <main className="flex-1 min-w-0 px-[38px] py-[30px]">
        <div className="max-w-[1160px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
