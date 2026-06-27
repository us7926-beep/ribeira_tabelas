interface Props {
  soma: number;
}

const TOLERANCIA = 0.01;

/** Mostra a soma dos percentuais do fluxo. Verde quando ≈ 100,
 * vermelho caso contrário. */
export function IndicadorSomaPercentual({ soma }: Props) {
  const ok = Math.abs(soma - 100) <= TOLERANCIA;
  const cor = ok ? "bg-up-bg border-up-line text-up-strong" : "bg-down-bg border-down-line text-down-strong";
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-[10px] border px-3 py-1.5 text-[12.5px] font-bold ${cor}`}
      role="status"
      aria-live="polite"
    >
      <span>Total: {soma.toFixed(2)}%</span>
      <span aria-hidden>{ok ? "✓" : "≠ 100"}</span>
    </div>
  );
}
