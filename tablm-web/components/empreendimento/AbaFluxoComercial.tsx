"use client";

import { useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";
import { KpiDelta } from "@/components/ui/KpiDelta";
import type { FluxoComercial } from "@/types";

function moeda(n: number | null | undefined): string {
  if (n == null) return "—";
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}

interface Props {
  empreendimentoId: string;
}

export function AbaFluxoComercial({ empreendimentoId }: Props) {
  const [dados, setDados] = useState<FluxoComercial | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    (async () => {
      setCarregando(true);
      try {
        const r = await fetch(`/api/empreendimentos/${empreendimentoId}/fluxo-comercial`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.detail ?? "Falha ao carregar fluxo");
        setDados(d as FluxoComercial);
      } catch (e) {
        setErro((e as Error).message);
      } finally {
        setCarregando(false);
      }
    })();
  }, [empreendimentoId]);

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
        <div className="text-[12px] font-bold tracking-[1.4px] uppercase text-muted mb-1">
          Versão da tabela
        </div>
        <div className="text-[16px] font-bold text-ink">{dados.versao}</div>

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
