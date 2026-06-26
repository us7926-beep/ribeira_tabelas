"use client";

import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import type { Empreendimento, EventoPromocional, Incorporadora } from "@/types";

interface Props {
  eventos: EventoPromocional[];
  empreendimentos: Empreendimento[];
  incorporadoras: Incorporadora[];
}

function diasAteVencer(dataFim: string | null | undefined): number | null {
  if (!dataFim) return null;
  const m = dataFim.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const fim = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);
  return Math.round((fim.getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000));
}

function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Card "Promoções ativas" — eventos com data_fim >= hoje, mais próximas de
 *  vencer no topo, badge colorido por urgência. */
export function PromocoesAtivas({ eventos, empreendimentos, incorporadoras }: Props) {
  const mapEmp = new Map(empreendimentos.map((e) => [e.id, e]));
  const mapInc = new Map(incorporadoras.map((i) => [i.id, i]));

  const ativos = eventos
    .filter((ev) => {
      const dias = diasAteVencer(ev.data_fim);
      // sem data_fim → consideramos não-ativo; queremos com prazo definido
      return dias !== null && dias >= 0;
    })
    .sort((a, b) => {
      const da = diasAteVencer(a.data_fim) ?? Number.POSITIVE_INFINITY;
      const db = diasAteVencer(b.data_fim) ?? Number.POSITIVE_INFINITY;
      return da - db;
    })
    .slice(0, 5);

  return (
    <Card variant="lg" className="tablm-up">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div>
          <div className="text-[16px] font-bold text-ink">Promoções ativas</div>
          <div className="text-[12.5px] text-muted mt-0.5">
            Eventos com data_fim no futuro — ordem por proximidade do término.
          </div>
        </div>
        <Link
          href="/benchmark?aba=movimentos"
          className="text-[12.5px] font-semibold text-royal hover:underline"
        >
          Todos os movimentos →
        </Link>
      </div>

      {ativos.length === 0 ? (
        <div className="text-[13.5px] text-muted">
          Nenhuma promoção com prazo ativo. Suba flyers em{" "}
          <Link href="/flyers" className="text-royal font-semibold hover:underline">
            Análise por IA
          </Link>{" "}
          ou registre eventos pelo Benchmark.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {ativos.map((ev) => {
            const emp = mapEmp.get(ev.empreendimento_id);
            const inc = emp ? mapInc.get(emp.incorporadora_id) : undefined;
            const dias = diasAteVencer(ev.data_fim) ?? 0;
            const tom: "up" | "warn" | "down" =
              dias > 14 ? "up" : dias > 3 ? "warn" : "down";
            const rotuloPrazo =
              dias === 0
                ? "Expira hoje"
                : dias === 1
                  ? "Expira amanhã"
                  : `Expira em ${dias} dias`;
            return (
              <div
                key={ev.id}
                className="border border-line-soft rounded-[12px] p-3 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-bold text-ink">
                      {emp?.nome ?? "Empreendimento"}
                    </span>
                    {inc && (
                      <span className="text-[12px] text-muted">· {inc.nome}</span>
                    )}
                    <Chip tom={tom}>{rotuloPrazo}</Chip>
                  </div>
                  <div className="text-[12.5px] text-muted mt-1 line-clamp-2">
                    {ev.descricao || ev.condicoes_comerciais || "Promoção sem descrição"}
                  </div>
                  <div className="text-[11.5px] text-faint mt-1 tnum">
                    {dataBR(ev.data_inicio)} → {dataBR(ev.data_fim)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
