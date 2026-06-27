import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CalculoRendaFinanciamento } from "./CalculoRendaFinanciamento";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          taxa_anual_usada: 7.66,
          taxa_mensal_usada: 0.006178,
          parcela_financiamento: 2587.34,
          total_mensal_comprometido: 4187.34,
          renda_necessaria: 13957.8,
          label_modalidade: "MCMV Faixa 3",
          descricao_modalidade: "Renda familiar...",
          alertas: ["Parcelas pontuais nao incluidas..."],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CalculoRendaFinanciamento", () => {
  it("renderiza titulo e inputs principais", () => {
    render(<CalculoRendaFinanciamento />);
    expect(screen.getByText("Renda mínima necessária")).toBeInTheDocument();
    expect(screen.getByText("Parcela mensal de obra (R$)")).toBeInTheDocument();
    expect(screen.getByText("Saldo a financiar (R$)")).toBeInTheDocument();
  });

  it("mostra placeholder quando saldo eh zero", () => {
    render(<CalculoRendaFinanciamento />);
    expect(
      screen.getByText(
        "Informe um saldo a financiar maior que zero para calcular.",
      ),
    ).toBeInTheDocument();
  });

  it("revela campo de taxa custom quando modalidade=personalizada", () => {
    render(<CalculoRendaFinanciamento />);
    expect(screen.queryByText(/Taxa personalizada/)).not.toBeInTheDocument();
    const selects = screen.getAllByRole("combobox");
    // Primeiro combobox = Modalidade
    fireEvent.change(selects[0], { target: { value: "personalizada" } });
    expect(screen.getByText(/Taxa personalizada/)).toBeInTheDocument();
  });

  it("lista todos os presets no select de modalidade", () => {
    render(<CalculoRendaFinanciamento />);
    const opcoes = screen
      .getAllByRole("option")
      .map((o) => (o as HTMLOptionElement).value);
    expect(opcoes).toContain("mcmv_faixa1");
    expect(opcoes).toContain("mcmv_faixa3");
    expect(opcoes).toContain("sbpe");
    expect(opcoes).toContain("personalizada");
  });

  it("inputs ficam read-only quando controlado=true", () => {
    render(
      <CalculoRendaFinanciamento
        parcelaObraMensal={1500}
        saldoFinanciar={300000}
        controlado
      />,
    );
    const parcela = screen.getByDisplayValue("1500");
    const saldo = screen.getByDisplayValue("300000");
    expect(parcela).toHaveAttribute("readonly");
    expect(saldo).toHaveAttribute("readonly");
  });
});
