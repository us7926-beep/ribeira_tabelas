"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { DonutConic } from "@/components/ui/DonutConic";
import { Dropzone } from "@/components/ui/Dropzone";
import { KpiCard } from "@/components/ui/KpiCard";
import type { Empreendimento } from "@/types";

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

interface DistribuicaoLinha {
  modalidade: string;
  unidades_vendidas: number;
  vgv: number | null;
}

interface Resultado {
  colunas: {
    unidade: string;
    valor: string;
    status: string;
    modalidade?: string | null;
    modalidade_origem?: "explicita" | "inferida" | null;
  };
  kpis: KPIs;
  distribuicao?: DistribuicaoLinha[];
}

function moeda(valor: number): string {
  return "R$ " + Math.round(valor).toLocaleString("pt-BR");
}

function moedaCurta(valor: number): string {
  if (valor >= 1_000_000_000) return `R$ ${(valor / 1_000_000_000).toFixed(1)} bi`;
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toFixed(1)} mi`;
  return moeda(valor);
}

function mesCorrenteYYYYMM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface Props {
  empreendimentos?: Empreendimento[];
}

export default function VendasKpis({ empreendimentos = [] }: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [res, setRes] = useState<Resultado | null>(null);

  // Vinculação ao empreendimento
  const [empId, setEmpId] = useState("");
  const [mes, setMes] = useState(mesCorrenteYYYYMM());
  const [salvandoVinculo, setSalvandoVinculo] = useState(false);
  const [vinculado, setVinculado] = useState("");

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

  async function salvarVinculo() {
    if (!empId || !res) return;
    setErro("");
    setVinculado("");
    setSalvandoVinculo(true);
    try {
      // 1) Upsert da venda mensal (mês + total vendido + VGV)
      const r1 = await fetch(`/api/empreendimentos/${empId}/vendas-mensais`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mes,
          unidades_vendidas: res.kpis.vendidas,
          vgv_mes: res.kpis.vgv_vendido,
          fonte: "planilha",
        }),
      });
      const d1 = await r1.json();
      if (!r1.ok) throw new Error(d1.detail ?? "Falha ao salvar venda mensal");

      // 2) Se a IA detectou distribuição, salva a quebra
      if (res.distribuicao && res.distribuicao.length > 0) {
        const r2 = await fetch(
          `/api/empreendimentos/${empId}/vendas-mensais/distribuicao`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mes,
              linhas: res.distribuicao.map((l) => ({
                modalidade: l.modalidade,
                unidades_vendidas: l.unidades_vendidas,
                vgv: l.vgv,
              })),
            }),
          },
        );
        const d2 = await r2.json();
        if (!r2.ok) throw new Error(d2.detail ?? "Falha ao salvar distribuição");
      }

      const nome = empreendimentos.find((e) => e.id === empId)?.nome ?? "empreendimento";
      const sufixo =
        res.distribuicao && res.distribuicao.length > 0
          ? ` com distribuição em ${res.distribuicao.length} modalidades`
          : "";
      setVinculado(
        `Salvo em "${nome}" para o mês ${mes}${sufixo}. O Fluxo Comercial deste mês já está em modo Real.`,
      );
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvandoVinculo(false);
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

          {/* Vincular ao empreendimento — salva venda mensal e distribuição */}
          <Card variant="lg">
            <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
              <div>
                <div className="text-[16px] font-bold text-ink">
                  Vincular ao empreendimento
                </div>
                <div className="text-[12.5px] text-muted mt-0.5">
                  Salva o mês inteiro (total vendido + VGV)
                  {res.distribuicao && res.distribuicao.length > 0
                    ? " + distribuição por modalidade detectada"
                    : ""}{" "}
                  no Histórico de Vendas do empreendimento. Use{" "}
                  <b>Operação → Vendas</b> sempre que receber uma nova tabela.
                </div>
              </div>
              <Chip tom="royal">Opcional</Chip>
            </div>
            {empreendimentos.length === 0 ? (
              <div className="text-[13.5px] text-muted">
                Cadastre um empreendimento em <b>Carteira</b> antes de vincular.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-[1.6fr_160px_auto] gap-2.5 items-end">
                <select
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  className="w-full px-[15px] py-[13px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition"
                >
                  <option value="">Selecione o empreendimento…</option>
                  {empreendimentos.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nome}
                    </option>
                  ))}
                </select>
                <input
                  type="month"
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  className="w-full px-[15px] py-[13px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition"
                />
                <Button onClick={salvarVinculo} disabled={!empId || salvandoVinculo}>
                  {salvandoVinculo ? "Salvando…" : "Salvar no mês"}
                </Button>
              </div>
            )}
            {vinculado && (
              <div className="mt-3 rounded-[12px] bg-up-bg text-up-strong text-[13.5px] px-4 py-3 border border-up-line">
                {vinculado}{" "}
                {empId && (
                  <Link
                    className="font-bold underline"
                    href={`/empreendimentos/${empId}?aba=vendas`}
                  >
                    Abrir Histórico de Vendas →
                  </Link>
                )}
              </div>
            )}
          </Card>

          {res.distribuicao && res.distribuicao.length > 0 && (
            <Card variant="lg">
              <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-[16px] font-bold text-ink">
                      Distribuição por modalidade detectada
                    </div>
                    {res.colunas.modalidade_origem === "inferida" && (
                      <Chip tom="warn">inferida automaticamente</Chip>
                    )}
                  </div>
                  <div className="text-[12.5px] text-muted mt-0.5">
                    {res.colunas.modalidade_origem === "inferida" ? (
                      <>
                        A planilha não tinha coluna de modalidade — a classificação foi
                        deduzida do nome da unidade (FGTS/MCMV/SBPE…) e da composição do
                        pagamento (entrada × financiamento × subsídio). Revise antes de
                        salvar.
                      </>
                    ) : (
                      <>
                        Coluna <b className="text-ink">{res.colunas.modalidade}</b> da planilha.
                        O painel acima salva essa distribuição automaticamente quando você
                        vincula a um empreendimento.
                      </>
                    )}
                  </div>
                </div>
                <Chip tom="up">{res.distribuicao.length} modalidades</Chip>
              </div>
              <div className="overflow-x-auto border border-line-soft rounded-[12px]">
                <table className="w-full text-[13.5px]">
                  <thead className="bg-thead text-muted">
                    <tr>
                      <th className="text-left font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5">
                        Modalidade
                      </th>
                      <th className="text-right font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5">
                        Unidades vendidas
                      </th>
                      <th className="text-right font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5">
                        VGV
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.distribuicao.map((linha) => (
                      <tr key={linha.modalidade} className="border-t border-line-soft">
                        <td className="px-3 py-2 font-semibold text-ink">
                          {linha.modalidade}
                        </td>
                        <td className="px-3 py-2 text-right tnum font-bold text-ink">
                          {linha.unidades_vendidas}
                        </td>
                        <td className="px-3 py-2 text-right tnum text-body">
                          {linha.vgv != null ? moedaCurta(linha.vgv) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
