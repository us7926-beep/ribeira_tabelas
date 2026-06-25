"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { estoque, precoM2, ticketMedio, unidades, vso } from "@/lib/benchmark";
import type { Empreendimento, Incorporadora } from "@/types";

interface Props {
  incorporadoras: Incorporadora[];
  empreendimentos: Empreendimento[];
  ribeiraId?: string;
}

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function brlMil(n: number) {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  return `R$ ${Math.round(n / 1000)} mil`;
}

interface Linha {
  label: string;
  you: string;
  them: string;
  youLead: boolean | null;
}

function linhas(meu: Empreendimento, conc: Empreendimento): Linha[] {
  const pMeu = precoM2(meu);
  const pCo = precoM2(conc);
  const tMeu = ticketMedio(meu);
  const tCo = ticketMedio(conc);
  const vMeu = vso(meu);
  const vCo = vso(conc);
  return [
    { label: "Preço/m²", you: brl(pMeu), them: brl(pCo), youLead: pMeu > pCo ? true : pMeu < pCo ? false : null },
    { label: "Ticket médio", you: brlMil(tMeu), them: brlMil(tCo), youLead: tMeu > tCo ? true : tMeu < tCo ? false : null },
    { label: "VSO", you: `${vMeu}%`, them: `${vCo}%`, youLead: vMeu > vCo ? true : vMeu < vCo ? false : null },
    { label: "Estoque", you: `${estoque(meu)} un`, them: `${estoque(conc)} un`, youLead: null },
    { label: "Padrão", you: meu.padrao ?? "Alto", them: conc.padrao ?? "Alto", youLead: null },
    { label: "Unidades", you: String(unidades(meu)), them: String(unidades(conc)), youLead: null },
  ];
}

function veredito(meu: Empreendimento, conc: Empreendimento) {
  const pMeu = precoM2(meu);
  const pCo = precoM2(conc);
  const vMeu = vso(meu);
  const vCo = vso(conc);
  if (pMeu < pCo && vMeu > vCo) {
    const diff = Math.round(((vMeu - vCo) / vCo) * 100);
    return `Você lidera ${diff}% em VSO contra ${conc.nome}; segure preço e ataque velocidade.`;
  }
  if (pMeu > pCo && vMeu < vCo) {
    const diff = Math.round(((pMeu - pCo) / pCo) * 100);
    return `Você perde em prêmio de preço para ${conc.nome} (${diff}% acima), mas vende ${vMeu}% mais rápido. Defenda o ticket e ataque a velocidade.`;
  }
  return `Posição equilibrada vs. ${conc.nome}. Acompanhe sinais de movimento.`;
}

export function AbaHeadToHead({ incorporadoras, empreendimentos, ribeiraId }: Props) {
  const meus = empreendimentos.filter((e) => e.incorporadora_id === ribeiraId);
  const concs = incorporadoras.filter((i) => i.id !== ribeiraId);
  const [meuIdx, setMeuIdx] = useState(0);
  const [concIdx, setConcIdx] = useState(0);
  const meu = meus[meuIdx];
  const conc = concs[concIdx];
  const empConc = conc ? empreendimentos.find((e) => e.incorporadora_id === conc.id) : undefined;

  if (!meu || !empConc || !conc) {
    return (
      <Card variant="lg" className="tablm-up">
        <div className="text-[15px] text-muted">
          Cadastre pelo menos um empreendimento seu e um do concorrente para comparar.
        </div>
      </Card>
    );
  }

  const cmp = linhas(meu, empConc);
  const ver = veredito(meu, empConc);

  return (
    <div className="flex flex-col gap-5 tablm-up">
      {meus.length > 1 && (
        <div>
          <div className="text-[12.5px] font-semibold text-muted mb-2">Seu empreendimento</div>
          <div className="flex flex-wrap gap-2">
            {meus.map((m, i) => (
              <button
                key={m.id}
                onClick={() => setMeuIdx(i)}
                className={
                  i === meuIdx
                    ? "px-4 py-2 rounded-[11px] bg-royal text-white text-[13px] font-bold"
                    : "px-4 py-2 rounded-[11px] bg-white border border-line text-body text-[13px] font-semibold hover:border-royal hover:text-royal transition-colors"
                }
              >
                {m.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-[12.5px] font-semibold text-muted mb-2">
          Escolha o concorrente para o confronto
        </div>
        <div className="flex flex-wrap gap-2">
          {concs.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setConcIdx(i)}
              className={
                i === concIdx
                  ? "px-4 py-2 rounded-[11px] bg-royal text-white text-[13px] font-bold"
                  : "px-4 py-2 rounded-[11px] bg-white border border-line text-body text-[13px] font-semibold hover:border-royal hover:text-royal transition-colors"
              }
            >
              {c.nome}
            </button>
          ))}
        </div>
      </div>

      <Card variant="lg">
        <div className="grid grid-cols-[1fr_80px_1fr] items-center gap-3.5 pb-[18px] border-b border-line-soft">
          <div className="text-right">
            <div className="text-[11px] font-bold text-royal tracking-[0.5px] uppercase">VOCÊ</div>
            <div className="text-[18px] font-extrabold text-ink mt-0.5">{meu.nome}</div>
            <div className="text-[12.5px] text-faint">
              Ribeira{meu.bairro ? ` · ${meu.bairro}` : ""}
            </div>
          </div>
          <div className="flex justify-center">
            <div className="w-11 h-11 rounded-full bg-royal-tint text-royal grid place-items-center text-[13px] font-extrabold">
              VS
            </div>
          </div>
          <div className="text-left">
            <div className="text-[11px] font-bold text-faint tracking-[0.5px] uppercase">CONCORRENTE</div>
            <div className="text-[18px] font-extrabold text-ink mt-0.5">{empConc.nome}</div>
            <div className="text-[12.5px] text-faint">
              {conc.nome}
              {empConc.bairro ? ` · ${empConc.bairro}` : ""}
            </div>
          </div>
        </div>

        {cmp.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-[1fr_130px_1fr] items-center border-b border-[#F2F4F9] py-[13px]"
          >
            <div
              className="text-right text-[15px] tnum"
              style={{
                fontWeight: r.youLead ? 800 : 600,
                color: r.youLead ? "#2347C5" : r.youLead === false ? "#97A2B5" : "#2C3850",
              }}
            >
              {r.you}
            </div>
            <div className="text-center text-[11.5px] font-semibold text-faint uppercase tracking-[0.3px]">
              {r.label}
            </div>
            <div
              className="text-left text-[15px] tnum"
              style={{
                fontWeight: r.youLead === false ? 800 : 600,
                color: r.youLead === false ? "#2347C5" : r.youLead ? "#97A2B5" : "#2C3850",
              }}
            >
              {r.them}
            </div>
          </div>
        ))}

        <div className="flex items-start gap-2.5 mt-[18px] bg-[#F7F9FE] border border-line rounded-[12px] p-[14px_16px]">
          <span className="w-2 h-2 rounded-full bg-royal shrink-0 mt-2" />
          <span className="text-[13.5px] text-body leading-relaxed">{ver}</span>
        </div>
      </Card>
    </div>
  );
}
