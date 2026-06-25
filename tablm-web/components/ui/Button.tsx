import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variant;
}

/** Botões padronizados. Primário royal com shadow-btn; secundário branco com borda. */
export function Button({ variante = "primary", className = "", children, ...rest }: Props) {
  const base = "rounded-[12px] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const map: Record<Variant, string> = {
    primary:
      "bg-royal text-white text-[15.5px] px-4 py-[14px] shadow-[0_6px_16px_rgba(35,71,197,0.28)] hover:bg-royal-hover",
    secondary:
      "bg-white border border-line text-body text-[13.5px] px-4 py-[10px] hover:border-royal hover:text-royal",
    ghost: "text-muted text-[13.5px] px-3 py-2 hover:text-royal hover:bg-royal-tint",
  };
  return (
    <button {...rest} className={`${base} ${map[variante]} ${className}`}>
      {children}
    </button>
  );
}
