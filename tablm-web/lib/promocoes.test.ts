import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EventoPromocional } from "@/types";

import { contarVencendo, diasAteVencer } from "./promocoes";

function ev(data_fim: string | null | undefined): EventoPromocional {
  return {
    id: "x",
    empreendimento_id: "y",
    data_fim,
  };
}

describe("diasAteVencer", () => {
  beforeEach(() => {
    // Trava o relógio em 2026-06-20 UTC para tornar os deltas determinísticos.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devolve null quando a data está ausente ou inválida", () => {
    expect(diasAteVencer(null)).toBeNull();
    expect(diasAteVencer(undefined)).toBeNull();
    expect(diasAteVencer("")).toBeNull();
    expect(diasAteVencer("não-é-data")).toBeNull();
  });

  it("conta 0 quando a data é hoje (UTC)", () => {
    expect(diasAteVencer("2026-06-20")).toBe(0);
  });

  it("conta positivo quando a data é futura", () => {
    expect(diasAteVencer("2026-06-27")).toBe(7);
    expect(diasAteVencer("2026-07-20")).toBe(30);
  });

  it("conta negativo quando a data é passada", () => {
    expect(diasAteVencer("2026-06-13")).toBe(-7);
  });

  it("aceita strings ISO com hora — usa só a parte da data", () => {
    expect(diasAteVencer("2026-06-27T23:59:59Z")).toBe(7);
  });
});

describe("contarVencendo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("conta zero para lista vazia", () => {
    expect(contarVencendo([])).toEqual({ vencendo7d: 0, vencendo3d: 0 });
  });

  it("ignora datas ausentes e expiradas", () => {
    const eventos = [
      ev(null), // sem prazo -> ignorado
      ev("2026-06-19"), // expirado -> ignorado
    ];
    expect(contarVencendo(eventos)).toEqual({ vencendo7d: 0, vencendo3d: 0 });
  });

  it("classifica corretamente nas faixas <=3 e <=7", () => {
    const eventos = [
      ev("2026-06-20"), // hoje -> conta nos dois
      ev("2026-06-22"), // 2d -> conta nos dois
      ev("2026-06-24"), // 4d -> só 7d
      ev("2026-06-27"), // 7d -> só 7d
      ev("2026-06-28"), // 8d -> nenhum
    ];
    expect(contarVencendo(eventos)).toEqual({ vencendo7d: 4, vencendo3d: 2 });
  });
});
