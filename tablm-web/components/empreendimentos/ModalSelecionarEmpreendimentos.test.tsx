import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Empreendimento } from "@/types";

import { ModalSelecionarEmpreendimentos } from "./ModalSelecionarEmpreendimentos";

const empreendimentos: Empreendimento[] = [
  { id: "a", incorporadora_id: "i1", nome: "Alegria", cidade: "Mogi", bairro: "Centro", padrao: "Alto" },
  { id: "b", incorporadora_id: "i1", nome: "Bristol", cidade: "SP", bairro: "Vila Mariana", padrao: "Médio" },
  { id: "c", incorporadora_id: "i2", nome: "Central", cidade: "Mogi", bairro: "Centro", padrao: "Alto" },
];

describe("<ModalSelecionarEmpreendimentos />", () => {
  it("não renderiza quando aberto=false", () => {
    render(
      <ModalSelecionarEmpreendimentos
        aberto={false}
        empreendimentos={empreendimentos}
        idsSelecionados={[]}
        onFechar={() => {}}
        onConfirmar={() => {}}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renderiza lista e marca o item travado como 'atual'", () => {
    render(
      <ModalSelecionarEmpreendimentos
        aberto={true}
        empreendimentos={empreendimentos}
        idsSelecionados={["a"]}
        travarIds={["a"]}
        onFechar={() => {}}
        onConfirmar={() => {}}
      />,
    );
    // Alegria aparece 2x (chip topo + item na lista). Basta >0 pra saber que renderizou.
    expect(screen.getAllByText("Alegria").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Bristol")).toBeInTheDocument();
    expect(screen.getByText("Central")).toBeInTheDocument();
    expect(screen.getByText("atual")).toBeInTheDocument();
    const botao = screen.getByRole("button", { name: /Comparar/i });
    expect(botao).toBeDisabled();
    expect(screen.getByText(/Selecione mais 1/i)).toBeInTheDocument();
  });

  it("filtra por busca (nome/cidade/bairro/padrão)", () => {
    render(
      <ModalSelecionarEmpreendimentos
        aberto={true}
        empreendimentos={empreendimentos}
        idsSelecionados={[]}
        onFechar={() => {}}
        onConfirmar={() => {}}
      />,
    );
    const busca = screen.getByPlaceholderText(/Buscar/i);
    fireEvent.change(busca, { target: { value: "Vila Mariana" } });
    expect(screen.getByText("Bristol")).toBeInTheDocument();
    expect(screen.queryByText("Alegria")).not.toBeInTheDocument();
    expect(screen.queryByText("Central")).not.toBeInTheDocument();
  });

  it("confirma com ids selecionados quando ≥2", () => {
    const onConfirmar = vi.fn();
    render(
      <ModalSelecionarEmpreendimentos
        aberto={true}
        empreendimentos={empreendimentos}
        idsSelecionados={["a"]}
        travarIds={["a"]}
        onFechar={() => {}}
        onConfirmar={onConfirmar}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Bristol/i }));
    const botao = screen.getByRole("button", { name: /Comparar \(2\)/i });
    expect(botao).not.toBeDisabled();
    fireEvent.click(botao);
    expect(onConfirmar).toHaveBeenCalledWith(expect.arrayContaining(["a", "b"]));
    expect(onConfirmar.mock.calls[0][0]).toHaveLength(2);
  });

  it("não desmarca o item travado", () => {
    render(
      <ModalSelecionarEmpreendimentos
        aberto={true}
        empreendimentos={empreendimentos}
        idsSelecionados={["a"]}
        travarIds={["a"]}
        onFechar={() => {}}
        onConfirmar={() => {}}
      />,
    );
    // Clica no item da lista (que é <button disabled> — o React ignora clicks em disabled).
    const itemAlegria = screen.getByRole("button", { name: /Alegria/i });
    fireEvent.click(itemAlegria);
    expect(screen.getByText(/Selecione mais 1/i)).toBeInTheDocument();
  });
});
