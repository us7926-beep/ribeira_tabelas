import type {
  FluxoConfig,
  FluxoSimularResponse,
  SimuladorLinha,
} from "@/types";

interface SimularReq {
  linhas: { id: string; valor_unidade: number; fluxo: FluxoConfig }[];
}

/** POST /fluxo/simular via route handler proxy. */
export async function simularFluxo(
  linhas: SimuladorLinha[],
): Promise<FluxoSimularResponse> {
  const req: SimularReq = {
    linhas: linhas.map((l) => ({
      id: l.id,
      valor_unidade: l.valorUnidade,
      fluxo: l.fluxo,
    })),
  };
  const r = await fetch("/api/fluxo/simular", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const corpo = await r.json();
  if (!r.ok) {
    throw new Error(corpo?.detail ?? `Erro ${r.status}`);
  }
  return corpo as FluxoSimularResponse;
}

/** Fluxo zerado padrão — usado ao adicionar nova linha.
 * Default: 10% Ato + 90% Financiamento (soma 100). */
export function fluxoPadrao(): FluxoConfig {
  const hoje = new Date().toISOString().slice(0, 10);
  return {
    ato: { percentual: 10.0, data: hoje },
    dias30: { percentual: 0.0, data: hoje },
    dias60: { percentual: 0.0, data: hoje },
    dias90: { percentual: 0.0, data: hoje },
    mensais: { percentual: 0.0, quantidade: 0, data_inicio: hoje },
    anuais: { percentual: 0.0, quantidade: 0, data_inicio: hoje },
    semestrais: { percentual: 0.0, quantidade: 0, data_inicio: hoje },
    parcela_unica: { percentual: 0.0, data: hoje },
    financiamento: { percentual: 90.0, data: hoje },
  };
}

/** Soma de todos os percentuais (inclui financiamento). Útil pra
 * validação client-side antes do request. */
export function somaPercentuais(fluxo: FluxoConfig): number {
  return (
    fluxo.ato.percentual +
    fluxo.dias30.percentual +
    fluxo.dias60.percentual +
    fluxo.dias90.percentual +
    fluxo.mensais.percentual +
    fluxo.anuais.percentual +
    fluxo.semestrais.percentual +
    fluxo.parcela_unica.percentual +
    fluxo.financiamento.percentual
  );
}

/** Recalcula o financiamento como residual: 100 - soma(demais). */
export function recalcularFinanciamento(fluxo: FluxoConfig): FluxoConfig {
  const somaSem =
    fluxo.ato.percentual +
    fluxo.dias30.percentual +
    fluxo.dias60.percentual +
    fluxo.dias90.percentual +
    fluxo.mensais.percentual +
    fluxo.anuais.percentual +
    fluxo.semestrais.percentual +
    fluxo.parcela_unica.percentual;
  const residual = Math.max(0, Math.round((100 - somaSem) * 100) / 100);
  return {
    ...fluxo,
    financiamento: { ...fluxo.financiamento, percentual: residual },
  };
}
