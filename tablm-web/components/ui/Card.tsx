import type { HTMLAttributes } from "react";

type Variant = "default" | "lg";

interface Props extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

/** Card branco, borda fina, sombra discreta. variant="lg" = padding maior. */
export function Card({ variant = "default", className = "", children, ...rest }: Props) {
  const padding = variant === "lg" ? "p-[22px]" : "p-5";
  return (
    <div
      {...rest}
      className={`bg-white border border-line rounded-[16px] shadow-[0_1px_3px_rgba(20,40,90,0.05)] ${padding} ${className}`}
    >
      {children}
    </div>
  );
}
