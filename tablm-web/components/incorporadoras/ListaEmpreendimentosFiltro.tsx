"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Chip } from "@/components/ui/Chip";
import type { Empreendimento } from "@/types";

const campo =
  "w-full px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition";

/** Lista de empreendimentos com busca client-side por nome/bairro. */
export function ListaEmpreendimentosFiltro({ lista }: { lista: Empreendimento[] }) {
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return lista;
    return lista.filter(
      (e) =>
        e.nome.toLowerCase().includes(termo) ||
        (e.bairro ?? "").toLowerCase().includes(termo) ||
        (e.cidade ?? "").toLowerCase().includes(termo),
    );
  }, [busca, lista]);

  return (
    <div className="flex flex-col gap-3 tablm-up">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={`🔍 Buscar entre ${lista.length} empreendimento(s)…`}
          className={`${campo} max-w-[420px]`}
        />
        {busca && (
          <span className="text-[12.5px] text-muted">
            {filtradas.length} encontrado(s)
          </span>
        )}
      </div>

      {filtradas.length === 0 ? (
        <div className="text-[14px] text-muted">
          Nenhum empreendimento encontrado com &quot;{busca}&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtradas.map((emp) => (
            <Link
              key={emp.id}
              href={`/empreendimentos/${emp.id}`}
              className="bg-white border border-line rounded-[14px] p-[18px_20px] shadow-[0_1px_3px_rgba(20,40,90,0.05)] hover:border-royal transition-colors block"
            >
              <div className="font-bold text-ink text-[15px]">{emp.nome}</div>
              <div className="text-[12.5px] text-faint mt-0.5">
                {[emp.bairro, emp.cidade].filter(Boolean).join(" · ") || "—"}
              </div>
              {emp.padrao && (
                <div className="mt-2">
                  <Chip tom="royal">{emp.padrao}</Chip>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
