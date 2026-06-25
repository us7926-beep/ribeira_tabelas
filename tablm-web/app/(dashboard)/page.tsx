import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { RoyalCard } from "@/components/ui/RoyalCard";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { paraMovimentos } from "@/lib/benchmark";
import type { Empreendimento, EventoPromocional, Incorporadora } from "@/types";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const token = await getToken();
  let incorporadoras: Incorporadora[] = [];
  let empreendimentos: Empreendimento[] = [];
  let eventos: EventoPromocional[] = [];
  let erro = false;
  try {
    [incorporadoras, empreendimentos, eventos] = await Promise.all([
      api<Incorporadora[]>("/incorporadoras", { token }),
      api<Empreendimento[]>("/empreendimentos", { token }),
      api<EventoPromocional[]>("/benchmark/eventos", { token }),
    ]);
  } catch {
    erro = true;
  }

  const recentes = paraMovimentos(eventos, empreendimentos, incorporadoras).slice(0, 3);

  return (
    <>
      <PageHeader
        eyebrow="Visão geral"
        title="Dashboards de Vendas"
        subtitle="Estado da sua carteira em um relance. Use o Benchmark Competitivo para aprofundar a leitura de mercado."
        acao={
          <Link href="/benchmark">
            <Button variante="primary">Abrir Benchmark</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5 tablm-up">
        <KpiCard
          rotulo="Incorporadoras"
          valor={erro ? "—" : String(incorporadoras.length)}
          hint="na base ativa"
        />
        <KpiCard
          rotulo="Empreendimentos"
          valor={erro ? "—" : String(empreendimentos.length)}
          hint="cadastrados"
        />
        <KpiCard
          rotulo="Eventos detectados"
          valor={erro ? "—" : String(eventos.length)}
          hint="últimas semanas"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
        <Card variant="lg" className="tablm-up">
          <div className="text-[16px] font-bold text-ink mb-0.5">Movimentos recentes</div>
          <div className="text-[12.5px] text-muted mb-4">
            Reajustes, lançamentos e promoções detectados pela IA.
          </div>
          {recentes.length === 0 ? (
            <div className="text-[13.5px] text-muted">
              Nenhum movimento ainda. Suba um flyer em <Link className="text-royal font-semibold" href="/flyers">Análise por IA</Link>.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {recentes.map((m) => (
                <div key={m.id} className="flex items-start gap-3 py-1.5">
                  <div
                    className="w-3 h-3 rounded-full bg-white border-[3px] mt-1.5 shrink-0"
                    style={{ borderColor: m.iCor.dot }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-bold text-ink">{m.who}</span>
                      <Chip
                        tom={
                          m.tipo === "Reajuste" ? "down"
                          : m.tipo === "Lançamento" ? "royal"
                          : "warn"
                        }
                      >
                        {m.tipo}
                      </Chip>
                    </div>
                    <div className="text-[13px] text-muted leading-relaxed mt-0.5">{m.desc}</div>
                  </div>
                </div>
              ))}
              <Link
                href="/benchmark?aba=movimentos"
                className="text-[13px] font-semibold text-royal hover:underline mt-1 self-start"
              >
                Ver todos os movimentos →
              </Link>
            </div>
          )}
        </Card>

        <RoyalCard className="tablm-up">
          <div className="text-[11px] font-bold tracking-[1.6px] uppercase text-white/75 mb-2">
            Próximo passo
          </div>
          <div className="text-[20px] font-extrabold leading-tight mb-3">
            Acelere a leitura competitiva.
          </div>
          <div className="text-[13.5px] text-white/85 leading-relaxed mb-5">
            Veja seu mapa de posicionamento, ranking de ameaça e onde estão as
            janelas de oportunidade.
          </div>
          <Link href="/benchmark">
            <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[11px] bg-white text-royal font-bold text-[13.5px] hover:bg-white/90 transition-colors">
              Abrir Benchmark →
            </span>
          </Link>
        </RoyalCard>
      </div>

      {erro && (
        <p className="mt-5 text-[13px] text-muted">
          (Inicie o backend e configure o Supabase para ver os números reais.)
        </p>
      )}
    </>
  );
}
