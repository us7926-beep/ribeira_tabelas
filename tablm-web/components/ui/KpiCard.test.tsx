import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KpiCard } from "./KpiCard";

describe("KpiCard", () => {
  it("renderiza rótulo e valor", () => {
    render(<KpiCard rotulo="VGV" valor="R$ 50 mi" />);
    expect(screen.getByText("VGV")).toBeInTheDocument();
    expect(screen.getByText("R$ 50 mi")).toBeInTheDocument();
  });

  it("aceita ReactNode no valor", () => {
    render(<KpiCard rotulo="VSO" valor={<b data-testid="custom">42%</b>} />);
    expect(screen.getByTestId("custom")).toHaveTextContent("42%");
  });

  it("mostra hint quando fornecido", () => {
    render(<KpiCard rotulo="x" valor="1" hint="último mês" />);
    expect(screen.getByText("último mês")).toBeInTheDocument();
  });

  it("mostra delta quando fornecido", () => {
    render(<KpiCard rotulo="x" valor="1" delta={<span data-testid="d">+12%</span>} />);
    expect(screen.getByTestId("d")).toBeInTheDocument();
  });

  it("não renderiza o wrapper de hint/delta quando ambos ausentes", () => {
    const { container } = render(<KpiCard rotulo="x" valor="1" />);
    // O wrapper "mt-1" só aparece quando há hint ou delta
    const wrapper = container.querySelector(".mt-1");
    expect(wrapper).toBeNull();
  });
});
