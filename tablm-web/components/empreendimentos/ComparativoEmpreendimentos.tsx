"use client";

import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import type { Empreendimento, Incorporadora } from "@/types";

interface Props {
  empreendimentos: Empreendimento[];
  mapIncorporadora: Map<string, Incorporadora>;
}

function moeda(n: number | null | undefined): string {
  if (n == null) return "—";
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}

function moedaCurta(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000) return `R$ ${(n / 1_000_000_000).toFixed(1)} bi`;
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)} mi`;
  if (n >= 1000) return `R$ ${Math.round(n / 1000)} mil`;
  return `R$ ${Math.round(n)}`;
}

interface LinhaMetrica {
  rotulo: string;
  /** Valor numérico para encontrar o líder. null = não comparável. */
  numerico: (e: Empreendimento) => number | null;
  /** Formato exibido na célula. */
  formatar: (e: Empreendimento) => string;
  /** Como interpretar "melhor": maior ou menor valor. */
  melhor?: "maior" | "menor";
}

const METRICAS: LinhaMetrica[] = [
  { rotulo: "Padrão", numerico: () => null, formatar: (e) => e.padrao ?? "—" },
  { rotulo: "Cidade", numerico: () => null, formatar: (e) => e.cidade ?? "—" },
  { rotulo: "Bairro", numerico: () => null, formatar: (e) => e.bairro ?? "—" },
  {
    rotulo: "Preço/m²",
    numerico: (e) => e.preco_m2_medio ?? null,
    formatar: (e) => moeda(e.preco_m2_medio),
    melhor: "maior",
  },
  {
    rotulo: "Ticket médio",
    numerico: (e) => e.ticket_medio ?? null,
    formatar: (e) => moedaCurta(e.ticket_medio),
    melhor: "maior",
  },
  {
    rotulo: "VGV total",
    numerico: (e) => e.vgv_total ?? null,
    formatar: (e) => moedaCurta(e.vgv_total),
    melhor: "maior",
  },
  {
    rotulo: "VSO",
    numerico: (e) => e.vso ?? null,
    formatar: (e) => (e.vso != null ? `${Math.round(e.vso)}%` : "—"),
    melhor: "maior",
  },
  {
    rotulo: "Unidades vendidas",
    numerico: (e) => e.unidades_vendidas ?? null,
    formatar: (e) => (e.unidades_vendidas != null ? String(e.unidades_vendidas) : "—"),
    melhor: "maior",
  },
  {
    rotulo: "Unidades disponíveis",
    numerico: (e) => e.unidades_disponiveis ?? null,
    formatar: (e) =>
      e.unidades_disponiveis != null ? String(e.unidades_disponiveis) : "—",
    melhor: "menor",
  },
  {
    rotulo: "Total unidades",
    numerico: (e) => e.total_unidades_calc ?? e.total_unidades ?? null,
    formatar: (e) => {
      const t = e.total_unidades_calc ?? e.total_unidades;
      return t != null ? String(t) : "—";
    },
    melhor: "maior",
  },
];

export function ComparativoEmpreendimentos({ empreendimentos, mapIncorporadora }: Props) {
  function lider(m: LinhaMetrica): string | null {
    if (!m.melhor) return null;
    const valores = empreendimentos
      .map((e) => ({ id: e.id, v: m.numerico(e) }))
      .filter((x): x is { id: string; v: number } => x.v != null);
    if (valores.length < 2) return null;
    const ordenados = [...valores].sort((a, b) =>
      m.melhor === "maior" ? b.v - a.v : a.v - b.v,
    );
    // Se todos empatados, ninguém é líder destacado.
    if (ordenados[0].v === ordenados[ordenados.length - 1].v) return null;
    return ordenados[0].id;
  }

  return (
    <Card variant="lg" className="tablm-up">
      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead className="bg-thead text-muted">
            <tr>
              <th className="text-left font-bold text-[11.5px] uppercase tracking-[0.4px] px-4 py-3 sticky left-0 bg-thead">
                Métrica
              </th>
              {empreendimentos.map((e) => {
                const inc = mapIncorporadora.get(e.incorporadora_id);
                return (
                  <th
                    key={e.id}
                    className="text-left font-bold text-[12.5px] px-4 py-3 min-w-[180px] text-ink"
                  >
                    <Link
                      href={`/empreendimentos/${e.id}`}
                      className="hover:text-royal hover:underline"
                    >
                      {e.nome}
                    </Link>
                    {inc && (
                      <div className="text-[11px] text-muted font-medium mt-0.5">
                        {inc.nome}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {METRICAS.map((m) => {
              const idLider = lider(m);
              return (
                <tr key={m.rotulo} className="border-t border-line-soft">
                  <td className="px-4 py-3 font-semibold text-body sticky left-0 bg-white">
                    {m.rotulo}
                  </td>
                  {empreendimentos.map((e) => {
                    const ehLider = e.id === idLider;
                    return (
                      <td
                        key={e.id}
                        className={
                          ehLider
                            ? "px-4 py-3 tnum font-extrabold text-up-strong bg-up-bg"
                            : "px-4 py-3 tnum text-ink"
                        }
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {m.formatar(e)}
                          {ehLider && <Chip tom="up">líder</Chip>}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[11.5px] text-faint mt-3">
        Célula verde = líder na métrica. Empate técnico não é destacado.
        Empreendimentos sem KPIs sincronizados aparecem como "—".
      </div>
    </Card>
  );
}
