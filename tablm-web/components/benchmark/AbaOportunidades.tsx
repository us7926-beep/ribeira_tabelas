"use client";

import { Fragment } from "react";

import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { montarHeatmap } from "@/lib/benchmark";
import type { Empreendimento } from "@/types";

interface Props {
  empreendimentos: Empreendimento[];
  ribeiraId?: string;
}

interface Janela {
  faixa: string;
  oferta: string;
  janela: { rotulo: string; tom: "up" | "warn" | "neutro" };
}

/** Deriva janelas do PRÓPRIO heatmap: célula sem concorrente (GAP) = agir
 * agora; 1 concorrente = curto prazo; 2 = médio prazo. Nada inventado —
 * some quando a base não tem espaço claro. */
function derivarJanelas(
  grid: ReturnType<typeof montarHeatmap>["grid"],
  padroes: string[],
): Janela[] {
  const janelas: (Janela & { ordem: number })[] = [];
  for (const row of grid) {
    row.cells.forEach((cell, i) => {
      const n = cell.gap ? 0 : cell.n;
      if (n > 2) return;
      janelas.push({
        faixa: `${padroes[i]} · ${row.bairro}`,
        oferta: n === 0 ? "0 produtos" : n === 1 ? "1 produto" : `${n} produtos`,
        janela:
          n === 0
            ? { rotulo: "Agir agora", tom: "up" }
            : n === 1
              ? { rotulo: "Curto prazo", tom: "warn" }
              : { rotulo: "Médio prazo", tom: "neutro" },
        ordem: n,
      });
    });
  }
  return janelas.sort((a, b) => a.ordem - b.ordem).slice(0, 5);
}

export function AbaOportunidades({ empreendimentos, ribeiraId }: Props) {
  const { padroes, grid } = montarHeatmap(empreendimentos, ribeiraId);
  const janelas = derivarJanelas(grid, padroes);

  return (
    <div className="flex flex-col gap-5 tablm-up">
      <Card variant="lg">
        <div className="text-[16px] font-bold text-ink mb-0.5">
          Mapa de cobertura — território × padrão
        </div>
        <div className="text-[12.5px] text-muted mb-5">
          Densidade da oferta. Células vazias = espaço sem concorrência direta.
        </div>

        <div className="grid grid-cols-[130px_repeat(4,1fr)] gap-2 items-center">
          <div />
          {padroes.map((c) => (
            <div
              key={c}
              className="text-center text-[12px] font-bold text-muted uppercase tracking-[0.3px]"
            >
              {c}
            </div>
          ))}
          {grid.map((row) => (
            <Fragment key={row.bairro}>
              <div className="text-[13px] font-semibold text-body">{row.bairro}</div>
              {row.cells.map((cell, i) =>
                cell.gap ? (
                  <div
                    key={i}
                    className="h-[46px] rounded-[9px] border-[1.5px] border-dashed border-royal bg-[#F4F7FE] grid place-items-center text-[10.5px] font-extrabold text-royal tracking-[0.4px]"
                  >
                    GAP
                  </div>
                ) : (
                  <div
                    key={i}
                    className="h-[46px] rounded-[9px] grid place-items-center text-[12.5px] font-bold tnum"
                    style={{ background: cell.bg, color: cell.text }}
                  >
                    {cell.n}
                  </div>
                ),
              )}
            </Fragment>
          ))}
        </div>

        <div className="flex items-center gap-4 mt-4 text-[11.5px] text-faint font-semibold">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-[#EAF0FE]" /> baixa oferta
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-[#2347C5]" /> alta oferta
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm border-[1.5px] border-dashed border-royal bg-[#F4F7FE]" />
            oportunidade
          </span>
        </div>
      </Card>

      <Card variant="lg">
        <div className="text-[16px] font-bold text-ink mb-0.5">
          Janelas de oportunidade priorizadas
        </div>
        <div className="text-[12.5px] text-muted mb-4">
          Derivadas do mapa acima: territórios × padrão com pouca ou nenhuma
          concorrência direta cadastrada.
        </div>
        {janelas.length === 0 ? (
          <div className="text-[13.5px] text-muted">
            Nenhuma janela clara — todos os territórios mapeados têm 3+
            produtos concorrentes. Cadastre mais empreendimentos na base para
            refinar a leitura.
          </div>
        ) : (
          <div className="overflow-x-auto border border-line-soft rounded-[12px]">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-[1.6fr_1fr_140px] bg-thead text-[12px] font-bold text-muted uppercase tracking-[0.4px]">
                <div className="px-4 py-3">Padrão / Território</div>
                <div className="px-4 py-3">Oferta concorrente</div>
                <div className="px-4 py-3 text-right">Janela</div>
              </div>
              {janelas.map((j) => (
                <div
                  key={j.faixa}
                  className="grid grid-cols-[1.6fr_1fr_140px] border-t border-line-soft text-[14px] items-center"
                >
                  <div className="px-4 py-[13px] font-semibold text-body">{j.faixa}</div>
                  <div className="px-4 py-[13px] tnum text-body">{j.oferta}</div>
                  <div className="px-4 py-[13px] text-right">
                    <Chip tom={j.janela.tom}>{j.janela.rotulo}</Chip>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
