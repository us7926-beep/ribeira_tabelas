"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { HBar } from "@/components/ui/HBar";
import { KpiCard } from "@/components/ui/KpiCard";
import type { VendaMensal } from "@/types";

interface Props {
  empreendimentoId: string;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatarMes(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (!m) return iso;
  return `${MESES[Number(m[2]) - 1]} ${m[1]}`;
}

function moedaCurta(n: number | null | undefined): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)} mi`;
  if (n >= 1000) return `R$ ${Math.round(n / 1000)} mil`;
  return `R$ ${Math.round(n)}`;
}

export function AbaVendasMensais({ empreendimentoId }: Props) {
  const [vendas, setVendas] = useState<VendaMensal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  // Form para nova linha
  const [novoMes, setNovoMes] = useState("");
  const [novoUnidades, setNovoUnidades] = useState("");
  const [novoVgv, setNovoVgv] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setCarregando(true);
    try {
      const r = await fetch(`/api/empreendimentos/${empreendimentoId}/vendas-mensais`);
      const d = await r.json();
      if (Array.isArray(d)) setVendas(d);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empreendimentoId]);

  async function salvarLinha() {
    setErro("");
    const m = novoMes.match(/^(\d{4})-(\d{2})/);
    if (!m) {
      setErro("Mês deve estar em AAAA-MM (ex.: 2026-06).");
      return;
    }
    const u = parseInt(novoUnidades, 10);
    if (Number.isNaN(u) || u < 0) {
      setErro("Unidades vendidas deve ser número.");
      return;
    }
    setSalvando(true);
    try {
      const body: Record<string, unknown> = {
        mes: novoMes,
        unidades_vendidas: u,
        fonte: "manual",
      };
      if (novoVgv) body.vgv_mes = Number(novoVgv.replace(",", "."));
      const r = await fetch(`/api/empreendimentos/${empreendimentoId}/vendas-mensais`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Falha ao salvar");
      setNovoMes("");
      setNovoUnidades("");
      setNovoVgv("");
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const kpis = useMemo(() => {
    if (vendas.length === 0) return null;
    const total = vendas.reduce((a, v) => a + v.unidades_vendidas, 0);
    const vgv = vendas.reduce((a, v) => a + (v.vgv_mes ?? 0), 0);
    const melhor = vendas.reduce((a, v) => (v.unidades_vendidas > a.unidades_vendidas ? v : a), vendas[0]);
    return {
      total,
      media: Math.round(total / vendas.length),
      melhor,
      vgv,
    };
  }, [vendas]);

  const maxUn = vendas.reduce((a, v) => Math.max(a, v.unidades_vendidas), 0);

  return (
    <div className="flex flex-col gap-5 tablm-up">
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <KpiCard rotulo="Total período" valor={String(kpis.total)} hint={`${vendas.length} mês(es)`} />
          <KpiCard rotulo="Média mensal" valor={String(kpis.media)} />
          <KpiCard
            rotulo="Melhor mês"
            valor={String(kpis.melhor.unidades_vendidas)}
            hint={formatarMes(kpis.melhor.mes)}
          />
          <KpiCard rotulo="VGV período" valor={moedaCurta(kpis.vgv)} />
        </div>
      )}

      <Card variant="lg">
        <div className="text-[16px] font-bold text-ink mb-3">Vendas por mês</div>
        {carregando ? (
          <div className="text-[13.5px] text-muted">Carregando…</div>
        ) : vendas.length === 0 ? (
          <div className="text-[13.5px] text-muted">
            Nenhuma venda registrada ainda. Adicione o primeiro mês abaixo.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {vendas.map((v) => (
              <div key={v.id} className="grid grid-cols-[110px_1fr_80px_120px] items-center gap-3 py-1">
                <div className="text-[12.5px] font-bold text-body tnum">{formatarMes(v.mes)}</div>
                <HBar pct={maxUn ? (v.unidades_vendidas / maxUn) * 100 : 0} />
                <div className="text-[13.5px] font-bold text-ink tnum text-right">
                  {v.unidades_vendidas}
                </div>
                <div className="text-[12.5px] text-muted tnum text-right">
                  {moedaCurta(v.vgv_mes ?? null)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card variant="lg">
        <div className="text-[16px] font-bold text-ink mb-3">Adicionar mês</div>
        <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_1fr_auto] gap-2.5 items-end">
          <input
            value={novoMes}
            onChange={(e) => setNovoMes(e.target.value)}
            type="month"
            className="w-full px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition"
          />
          <input
            value={novoUnidades}
            onChange={(e) => setNovoUnidades(e.target.value)}
            type="number"
            min={0}
            placeholder="Unidades vendidas"
            className="w-full px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition"
          />
          <input
            value={novoVgv}
            onChange={(e) => setNovoVgv(e.target.value)}
            type="text"
            placeholder="VGV do mês (R$, opcional)"
            className="w-full px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition"
          />
          <Button onClick={salvarLinha} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar mês"}
          </Button>
        </div>
        {erro && (
          <div className="mt-3 rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line">
            {erro}
          </div>
        )}
      </Card>
    </div>
  );
}
