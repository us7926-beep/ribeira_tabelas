import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Tabs } from "./Tabs";

const ABAS = [
  { id: "a", label: "Alfa" },
  { id: "b", label: "Beta" },
  { id: "c", label: "Gama" },
] as const;

describe("Tabs", () => {
  it("renderiza todas as abas", () => {
    render(<Tabs abas={[...ABAS]} ativa="a" onTrocar={() => {}} />);
    expect(screen.getByText("Alfa")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gama")).toBeInTheDocument();
  });

  it("aplica estilo ativo ao item correspondente", () => {
    render(<Tabs abas={[...ABAS]} ativa="b" onTrocar={() => {}} />);
    const ativa = screen.getByText("Beta");
    expect(ativa).toHaveClass("bg-royal");
    expect(ativa).toHaveClass("text-white");

    const inativa = screen.getByText("Alfa");
    expect(inativa).not.toHaveClass("bg-royal");
    expect(inativa).toHaveClass("text-muted");
  });

  it("dispara onTrocar com o id ao clicar numa aba", () => {
    const onTrocar = vi.fn();
    render(<Tabs abas={[...ABAS]} ativa="a" onTrocar={onTrocar} />);
    fireEvent.click(screen.getByText("Gama"));
    expect(onTrocar).toHaveBeenCalledWith("c");
  });

  it("aceita className extra no wrapper", () => {
    const { container } = render(
      <Tabs abas={[...ABAS]} ativa="a" onTrocar={() => {}} className="ml-4" />,
    );
    expect(container.firstChild).toHaveClass("ml-4");
  });
});
