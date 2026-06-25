"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DonutConic } from "@/components/ui/DonutConic";
import { Dropzone } from "@/components/ui/Dropzone";
import { KpiCard } from "@/components/ui/KpiCard";

interface KPIs {
  total_unidades: number;
  disponiveis: number;
  vendidas: number;
  reservadas: number;
  pct_vendidas: number;
  pct_disponiveis: number;
  vgv_total: number;
  vgv_vendido: number;
  ticket_medio: number;
  vso: number;
}

interface Resultado {
  colunas: { unidade: string; valor: string; status: string };
  kpis: KPIs;
}

function moeda(valor: number): string {
  return "R$ " + Math.round(valor).toLocaleString("pt-BR");
}

function moedaCurta(valor: number): string {
  if (valor >= 1_000_000_000) return `R$ ${(valor / 1_000_000_000).toFixed(1)} bi`;
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toFixed(1)} mi`;
  return moeda(valor);
}

export default function VendasKpis() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [res, setRes] = useState<Resultado | null>(null);

  async function calcular() {
    if (!arquivo) return;
    setErro("");
    setRes(null);
    setCarregando(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const r = await fetch("/api/vendas/kpis", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Falha ao calcular");
      setRes(d as Resultado);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  const k = res?.kpis;
  const total = k?.total_unidades || 0;
  const pctVend = total ? (k!.vendidas / total) * 100 : 0;
  const pctDisp = total ? (k!.disponiveis / total) * 100 : 0;
  const pctRes = total ? (k!.reservadas / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-5">
      <Card variant="lg">
        <div className="text-[16px] font-bold text-ink mb-0.5">Subir tabela de unidades</div>
        <div className="text-[12.5px] text-muted mb-4">
          CSV ou Excel com situação (Disponível / Vendido / Reservado). Detectamos as colunas
          automaticamente.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_auto] gap-4 items-end">
          <Dropzone
            arquivo={arquivo}
            onArquivo={setArquivo}
            aceitar=".csv,.xlsx,.xls"
            titulo="Arraste a planilha de vendas aqui"
            dica="CSV ou Excel · até 50 MB"
          />
          <Button onClick={calcular} disabled={!arquivo || carregando}>
            {carregando ? "Calculando..." : "Calcular KPIs"}
          </Button>
        </div>
      </Card>

      {erro && (
        <div className="rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line">
          {erro}
        </div>
      )}

      {k && (
        <>
          <div className="text-[12.5px] text-muted">
            {k.total_unidades} unidades · situação: <b className="text-ink">{res!.colunas.status}</b>,
            valor: <b className="text-ink">{res!.colunas.valor}</b>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <KpiCard
              rotulo="Vendidas"
              valor={String(k.vendidas)}
              hint={`${k.pct_vendidas}% · VSO ${k.vso}%`}
            />
            <KpiCard
              rotulo="Disponíveis"
              valor={String(k.disponiveis)}
              hint={`${k.pct_disponiveis}%`}
            />
            <KpiCard rotulo="Reservadas" valor={String(k.reservadas)} />
            <KpiCard rotulo="Total" valor={String(k.total_unidades)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-4">
            <Card variant="lg" className="flex flex-col items-center">
              <div className="text-[14px] font-bold text-ink mb-3 self-start">
                Situação das unidades
              </div>
              <DonutConic
                fatias={[
                  { pct: pctVend, cor: "#15A34A" },
                  { pct: pctRes, cor: "#E0B23A" },
                  { pct: pctDisp, cor: "#2347C5" },
                ]}
                miolo={
                  <div>
                    <div className="text-[24px] font-extrabold text-ink tnum leading-none">
                      {k.total_unidades}
                    </div>
                    <div className="text-[10.5px] text-muted mt-1 tracking-[0.3px] uppercase font-bold">
                      unidades
                    </div>
                  </div>
                }
              />
              <div className="flex items-center gap-4 mt-5 text-[12px] font-semibold text-body">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-up" />
                  Vendidas {k.pct_vendidas}%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-warn" />
                  Reservadas {Math.round(pctRes)}%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-royal" />
                  Disponíveis {k.pct_disponiveis}%
                </span>
              </div>
            </Card>

            <Card variant="lg">
              <div className="text-[14px] font-bold text-ink mb-4">VGV e ticket</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <KpiCard rotulo="VGV total" valor={moedaCurta(k.vgv_total)} />
                <KpiCard rotulo="VGV vendido" valor={moedaCurta(k.vgv_vendido)} />
                <KpiCard rotulo="Ticket médio" valor={moedaCurta(k.ticket_medio)} />
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
