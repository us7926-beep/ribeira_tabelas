"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/", label: "Visão geral", icone: "▦" },
  { href: "/incorporadoras", label: "Incorporadoras", icone: "▤" },
  { href: "/flyers", label: "Análise de Flyer", icone: "✦" },
  { href: "/benchmark", label: "Benchmark", icone: "◷" },
  { href: "/benchmark/eventos", label: "Eventos & Promoções", icone: "◈" },
  { href: "/mercado", label: "Mercado", icone: "⊞" },
  { href: "/vendas", label: "Vendas", icone: "▲" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-64 shrink-0 bg-sidebar text-white/80 flex flex-col">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10">
        <div className="size-9 rounded-lg bg-royal grid place-items-center font-extrabold text-white">T</div>
        <div>
          <div className="font-bold text-white leading-none">TabLM</div>
          <div className="text-[10px] tracking-[0.15em] text-white/45 mt-0.5">RIBEIRA</div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV.map((item) => {
          const ativo =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                ativo ? "bg-white/10 text-white" : "hover:bg-white/5"
              }`}
            >
              {ativo && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-royal" />
              )}
              <span className="w-4 text-center opacity-70">{item.icone}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={sair}
        className="m-3 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/5 text-left"
      >
        ↪ Sair
      </button>
    </aside>
  );
}
