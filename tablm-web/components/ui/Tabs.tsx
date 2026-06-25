"use client";

interface Aba<T extends string> {
  id: T;
  label: string;
}

interface Props<T extends string> {
  abas: Aba<T>[];
  ativa: T;
  onTrocar: (id: T) => void;
  className?: string;
}

/** Segmented control royal — sub-abas / chips. */
export function Tabs<T extends string>({ abas, ativa, onTrocar, className = "" }: Props<T>) {
  return (
    <div
      className={`inline-flex gap-1.5 bg-white border border-line rounded-[13px] p-[5px] ${className}`}
    >
      {abas.map((aba) => {
        const eAtiva = aba.id === ativa;
        return (
          <button
            key={aba.id}
            onClick={() => onTrocar(aba.id)}
            className={
              eAtiva
                ? "px-[18px] py-[9px] rounded-[9px] bg-royal text-white text-[14px] font-semibold"
                : "px-[18px] py-[9px] rounded-[9px] text-muted text-[14px] font-semibold hover:bg-[#F1F4FB] hover:text-royal transition-colors"
            }
          >
            {aba.label}
          </button>
        );
      })}
    </div>
  );
}
