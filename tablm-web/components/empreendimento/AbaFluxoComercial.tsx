"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { KpiDelta } from "@/components/ui/KpiDelta";
import { baixarCsv, montarCsv } from "@/lib/csv";
import type { DistribuicaoModalidade, FluxoComercial } from "@/types";

function moeda(n: number | null | undefined): string {
  if (n == null) return "—";
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function formatarMes(yyyymm: string): string {
  const m = yyyymm.match(/^(\d{4})-(\d{2})/);
  if (!m) return yyyymm;
  return `${MESES[Number(m[2]) - 1]} ${m[1]}`;
}

interface Props {
  empreendimentoId: string;
}

export function AbaFluxoComercial({ empreendimentoId }: Props) {
  const [dados, setDados] = useState<FluxoComercial | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([]);
  const [mesSelecionado, setMesSelecionado] = useState<string>("");

  // Carrega lista de meses com distribuição cadastrada (uma vez)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(
          `/api/empreendimentos/${empreendimentoId}/vendas-mensais/distribuicao`,
        );
        const d = await r.json();
        if (Array.isArray(d)) {
          const set = new Set<string>();
          for (const linha of d as DistribuicaoModalidade[]) {
            if (linha.mes) set.add(linha.mes.slice(0, 7));
          }
          const lista = Array.from(set).sort().reverse();
          setMesesDisponiveis(lista);
          if (lista.length > 0 && !mesSelecionado) setMesSelecionado(lista[0]);
        }
      } catch {
        /* ok manter vazio — fica em "Estimado" */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empreendimentoId]);

  // Recarrega o comparativo quando o mês muda
  useEffect(() => {
    (async () => {
      setCarregando(true);
      try {
        const qs = mesSelecionado ? `?mes=${mesSelecionado}` : "";
        const r = await fetch(`/api/empreendimentos/${empreendimentoId}/fluxo-comercial${qs}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.detail ?? "Falha ao carregar fluxo");
        setDados(d as FluxoComercial);
      } catch (e) {
        setErro((e as Error).message);
      } finally {
        setCarregando(false);
      }
    })();
  }, [empreendimentoId, mesSelecionado]);

  const fonte = dados?.comparativo.fonte ?? "estimado";
  const totalVendas = dados?.comparativo.total_vendas ?? 0;
  const mesUsado = dados?.mes ?? mesSelecionado;
  const ehReal = useMemo(() => fonte === "real" && totalVendas > 0, [fonte, totalVendas]);

  if (carregando) {
    return (
      <Card className="tablm-up">
        <div className="text-[13.5px] text-muted">Calculando comparativo…</div>
      </Card>
    );
  }

  if (erro || !dados) {
    return (
      <Card className="tablm-up">
        <div className="text-[13.5px] text-muted">
          {erro || "Suba uma tabela de preços na aba anterior para calcular o fluxo comercial."}
        </div>
      </Card>
    );
  }

  const { comparativo } = dados;

  return (
    <div className="flex flex-col gap-5 tablm-up">
      <Card variant="lg">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <div className="text-[12px] font-bold tracking-[1.4px] uppercase text-muted mb-1">
              Versão da tabela
            </div>
            <div className="text-[16px] font-bold text-ink">{dados.versao}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {ehReal ? (
              <Chip tom="up">Real</Chip>
            ) : (
              <Chip tom="warn">Estimado</Chip>
            )}
            <span className="text-[12.5px] text-muted">
              {ehReal ? (
                <>
                  baseado em <b className="text-ink tnum">{totalVendas}</b> vendas
                  registradas em <b className="text-ink">{formatarMes(mesUsado ?? "")}</b>
                </>
              ) : (
                <>
                  distribuição uniforme — configure em{" "}
                  <Link className="text-royal font-semibold hover:underline" href="?aba=vendas">
                    Histórico de Vendas
                  </Link>
                </>
              )}
            </span>
            {mesesDisponiveis.length > 1 && (
              <select
                value={mesSelecionado}
                onChange={(e) => setMesSelecionado(e.target.value)}
                className="rounded-[10px] border border-line bg-white px-3 py-1.5 text-[12.5px] outline-none focus:border-royal"
              >
                {mesesDisponiveis.map((m) => (
                  <option key={m} value={m}>
                    {formatarMes(m)}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => {
                const linhas = comparativo.tipos.map((tipo) => {
                  const l = comparativo.por_tipo[tipo];
                  return [
                    tipo,
                    l.ticket_medio,
                    l.pct_total,
                    l.valor_medio_parcela ?? "",
                    l.n_parcelas ?? "",
                    l.unidades ?? "",
                  ];
                });
                const versaoSegura = (dados.versao || "tabela").replace(/[\\/\s]+/g, "_");
                const mesSegura = (mesUsado || "").replace(/[\\/\s]+/g, "_");
                const nome = `fluxo-comercial-${versaoSegura}${mesSegura ? `-${mesSegura}` : ""}.csv`;
                baixarCsv(
                  nome,
                  montarCsv(
                    [
                      "condicao",
                      "ticket_medio",
                      "pct_total",
                      "valor_medio_parcela",
                      "n_parcelas",
                      "unidades",
                    ],
                    linhas,
                  ),
                );
              }}
              disabled={comparativo.tipos.length === 0}
              className="text-[12.5px] font-bold text-royal hover:underline disabled:text-faint disabled:no-underline"
            >
              Baixar CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-line-soft rounded-[12px] mt-4">
          <table className="w-full text-[14px]">
            <thead className="bg-thead text-muted">
              <tr>
                <th className="text-left font-bold text-[12px] uppercase tracking-[0.4px] px-4 py-3">
                  Condição
                </th>
                <th className="text-right font-bold text-[12px] uppercase tracking-[0.4px] px-4 py-3">
                  Ticket médio
                </th>
                <th className="text-right font-bold text-[12px] uppercase tracking-[0.4px] px-4 py-3">
                  % do total
                </th>
                <th className="text-right font-bold text-[12px] uppercase tracking-[0.4px] px-4 py-3">
                  Parcela média
                </th>
                <th className="text-right font-bold text-[12px] uppercase tracking-[0.4px] px-4 py-3">
                  Nº parcelas
                </th>
              </tr>
            </thead>
            <tbody>
              {comparativo.tipos.map((tipo) => {
                const linha = comparativo.por_tipo[tipo];
                return (
                  <tr key={tipo} className="border-t border-line-soft">
                    <td className="px-4 py-[13px] font-semibold text-body">{tipo}</td>
                    <td className="px-4 py-[13px] text-right tnum font-bold text-ink">
                      {moeda(linha.ticket_medio)}
                    </td>
                    <td className="px-4 py-[13px] text-right tnum text-body">
                      {linha.pct_total}%
                    </td>
                    <td className="px-4 py-[13px] text-right tnum text-body">
                      {moeda(linha.valor_medio_parcela ?? null)}
                    </td>
                    <td className="px-4 py-[13px] text-right tnum text-body">
                      {linha.n_parcelas ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {comparativo.diferencas.length > 0 && (
        <Card variant="lg">
          <div className="text-[16px] font-bold text-ink mb-3">Diferenças entre condições</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {comparativo.diferencas.map((d, i) => (
              <div key={i} className="bg-thead border border-line-soft rounded-[12px] p-4">
                <div className="text-[12px] text-muted mb-1">
                  {d.de} → {d.para}
                </div>
                <div className="text-[18px] font-extrabold text-ink tnum">
                  {moeda(d.diferenca_reais)}
                </div>
                <KpiDelta direcao={d.diferenca_pct > 0 ? "alta" : d.diferenca_pct < 0 ? "baixa" : "neutro"}>
                  {Math.abs(d.diferenca_pct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                </KpiDelta>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
