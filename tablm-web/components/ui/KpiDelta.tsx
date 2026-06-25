type Direcao = "alta" | "baixa" | "neutro";

interface Props {
  direcao: Direcao;
  children: React.ReactNode;
}

/** Indicador ▲/▼ — única cor além do royal/neutros. */
export function KpiDelta({ direcao, children }: Props) {
  const cor =
    direcao === "alta" ? "text-up" : direcao === "baixa" ? "text-down" : "text-muted";
  const seta = direcao === "alta" ? "▲" : direcao === "baixa" ? "▼" : "•";
  return (
    <span className={`text-[12.5px] font-bold ${cor} tnum`}>
      {seta} {children}
    </span>
  );
}
