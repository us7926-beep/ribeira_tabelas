import type { HTMLAttributes } from "react";

/** Card royal de destaque (Insights / Confiança / Reajuste a aplicar). */
export function RoyalCard({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={`rounded-[16px] p-[22px] text-white shadow-[0_8px_22px_rgba(35,71,197,0.2)] bg-[linear-gradient(160deg,#2347C5,#1A38A8)] ${className}`}
    >
      {children}
    </div>
  );
}
