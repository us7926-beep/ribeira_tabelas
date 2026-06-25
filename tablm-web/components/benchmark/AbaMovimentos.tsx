import { Card } from "@/components/ui/Card";
import { paraMovimentos } from "@/lib/benchmark";
import type { Empreendimento, EventoPromocional, Incorporadora } from "@/types";

interface Props {
  eventos: EventoPromocional[];
  empreendimentos: Empreendimento[];
  incorporadoras: Incorporadora[];
}

function formatarDataPt(iso: string) {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const mes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(m[2]) - 1];
  return `${m[3]} ${mes}`;
}

export function AbaMovimentos({ eventos, empreendimentos, incorporadoras }: Props) {
  const moves = paraMovimentos(eventos, empreendimentos, incorporadoras);

  return (
    <Card variant="lg" className="tablm-up">
      <div className="text-[16px] font-bold text-ink mb-0.5">
        Movimentos da concorrência
      </div>
      <div className="text-[12.5px] text-muted mb-5">
        Reajustes, lançamentos e promoções detectados nas últimas semanas.
      </div>

      {moves.length === 0 && (
        <div className="text-[13.5px] text-muted">
          Nenhum movimento registrado. Use Análise por IA para detectar flyers e registrar eventos.
        </div>
      )}

      <div className="relative pl-[26px]">
        <div className="absolute left-[5px] top-1 bottom-1 w-0.5 bg-line-soft" />
        <div className="flex flex-col gap-5">
          {moves.map((m) => (
            <div key={m.id} className="relative">
              <div
                className="absolute -left-[26px] top-[3px] w-3 h-3 rounded-full bg-white border-[3px]"
                style={{ borderColor: m.iCor.dot }}
              />
              <div className="flex items-center gap-2.5 flex-wrap mb-1">
                <span className="text-[12px] font-bold text-faint tnum">
                  {formatarDataPt(m.data)}
                </span>
                <span className="text-[14px] font-bold text-ink">{m.who}</span>
                <span
                  className="text-[11px] font-bold px-[9px] py-0.5 rounded-[20px]"
                  style={{ color: m.tCor.text, background: m.tCor.bg }}
                >
                  {m.tipo}
                </span>
                <span
                  className="text-[11px] font-bold px-[9px] py-0.5 rounded-[20px] border"
                  style={{ color: m.iCor.color, borderColor: m.iCor.line }}
                >
                  {m.impacto}
                </span>
              </div>
              <div className="text-[13.5px] text-muted leading-relaxed">{m.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
