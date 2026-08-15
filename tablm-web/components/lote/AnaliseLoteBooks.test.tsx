import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Incorporadora } from "@/types";

import { AnaliseLoteBooks } from "./AnaliseLoteBooks";

const fakeFetch = vi.fn();

beforeEach(() => {
  fakeFetch.mockReset();
  vi.stubGlobal("fetch", fakeFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const incs: Incorporadora[] = [
  { id: "i1", nome: "Ribeira" },
  { id: "i2", nome: "Helbor" },
];

function fakePdfFile(nome: string): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], nome, {
    type: "application/pdf",
  });
}

describe("<AnaliseLoteBooks />", () => {
  it("mostra Dropzone e não renderiza fila enquanto vazio", () => {
    render(<AnaliseLoteBooks incorporadoras={incs} />);
    expect(screen.getByText(/Arraste books PDF aqui/i)).toBeInTheDocument();
    expect(screen.queryByText(/Revisar fila/i)).not.toBeInTheDocument();
  });

  it("processa arquivo aceito e mostra campos extraídos com botão Criar habilitado", async () => {
    fakeFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        arquivo_nome: "alegria.pdf",
        ficha: { nome: "Alegria", cidade: "Mogi", padrao: "Alto" },
        tabela: {
          nome_empreendimento: "Alegria",
          incorporadora: "Ribeira",
          unidades: [{ unidade: "101" }, { unidade: "102" }],
          promocoes: [],
        },
        erros: {},
      }),
    });

    render(<AnaliseLoteBooks incorporadoras={incs} />);

    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input!, {
      target: { files: [fakePdfFile("alegria.pdf")] },
    });

    await waitFor(() => {
      expect(screen.getByText(/Revisar fila/i)).toBeInTheDocument();
    });
    // Chip "Extraído" aparece no item (o texto "extraídos" também está no subtítulo — usamos exact match).
    await waitFor(() => {
      expect(screen.getByText("Extraído")).toBeInTheDocument();
    });
    expect(screen.getByText("Alegria")).toBeInTheDocument();
    // O texto "2 unidades na tabela" está quebrado entre <b>2</b> e span — o
    // matcher pega o wrapper + o pai; basta 1 match pra confirmar renderização.
    const encontrados = screen.getAllByText((_c, el) =>
      /2\s*unidades?\s*na tabela/i.test(el?.textContent ?? ""),
    );
    expect(encontrados.length).toBeGreaterThan(0);

    const botao = screen.getByRole("button", { name: /Criar 1 empreendimento/i });
    expect(botao).not.toBeDisabled();
  });

  it("mostra erro e permite retentar quando /books/extrair falha", async () => {
    fakeFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ detail: "Gemini timeout" }),
    });

    render(<AnaliseLoteBooks incorporadoras={incs} />);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(input!, { target: { files: [fakePdfFile("x.pdf")] } });

    await waitFor(() => {
      expect(screen.getByText(/Gemini timeout/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Retentar/i })).toBeInTheDocument();
    // Botão criar continua desabilitado.
    expect(
      screen.getByRole("button", { name: /Criar 0 empreendimento/i }),
    ).toBeDisabled();
  });

  it("ignora arquivos não-PDF (drop de xlsx)", () => {
    render(<AnaliseLoteBooks incorporadoras={incs} />);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    const xlsx = new File([new Uint8Array([1, 2])], "planilha.xlsx", {
      type: "application/vnd.ms-excel",
    });
    fireEvent.change(input!, { target: { files: [xlsx] } });
    // Fila não aparece porque o único arquivo foi filtrado.
    expect(screen.queryByText(/Revisar fila/i)).not.toBeInTheDocument();
  });
});
