import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Chip } from "./Chip";

describe("Chip", () => {
  it("renderiza os filhos como texto", () => {
    render(<Chip>oi</Chip>);
    expect(screen.getByText("oi")).toBeInTheDocument();
  });

  it("aplica classes do tom royal quando especificado", () => {
    render(<Chip tom="royal">royal</Chip>);
    const node = screen.getByText("royal");
    expect(node).toHaveClass("text-royal");
    expect(node).toHaveClass("bg-royal-tint");
  });

  it("aplica classes do tom warn", () => {
    render(<Chip tom="warn">vencendo</Chip>);
    const node = screen.getByText("vencendo");
    expect(node).toHaveClass("text-warn-strong");
    expect(node).toHaveClass("bg-warn-bg");
  });

  it("cai no neutro quando tom é omitido", () => {
    render(<Chip>neutro</Chip>);
    const node = screen.getByText("neutro");
    expect(node).toHaveClass("text-muted");
  });

  it("aceita className extra sem perder as classes do tom", () => {
    render(
      <Chip tom="up" className="ml-4">
        ok
      </Chip>,
    );
    const node = screen.getByText("ok");
    expect(node).toHaveClass("ml-4");
    expect(node).toHaveClass("text-up-strong");
  });
});
