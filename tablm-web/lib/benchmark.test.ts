import { describe, expect, it } from "vitest";

import type { Empreendimento, EventoPromocional, Incorporadora } from "@/types";

import {
  acharRibeira,
  corAmeaca,
  estoque,
  montarHeatmap,
  paraMovimentos,
  pontosScatter,
  precoM2,
  rankingAmeaca,
  score,
  temKpisReais,
  ticketMedio,
  unidades,
  vso,
} from "./benchmark";

function emp(over: Partial<Empreendimento> = {}): Empreendimento {
  return {
    id: over.id ?? "emp-1",
    incorporadora_id: over.incorporadora_id ?? "inc-1",
    nome: over.nome ?? "Edifício Teste",
    ...over,
  };
}

describe("precoM2 / vso / ticketMedio / estoque / unidades", () => {
  it("usa KPI real quando presente, arredondado", () => {
    const e = emp({
      preco_m2_medio: 9876.4,
      vso: 47.6,
      ticket_medio: 612_345.5,
      unidades_disponiveis: 42,
      total_unidades_calc: 120,
    });
    expect(precoM2(e)).toBe(9876);
    expect(vso(e)).toBe(48);
    expect(ticketMedio(e)).toBe(612_346);
    expect(estoque(e)).toBe(42);
    expect(unidades(e)).toBe(120);
  });

  it("cai pro fallback heurístico quando o KPI real é null/undefined", () => {
    const e = emp({ nome: "Heurístico" });
    expect(precoM2(e)).toBeGreaterThanOrEqual(7000);
    expect(precoM2(e)).toBeLessThanOrEqual(13000);
    expect(vso(e)).toBeGreaterThanOrEqual(25);
    expect(vso(e)).toBeLessThanOrEqual(90);
    expect(unidades(e)).toBeGreaterThanOrEqual(80);
  });

  it("unidades prefere total_unidades_calc, depois total_unidades, depois fallback", () => {
    expect(unidades(emp({ total_unidades_calc: 200, total_unidades: 999 }))).toBe(200);
    expect(unidades(emp({ total_unidades: 75 }))).toBe(75);
    const heuristico = unidades(emp({ nome: "Sem totais" }));
    expect(heuristico).toBeGreaterThanOrEqual(80);
  });

  it("fallback é determinístico (mesmo nome -> mesmo valor)", () => {
    const a = emp({ nome: "Mesmo nome" });
    const b = emp({ nome: "Mesmo nome", id: "outro" });
    expect(precoM2(a)).toBe(precoM2(b));
    expect(vso(a)).toBe(vso(b));
  });
});

describe("temKpisReais", () => {
  it("true quando algum KPI está preenchido", () => {
    expect(temKpisReais(emp({ preco_m2_medio: 8000 }))).toBe(true);
    expect(temKpisReais(emp({ vso: 50 }))).toBe(true);
    expect(temKpisReais(emp({ ticket_medio: 100_000 }))).toBe(true);
  });

  it("false quando todos estão null/undefined", () => {
    expect(temKpisReais(emp())).toBe(false);
  });
});

describe("score / corAmeaca", () => {
  it("score combina VSO (60%) e preço normalizado (40%)", () => {
    const e = emp({ preco_m2_medio: 10000, vso: 60 });
    // pNorm = ((10000-7000)/6000)*100 = 50; score = 60*0.6 + 50*0.4 = 56
    expect(score(e)).toBe(56);
  });

  it("corAmeaca: vermelho >=75, âmbar >=50, royal abaixo", () => {
    expect(corAmeaca(80).corScore).toBe("#DC2626");
    expect(corAmeaca(60).corScore).toBe("#E0A21A");
    expect(corAmeaca(40).corScore).toBe("#2347C5");
  });
});

describe("acharRibeira", () => {
  it("encontra incorporadora cujo nome contém 'ribeira' (case-insensitive)", () => {
    const incs: Incorporadora[] = [
      { id: "a", nome: "Construtora Alpha" },
      { id: "b", nome: "Ribeira Empreendimentos" },
    ];
    expect(acharRibeira(incs)?.id).toBe("b");
  });

  it("aceita variação de caixa", () => {
    const incs: Incorporadora[] = [{ id: "x", nome: "RIBEIRA Holding" }];
    expect(acharRibeira(incs)?.id).toBe("x");
  });

  it("cai pro primeiro item quando nenhum match", () => {
    const incs: Incorporadora[] = [
      { id: "a", nome: "Alpha" },
      { id: "b", nome: "Beta" },
    ];
    expect(acharRibeira(incs)?.id).toBe("a");
  });

  it("devolve undefined quando lista vazia", () => {
    expect(acharRibeira([])).toBeUndefined();
  });
});

