import { describe, expect, it } from "vitest";

import { normalizarPontosHeatmap } from "./heatmap-utils";

describe("normalizarPontosHeatmap", () => {
  it("filtra entradas sem valor útil (null, undefined, zero, negativo)", () => {
    const pontos = normalizarPontosHeatmap([
      { lat: 1, lng: 1, valor: null },
      { lat: 2, lng: 2, valor: undefined },
      { lat: 3, lng: 3, valor: 0 },
      { lat: 4, lng: 4, valor: -100 },
      { lat: 5, lng: 5, valor: 500000 },
    ]);
    expect(pontos).toHaveLength(1);
    expect(pontos[0].lat).toBe(5);
  });

  it("mapeia o maior valor em peso 1 e o resto em proporção com piso 0.15", () => {
    const pontos = normalizarPontosHeatmap([
      { lat: 1, lng: 1, valor: 100 },
      { lat: 2, lng: 2, valor: 50 },
      { lat: 3, lng: 3, valor: 200 }, // maior
    ]);
    const [p1, p2, p3] = pontos;
    // maior vira 1.0
    expect(p3.peso).toBeCloseTo(1, 3);
    // 100/200 = 0.5 → 0.15 + 0.85*0.5 = 0.575
    expect(p1.peso).toBeCloseTo(0.575, 3);
    // 50/200 = 0.25 → 0.15 + 0.85*0.25 = 0.3625
    expect(p2.peso).toBeCloseTo(0.3625, 3);
  });

  it("respeita o piso — nenhum peso menor que minimoRelativo", () => {
    const pontos = normalizarPontosHeatmap([
      { lat: 1, lng: 1, valor: 1 },
      { lat: 2, lng: 2, valor: 100000 },
    ]);
    // valor muito pequeno em relação ao máximo — mas ainda deve estar visível
    expect(pontos[0].peso).toBeGreaterThanOrEqual(0.15);
  });

  it("devolve array vazio quando não há entrada válida", () => {
    expect(normalizarPontosHeatmap([])).toEqual([]);
    expect(normalizarPontosHeatmap([{ lat: 1, lng: 1, valor: null }])).toEqual([]);
  });

  it("aceita minimoRelativo customizado", () => {
    const pontos = normalizarPontosHeatmap(
      [
        { lat: 1, lng: 1, valor: 10 },
        { lat: 2, lng: 2, valor: 100 },
      ],
      0.3,
    );
    expect(pontos[0].peso).toBeCloseTo(0.3 + 0.7 * 0.1, 3); // 0.37
    expect(pontos[1].peso).toBeCloseTo(1, 3);
  });
});
