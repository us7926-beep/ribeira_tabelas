import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

describe("Button", () => {
  it("renderiza filhos e dispara onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salvar</Button>);
    const btn = screen.getByRole("button", { name: "Salvar" });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("primary é a variante default", () => {
    render(<Button>Padrão</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("bg-royal");
    expect(btn).toHaveClass("text-white");
  });

  it("variante secondary usa borda + fundo branco", () => {
    render(<Button variante="secondary">Sec</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("bg-white");
    expect(btn).toHaveClass("border-line");
  });

  it("variante ghost usa text-muted + hover royal", () => {
    render(<Button variante="ghost">Ghost</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("text-muted");
  });

  it("respeita disabled e bloqueia onClick", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Off
      </Button>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("passa className extra sem perder as classes da variante", () => {
    render(<Button className="ml-2">x</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("ml-2");
    expect(btn).toHaveClass("bg-royal");
  });
});
