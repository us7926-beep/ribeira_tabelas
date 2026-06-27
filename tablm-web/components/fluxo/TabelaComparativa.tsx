"use client";

import { useMemo, useState } from "react";

import { TabelaDiferenca } from "@/components/fluxo/TabelaDiferenca";
import { TabelaLinhaUnidade } from "@/components/fluxo/TabelaLinhaUnidade";
import { Card } from "@/components/ui/Card";
import { FLUXO_COLUNAS } from "@/lib/fluxoColunas";
import type { ResultadoLinha, SimuladorLinha } from "@/types";

interface Props {
  linhas: SimuladorLinha[];
  resultados: Record<string, ResultadoLinha>;
  diferencas: Record<string, number> | null;
}

/** Tabela comparativa principal. Colunas iteradas a partir de
 * FLUXO_COLUNAS (fonte única). Coluna identificação sticky-left.
 * Toggle mostra/oculta colunas zeradas. */
export function TabelaComparativa({ linhas, resultados, diferencas }: Props) {
  const [mostrarZeradas, setMostrarZeradas] = useState(false);

  const colunasVisiveis = useMemo(() => {
    if (mostrarZeradas) return FLUXO_COLUNAS;
    return FLUXO_COLUNAS.filter((col) => {
      if (col.sempreVisivel) return true;
      // mostra se alguma linha tem percentual > 0 ou qtd > 0 nessa coluna
      return linhas.some((linha) => {
        const campo = linha.fluxo[col.id];
        if ("quantidade" in campo) {
          return campo.percentual > 0 || campo.quantidade > 0;
        }
        return campo.percentual > 0;
      });
    });
  }, [linhas, mostrarZeradas]);

  if (linhas.length === 0) {
    return (
      <Card>
        <div className="text-[13.5px] text-muted">
          Adicione um empreendimento para começar a simular.
        </div>
      </Card>
    );
  }

  return (
    <Card variant="lg">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <div className="text-[16px] font-bold text-ink">Tabela comparativa</div>
          <div className="text-[12.5px] text-muted mt-0.5">
            {colunasVisiveis.length} coluna(s) visível(is) ·{" "}
            {linhas.length} linha(s).
          </div>
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-body cursor-pointer">
          <input
            type="checkbox"
            checked={mostrarZeradas}
            onChange={(e) => setMostrarZeradas(e.target.checked)}
            className="w-4 h-4 accent-royal"
          />
          Mostrar colunas zeradas
        </label>
      </div>

      <div className="overflow-x-auto border border-line-soft rounded-[12px]">
        <table className="w-full text-[13.5px]">
          <thead className="bg-ink text-white">
            <tr>
              <th className="sticky left-0 z-20 bg-ink text-left font-bold text-[11.5px] uppercase tracking-[0.4px] px-4 py-3 min-w-[220px]">
                Empreendimento / Unidade
              </th>
              {colunasVisiveis.map((col) => (
                <th
                  key={col.id}
                  className={`px-3 py-3 text-right font-bold text-[11.5px] uppercase tracking-[0.4px] min-w-[110px] ${col.derivada ? "bg-royal text-white" : ""}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
            {/* Linha de percentuais (preview por linha — agregação textual) */}
            {linhas.length > 0 && (
              <tr className="bg-[#2A3A55] text-white text-[12px]">
                <th className="sticky left-0 z-20 bg-[#2A3A55] text-left font-semibold uppercase tracking-[0.3px] px-4 py-2">
                  % por linha (linha 1)
                </th>
                {colunasVisiveis.map((col) => {
                  const p = linhas[0].fluxo[col.id].percentual;
                  return (
                    <th
                      key={col.id}
                      className="px-3 py-2 text-right tnum font-semibold"
                    >
                      {p.toFixed(2)}%
                    </th>
                  );
                })}
              </tr>
            )}
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <TabelaLinhaUnidade
                key={linha.id}
                linha={linha}
                resultado={resultados[linha.id]}
                colunasVisiveis={colunasVisiveis}
              />
            ))}
            {diferencas && linhas.length >= 2 && (
              <TabelaDiferenca
                diferencas={diferencas}
                colunasVisiveis={colunasVisiveis}
              />
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
