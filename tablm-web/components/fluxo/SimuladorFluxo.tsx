"use client";

import { useState } from "react";

import { ModalSelecionarUnidade } from "@/components/fluxo/ModalSelecionarUnidade";
import { PainelRendaLinha } from "@/components/fluxo/PainelRendaLinha";
import { SimuladorLinhaConfig } from "@/components/fluxo/SimuladorLinhaConfig";
import { TabelaComparativa } from "@/components/fluxo/TabelaComparativa";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSimuladorFluxo } from "@/lib/useSimuladorFluxo";
import type { Empreendimento } from "@/types";

interface Props {
  empreendimentos: Empreendimento[];
}

/** Orquestrador. Instancia useSimuladorFluxo, renderiza o painel de
 * configurações por linha + a tabela comparativa + o painel de renda
 * por linha. Botão "+ Adicionar Empreendimento" abre o modal. */
export function SimuladorFluxo({ empreendimentos }: Props) {
  const sim = useSimuladorFluxo();
  const [modalAberto, setModalAberto] = useState(false);
  const [erroAdd, setErroAdd] = useState<string | null>(null);

  function abrir() {
    setErroAdd(null);
    setModalAberto(true);
  }

  return (
    <div className="flex flex-col gap-5 tablm-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[13.5px] text-muted">
          {sim.linhas.length} de {sim.maxLinhas} linhas ·{" "}
          {sim.carregando ? "calculando…" : "pronto"}
        </div>
        <Button variante="primary" onClick={abrir}>
          + Adicionar Empreendimento
        </Button>
      </div>

      {erroAdd && (
        <div className="rounded-[12px] bg-warn-bg text-warn-strong text-[13.5px] px-4 py-3 border border-warn-line">
          {erroAdd}
        </div>
      )}

      {sim.erro && (
        <div className="rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line">
          {sim.erro}
        </div>
      )}

      {sim.linhas.length === 0 ? (
        <Card>
          <div className="text-[13.5px] text-muted">
            Nenhuma linha ainda. Clique em <b>+ Adicionar Empreendimento</b> para
            começar a simular. Você pode comparar até <b>{sim.maxLinhas} linhas</b>{" "}
            simultaneamente.
          </div>
        </Card>
      ) : (
        <>
          {/* Configuração por linha */}
          {sim.linhas.map((linha) => (
            <SimuladorLinhaConfig
              key={linha.id}
              linha={linha}
              onUpdate={(mutator) => sim.updateFluxo(linha.id, mutator)}
              onRemove={() => sim.removeLinha(linha.id)}
            />
          ))}

          {/* Tabela comparativa */}
          <TabelaComparativa
            linhas={sim.linhas}
            resultados={sim.resultados}
            diferencas={sim.diferencas}
          />

          {/* Painel de renda por linha */}
          {sim.linhas.map((linha) => (
            <PainelRendaLinha
              key={`renda-${linha.id}`}
              linha={linha}
              resultado={sim.resultados[linha.id]}
              config={sim.configRenda[linha.id] ?? {
                modalidade: "mcmv_faixa3",
                taxaPersonalizada: null,
                prazoMeses: 360,
              }}
              onChange={(parcial) => sim.updateRenda(linha.id, parcial)}
            />
          ))}
        </>
      )}

      <ModalSelecionarUnidade
        aberto={modalAberto}
        empreendimentos={empreendimentos}
        onFechar={() => setModalAberto(false)}
        onConfirmar={(args) => {
          const r = sim.addLinha(args);
          if (!r.ok) {
            setErroAdd(r.erro ?? "Não foi possível adicionar");
          } else {
            setErroAdd(null);
            setModalAberto(false);
          }
        }}
      />
    </div>
  );
}
