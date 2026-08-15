import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CardDiagnostico } from "./CardDiagnostico";

const fakeFetch = vi.fn();

beforeEach(() => {
  fakeFetch.mockReset();
  vi.stubGlobal("fetch", fakeFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function ok(dados: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(dados) });
}

describe("<CardDiagnostico />", () => {
  it("mostra empty state quando não há parecer", async () => {
    fakeFetch.mockResolvedValueOnce(ok({ atual: null, historico: [] }));

    render(<CardDiagnostico empreendimentoId="abc" />);

    await waitFor(() => {
      expect(screen.getByText(/Nenhum diagnóstico ainda/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button")).toHaveTextContent(/Gerar diagnóstico/i);
  });

  it("renderiza resumo executivo e bullets com tags corretas", async () => {
    fakeFetch.mockResolvedValueOnce(ok({
      atual: {
        id: "p1",
        resumo_executivo: "Posição premium com estoque enxuto.",
        criado_em: "2026-08-15T12:00:00Z",
        bullets: [
          { texto: "Preço 9% acima da média", tag: "risco", kpi_referencia: "preco_m2" },
          { texto: "VSO em 100%", tag: "forca" },
        ],
      },
      historico: [{ id: "p0" }],
    }));

    render(<CardDiagnostico empreendimentoId="abc" />);

    await waitFor(() => {
      expect(screen.getByText(/Posição premium/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Preço 9% acima da média/i)).toBeInTheDocument();
    expect(screen.getByText("Risco")).toBeInTheDocument();
    expect(screen.getByText("Força")).toBeInTheDocument();
    expect(screen.getByText(/preco_m2/)).toBeInTheDocument();
    expect(screen.getByText(/1 versão\(ões\) anterior\(es\)/i)).toBeInTheDocument();
    // Botão vira "Atualizar" quando já tem parecer.
    expect(screen.getByRole("button")).toHaveTextContent(/Atualizar diagnóstico/i);
  });

  it("mostra erro quando fetch falha", async () => {
    fakeFetch.mockResolvedValueOnce({
      ok: false, status: 503, json: () => Promise.resolve({ detail: "Sem DB" }),
    });

    render(<CardDiagnostico empreendimentoId="abc" />);

    await waitFor(() => {
      expect(screen.getByText(/Erro 503/i)).toBeInTheDocument();
    });
  });
});
