"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { excluirIncorporadora } from "@/app/(dashboard)/incorporadoras/actions";
import { Chip } from "@/components/ui/Chip";
import type { Incorporadora } from "@/types";

const campo =
  "w-full px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition";

/** Lista de incorporadoras com busca client-side por nome. */
export function ListaIncorporadorasFiltro({ lista }: { lista: Incorporadora[] }) {
  const [busca, setBusca] = useState("");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function excluir(inc: Incorporadora) {
    if (!confirm(`Excluir a incorporadora "${inc.nome}"? Só funciona se não houver empreendimentos vinculados.`)) {
      return;
    }
    setExcluindoId(inc.id);
    setErroExclusao(null);
    startTransition(async () => {
      const resultado = await excluirIncorporadora(inc.id);
      if (!resultado.ok) {
        setErroExclusao(resultado.erro);
      }
      setExcluindoId(null);
    });
  }

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return lista;
    return lista.filter((i) => i.nome.toLowerCase().includes(termo));
  }, [busca, lista]);

  return (
    <div className="flex flex-col gap-3 tablm-up">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={`🔍 Buscar entre ${lista.length} incorporadora(s)…`}
          className={`${campo} max-w-[420px]`}
        />
        {busca && (
          <span className="text-[12.5px] text-muted">
            {filtradas.length} encontrada(s)
          </span>
        )}
      </div>

      {erroExclusao && (
        <div className="rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line">
          {erroExclusao}
        </div>
      )}

      {filtradas.length === 0 ? (
        <div className="text-[14px] text-muted">
          Nenhuma incorporadora encontrada com &quot;{busca}&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtradas.map((inc) => {
            const nossa = inc.nome.toLowerCase().includes("ribeira");
            const excluindo = excluindoId === inc.id;
            return (
              <Link
                key={inc.id}
                href={`/incorporadoras/${inc.id}`}
                className={`relative bg-white border border-line rounded-[14px] p-[18px_20px] shadow-[0_1px_3px_rgba(20,40,90,0.05)] hover:border-royal transition-colors flex items-center gap-3 ${excluindo ? "opacity-50 pointer-events-none" : ""}`}
              >
                <span
                  className={
                    nossa
                      ? "w-[10px] h-[10px] rounded-full bg-royal shrink-0"
                      : "w-[10px] h-[10px] rounded-full bg-[#D4DAE6] shrink-0"
                  }
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-ink text-[15px] truncate">{inc.nome}</div>
                  <div className="text-[12px] text-faint mt-0.5">
                    {nossa ? "Nossa" : "Concorrente"}
                  </div>
                </div>
                {nossa && <Chip tom="royal">RIBEIRA</Chip>}
                <span className="text-[12px] text-muted">→</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    excluir(inc);
                  }}
                  disabled={excluindo}
                  aria-label={`Excluir ${inc.nome}`}
                  title="Excluir incorporadora"
                  className="absolute top-2 right-2 w-7 h-7 rounded-full text-faint hover:text-down-strong hover:bg-down-bg grid place-items-center text-[18px] leading-none transition-colors"
                >
                  {excluindo ? "…" : "×"}
                </button>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