describe("pontosScatter", () => {
  it("limita a 12 pontos e marca ours pra empreendimento da ribeira", () => {
    const lista = Array.from({ length: 20 }, (_, i) =>
      emp({ id: `e${i}`, nome: `E${i}`, incorporadora_id: i < 3 ? "ribeira" : "outra" }),
    );
    const pontos = pontosScatter(lista, "ribeira");
    expect(pontos).toHaveLength(12);
    expect(pontos.slice(0, 3).every((p) => p.ours)).toBe(true);
    expect(pontos.slice(3).every((p) => !p.ours)).toBe(true);
  });
});

describe("rankingAmeaca", () => {
  it("exclui ribeira, ordena por score desc e limita a 4", () => {
    const incs: Incorporadora[] = [
      { id: "ribeira", nome: "Ribeira" },
      { id: "a", nome: "A" },
      { id: "b", nome: "B" },
      { id: "c", nome: "C" },
      { id: "d", nome: "D" },
      { id: "e", nome: "E" },
    ];
    const emps = [
      emp({ id: "ea", incorporadora_id: "a", preco_m2_medio: 12000, vso: 90 }),
      emp({ id: "eb", incorporadora_id: "b", preco_m2_medio: 7500, vso: 30 }),
      emp({ id: "ec", incorporadora_id: "c", preco_m2_medio: 9000, vso: 60 }),
    ];
    const ranking = rankingAmeaca(incs, emps, "ribeira");
    expect(ranking).toHaveLength(4);
    expect(ranking.map((r) => r.nome)).not.toContain("Ribeira");
    expect(ranking[0].score).toBeGreaterThanOrEqual(ranking[ranking.length - 1].score);
  });
});

describe("paraMovimentos", () => {
  const incs: Incorporadora[] = [{ id: "i", nome: "Construtora X" }];
  const emps = [emp({ id: "e1", incorporadora_id: "i" })];

  it("classifica tipo a partir da descrição", () => {
    const eventos: EventoPromocional[] = [
      { id: "1", empreendimento_id: "e1", descricao: "Reajuste de tabela", data_inicio: "2026-06-01" },
      { id: "2", empreendimento_id: "e1", descricao: "Lançamento novo bloco", data_inicio: "2026-05-01" },
      { id: "3", empreendimento_id: "e1", descricao: "ITBI grátis até maio", data_inicio: "2026-04-01" },
    ];
    const movs = paraMovimentos(eventos, emps, incs);
    expect(movs[0].tipo).toBe("Reajuste");
    expect(movs[1].tipo).toBe("Lançamento");
    expect(movs[2].tipo).toBe("Promoção");
  });

  it("ordena por data_inicio decrescente", () => {
    const eventos: EventoPromocional[] = [
      { id: "antigo", empreendimento_id: "e1", data_inicio: "2026-01-01", descricao: "x" },
      { id: "novo", empreendimento_id: "e1", data_inicio: "2026-06-01", descricao: "x" },
    ];
    const movs = paraMovimentos(eventos, emps, incs);
    expect(movs[0].id).toBe("novo");
    expect(movs[1].id).toBe("antigo");
  });
});

describe("montarHeatmap", () => {
  it("monta grid 4×4 (bairros × padrões) marcando GAP onde contagem é 0", () => {
    const empsConcorrentes = [
      emp({ id: "1", incorporadora_id: "x", bairro: "Centro", padrao: "Alto" }),
      emp({ id: "2", incorporadora_id: "x", bairro: "Centro", padrao: "Alto" }),
      emp({ id: "3", incorporadora_id: "x", bairro: "Vila Nova", padrao: "Médio" }),
    ];
    const { padroes, grid } = montarHeatmap(empsConcorrentes, "ribeira-id");
    expect(padroes).toEqual(["Econômico", "Médio", "Alto", "Luxo"]);
    expect(grid).toHaveLength(4);
    const linhaCentro = grid.find((l) => l.bairro === "Centro");
    expect(linhaCentro).toBeTruthy();
    const celulaCentroAlto = linhaCentro!.cells[padroes.indexOf("Alto")];
    expect(celulaCentroAlto.gap).toBe(false);
    if (!celulaCentroAlto.gap) expect(celulaCentroAlto.n).toBe(2);
    const celulaCentroEconomico = linhaCentro!.cells[padroes.indexOf("Econômico")];
    expect(celulaCentroEconomico.gap).toBe(true);
  });

  it("exclui empreendimentos da ribeira da contagem", () => {
    const todos = [
      emp({ id: "1", incorporadora_id: "ribeira", bairro: "Centro", padrao: "Alto" }),
      emp({ id: "2", incorporadora_id: "x", bairro: "Centro", padrao: "Alto" }),
    ];
    const { padroes, grid } = montarHeatmap(todos, "ribeira");
    const linhaCentro = grid.find((l) => l.bairro === "Centro")!;
    const celula = linhaCentro.cells[padroes.indexOf("Alto")];
    expect(celula.gap).toBe(false);
    if (!celula.gap) expect(celula.n).toBe(1); // só o do "x" entrou
  });
});
