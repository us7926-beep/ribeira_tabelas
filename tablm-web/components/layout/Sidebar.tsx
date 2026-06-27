"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Props {
  vencendo7d?: number;
  vencendo3d?: number;
}

const NAV: { href: string; label: string }[] = [
  { href: "/benchmark", label: "Benchmark Competitivo" },
  { href: "/", label: "Dashboards de Vendas" },
  { href: "/flyers", label: "Análise por IA" },
  { href: "/promocoes", label: "Promoções" },
  { href: "/incorporadoras", label: "Carteira" },
  { href: "/simulador", label: "Simulador de Fluxo" },
  { href: "/incc", label: "Reajustar por INCC" },
];

function ehAtivo(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatarMoment() {
  const agora = new Date();
  const dd = String(agora.getDate()).padStart(2, "0");
  const mm = String(agora.getMonth() + 1).padStart(2, "0");
  const hh = String(agora.getHours()).padStart(2, "0");
  const mi = String(agora.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} · ${hh}:${mi}`;
}

export default function Sidebar({ vencendo7d = 0, vencendo3d = 0 }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [momento, setMomento] = useState("");

  useEffect(() => {
    setMomento(formatarMoment());
    const id = setInterval(() => setMomento(formatarMoment()), 60_000);
    return () => clearInterval(id);
  }, []);

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className="w-64 shrink-0 flex flex-col text-white p-[22px_16px]"
      style={{
        background:
          "linear-gradient(180deg,#1F40BC 0%,#16308F 60%,#102678 100%)",
      }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 mb-7 px-1">
        <div className="size-10 rounded-[11px] bg-white grid place-items-center text-royal font-extrabold text-[18px]">
          T
        </div>
        <div className="leading-tight">
          <div className="font-extrabold text-[17px] text-white">TabLM</div>
          <div className="text-[10.5px] text-white/60 mt-0.5">
            Ribeira Empreendimentos
          </div>
        </div>
      </Link>

      {/* Label MENU */}
      <div className="text-[10.5px] font-bold tracking-[1.4px] text-white/45 uppercase px-3 mb-3">
        Menu
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1">
        {NAV.map((item) => {
          const ativo = ehAtivo(item.href, pathname);
          const mostraBadge = item.href === "/promocoes" && vencendo7d > 0;
          const tomUrgente = vencendo3d > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                ativo
                  ? "flex items-center gap-3 px-3 py-[11px] rounded-[11px] bg-white/[0.16] text-white font-semibold text-[14px]"
                  : "flex items-center gap-3 px-3 py-[11px] rounded-[11px] text-white/[0.78] hover:bg-white/[0.08] hover:text-white font-medium text-[14px] transition-colors"
              }
            >
              <span
                className={
                  ativo
                    ? "w-[7px] h-[7px] rounded-full bg-white shrink-0"
                    : "w-[7px] h-[7px] rounded-full bg-white/30 shrink-0"
                }
              />
              <span className="flex-1">{item.label}</span>
              {mostraBadge && (
                <span
                  title={`${vencendo7d} promoção(ões) vencendo em até 7 dias`}
                  className={
                    tomUrgente
                      ? "ml-auto inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#FF4D4F] text-white text-[11px] font-extrabold tnum shrink-0"
                      : "ml-auto inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#F2A93B] text-white text-[11px] font-extrabold tnum shrink-0"
                  }
                >
                  {vencendo7d}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Rodapé: usuário + sair */}
      <div className="mt-4 flex items-center gap-3 bg-white/[0.08] rounded-[12px] p-[10px_12px]">
        <div className="size-9 rounded-full bg-white/15 grid place-items-center text-white font-bold text-[14px]">
          L
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-bold text-white">Leonardo</div>
          <div className="text-[11px] text-white/55 tnum">{momento || "—"}</div>
        </div>
        <button
          onClick={sair}
          className="text-[12px] font-bold text-white/75 hover:text-white"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
