"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fluxoPadrao, recalcularFinanciamento, simularFluxo } from "@/lib/fluxo";
import type {
  ConfigRendaLinha,
  FluxoConfig,
  ResultadoLinha,
  SimuladorLinha,
} from "@/types";

const MAX_LINHAS = 4;
const DEBOUNCE_MS = 600;

const CORES_LINHA: SimuladorLinha["cor"][] = ["royal", "up", "warn", "down"];

function novoId(): string {
  return `linha-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface NovaLinhaArgs {
  empreendimentoId: string;
  empreendimentoNome: string;
  unidadeLabel: string;
  valorUnidade: number;
}

interface Estado {
  linhas: SimuladorLinha[];
  resultados: Record<string, ResultadoLinha>;
  diferencas: Record<string, number> | null;
  carregando: boolean;
  erro: string | null;
  configRenda: Record<string, ConfigRendaLinha>;
}

const CONFIG_RENDA_PADRAO: ConfigRendaLinha = {
  modalidade: "mcmv_faixa3",
  taxaPersonalizada: null,
  prazoMeses: 360,
};

/** Hook orquestrador do Simulador. State local + debounce 600ms na
 * chamada do backend a cada mudança no fluxo. Custom hook (sem
 * Context/Zustand) — segue convenção do projeto. */
export function useSimuladorFluxo() {
  const [estado, setEstado] = useState<Estado>({
    linhas: [],
    resultados: {},
    diferencas: null,
    carregando: false,
    erro: null,
    configRenda: {},
  });

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linhasRef = useRef(estado.linhas);
  linhasRef.current = estado.linhas;

  const recalcular = useCallback(async () => {
    const linhas = linhasRef.current;
    if (linhas.length === 0) {
      setEstado((s) => ({
        ...s,
        resultados: {},
        diferencas: null,
        erro: null,
      }));
      return;
    }
    setEstado((s) => ({ ...s, carregando: true, erro: null }));
    try {
      const resp = await simularFluxo(linhas);
      const mapa: Record<string, ResultadoLinha> = {};
      for (const r of resp.linhas) mapa[r.id] = r;
      setEstado((s) => ({
        ...s,
        resultados: mapa,
        diferencas: resp.diferencas,
        carregando: false,
        erro: null,
      }));
    } catch (e) {
      setEstado((s) => ({
        ...s,
        carregando: false,
        erro: (e as Error).message,
      }));
    }
  }, []);

  const agendarRecalculo = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void recalcular();
    }, DEBOUNCE_MS);
  }, [recalcular]);

  // Recalcula imediatamente quando a quantidade de linhas muda (add/remove).
  // Mudanças no fluxo de uma linha são debouncadas via updateFluxo.
  useEffect(() => {
    void recalcular();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.linhas.length]);

  function addLinha(args: NovaLinhaArgs): { ok: boolean; erro?: string } {
    if (estado.linhas.length >= MAX_LINHAS) {
      return {
        ok: false,
        erro: `Máximo de ${MAX_LINHAS} linhas para manter a tabela legível.`,
      };
    }
    const id = novoId();
    const nova: SimuladorLinha = {
      id,
      empreendimentoId: args.empreendimentoId,
      empreendimentoNome: args.empreendimentoNome,
      unidadeLabel: args.unidadeLabel,
      valorUnidade: args.valorUnidade,
      fluxo: fluxoPadrao(),
      cor: CORES_LINHA[estado.linhas.length] ?? "royal",
    };
    setEstado((s) => ({
      ...s,
      linhas: [...s.linhas, nova],
      configRenda: { ...s.configRenda, [id]: { ...CONFIG_RENDA_PADRAO } },
    }));
    return { ok: true };
  }

  function removeLinha(id: string) {
    setEstado((s) => {
      const novasLinhas = s.linhas.filter((l) => l.id !== id);
      const { [id]: _omitido, ...resto } = s.resultados;
      const { [id]: _omitidoR, ...restoConfig } = s.configRenda;
      return {
        ...s,
        linhas: novasLinhas,
        resultados: resto,
        configRenda: restoConfig,
      };
    });
  }

  function updateFluxo(id: string, mutator: (fluxo: FluxoConfig) => FluxoConfig) {
    setEstado((s) => ({
      ...s,
      linhas: s.linhas.map((l) =>
        l.id === id ? { ...l, fluxo: recalcularFinanciamento(mutator(l.fluxo)) } : l,
      ),
    }));
    agendarRecalculo();
  }

  function updateRenda(id: string, parcial: Partial<ConfigRendaLinha>) {
    setEstado((s) => ({
      ...s,
      configRenda: {
        ...s.configRenda,
        [id]: { ...(s.configRenda[id] ?? CONFIG_RENDA_PADRAO), ...parcial },
      },
    }));
  }

  return {
    linhas: estado.linhas,
    resultados: estado.resultados,
    diferencas: estado.diferencas,
    configRenda: estado.configRenda,
    carregando: estado.carregando,
    erro: estado.erro,
    maxLinhas: MAX_LINHAS,
    addLinha,
    removeLinha,
    updateFluxo,
    updateRenda,
    recalcular,
  };
}
