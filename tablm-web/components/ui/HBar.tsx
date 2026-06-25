interface Props {
  /** Porcentagem 0-100 da barra preenchida. */
  pct: number;
  /** Cor da barra. Default = royal. */
  cor?: string;
  /** Cor de fundo da trilha. */
  trilha?: string;
  altura?: string;
}

/** Barra horizontal simples (preço/m², score, etc.). */
export function HBar({ pct, cor = "#2347C5", trilha = "#EEF1F8", altura = "h-2.5" }: Props) {
  const safe = Math.max(0, Math.min(100, pct));
  return (
    <div className={`${altura} w-full rounded-[6px] overflow-hidden`} style={{ background: trilha }}>
      <div
        className="h-full rounded-[6px]"
        style={{ width: `${safe}%`, background: cor }}
      />
    </div>
  );
}
