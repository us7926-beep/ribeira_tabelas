/** Fonte ÚNICA da verdade para colunas do Simulador de Fluxo Comercial.
 *
 * Tanto `TabelaComparativa` quanto `FluxoGridConfig` iteram sobre este
 * array — não hardcode colunas em outro lugar. Mudar a ordem ou os labels
 * aqui propaga automaticamente para a tabela e para o grid de configuração.
 *
 * Sincronizada com `FluxoConfig` em `api/fluxo_simulador.py` (mesmas keys).
 */

export type FluxoColunaId =
  | "ato"
  | "dias30"
  | "dias60"
  | "dias90"
  | "mensais"
  | "anuais"
  | "semestrais"
  | "parcela_unica"
  | "financiamento";

export interface FluxoColuna {
  id: FluxoColunaId;
  label: string;
  /** Quando true, a coluna sempre aparece na tabela (mesmo sem valor). */
  sempreVisivel: boolean;
  /** Quando true, o input pede quantidade de parcelas. */
  aceitaQuantidade: boolean;
  /** Quando true, percentual é derivado (100 - soma dos demais) e
   * exibido como read-only. */
  derivada: boolean;
}

export const FLUXO_COLUNAS: readonly FluxoColuna[] = [
  { id: "ato", label: "Ato", sempreVisivel: true, aceitaQuantidade: false, derivada: false },
  { id: "dias30", label: "30 Dias", sempreVisivel: false, aceitaQuantidade: false, derivada: false },
  { id: "dias60", label: "60 Dias", sempreVisivel: false, aceitaQuantidade: false, derivada: false },
  { id: "dias90", label: "90 Dias", sempreVisivel: false, aceitaQuantidade: false, derivada: false },
  { id: "mensais", label: "Mensais", sempreVisivel: false, aceitaQuantidade: true, derivada: false },
  { id: "anuais", label: "Anuais", sempreVisivel: false, aceitaQuantidade: true, derivada: false },
  { id: "semestrais", label: "Semestrais", sempreVisivel: false, aceitaQuantidade: true, derivada: false },
  { id: "parcela_unica", label: "Parcela Única", sempreVisivel: false, aceitaQuantidade: false, derivada: false },
  { id: "financiamento", label: "Financiamento", sempreVisivel: true, aceitaQuantidade: false, derivada: true },
] as const;
