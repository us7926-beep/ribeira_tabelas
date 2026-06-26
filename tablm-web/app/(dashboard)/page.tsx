import Link from "next/link";

import { ImportarEmpreendimentoBook } from "@/components/incorporadoras/ImportarEmpreendimentoBook";
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

function moedaCurta(n: number | null | undefined): string {
  if (!n) return "—";
  if (n >= 1_000_000_000) return `R$ ${(n / 1_000_000_000).toFixed(1)} bi`;
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)} mi`;
  if (n >= 1000) return `R$ ${Math.round(n / 1000)} mil`;
  return `R$ ${Math.round(n)}`;
}

function moeda(n: number | null | undefined): string {
  if (!n) return "—";
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}

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

  // Top empreendimentos por VGV total (entre os que tem KPIs sincronizados).
  const topVgv = empreendimentos
    .filter((e) => (e.vgv_total ?? 0) > 0)
    .sort((a, b) => (b.vgv_total ?? 0) - (a.vgv_total ?? 0))
    .slice(0, 5);

  return (
    <>
      <PageHeader
        eyebrow="Visão geral"
        title="Dashboards de Vendas"
        subtitle="Estado da sua carteira em um relance. Use o Benchmark Competitivo para aprofundar a leitura de mercado."
        acao={
          <div className="flex gap-2 flex-wrap">
            <ImportarEmpreendimentoBook incorporadoras={incorporadoras} />
            <Link href="/benchmark">
              <Button variante="primary">Abrir Benchmark</Button>
            </Link>
          </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
        {/* Movimentos recentes */}
        <Card variant="lg" className="tablm-up">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div>
              <div className="text-[16px] font-bold text-ink">Movimentos recentes</div>
              <div className="text-[12.5px] text-muted mt-0.5">
                Reajustes, lançamentos e promoções detectados pela IA.
              </div>
            </div>
            <Link
              href="/benchmark?aba=movimentos"
              className="text-[12.5px] font-semibold text-royal hover:underline"
            >
              Ver todos →
            </Link>
          </div>
          {recentes.length === 0 ? (
            <div className="text-[13.5px] text-muted">
              Nenhum movimento ainda. Suba um flyer em{" "}
              <Link className="text-royal font-semibold" href="/flyers">
                Análise por IA
              </Link>
              .
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
                          m.tipo === "Reajuste"
                            ? "down"
                            : m.tipo === "Lançamento"
                              ? "royal"
                              : "warn"
                        }
                      >
                        {m.tipo}
                      </Chip>
                    </div>
                    <div className="text-[13px] text-muted leading-relaxed mt-0.5">
                      {m.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* CTA royal */}
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

      {/* Top empreendimentos por VGV */}
      {topVgv.length > 0 && (
        <Card variant="lg" className="mt-4 tablm-up">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div>
              <div className="text-[16px] font-bold text-ink">
                Maiores empreendimentos por VGV
              </div>
              <div className="text-[12.5px] text-muted mt-0.5">
                Ranking dos com KPIs sincronizados.
              </div>
            </div>
            <Link
              href="/incorporadoras"
              className="text-[12.5px] font-semibold text-royal hover:underline"
            >
              Carteira completa →
            </Link>
          </div>
          <div className="overflow-x-auto border border-line-soft rounded-[12px]">
            <table className="w-full text-[14px]">
              <thead className="bg-thead text-muted">
                <tr>
                  <th className="text-left font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5">
                    Empreendimento
                  </th>
                  <th className="text-left font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5">
                    Bairro
                  </th>
                  <th className="text-left font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5">
                    Padrão
                  </th>
                  <th className="text-right font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5">
                    Preço/m²
                  </th>
                  <th className="text-right font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5">
                    Ticket
                  </th>
                  <th className="text-right font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5">
                    VGV
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {topVgv.map((e) => (
                  <tr key={e.id} className="border-t border-line-soft">
                    <td className="px-3 py-[12px] font-semibold text-ink">{e.nome}</td>
                    <td className="px-3 py-[12px] text-body">{e.bairro ?? "—"}</td>
                    <td className="px-3 py-[12px]">
                      {e.padrao ? <Chip tom="royal">{e.padrao}</Chip> : "—"}
                    </td>
                    <td className="px-3 py-[12px] text-right tnum text-body">
                      {moeda(e.preco_m2_medio ?? null)}
                    </td>
                    <td className="px-3 py-[12px] text-right tnum text-body">
                      {moedaCurta(e.ticket_medio ?? null)}
                    </td>
                    <td className="px-3 py-[12px] text-right tnum font-bold text-ink">
                      {moedaCurta(e.vgv_total ?? null)}
                    </td>
                    <td className="px-3 py-[12px] text-right">
                      <Link
                        href={`/empreendimentos/${e.id}`}
                        className="text-[13px] font-bold text-royal hover:underline"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {erro && (
        <p className="mt-5 text-[13px] text-muted">
          (Inicie o backend e configure o Supabase para ver os números reais.)
        </p>
      )}
    </>
  );
}
