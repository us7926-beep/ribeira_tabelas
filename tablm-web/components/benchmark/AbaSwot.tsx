interface Quadrante {
  title: string;
  sub: string;
  icon: string;
  accent: string;
  tint: string;
  items: string[];
}

const QUADRANTES: Quadrante[] = [
  {
    title: "Forças",
    sub: "onde você ganha",
    icon: "F",
    accent: "#2347C5",
    tint: "#EAF0FE",
    items: [
      "Velocidade de vendas (VSO 62%) acima da média da praça.",
      "Marca consolidada em Jardim Aurora, líder de ticket médio.",
      "Prêmio de preço sustentado de 6,7% sobre concorrentes diretos.",
    ],
  },
  {
    title: "Fraquezas",
    sub: "onde você perde",
    icon: "W",
    accent: "#DC2626",
    tint: "#FDF2F2",
    items: [
      "Estoque alto no padrão Alto (38 un) frente à absorção atual.",
      "Sem produto na faixa Luxo, cedida à Cyrela Costa.",
      "Preço/m² 15% abaixo no Centro vs. Marina Tower.",
    ],
  },
  {
    title: "Oportunidades",
    sub: "espaços a ocupar",
    icon: "O",
    accent: "#15A34A",
    tint: "#E9FBF0",
    items: [
      "Demanda no padrão Alto em Vila Marina sem oferta direta.",
      "Faixa R$ 500–650 mil subofertada em toda a praça.",
      "Distratos da concorrência liberando clientes qualificados.",
    ],
  },
  {
    title: "Ameaças",
    sub: "riscos a monitorar",
    icon: "A",
    accent: "#E0A21A",
    tint: "#FBF3DD",
    items: [
      "Lançamento da Construtora Lima no Centro (mesmo padrão).",
      "MRV Norte pressiona o preço de entrada da região.",
      "INCC acumulado pode comprimir margem se não repassado.",
    ],
  },
];

export function AbaSwot() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 tablm-up">
      {QUADRANTES.map((q) => (
        <div
          key={q.title}
          className="bg-white border border-line rounded-[16px] p-[22px] shadow-[0_1px_3px_rgba(20,40,90,0.05)]"
          style={{ borderTop: `3px solid ${q.accent}` }}
        >
          <div className="flex items-center gap-2.5 mb-3.5">
            <div
              className="w-[30px] h-[30px] rounded-[9px] grid place-items-center text-[15px] font-extrabold"
              style={{ background: q.tint, color: q.accent }}
            >
              {q.icon}
            </div>
            <div>
              <div className="text-[15.5px] font-bold text-ink">{q.title}</div>
              <div className="text-[12px] text-faint">{q.sub}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {q.items.map((it, i) => (
              <div key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-body">
                <span
                  className="w-[5px] h-[5px] rounded-full mt-[7px] shrink-0"
                  style={{ background: q.accent }}
                />
                <span>{it}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
