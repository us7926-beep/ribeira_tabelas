interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  acao?: React.ReactNode;
}

/** Cabeçalho de tela: eyebrow uppercase royal + título 30px + subtítulo + ação opcional. */
export function PageHeader({ eyebrow, title, subtitle, acao }: Props) {
  return (
    <div className="mb-6 tablm-up flex items-start justify-between gap-6">
      <div>
        {eyebrow && (
          <div className="text-[12px] font-bold tracking-[1.6px] uppercase text-royal">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[30px] font-extrabold tracking-[-0.7px] text-ink mt-[7px] mb-[6px]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[15.5px] text-muted max-w-[640px] leading-relaxed">{subtitle}</p>
        )}
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  );
}
