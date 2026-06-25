"use client";

import { useMemo, useState } from "react";

import { Tabs } from "@/components/ui/Tabs";
import { acharRibeira } from "@/lib/benchmark";
import type { Empreendimento, EventoPromocional, Incorporadora } from "@/types";

import { AbaBase } from "./AbaBase";
import { AbaHeadToHead } from "./AbaHeadToHead";
import { AbaMovimentos } from "./AbaMovimentos";
import { AbaOportunidades } from "./AbaOportunidades";
import { AbaPanorama } from "./AbaPanorama";
import { AbaSwot } from "./AbaSwot";
import { Recorte } from "./Recorte";

type Aba = "panorama" | "h2h" | "swot" | "oportunidades" | "movimentos" | "base";

const ABAS: { id: Aba; label: string }[] = [
  { id: "panorama", label: "Panorama" },
  { id: "h2h", label: "Head-to-head" },
  { id: "swot", label: "SWOT" },
  { id: "oportunidades", label: "Oportunidades" },
  { id: "movimentos", label: "Movimentos" },
  { id: "base", label: "Base" },
];

interface Props {
  incorporadoras: Incorporadora[];
  empreendimentos: Empreendimento[];
  eventos: EventoPromocional[];
  abaInicial?: Aba;
}

export function BenchmarkApp({
  incorporadoras,
  empreendimentos,
  eventos,
  abaInicial = "panorama",
}: Props) {
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [territorio, setTerritorio] = useState("Todos");
  const [padrao, setPadrao] = useState("Todos");
  const [concorrente, setConcorrente] = useState("Todos");

  const ribeira = useMemo(() => acharRibeira(incorporadoras), [incorporadoras]);
  const ribeiraId = ribeira?.id;

  const bairros = useMemo(() => {
    const s = new Set<string>();
    for (const e of empreendimentos) if (e.bairro) s.add(e.bairro);
    return ["Todos", ...Array.from(s).sort()];
  }, [empreendimentos]);

  const padroes = useMemo(() => {
    const s = new Set<string>();
    for (const e of empreendimentos) if (e.padrao) s.add(e.padrao);
    if (s.size === 0) ["Econômico", "Médio", "Alto", "Luxo"].forEach((p) => s.add(p));
    return ["Todos", ...Array.from(s).sort()];
  }, [empreendimentos]);

  const nomesConcs = useMemo(
    () => ["Todos", ...incorporadoras.filter((i) => i.id !== ribeiraId).map((i) => i.nome)],
    [incorporadoras, ribeiraId],
  );

  const empFiltrados = useMemo(() => {
    return empreendimentos.filter((e) => {
      if (territorio !== "Todos" && e.bairro !== territorio) return false;
      if (padrao !== "Todos" && e.padrao !== padrao) return false;
      if (concorrente !== "Todos") {
        const inc = incorporadoras.find((i) => i.id === e.incorporadora_id);
        if (e.incorporadora_id !== ribeiraId && inc?.nome !== concorrente) return false;
      }
      return true;
    });
  }, [empreendimentos, territorio, padrao, concorrente, incorporadoras, ribeiraId]);

  const atualizado = `Base atualizada · ${empreendimentos.length} empreendimentos · ${incorporadoras.length} incorporadoras`;

  return (
    <>
      <Recorte
        atualizado={atualizado}
        filtros={[
          { rotulo: "Território", valor: territorio, opcoes: bairros, onTrocar: setTerritorio },
          { rotulo: "Padrão", valor: padrao, opcoes: padroes, onTrocar: setPadrao },
          { rotulo: "Concorrente", valor: concorrente, opcoes: nomesConcs, onTrocar: setConcorrente },
        ]}
      />

      <Tabs abas={ABAS} ativa={aba} onTrocar={setAba} className="mb-5" />

      {aba === "panorama" && (
        <AbaPanorama
          incorporadoras={incorporadoras}
          empreendimentos={empFiltrados}
          ribeiraId={ribeiraId}
        />
      )}
      {aba === "h2h" && (
        <AbaHeadToHead
          incorporadoras={incorporadoras}
          empreendimentos={empFiltrados}
          ribeiraId={ribeiraId}
        />
      )}
      {aba === "swot" && <AbaSwot />}
      {aba === "oportunidades" && (
        <AbaOportunidades empreendimentos={empFiltrados} ribeiraId={ribeiraId} />
      )}
      {aba === "movimentos" && (
        <AbaMovimentos
          eventos={eventos}
          empreendimentos={empreendimentos}
          incorporadoras={incorporadoras}
        />
      )}
      {aba === "base" && <AbaBase />}
    </>
  );
}
