"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Chip } from "@/components/ui/Chip";
import type { Empreendimento, EventoPromocional } from "@/types";

const campo =
  "w-full px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition";

function temPromocaoAtivaHoje(eventos: EventoPromocional[]): boolean {
  const hoje = new Date().toISOString().slice(0, 10);
  return eventos.some(
    (ev) =>
      (ev.data_fim ?? "9999-12-31") >= hoje &&
      (ev.data_inicio ?? "0000-01-01") <= hoje,
  );
}

interface Props {
  lista: Empreendimento[];
  eventos?: EventoPromocional[];
}

/** Lista de empreendimentos com busca client-side por nome/bairro. */
export function ListaEmpreendimentosFiltro({ lista, eventos = [] }: Props) {
  const [busca, setBusca] = useState("");

  // Mapa empreendimento_id -> tem promoção ativa hoje?
  const promoAtiva = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const emp of lista) {
      const meus = eventos.filter((ev) => ev.empreendimento_id === emp.id);
      if (temPromocaoAtivaHoje(meus)) m.set(emp.id, true);
    }
    return m;
  }, [lista, eventos]);

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
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold text-ink text-[15px] min-w-0 truncate">
                  {emp.nome}
                </div>
                {promoAtiva.has(emp.id) && (
                  <Chip tom="up" className="shrink-0">
                    🔥 promoção
                  </Chip>
                )}
              </div>
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
