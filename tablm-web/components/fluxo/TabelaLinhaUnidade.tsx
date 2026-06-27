import { FLUXO_COLUNAS } from "@/lib/fluxoColunas";
import type { ResultadoLinha, SimuladorLinha } from "@/types";

interface Props {
  linha: SimuladorLinha;
  resultado: ResultadoLinha | undefined;
  colunasVisiveis: typeof FLUXO_COLUNAS;
}

function moeda(n: number): string {
  if (n === 0) return "0";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const CORES: Record<SimuladorLinha["cor"], string> = {
  royal: "border-l-4 border-royal",
  up: "border-l-4 border-up",
  warn: "border-l-4 border-warn",
  down: "border-l-4 border-down",
};

/** Uma linha da TabelaComparativa: identificação à esquerda (sticky)
 * + valores em R$ por coluna. Para colunas parceladas, mostra a
 * parcela unitária (já calculada no backend). */
export function TabelaLinhaUnidade({ linha, resultado, colunasVisiveis }: Props) {
  return (
    <tr className={`${CORES[linha.cor]} border-b border-line-soft`}>
      <td className="sticky left-0 z-10 bg-white px-4 py-3 align-top min-w-[220px]">
        <div className="text-[13.5px] font-bold text-ink truncate">
          {linha.empreendimentoNome}
        </div>
        <div className="text-[12px] text-muted mt-0.5">{linha.unidadeLabel}</div>
        <div className="text-[11.5px] text-faint mt-1 tnum">
          R$ {moeda(linha.valorUnidade)}
        </div>
      </td>
      {colunasVisiveis.map((col) => {
        const c = resultado?.colunas[col.id];
        const valor = c?.parcela ?? 0;
        return (
          <td
            key={col.id}
            className={`px-3 py-3 text-right tnum text-[13.5px] ${col.derivada ? "bg-royal-tint/30 font-bold text-royal-deep" : "text-ink"}`}
            title={
              c
                ? `total R$ ${moeda(c.total)} · parcela R$ ${moeda(c.parcela)}`
                : undefined
            }
          >
            {moeda(valor)}
          </td>
        );
      })}
    </tr>
  );
}
