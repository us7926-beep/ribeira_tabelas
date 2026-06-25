interface Fatia {
  pct: number;
  cor: string;
}

interface Props {
  fatias: Fatia[];
  /** Conteúdo do miolo (KPI grande, ex.: "120 unidades"). */
  miolo: React.ReactNode;
  tamanho?: number;
}

/** Rosca em conic-gradient (sem lib). Pcts devem somar 100. */
export function DonutConic({ fatias, miolo, tamanho = 150 }: Props) {
  let acumulado = 0;
  const stops = fatias
    .map((f) => {
      const ini = acumulado;
      acumulado += f.pct;
      return `${f.cor} ${ini}% ${acumulado}%`;
    })
    .join(",");

  return (
    <div
      className="rounded-full grid place-items-center"
      style={{
        width: tamanho,
        height: tamanho,
        background: `conic-gradient(${stops})`,
      }}
    >
      <div
        className="rounded-full bg-white grid place-items-center text-center"
        style={{ width: tamanho * 0.66, height: tamanho * 0.66 }}
      >
        {miolo}
      </div>
    </div>
  );
}
