"use client";

import { useState } from "react";

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

function Card({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-line border-l-4 border-l-royal p-5">
      <div className="text-sm font-semibold text-muted">{titulo}</div>
      <div className="text-2xl font-extrabold text-ink mt-1 tabular-nums">{valor}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
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
  const total = k?.total_unidades || 1;

  return (
    <div className="max-w-4xl">
      <div className="bg-white rounded-2xl border border-line p-6">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-lg file:border-0 file:bg-royal file:text-white file:px-4 file:py-2 file:font-semibold hover:file:bg-royal-dark"
        />
        <button
          onClick={calcular}
          disabled={!arquivo || carregando}
          className="mt-4 rounded-lg bg-royal hover:bg-royal-dark text-white font-semibold px-5 py-2.5 disabled:opacity-50"
        >
          {carregando ? "Calculando..." : "Calcular KPIs"}
        </button>
      </div>

      {erro && (
        <div className="mt-4 rounded-lg bg-red-50 text-neg text-sm px-3 py-2 border border-red-100">{erro}</div>
      )}

      {k && (
        <div className="mt-6">
          <div className="text-sm text-muted mb-3">
            {k.total_unidades} unidades · situação: <b>{res!.colunas.status}</b>, valor: <b>{res!.colunas.valor}</b>
          </div>

          {/* barra de proporção */}
          <div className="flex h-3 rounded-full overflow-hidden mb-5 border border-line">
            <div className="bg-pos" style={{ width: `${(k.vendidas / total) * 100}%` }} title="Vendidas" />
            <div className="bg-amber" style={{ width: `${(k.reservadas / total) * 100}%` }} title="Reservadas" />
            <div className="bg-royal" style={{ width: `${(k.disponiveis / total) * 100}%` }} title="Disponíveis" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card titulo="Vendidas" valor={String(k.vendidas)} sub={`${k.pct_vendidas}% · VSO ${k.vso}%`} />
            <Card titulo="Disponíveis" valor={String(k.disponiveis)} sub={`${k.pct_disponiveis}%`} />
            <Card titulo="Reservadas" valor={String(k.reservadas)} />
            <Card titulo="Total de unidades" valor={String(k.total_unidades)} />
            <Card titulo="VGV total" valor={moeda(k.vgv_total)} />
            <Card titulo="VGV vendido" valor={moeda(k.vgv_vendido)} />
            <Card titulo="Ticket médio" valor={moeda(k.ticket_medio)} />
          </div>
        </div>
      )}
    </div>
  );
}
