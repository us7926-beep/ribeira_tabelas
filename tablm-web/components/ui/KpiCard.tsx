import type { ReactNode } from "react";

interface Props {
  rotulo: string;
  valor: ReactNode;
  hint?: ReactNode;
  delta?: ReactNode;
}

/** Card KPI: rótulo pequeno, número grande extrabold tabular, hint/delta opcional. */
export function KpiCard({ rotulo, valor, hint, delta }: Props) {
  return (
    <div className="bg-white border border-line rounded-[15px] p-[17px_18px] shadow-[0_1px_3px_rgba(20,40,90,0.05)]">
      <div className="text-[12.5px] text-muted font-semibold">{rotulo}</div>
      <div className="text-[26px] font-extrabold text-ink tracking-[-0.5px] mt-1.5 tnum leading-tight">
        {valor}
      </div>
      {(hint || delta) && (
        <div className="mt-1">
          {delta}
          {hint && <div className="text-[12.5px] text-faint mt-0.5">{hint}</div>}
        </div>
      )}
    </div>
  );
}
