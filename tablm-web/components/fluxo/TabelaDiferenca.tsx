import { FLUXO_COLUNAS } from "@/lib/fluxoColunas";

interface Props {
  diferencas: Record<string, number>;
  colunasVisiveis: typeof FLUXO_COLUNAS;
}

function moeda(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Linha de diferença entre as 2 primeiras linhas da tabela.
 * Positivo (linha A mais cara) -> vermelho; negativo -> verde; zero -> traço. */
export function TabelaDiferenca({ diferencas, colunasVisiveis }: Props) {
  return (
    <tr className="border-b border-line-soft bg-thead">
      <td className="sticky left-0 z-10 bg-thead px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.5px] text-muted">
        Diferença R$ (A − B)
      </td>
      {colunasVisiveis.map((col) => {
        const d = diferencas[col.id] ?? 0;
        const tom =
          d > 0.01
            ? "text-down-strong"
            : d < -0.01
              ? "text-up-strong"
              : "text-faint";
        const valor =
          Math.abs(d) < 0.01
            ? "—"
            : `${d > 0 ? "+" : ""}${moeda(d)}`;
        return (
          <td
            key={col.id}
            className={`px-3 py-2.5 text-right tnum text-[12.5px] font-bold ${tom}`}
          >
            {valor}
          </td>
        );
      })}
    </tr>
  );
}
