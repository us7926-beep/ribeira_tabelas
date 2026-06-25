"use client";

import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { KpiDelta } from "@/components/ui/KpiDelta";
import {
  pontosScatter,
  precoM2,
  rankingAmeaca,
} from "@/lib/benchmark";
import type { Empreendimento, Incorporadora } from "@/types";

interface Props {
  incorporadoras: Incorporadora[];
  empreendimentos: Empreendimento[];
  ribeiraId?: string;
}

function formatarBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function AbaPanorama({ incorporadoras, empreendimentos, ribeiraId }: Props) {
  const meus = empreendimentos.filter((e) => e.incorporadora_id === ribeiraId);
  const concorrentes = empreendimentos.filter((e) => e.incorporadora_id !== ribeiraId);

  const todosPrecos = empreendimentos.map(precoM2).sort((a, b) => b - a);
  const meuPrecoMedio = meus.length
    ? Math.round(meus.reduce((a, e) => a + precoM2(e), 0) / meus.length)
    : 0;
  const posicao = meuPrecoMedio
    ? todosPrecos.findIndex((p) => p <= meuPrecoMedio) + 1
    : 0;
  const total = empreendimentos.length || 1;

  const share = total ? Math.round((meus.length / total) * 100) : 0;
  const concsPressionando = concorrentes.filter((e) => precoM2(e) >= meuPrecoMedio).length;
  const pressao = concsPressionando >= 3 ? "Alta" : concsPressionando >= 1 ? "Média" : "Baixa";
  const corPressao = pressao === "Alta" ? "text-down" : pressao === "Média" ? "text-warn-strong" : "text-up";

  const dots = pontosScatter(empreendimentos, ribeiraId);
  const ameacas = rankingAmeaca(incorporadoras, empreendimentos, ribeiraId);

  return (
    <div className="flex flex-col gap-5 tablm-up">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
        <KpiCard
          rotulo="Sua posição"
          valor={posicao ? <>{posicao}º <span className="text-[16px] text-muted font-bold">de {total}</span></> : "—"}
          hint="por preço/m²"
        />
        <KpiCard
          rotulo="Seu preço/m²"
          valor={meuPrecoMedio ? formatarBRL(meuPrecoMedio) : "—"}
          delta={<KpiDelta direcao="alta">6,7% acima da média</KpiDelta>}
        />
        <KpiCard
          rotulo="Share na praça"
          valor={`${share}%`}
          delta={<KpiDelta direcao="alta">+2 p.p. no trimestre</KpiDelta>}
        />
        <KpiCard
          rotulo="Pressão de preço"
          valor={<span className={corPressao}>{pressao}</span>}
          hint={`${concsPressionando} concorrentes ativos`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-4">
        {/* Mapa de posicionamento */}
        <Card variant="lg">
          <div className="text-[16px] font-bold text-ink mb-0.5">Mapa de posicionamento</div>
          <div className="text-[12.5px] text-muted mb-4">
            Preço/m² (vertical) × velocidade de vendas — VSO (horizontal)
          </div>
          <div className="flex gap-3">
            {/* régua Y */}
            <div className="flex flex-col justify-between items-end pb-[22px] text-[10.5px] font-semibold text-[#B7C0D0] tnum">
              <span>R$ 13k</span>
              <span>R$ 11k</span>
              <span>R$ 9k</span>
              <span>R$ 7k</span>
            </div>
            <div className="flex-1">
              <div
                className="relative h-[290px] border-l-[1.5px] border-b-[1.5px] border-line"
                style={{
                  background:
                    "linear-gradient(#F2F5FB 1px,transparent 1px) 0 0/100% 25%,linear-gradient(90deg,#F2F5FB 1px,transparent 1px) 0 0/25% 100%",
                }}
              >
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-line" />
                <div className="absolute top-1/2 left-0 right-0 h-px bg-line" />
                <div className="absolute top-2 left-2.5 text-[10.5px] font-bold tracking-[0.3px] text-[#C2CCDC]">
                  PRÊMIO PARADO
                </div>
                <div className="absolute top-2 right-2.5 text-[10.5px] font-bold tracking-[0.3px] text-[#93A6E0]">
                  LÍDER DE PRÊMIO
                </div>
                <div className="absolute bottom-2 left-2.5 text-[10.5px] font-bold tracking-[0.3px] text-[#E0A9A9]">
                  ZONA DE RISCO
                </div>
                <div className="absolute bottom-2 right-2.5 text-[10.5px] font-bold tracking-[0.3px] text-[#9FD0B2]">
                  VOLUME AGRESSIVO
                </div>

                {dots.map((d) => (
                  <div
                    key={d.label}
                    className="absolute -translate-x-1/2 translate-y-1/2 flex flex-col items-center"
                    style={{ left: `${d.x}%`, bottom: `${d.y}%` }}
                  >
                    {d.ours ? (
                      <>
                        <div
                          className="w-5 h-5 rounded-full bg-royal border-[3px] border-white"
                          style={{
                            boxShadow:
                              "0 0 0 3px rgba(35,71,197,0.3), 0 4px 10px rgba(35,71,197,0.4)",
                          }}
                        />
                        <div className="text-[11px] font-extrabold text-royal mt-1 bg-royal-tint px-[7px] rounded-[10px] whitespace-nowrap">
                          VOCÊ
                        </div>
                      </>
                    ) : (
                      <>
                        <div
                          className="w-[13px] h-[13px] rounded-full bg-[#B9C8EE] border-2 border-white"
                          style={{ boxShadow: "0 1px 3px rgba(20,40,90,0.2)" }}
                        />
                        <div className="text-[10px] font-semibold text-muted mt-[3px] whitespace-nowrap">
                          {d.label}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10.5px] font-semibold text-[#B7C0D0] mt-1.5">
                <span>VSO baixa</span>
                <span>velocidade de vendas →</span>
                <span>VSO alta</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Ranking de ameaça */}
        <Card variant="lg">
          <div className="text-[16px] font-bold text-ink mb-0.5">Ranking de ameaça</div>
          <div className="text-[12.5px] text-muted mb-4">Quem mais pressiona seu preço</div>
          <div className="flex flex-col gap-4">
            {ameacas.length === 0 && (
              <div className="text-[13px] text-faint">
                Cadastre incorporadoras concorrentes para ver o ranking.
              </div>
            )}
            {ameacas.map((t) => (
              <div key={t.nome}>
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="text-[13.5px] font-bold text-body">{t.nome}</span>
                  <span className="text-[13px] font-extrabold tnum" style={{ color: t.corScore }}>
                    {t.score}
                  </span>
                </div>
                <div className="h-2 bg-[#EEF1F8] rounded-[6px] overflow-hidden mb-1">
                  <div
                    className="h-full rounded-[6px]"
                    style={{ width: `${t.score}%`, background: t.corBarra }}
                  />
                </div>
                <div className="text-[12px] text-faint">{t.motivo}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
