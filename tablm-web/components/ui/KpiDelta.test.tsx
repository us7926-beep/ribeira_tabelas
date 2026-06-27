import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KpiDelta } from "./KpiDelta";

describe("KpiDelta", () => {
  it("renderiza seta ▲ para alta com cor verde", () => {
    render(<KpiDelta direcao="alta">+12%</KpiDelta>);
    const node = screen.getByText(/▲/);
    expect(node).toHaveClass("text-up");
    expect(node).toHaveTextContent("▲ +12%");
  });

  it("renderiza seta ▼ para baixa com cor vermelha", () => {
    render(<KpiDelta direcao="baixa">−8%</KpiDelta>);
    const node = screen.getByText(/▼/);
    expect(node).toHaveClass("text-down");
    expect(node).toHaveTextContent("▼ −8%");
  });

  it("renderiza • neutro com cor muted", () => {
    render(<KpiDelta direcao="neutro">estável</KpiDelta>);
    const node = screen.getByText(/•/);
    expect(node).toHaveClass("text-muted");
  });
});
