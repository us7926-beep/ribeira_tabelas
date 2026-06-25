type Tom = "royal" | "up" | "down" | "warn" | "neutro";

interface Props {
  tom?: Tom;
  className?: string;
  children: React.ReactNode;
}

/** Pílula pequena para status / categoria. */
export function Chip({ tom = "neutro", className = "", children }: Props) {
  const map: Record<Tom, string> = {
    royal: "text-royal bg-royal-tint border border-transparent",
    up: "text-up-strong bg-up-bg border border-up-line",
    down: "text-down-strong bg-down-bg border border-down-line",
    warn: "text-warn-strong bg-warn-bg border border-warn-line",
    neutro: "text-muted bg-thead border border-line",
  };
  return (
    <span
      className={`inline-flex items-center text-[12px] font-bold px-[9px] py-[3px] rounded-[20px] ${map[tom]} ${className}`}
    >
      {children}
    </span>
  );
}
