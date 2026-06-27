import type {
  CalculoRendaRequest,
  CalculoRendaResponse,
  ModalidadeFinanciamento,
} from "@/types";

/** Espelha o dict _PRESETS em api/financiamento.py — manter em sync.
 * Exposto no frontend pra exibir label/descricao/faixa sem chamada ao
 * backend (ex.: popular o select de modalidade). A taxa real usada no
 * cálculo vem do backend (que é a fonte da verdade). */
export interface PresetTaxa {
  id: ModalidadeFinanciamento;
  label: string;
  taxaAnual: number | null;
  descricao: string;
  faixaRenda: string;
}

export const PRESETS_TAXA: PresetTaxa[] = [
  {
    id: "mcmv_faixa1",
    label: "MCMV Faixa 1",
    taxaAnual: 4.5,
    descricao: "Média entre 4% e 5,25% a.a.",
    faixaRenda: "Até R$ 3.200/mês",
  },
  {
    id: "mcmv_faixa2",
    label: "MCMV Faixa 2",
    taxaAnual: 5.75,
    descricao: "Média entre 4,75% e 7% a.a.",
    faixaRenda: "Até R$ 5.000/mês",
  },
  {
    id: "mcmv_faixa3",
    label: "MCMV Faixa 3",
    taxaAnual: 7.66,
    descricao: "Média entre 6,5% e 8,16% a.a.",
    faixaRenda: "Até R$ 9.600/mês",
  },
  {
    id: "mcmv_faixa4",
    label: "MCMV Faixa 4 (Classe Média)",
    taxaAnual: 10.0,
    descricao: "10% a 10,5% a.a.",
    faixaRenda: "Até R$ 13.000/mês",
  },
  {
    id: "sbpe",
    label: "SBPE",
    taxaAnual: 11.19,
    descricao: "Taxa de balcão Caixa. TR não incluída.",
    faixaRenda: "Imóveis até R$ 2,25 mi",
  },
  {
    id: "personalizada",
    label: "Personalizada",
    taxaAnual: null,
    descricao: "Taxa informada manualmente.",
    faixaRenda: "—",
  },
];

/** Chama o route handler proxy que repassa para o backend FastAPI. */
export async function calcularRendaNecessaria(
  req: CalculoRendaRequest,
): Promise<CalculoRendaResponse> {
  const r = await fetch("/api/financiamento/calcular-renda", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const corpo = await r.json();
  if (!r.ok) {
    throw new Error(corpo?.detail ?? `Erro ${r.status}`);
  }
  return corpo as CalculoRendaResponse;
}
