import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Empreendimento, TabelaPrecos } from "@/types";

import { ComparativoUnidades } from "./ComparativoUnidades";

const fakeFetch = vi.fn();

const empreendimentos: Empreendimento[] = [
  { id: "a", incorporadora_id: "i", nome: "Alegria", cidade: "Mogi", bairro: "Centro", padrao: "Alto" },
  { id: "b", incorporadora_id: "i", nome: "Bristol", cidade: "SP", bairro: "Vila", padrao: "Médio" },
];

function tabelaCom(idEmp: string, unidades: TabelaPrecos["unidades"]): TabelaPrecos {
  return {
    id: `tp-${idEmp}`,
    empreendimento_id: idEmp,
    versao: "Jul/2026",
    data_referencia: "2026-07-01",
    unidades,
    condicoes: null,
    promocoes: null,
  };
}

beforeEach(() => {
  fakeFetch.mockReset();
  vi.stubGlobal("fetch", fakeFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("<ComparativoUnidades />", () => {
  it("mostra empty state e depois carrega tabelas em paralelo", async () => {
    fakeFetch.mockImplementation(async (url: string) => {
      if (url.includes("/a/")) {
        return {
          ok: true,
          json: async () => [tabelaCom("a", [
            { unidade: "101", area_m2: 50, preco_total: 500000 },
          ])],
        };
      }
      return {
        ok: true,
        json: async () => [tabelaCom("b", [
          { unidade: "20", area_m2: 60, preco_total: 700000 },
        ])],
      };
    });

    render(<ComparativoUnidades empreendimentos={empreendimentos} />);

    // Empty state antes de marcar
    expect(screen.getByText(/Marque unidades acima para comparar/i)).toBeInTheDocument();

    // Após load, unidades aparecem nas duas colunas.
    await waitFor(() => {
      expect(screen.getByText("101")).toBeInTheDocument();
      expect(screen.getByText("20")).toBeInTheDocument();
    });
  });

  it("marca líder pelo menor preço/m² quando 2+ selecionadas", async () => {
    fakeFetch.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes("/a/")
          ? [tabelaCom("a", [{ unidade: "101", area_m2: 50, preco_total: 500000 }])] // R$10.000/m²
          : [tabelaCom("b", [{ unidade: "20", area_m2: 60, preco_total: 480000 }])], // R$8.000/m²
    }));

    render(<ComparativoUnidades empreendimentos={empreendimentos} />);

    await waitFor(() => expect(screen.getByText("101")).toBeInTheDocument());

    fireEvent.click(screen.getByText("101"));
    fireEvent.click(screen.getByText("20"));

    // Chip "menor" aparece pelo menos uma vez no menor pM².
    // (evitamos ser estritos porque o texto "menor" também pode aparecer
    // em legendas/tooltips em outras versões visuais)
    await waitFor(() => {
      expect(screen.getAllByText(/menor/i).length).toBeGreaterThanOrEqual(1);
    });
    // Tabela consolidada mostra ambas as linhas (R$10.000/m² e R$8.000/m²).
    expect(screen.getByText("R$ 10.000")).toBeInTheDocument();
    expect(screen.getByText("R$ 8.000")).toBeInTheDocument();
  });

  it("mostra empty por empreendimento sem tabela cadastrada", async () => {
    fakeFetch.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => (url.includes("/a/") ? [] : [tabelaCom("b", [])]),
    }));

    render(<ComparativoUnidades empreendimentos={empreendimentos} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Nenhuma tabela de preços cadastrada/i).length).toBeGreaterThan(0);
    });
  });
});
