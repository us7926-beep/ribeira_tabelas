import type { Empreendimento, EventoPromocional, Incorporadora } from "@/types";

import { precoM2, ticketMedio, unidades, vso } from "./benchmark";

export interface QuadranteSwot {
  title: string;
  sub: string;
  icon: string;
  accent: string;
  tint: string;
  items: string[];
}

function media(ns: number[]): number {
  if (ns.length === 0) return 0;
  return ns.reduce((a, b) => a + b, 0) / ns.length;
}

function brlCurto(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)} mi`;
  if (n >= 1000) return `R$ ${Math.round(n / 1000)} mil`;
  return `R$ ${Math.round(n)}`;
}

/**
 * Analisa empreendimentos próprios vs concorrência e devolve os 4 quadrantes
 * do SWOT com bullets derivados. Regras propositalmente simples; quando os
 * dados ficam ricos, é só evoluir os bullets aqui.
 */
export function analisarSwot(
  meus: Empreendimento[],
  concorrentes: Empreendimento[],
  eventos: EventoPromocional[],
  incorporadoras: Incorporadora[],
): QuadranteSwot[] {
  const PADROES = ["Econômico", "Médio", "Alto", "Luxo"];

  const vsoMercado = media([...meus, ...concorrentes].map(vso));
  const precoMercado = media([...meus, ...concorrentes].map(precoM2));
  const ticketMercado = media([...meus, ...concorrentes].map(ticketMedio));

  // -------- Forças ----------
  const forcas: string[] = [];
  const acimaVso = meus.filter((e) => vso(e) > vsoMercado);
  if (acimaVso.length) {
    const melhor = acimaVso.reduce((a, b) => (vso(a) >= vso(b) ? a : b));
    forcas.push(
      `${melhor.nome} vende mais rápido que a média (VSO ${vso(melhor)}% vs. ${Math.round(vsoMercado)}% no mercado).`,
    );
  }
  const premium = meus.filter((e) => precoM2(e) > precoMercado * 1.05);
  if (premium.length) {
    const p = premium[0];
    const delta = Math.round(((precoM2(p) - precoMercado) / precoMercado) * 100);
    forcas.push(
      `Prêmio de preço sustentado em ${p.nome} (+${delta}% sobre a média da praça).`,
    );
  }
  if (meus.length >= 2) {
    forcas.push(`Carteira diversificada (${meus.length} empreendimentos em operação).`);
  }
  if (forcas.length === 0) {
    forcas.push("Cadastre suas planilhas em Base para começarmos a mapear suas vantagens.");
  }

  // -------- Fraquezas ----------
  const fraquezas: string[] = [];
  const lentos = meus.filter((e) => vso(e) < vsoMercado * 0.85);
  if (lentos.length) {
    const l = lentos[0];
    fraquezas.push(`Velocidade abaixo da média em ${l.nome} (VSO ${vso(l)}%).`);
  }
  const meusPadroes = new Set(meus.map((e) => e.padrao).filter(Boolean));
  const concorrentePadroes = new Set(concorrentes.map((e) => e.padrao).filter(Boolean));
  const padroesSemNos = PADROES.filter(
    (p) => concorrentePadroes.has(p) && !meusPadroes.has(p),
  );
  if (padroesSemNos.length) {
    fraquezas.push(
      `Sem produto no padrão ${padroesSemNos.join(", ")}, onde a concorrência atua.`,
    );
  }
  const abaixoPreco = meus.filter((e) => precoM2(e) < precoMercado * 0.9);
  if (abaixoPreco.length) {
    const a = abaixoPreco[0];
    const delta = Math.round(((precoMercado - precoM2(a)) / precoMercado) * 100);
    fraquezas.push(`${a.nome} ${delta}% abaixo do preço/m² médio da praça.`);
  }
  if (fraquezas.length === 0) {
    fraquezas.push("Nada crítico identificado com os dados atuais. Continue acompanhando.");
  }

  // -------- Oportunidades ----------
  const oportunidades: string[] = [];
  const meusBairros = new Set(meus.map((e) => e.bairro).filter(Boolean));
  const bairrosSemNos: string[] = [];
  for (const e of concorrentes) {
    if (e.bairro && !meusBairros.has(e.bairro) && !bairrosSemNos.includes(e.bairro)) {
      bairrosSemNos.push(e.bairro);
    }
  }
  if (bairrosSemNos.length) {
    oportunidades.push(
      `Demanda ativa em ${bairrosSemNos.slice(0, 2).join(" e ")} sem oferta sua direta.`,
    );
  }
  // Faixa de ticket subofertada
  const ticketsMercado = [...meus, ...concorrentes].map(ticketMedio).sort((a, b) => a - b);
  if (ticketsMercado.length >= 3 && ticketMercado > 0) {
    const baixo = ticketsMercado[0];
    const alto = ticketsMercado[ticketsMercado.length - 1];
    oportunidades.push(
      `Faixa entre ${brlCurto(baixo)} e ${brlCurto(alto)} ainda absorvida pelo mercado.`,
    );
  }
  // Concorrência com promoção (sinal de pressão)
  const eventosRecentes = eventos.slice().sort((a, b) => (b.data_inicio ?? "").localeCompare(a.data_inicio ?? ""));
  if (eventosRecentes.length) {
    oportunidades.push(
      "Movimentos de promoção da concorrência podem liberar clientes qualificados.",
    );
  }
  if (oportunidades.length === 0) {
    oportunidades.push("Adicione concorrentes em Carteira para mapearmos os gaps de mercado.");
  }

  // -------- Ameaças ----------
  const ameacas: string[] = [];
  const concsAtivos = incorporadoras.length - meus.length;
  if (concsAtivos > 0) {
    ameacas.push(
      `${concsAtivos} incorporadora(s) concorrentes ativas na praça pressionando o preço.`,
    );
  }
  const ameacasRecentes = eventosRecentes
    .map((ev) => (ev.descricao ?? "").toLowerCase())
    .filter((d) => d.includes("reajust") || d.includes("lança") || d.includes("lanc"));
  if (ameacasRecentes.length) {
    ameacas.push(
      `${ameacasRecentes.length} movimento(s) de reajuste/lançamento detectados — monitore margem.`,
    );
  }
  // Concorrência com VSO superior
  const vsoConc = media(concorrentes.map(vso));
  const vsoMeu = media(meus.map(vso));
  if (concorrentes.length && vsoConc > vsoMeu * 1.1) {
    ameacas.push(
      `Concorrência vendendo ${Math.round(((vsoConc - vsoMeu) / vsoMeu) * 100)}% mais rápido em média.`,
    );
  }
  if (ameacas.length === 0) {
    ameacas.push("Sem ameaças relevantes detectadas — mantenha vigilância.");
  }

  return [
    {
      title: "Forças",
      sub: "onde você ganha",
      icon: "F",
      accent: "#2347C5",
      tint: "#EAF0FE",
      items: forcas.slice(0, 3),
    },
    {
      title: "Fraquezas",
      sub: "onde você perde",
      icon: "W",
      accent: "#DC2626",
      tint: "#FDF2F2",
      items: fraquezas.slice(0, 3),
    },
    {
      title: "Oportunidades",
      sub: "espaços a ocupar",
      icon: "O",
      accent: "#15A34A",
      tint: "#E9FBF0",
      items: oportunidades.slice(0, 3),
    },
    {
      title: "Ameaças",
      sub: "riscos a monitorar",
      icon: "A",
      accent: "#E0A21A",
      tint: "#FBF3DD",
      items: ameacas.slice(0, 3),
    },
  ];
}
