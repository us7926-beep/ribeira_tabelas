import { describe, expect, it } from "vitest";

import { escaparCelula, montarCsv } from "./csv";

describe("escaparCelula", () => {
  it("devolve string vazia para null/undefined", () => {
    expect(escaparCelula(null)).toBe("");
    expect(escaparCelula(undefined)).toBe("");
  });

  it("não envolve em aspas valores simples", () => {
    expect(escaparCelula("simples")).toBe("simples");
    expect(escaparCelula(123)).toBe("123");
  });

  it("envolve em aspas quando contém vírgula", () => {
    expect(escaparCelula("a, b")).toBe('"a, b"');
  });

  it("envolve em aspas quando contém aspa e escapa dobrando", () => {
    expect(escaparCelula('ele disse "oi"')).toBe('"ele disse ""oi"""');
  });

  it("envolve em aspas quando contém quebra de linha", () => {
    expect(escaparCelula("linha1\nlinha2")).toBe('"linha1\nlinha2"');
  });
});

describe("montarCsv", () => {
  it("monta CSV simples com cabeçalho e linhas", () => {
    const csv = montarCsv(["nome", "valor"], [
      ["alfa", 1],
      ["beta", 2],
    ]);
    expect(csv).toBe("nome,valor\nalfa,1\nbeta,2");
  });

  it("escapa cada célula conforme RFC4180", () => {
    const csv = montarCsv(
      ["a", "b"],
      [["x, y", 'ele disse "oi"']],
    );
    expect(csv).toBe('a,b\n"x, y","ele disse ""oi"""');
  });

  it("aceita lista vazia (só cabeçalho)", () => {
    expect(montarCsv(["a", "b"], [])).toBe("a,b");
  });
});
