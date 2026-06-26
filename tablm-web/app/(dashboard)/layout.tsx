import Sidebar from "@/components/layout/Sidebar";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { contarVencendo } from "@/lib/promocoes";
import type { EventoPromocional } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getToken();
  let vencendo7d = 0;
  let vencendo3d = 0;
  try {
    const eventos = await api<EventoPromocional[]>(
      "/benchmark/eventos?ativos=true",
      { token },
    );
    ({ vencendo7d, vencendo3d } = contarVencendo(eventos));
  } catch {
    /* backend indisponível — sidebar fica sem badge */
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar vencendo7d={vencendo7d} vencendo3d={vencendo3d} />
      <main className="flex-1 min-w-0 px-[38px] py-[30px]">
        <div className="max-w-[1160px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
