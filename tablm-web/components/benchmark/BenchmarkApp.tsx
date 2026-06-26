"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RoyalCard } from "@/components/ui/RoyalCard";
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
  territorioInicial?: string;
  padraoInicial?: string;
  concorrenteInicial?: string;
}

export function BenchmarkApp({
  incorporadoras,
  empreendimentos,
  eventos,
  abaInicial = "panorama",
  territorioInicial = "Todos",
  padraoInicial = "Todos",
  concorrenteInicial = "Todos",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [aba, setAba] = useState<Aba>(abaInicial);
  const [territorio, setTerritorio] = useState(territorioInicial);
  const [padrao, setPadrao] = useState(padraoInicial);
  const [concorrente, setConcorrente] = useState(concorrenteInicial);

  // Atualiza um param na URL sem disparar reload — mantém deep link e refresh-safe.
  const atualizarUrl = useCallback(
    (chave: string, valor: string) => {
      const params = new URLSearchParams(sp?.toString() ?? "");
      if (!valor || valor === "Todos") params.delete(chave);
      else params.set(chave, valor);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, sp],
  );

  function trocarAba(a: Aba) {
    setAba(a);
    atualizarUrl("aba", a === "panorama" ? "" : a);
  }
  function trocarTerritorio(v: string) {
    setTerritorio(v);
    atualizarUrl("territorio", v);
  }
  function trocarPadrao(v: string) {
    setPadrao(v);
    atualizarUrl("padrao", v);
  }
  function trocarConcorrente(v: string) {
    setConcorrente(v);
    atualizarUrl("concorrente", v);
  }

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

  // Empty state global: zero empreendimentos no banco → CTA para popular.
  if (empreendimentos.length === 0 && aba !== "base") {
    return (
      <>
        <Tabs abas={ABAS} ativa={aba} onTrocar={trocarAba} className="mb-5" />
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 tablm-up">
          <Card variant="lg">
            <div className="text-[16px] font-bold text-ink mb-1">Sua base está vazia</div>
            <div className="text-[13.5px] text-muted mb-5 leading-relaxed">
              Cadastre incorporadoras e empreendimentos em <b>Carteira</b> e suba uma tabela na
              aba <b>Base</b> para o Benchmark começar a operar com dados reais — mapa de
              posicionamento, ranking de ameaça, SWOT, head-to-head e gaps de mercado.
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/incorporadoras">
                <Button variante="primary">Abrir Carteira</Button>
              </Link>
              <Button variante="secondary" onClick={() => trocarAba("base")}>
                Subir uma tabela
              </Button>
            </div>
          </Card>
          <RoyalCard>
            <div className="text-[11px] font-bold tracking-[1.6px] uppercase text-white/75 mb-2">
              Como funciona
            </div>
            <div className="text-[13.5px] text-white/90 leading-relaxed">
              1. Cadastre seus empreendimentos e os principais concorrentes.
              <br />2. Suba uma planilha em <b>Base</b> e vincule a um empreendimento — os KPIs
              ficam salvos.
              <br />3. As outras abas passam a refletir os números reais.
            </div>
          </RoyalCard>
        </div>
      </>
    );
  }

  return (
    <>
      <Recorte
        atualizado={atualizado}
        filtros={[
          { rotulo: "Território", valor: territorio, opcoes: bairros, onTrocar: trocarTerritorio },
          { rotulo: "Padrão", valor: padrao, opcoes: padroes, onTrocar: trocarPadrao },
          { rotulo: "Concorrente", valor: concorrente, opcoes: nomesConcs, onTrocar: trocarConcorrente },
        ]}
      />

      <Tabs abas={ABAS} ativa={aba} onTrocar={trocarAba} className="mb-5" />

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
      {aba === "swot" && (
        <AbaSwot
          meus={empFiltrados.filter((e) => e.incorporadora_id === ribeiraId)}
          concorrentes={empFiltrados.filter((e) => e.incorporadora_id !== ribeiraId)}
          eventos={eventos}
          incorporadoras={incorporadoras}
        />
      )}
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
      {aba === "base" && (
        <AbaBase empreendimentos={empreendimentos} incorporadoras={incorporadoras} />
      )}
    </>
  );
}
