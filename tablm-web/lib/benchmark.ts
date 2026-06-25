import type { Empreendimento, EventoPromocional, Incorporadora } from "@/types";

/**
 * Helpers de dados derivados para o Benchmark Competitivo.
 * Onde o backend ainda não fornece um campo (preço/m², VSO, score), derivamos
 * de forma determinística a partir do nome — mantém os exemplos "plausíveis"
 * do protótipo sem mexer no banco. Substituir quando o backend evoluir.
 */

function hashNome(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

/**
 * Cada getter abaixo prefere o KPI real salvo no empreendimento (preenchido
 * pelo POST /empreendimentos/{id}/kpis). Se ainda não houver dado real, cai
 * num valor heurístico determinístico para o protótipo continuar plausível.
 */

function temReal<T>(valor: T | null | undefined): valor is T {
  return valor !== null && valor !== undefined && !Number.isNaN(valor as number);
}

export function precoM2(emp: Empreendimento): number {
  if (temReal(emp.preco_m2_medio)) return Math.round(emp.preco_m2_medio as number);
  const base = 7000 + (hashNome(emp.nome) % 6000);
  return Math.round(base / 100) * 100;
}

export function vso(emp: Empreendimento): number {
  if (temReal(emp.vso)) return Math.round(emp.vso as number);
  return 25 + (hashNome(`vso-${emp.nome}`) % 65);
}

export function ticketMedio(emp: Empreendimento): number {
  if (temReal(emp.ticket_medio)) return Math.round(emp.ticket_medio as number);
  const base = 480_000 + (hashNome(`tic-${emp.nome}`) % 600_000);
  return Math.round(base / 10_000) * 10_000;
}

export function estoque(emp: Empreendimento): number {
  if (temReal(emp.unidades_disponiveis)) return emp.unidades_disponiveis as number;
  return 8 + (hashNome(`est-${emp.nome}`) % 80);
}

export function unidades(emp: Empreendimento): number {
  if (temReal(emp.total_unidades_calc)) return emp.total_unidades_calc as number;
  if (temReal(emp.total_unidades)) return emp.total_unidades as number;
  return 80 + (hashNome(`un-${emp.nome}`) % 180);
}

/** Indica se o empreendimento tem KPIs persistidos (mostra "real" vs. estimativa). */
export function temKpisReais(emp: Empreendimento): boolean {
  return temReal(emp.preco_m2_medio) || temReal(emp.vso) || temReal(emp.ticket_medio);
}

export function score(emp: Empreendimento): number {
  // Score derivado: VSO peso 0.6 + (preco_m2 normalizado) peso 0.4.
  const p = precoM2(emp);
  const v = vso(emp);
  const pNorm = Math.max(0, Math.min(100, ((p - 7000) / (13000 - 7000)) * 100));
  return Math.round(v * 0.6 + pNorm * 0.4);
}

export type CorAmeaca = { corScore: string; corBarra: string };
export function corAmeaca(s: number): CorAmeaca {
  if (s >= 75) return { corScore: "#DC2626", corBarra: "linear-gradient(90deg,#DC2626,#F0746E)" };
  if (s >= 50) return { corScore: "#E0A21A", corBarra: "linear-gradient(90deg,#E0A21A,#F1C75A)" };
  return { corScore: "#2347C5", corBarra: "linear-gradient(90deg,#2347C5,#4D6FE0)" };
}

/** "VOCÊ" = a Ribeira. Pela base existente: primeira incorporadora cujo nome contenha Ribeira. */
export function acharRibeira(incs: Incorporadora[]): Incorporadora | undefined {
  return (
    incs.find((i) => i.nome.toLowerCase().includes("ribeira")) ?? incs[0]
  );
}

/** Pontos do mapa de posicionamento. X = VSO (0-100), Y = preço/m² (7k..13k -> 0-100%). */
export function pontosScatter(
  empreendimentos: Empreendimento[],
  ribeiraId?: string,
) {
  return empreendimentos.slice(0, 12).map((e) => {
    const p = precoM2(e);
    const y = Math.max(2, Math.min(98, ((p - 7000) / (13000 - 7000)) * 100));
    return {
      label: e.nome,
      x: Math.max(2, Math.min(98, vso(e))),
      y,
      ours: e.incorporadora_id === ribeiraId,
      preco: p,
    };
  });
}

/** Ranking de ameaça por incorporadora (top 4). */
export function rankingAmeaca(
  incs: Incorporadora[],
  empreendimentos: Empreendimento[],
  ribeiraId?: string,
) {
  return incs
    .filter((i) => i.id !== ribeiraId)
    .slice(0, 4)
    .map((i) => {
      const emps = empreendimentos.filter((e) => e.incorporadora_id === i.id);
      const s = emps.length ? Math.round(emps.reduce((a, e) => a + score(e), 0) / emps.length) : score({ nome: i.nome } as Empreendimento);
      const principal = emps[0];
      const motivo = principal
        ? `${principal.bairro ?? "Centro"} · padrão ${principal.padrao ?? "Alto"} · ${unidades(principal)} un.`
        : "Posicionamento sem destaque na base";
      return { nome: i.nome, score: s, motivo, ...corAmeaca(s) };
    })
    .sort((a, b) => b.score - a.score);
}

/** Movimentos derivados dos eventos cadastrados (mais recentes primeiro). */
export function paraMovimentos(
  eventos: EventoPromocional[],
  empreendimentos: Empreendimento[],
  incorporadoras: Incorporadora[],
) {
  const mapEmp = new Map(empreendimentos.map((e) => [e.id, e]));
  const mapInc = new Map(incorporadoras.map((i) => [i.id, i]));
  return eventos
    .slice()
    .sort((a, b) => (b.data_inicio ?? "").localeCompare(a.data_inicio ?? ""))
    .map((ev) => {
      const emp = mapEmp.get(ev.empreendimento_id);
      const inc = emp ? mapInc.get(emp.incorporadora_id) : undefined;
      const desc = (ev.descricao ?? "").toLowerCase();
      const tipo =
        desc.includes("reajust") ? "Reajuste"
        : desc.includes("lança") || desc.includes("lanc") ? "Lançamento"
        : "Promoção";
      const tCor =
        tipo === "Reajuste" ? { text: "#B91C1C", bg: "#FDF2F2" }
        : tipo === "Lançamento" ? { text: "#2347C5", bg: "#EAF0FE" }
        : { text: "#8A6A1E", bg: "#FBF3DD" };
      const impacto = tipo === "Reajuste" ? "Ameaça" : tipo === "Promoção" ? "Neutro" : "Oportunidade";
      const iCor =
        impacto === "Ameaça" ? { color: "#DC2626", line: "#F3C7C7", dot: "#DC2626" }
        : impacto === "Oportunidade" ? { color: "#157A3D", line: "#BDEDCF", dot: "#15A34A" }
        : { color: "#6B7689", line: "#E5E9F2", dot: "#9AA7BE" };
      return {
        id: ev.id,
        data: ev.data_inicio ?? "",
        who: inc?.nome ?? emp?.nome ?? "Concorrente",
        prod: emp?.nome ?? "",
        desc: ev.descricao ?? ev.condicoes_comerciais ?? "Movimento detectado",
        tipo, tCor, impacto, iCor,
      };
    });
}

/** Heatmap território × padrão. Conta empreendimentos por par. GAP onde a contagem é 0. */
export function montarHeatmap(
  empreendimentos: Empreendimento[],
  ribeiraId?: string,
) {
  const padroes = ["Econômico", "Médio", "Alto", "Luxo"];
  // 4 bairros mais comuns + fallback
  const contagemBairro = new Map<string, number>();
  for (const e of empreendimentos) {
    const b = e.bairro?.trim() || "—";
    contagemBairro.set(b, (contagemBairro.get(b) ?? 0) + 1);
  }
  const bairros = Array.from(contagemBairro.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([n]) => n);
  if (bairros.length < 4) {
    for (const fb of ["Jardim Aurora", "Centro", "Vila Marina", "Parque Sul"]) {
      if (!bairros.includes(fb) && bairros.length < 4) bairros.push(fb);
    }
  }
  const escala = [
    { bg: "#EAF0FE", text: "#2347C5" },
    { bg: "#C9D5F4", text: "#2347C5" },
    { bg: "#9DB3EC", text: "#fff" },
    { bg: "#4D6FE0", text: "#fff" },
    { bg: "#2347C5", text: "#fff" },
  ];
  const grid = bairros.map((b) => ({
    bairro: b,
    cells: padroes.map((p) => {
      const n = empreendimentos.filter(
        (e) =>
          (e.bairro?.trim() || "—") === b &&
          (e.padrao ?? "Alto") === p &&
          e.incorporadora_id !== ribeiraId,
      ).length;
      if (n === 0) return { gap: true as const };
      const nivel = Math.min(escala.length - 1, n - 1);
      return { gap: false as const, n, ...escala[nivel] };
    }),
  }));
  return { padroes, grid };
}
