import { analisarSwot } from "@/lib/swot";
import type { Empreendimento, EventoPromocional, Incorporadora } from "@/types";

interface Props {
  meus: Empreendimento[];
  concorrentes: Empreendimento[];
  eventos: EventoPromocional[];
  incorporadoras: Incorporadora[];
}

export function AbaSwot({ meus, concorrentes, eventos, incorporadoras }: Props) {
  const quadrantes = analisarSwot(meus, concorrentes, eventos, incorporadoras);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 tablm-up">
      {quadrantes.map((q) => (
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
