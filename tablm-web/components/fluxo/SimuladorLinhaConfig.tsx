"use client";

import { useState } from "react";

import { FluxoGridConfig } from "@/components/fluxo/FluxoGridConfig";
import { IndicadorSomaPercentual } from "@/components/fluxo/IndicadorSomaPercentual";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { somaPercentuais } from "@/lib/fluxo";
import type { FluxoConfig, SimuladorLinha } from "@/types";

interface Props {
  linha: SimuladorLinha;
  onUpdate: (mutator: (f: FluxoConfig) => FluxoConfig) => void;
  onRemove: () => void;
}

function moeda(n: number): string {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Card colapsável de uma linha: cabeçalho com identificação +
 * FluxoGridConfig + IndicadorSomaPercentual. Recebe os 3 props. */
export function SimuladorLinhaConfig({ linha, onUpdate, onRemove }: Props) {
  const [expandido, setExpandido] = useState(true);
  const soma = somaPercentuais(linha.fluxo);

  return (
    <Card variant="lg">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Chip tom={linha.cor}>Linha {linha.cor.toUpperCase()}</Chip>
            <div className="text-[15px] font-bold text-ink truncate">
              {linha.empreendimentoNome}
            </div>
            <span className="text-[12.5px] text-muted">· {linha.unidadeLabel}</span>
          </div>
          <div className="text-[12.5px] text-faint mt-1 tnum">
            Valor da unidade: <b className="text-ink">{moeda(linha.valorUnidade)}</b>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <IndicadorSomaPercentual soma={soma} />
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="text-[12.5px] font-bold text-royal hover:underline"
          >
            {expandido ? "Recolher" : "Expandir"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Remover "${linha.empreendimentoNome}" do simulador?`)) {
                onRemove();
              }
            }}
            aria-label="Remover linha"
            title="Remover linha"
            className="w-7 h-7 rounded-full text-faint hover:text-down-strong hover:bg-down-bg grid place-items-center text-[18px] leading-none transition-colors"
          >
            ×
          </button>
        </div>
      </div>

      {expandido && <FluxoGridConfig fluxo={linha.fluxo} onChange={onUpdate} />}
    </Card>
  );
}
