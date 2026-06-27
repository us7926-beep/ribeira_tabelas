import { describe, expect, it } from "vitest";

import type { Empreendimento, EventoPromocional, Incorporadora } from "@/types";

import { analisarSwot } from "./swot";

function emp(over: Partial<Empreendimento> = {}): Empreendimento {
  return {
    id: over.id ?? "x",
    incorporadora_id: over.incorporadora_id ?? "ribeira",
    nome: over.nome ?? "Emp",
    ...over,
  };
}

describe("analisarSwot", () => {
  it("devolve sempre os 4 quadrantes Forças/Fraquezas/Oportunidades/Ameaças", () => {
    const quadrantes = analisarSwot([], [], [], []);
    expect(quadrantes.map((q) => q.title)).toEqual([
      "Forças",
      "Fraquezas",
      "Oportunidades",
      "Ameaças",
    ]);
  });

  it("cada quadrante tem accent/tint/icon/sub/items", () => {
    const quadrantes = analisarSwot([], [], [], []);
    for (const q of quadrantes) {
      expect(q.accent).toMatch(/^#/);
      expect(q.tint).toMatch(/^#/);
      expect(typeof q.icon).toBe("string");
      expect(typeof q.sub).toBe("string");
      expect(Array.isArray(q.items)).toBe(true);
      expect(q.items.length).toBeGreaterThan(0);
    }
  });

  it("cada quadrante tem no máximo 3 bullets", () => {
    const meus = Array.from({ length: 10 }, (_, i) =>
      emp({ id: `m${i}`, nome: `Meu ${i}`, preco_m2_medio: 12000 + i, vso: 80 + i }),
    );
    const concs = Array.from({ length: 10 }, (_, i) =>
      emp({ id: `c${i}`, nome: `Conc ${i}`, incorporadora_id: "outra", preco_m2_medio: 7500, vso: 30 }),
    );
    const quadrantes = analisarSwot(meus, concs, [], []);
    for (const q of quadrantes) {
      expect(q.items.length).toBeLessThanOrEqual(3);
    }
  });

  it("Forças menciona vantagens reais quando VSO é maior que o mercado", () => {
    const meus = [emp({ nome: "TopVendas", preco_m2_medio: 8000, vso: 90 })];
    const concs = [emp({ id: "c", incorporadora_id: "x", nome: "Lenta", preco_m2_medio: 8000, vso: 20 })];
    const [forcas] = analisarSwot(meus, concs, [], []);
    expect(forcas.title).toBe("Forças");
    expect(forcas.items.join(" ")).toMatch(/TopVendas/);
  });

  it("Oportunidades aponta bairros com concorrência mas sem oferta nossa", () => {
    const meus = [emp({ nome: "Meu", bairro: "Jardim A" })];
    const concs = [
      emp({ id: "c1", incorporadora_id: "x", nome: "C1", bairro: "Vila B" }),
      emp({ id: "c2", incorporadora_id: "x", nome: "C2", bairro: "Centro" }),
    ];
    const [, , oportunidades] = analisarSwot(meus, concs, [], []);
    expect(oportunidades.title).toBe("Oportunidades");
    expect(oportunidades.items.join(" ")).toMatch(/Vila B|Centro/);
  });

  it("Ameaças menciona concorrentes ativos quando ha mais incorporadoras que meus empreendimentos", () => {
    const meus = [emp({ nome: "Meu" })];
    const incs: Incorporadora[] = [
      { id: "ribeira", nome: "Ribeira" },
      { id: "a", nome: "Alpha" },
      { id: "b", nome: "Beta" },
    ];
    const [, , , ameacas] = analisarSwot(meus, [], [], incs);
    expect(ameacas.title).toBe("Ameaças");
    expect(ameacas.items[0]).toMatch(/incorporadora/);
  });

  it("eventos de reajuste/lançamento aparecem em Ameaças", () => {
    const meus = [emp()];
    const eventos: EventoPromocional[] = [
      { id: "1", empreendimento_id: "x", descricao: "Reajuste de 5%", data_inicio: "2026-05-01" },
      { id: "2", empreendimento_id: "x", descricao: "Lançamento torre 2", data_inicio: "2026-04-01" },
    ];
    const [, , , ameacas] = analisarSwot(meus, [], eventos, []);
    expect(ameacas.items.join(" ")).toMatch(/reajuste|lançamento|lanca/i);
  });
});
