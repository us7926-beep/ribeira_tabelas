"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { excluirEmpreendimento } from "@/app/(dashboard)/incorporadoras/actions";
import { Chip } from "@/components/ui/Chip";
import { baixarCsv, montarCsv } from "@/lib/csv";
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
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function excluir(emp: Empreendimento) {
    if (!confirm(`Excluir o empreendimento "${emp.nome}"? Documentos, tabelas de preços e histórico de vendas vinculados também somem. A ação não pode ser desfeita.`)) {
      return;
    }
    setExcluindoId(emp.id);
    setErroExclusao(null);
    startTransition(async () => {
      const resultado = await excluirEmpreendimento(emp.id, emp.incorporadora_id);
      if (!resultado.ok) {
        setErroExclusao(`Falha ao excluir "${emp.nome}": ${resultado.erro}`);
      }
      setExcluindoId(null);
    });
  }

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
        <button
          type="button"
          onClick={() => {
            if (filtradas.length === 0) return;
            const cabecalho = [
              "nome",
              "bairro",
              "cidade",
              "padrao",
              "preco_m2_medio",
              "ticket_medio",
              "vgv_total",
              "vso",
              "unidades_vendidas",
              "unidades_disponiveis",
              "total_unidades",
            ];
            const linhas = filtradas.map((e) => [
              e.nome,
              e.bairro ?? "",
              e.cidade ?? "",
              e.padrao ?? "",
              e.preco_m2_medio ?? "",
              e.ticket_medio ?? "",
              e.vgv_total ?? "",
              e.vso ?? "",
              e.unidades_vendidas ?? "",
              e.unidades_disponiveis ?? "",
              e.total_unidades_calc ?? e.total_unidades ?? "",
            ]);
            baixarCsv("empreendimentos.csv", montarCsv(cabecalho, linhas));
          }}
          disabled={filtradas.length === 0}
          className="ml-auto text-[12.5px] font-bold text-royal hover:underline disabled:text-faint disabled:no-underline"
        >
          Baixar CSV
        </button>
      </div>

      {erroExclusao && (
        <div className="rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line">
          {erroExclusao}
        </div>
      )}

      {filtradas.length === 0 ? (
        <div className="text-[14px] text-muted">
          Nenhum empreendimento encontrado com &quot;{busca}&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtradas.map((emp) => {
            const excluindo = excluindoId === emp.id;
            return (
              <Link
                key={emp.id}
                href={`/empreendimentos/${emp.id}`}
                className={`relative bg-white border border-line rounded-[14px] p-[18px_20px] shadow-[0_1px_3px_rgba(20,40,90,0.05)] hover:border-royal transition-colors block ${excluindo ? "opacity-50 pointer-events-none" : ""}`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    excluir(emp);
                  }}
                  disabled={excluindo}
                  aria-label={`Excluir ${emp.nome}`}
                  title="Excluir empreendimento"
                  className="absolute top-2 right-2 w-7 h-7 rounded-full text-faint hover:text-down-strong hover:bg-down-bg grid place-items-center text-[18px] leading-none transition-colors"
                >
                  {excluindo ? "…" : "×"}
                </button>
                <div className="flex items-start justify-between gap-2 pr-7">
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
            );
          })}
        </div>
      )}
    </div>
  );
}
