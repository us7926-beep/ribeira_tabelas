"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { HBar } from "@/components/ui/HBar";
import { KpiCard } from "@/components/ui/KpiCard";
import { baixarCsv, montarCsv } from "@/lib/csv";
import type {
  DistribuicaoModalidade,
  ModalidadeSugerida,
  VendaMensal,
} from "@/types";

interface Props {
  empreendimentoId: string;
  totalUnidades?: number | null;
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

interface PontoVso {
  mes: string;
  acumulado: number;
  /** % capado em 100 para o desenho do gráfico. */
  vso: number;
  /** % sem cap. Quando > 100, vendas excedem total_unidades cadastrado. */
  vsoReal: number;
}

/** Gráfico de área SVG do VSO acumulado por mês.
 * Sem lib externa — segue o padrão do sparkline em AbaTabela. */
function GraficoVso({ serie, totalUnidades }: { serie: PontoVso[]; totalUnidades: number }) {
  const W = 640;
  const H = 180;
  const padX = 36;
  const padY = 28;
  const n = serie.length;
  const escalaX = (i: number) => (n > 1 ? padX + (i * (W - 2 * padX)) / (n - 1) : W / 2);
  const escalaY = (v: number) => H - padY - (Math.min(100, v) / 100) * (H - 2 * padY);
  const xs = serie.map((_, i) => escalaX(i));
  const ys = serie.map((p) => escalaY(p.vso));
  const pontos = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  const areaPoligono = `${padX},${H - padY} ${pontos} ${W - padX},${H - padY}`;
  const linhasRef = [25, 50, 75, 100];
  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[200px]"
        preserveAspectRatio="none"
      >
        {linhasRef.map((p) => {
          const y = escalaY(p);
          return (
            <g key={p}>
              <line
                x1={padX}
                x2={W - padX}
                y1={y}
                y2={y}
                stroke="var(--color-line-soft)"
                strokeWidth={1}
                strokeDasharray={p === 100 ? "" : "3 3"}
              />
              <text x={padX - 6} y={y + 3} fill="var(--color-faint)" fontSize={10} fontWeight={700} textAnchor="end">
                {p}%
              </text>
            </g>
          );
        })}
        <polyline points={areaPoligono} fill="#EAF0FE" stroke="none" />
        <polyline points={pontos} fill="none" stroke="#2347C5" strokeWidth={2.5} />
        {xs.map((x, i) => (
          <g key={i}>
            <circle cx={x} cy={ys[i]} r={4} fill="#2347C5" stroke="#fff" strokeWidth={2} />
            <text x={x} y={ys[i] - 10} fill="#14203A" fontSize={11} fontWeight={700} textAnchor="middle">
              {serie[i].vso.toFixed(1)}%
            </text>
            <text x={x} y={H - 6} fill="#97A2B5" fontSize={10} fontWeight={600} textAnchor="middle">
              {serie[i].mes.slice(5, 7)}/{serie[i].mes.slice(2, 4)}
            </text>
          </g>
        ))}
        <title>
          {`VSO acumulado: ${serie[n - 1].vso.toFixed(1)}% (${serie[n - 1].acumulado}/${totalUnidades})`}
        </title>
      </svg>
    </div>
  );
}

export function AbaVendasMensais({ empreendimentoId, totalUnidades }: Props) {
  const [vendas, setVendas] = useState<VendaMensal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  // Form para nova linha
  const [novoMes, setNovoMes] = useState("");
  const [novoUnidades, setNovoUnidades] = useState("");
  const [novoVgv, setNovoVgv] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Distribuicao por modalidade do mês selecionado
  const [mesDist, setMesDist] = useState(""); // YYYY-MM
  const [linhasDist, setLinhasDist] = useState<DistribuicaoModalidade[]>([]);
  const [sugeridas, setSugeridas] = useState<ModalidadeSugerida[]>([]);
  const [novaModalidade, setNovaModalidade] = useState("");
  const [customNome, setCustomNome] = useState("");
  const [salvandoDist, setSalvandoDist] = useState(false);
  const [feedbackDist, setFeedbackDist] = useState("");

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

  // Carrega sugeridas uma vez por empreendimento
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(
          `/api/empreendimentos/${empreendimentoId}/vendas-mensais/modalidades-sugeridas`,
        );
        const d = await r.json();
        if (Array.isArray(d)) setSugeridas(d as ModalidadeSugerida[]);
      } catch {
        /* ok manter vazio */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empreendimentoId]);

  // Quando o mes selecionado mudar, carrega as linhas dele.
  useEffect(() => {
    if (!mesDist) {
      setLinhasDist([]);
      return;
    }
    (async () => {
      try {
        const r = await fetch(
          `/api/empreendimentos/${empreendimentoId}/vendas-mensais/distribuicao?de=${mesDist}&ate=${mesDist}`,
        );
        const d = await r.json();
        if (Array.isArray(d)) {
          setLinhasDist(
            (d as DistribuicaoModalidade[]).filter((l) => l.mes?.startsWith(mesDist)),
          );
        } else {
          setLinhasDist([]);
        }
      } catch {
        setLinhasDist([]);
      }
    })();
  }, [mesDist, empreendimentoId]);

  // Quando uma nova venda é cadastrada, escolhe o ultimo mes para distribuir.
  useEffect(() => {
    if (!mesDist && vendas.length > 0) {
      setMesDist(vendas[vendas.length - 1].mes.slice(0, 7));
    }
  }, [vendas, mesDist]);

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

  function adicionarModalidade(nome: string) {
    const limpo = (nome || "").trim();
    if (!limpo) return;
    if (linhasDist.some((l) => l.modalidade.toLowerCase() === limpo.toLowerCase())) return;
    setLinhasDist((prev) => [
      ...prev,
      { modalidade: limpo, unidades_vendidas: 0, vgv: null },
    ]);
  }

  function removerModalidade(idx: number) {
    setLinhasDist((prev) => prev.filter((_, i) => i !== idx));
  }

  function atualizarLinhaDist(idx: number, campo: "unidades_vendidas" | "vgv", valor: string) {
    setLinhasDist((prev) =>
      prev.map((linha, i) => {
        if (i !== idx) return linha;
        if (campo === "unidades_vendidas") {
          return { ...linha, unidades_vendidas: parseInt(valor || "0", 10) || 0 };
        }
        const n = valor ? Number(valor.replace(",", ".")) : null;
        return { ...linha, vgv: Number.isFinite(n as number) ? (n as number) : null };
      }),
    );
  }

  async function salvarDistribuicao() {
    if (!mesDist) {
      setFeedbackDist("Selecione um mês primeiro.");
      return;
    }
    setSalvandoDist(true);
    setFeedbackDist("");
    try {
      const r = await fetch(
        `/api/empreendimentos/${empreendimentoId}/vendas-mensais/distribuicao`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mes: mesDist,
            linhas: linhasDist
              .filter((l) => l.unidades_vendidas > 0)
              .map((l) => ({
                modalidade: l.modalidade,
                unidades_vendidas: l.unidades_vendidas,
                vgv: l.vgv,
              })),
          }),
        },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Falha ao salvar distribuição");
      setFeedbackDist("Distribuição salva. O Fluxo Comercial deste mês usa dados reais agora.");
    } catch (e) {
      setFeedbackDist((e as Error).message);
    } finally {
      setSalvandoDist(false);
    }
  }

  const totalDistUnidades = linhasDist.reduce((a, l) => a + (l.unidades_vendidas || 0), 0);
  const vendaDoMes = vendas.find((v) => v.mes.startsWith(mesDist));
  const conflitoSoma =
    !!vendaDoMes && totalDistUnidades !== vendaDoMes.unidades_vendidas;

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

  const serieVso = useMemo<PontoVso[]>(() => {
    if (!totalUnidades || totalUnidades <= 0 || vendas.length === 0) return [];
    const ordenadas = [...vendas].sort((a, b) => a.mes.localeCompare(b.mes));
    let acc = 0;
    return ordenadas.map((v) => {
      acc += v.unidades_vendidas;
      const vsoReal = (acc / totalUnidades) * 100;
      return {
        mes: v.mes,
        acumulado: acc,
        vso: Math.min(100, vsoReal),
        vsoReal,
      };
    });
  }, [vendas, totalUnidades]);

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
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="text-[16px] font-bold text-ink">Vendas por mês</div>
          <button
            type="button"
            onClick={() => {
              if (vendas.length === 0) return;
              const linhas = [...vendas]
                .sort((a, b) => a.mes.localeCompare(b.mes))
                .map((v) => [v.mes, v.unidades_vendidas, v.vgv_mes ?? ""]);
              baixarCsv(
                `vendas-mensais-${empreendimentoId.slice(0, 8)}.csv`,
                montarCsv(["mes", "unidades_vendidas", "vgv_mes"], linhas),
              );
            }}
            disabled={vendas.length === 0}
            className="text-[12.5px] font-bold text-royal hover:underline disabled:text-faint disabled:no-underline"
          >
            Baixar CSV
          </button>
        </div>
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

      {totalUnidades && totalUnidades > 0 && serieVso.length > 0 && (() => {
        const ultimo = serieVso[serieVso.length - 1];
        const vsoExcedido = ultimo.vsoReal > 100.01;
        return (
          <Card variant="lg">
            <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
              <div>
                <div className="text-[16px] font-bold text-ink">VSO acumulado</div>
                <div className="text-[12.5px] text-muted mt-0.5">
                  Velocidade de venda sobre <b className="text-ink tnum">{totalUnidades}</b>{" "}
                  unidades totais ·{" "}
                  <b className="text-ink tnum">{ultimo.acumulado}</b> vendidas até{" "}
                  <b className="text-ink">{formatarMes(ultimo.mes)}</b>.
                </div>
              </div>
              <Chip tom={vsoExcedido ? "warn" : "royal"}>
                {ultimo.vsoReal.toFixed(1)}% atual
              </Chip>
            </div>
            {vsoExcedido && (
              <div className="rounded-[12px] bg-warn-bg text-warn-strong text-[13px] px-4 py-3 border border-warn-line mb-3">
                Vendas acumuladas (<b className="tnum">{ultimo.acumulado}</b>) excedem o
                total cadastrado (<b className="tnum">{totalUnidades}</b>). Verifique
                <b> total_unidades</b> na Aba Ficha Técnica — o gráfico mostra 100% mas
                o número real é <b className="tnum">{ultimo.vsoReal.toFixed(1)}%</b>.
              </div>
            )}
            <GraficoVso serie={serieVso} totalUnidades={totalUnidades} />
          </Card>
        );
      })()}

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

      {/* Distribuicao por modalidade — alimenta /fluxo-comercial com dados reais */}
      <Card variant="lg">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <div className="text-[16px] font-bold text-ink">
              Distribuição por modalidade
            </div>
            <div className="text-[12.5px] text-muted mt-0.5">
              Liste quantas unidades foram vendidas em cada modalidade no mês. Sem
              isso, o Fluxo Comercial assume distribuição uniforme (
              <Chip tom="warn">Estimado</Chip>).
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={mesDist}
              onChange={(e) => setMesDist(e.target.value)}
              className="rounded-[12px] border border-line bg-white px-[14px] py-[9px] text-[13.5px] outline-none focus:border-royal"
            >
              <option value="">Selecione o mês…</option>
              {vendas.map((v) => {
                const k = v.mes.slice(0, 7);
                return (
                  <option key={v.id} value={k}>
                    {formatarMes(v.mes)} ({v.unidades_vendidas} un.)
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {!mesDist ? (
          <div className="text-[13.5px] text-muted">
            Cadastre um mês de venda acima e selecione-o para detalhar a distribuição.
          </div>
        ) : (
          <>
            {linhasDist.length > 0 && (
              <div className="overflow-x-auto border border-line-soft rounded-[12px] mb-3">
                <table className="w-full text-[13.5px]">
                  <thead className="bg-thead text-muted">
                    <tr>
                      <th className="text-left font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5">
                        Modalidade
                      </th>
                      <th className="text-right font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5 w-[160px]">
                        Unidades vendidas
                      </th>
                      <th className="text-right font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5 w-[200px]">
                        VGV (R$, opcional)
                      </th>
                      <th className="px-3 py-2.5 w-[80px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {linhasDist.map((l, i) => (
                      <tr key={`${l.modalidade}-${i}`} className="border-t border-line-soft">
                        <td className="px-3 py-2 font-semibold text-ink">{l.modalidade}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={l.unidades_vendidas || ""}
                            onChange={(e) =>
                              atualizarLinhaDist(i, "unidades_vendidas", e.target.value)
                            }
                            className="w-[110px] text-right rounded-[8px] border border-line bg-white px-2 py-1.5 outline-none focus:border-royal tnum"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="text"
                            placeholder="—"
                            value={l.vgv ?? ""}
                            onChange={(e) => atualizarLinhaDist(i, "vgv", e.target.value)}
                            className="w-[170px] text-right rounded-[8px] border border-line bg-white px-2 py-1.5 outline-none focus:border-royal tnum"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => removerModalidade(i)}
                            className="text-[12px] font-bold text-down-strong hover:underline"
                          >
                            remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap gap-2 items-center mb-3">
              <select
                value={novaModalidade}
                onChange={(e) => setNovaModalidade(e.target.value)}
                className="rounded-[12px] border border-line bg-white px-[14px] py-[9px] text-[13.5px] outline-none focus:border-royal"
              >
                <option value="">+ Adicionar modalidade…</option>
                {sugeridas
                  .filter(
                    (s) =>
                      !linhasDist.some(
                        (l) => l.modalidade.toLowerCase() === s.label.toLowerCase(),
                      ),
                  )
                  .map((s) => (
                    <option key={`${s.fonte}-${s.label}`} value={s.label}>
                      {s.label} {s.fonte === "condicoes" ? "(da tabela)" : "(do histórico)"}
                    </option>
                  ))}
                <option value="__custom__">+ Modalidade customizada…</option>
              </select>
              <Button
                variante="secondary"
                onClick={() => {
                  if (novaModalidade === "__custom__") return;
                  if (!novaModalidade) return;
                  adicionarModalidade(novaModalidade);
                  setNovaModalidade("");
                }}
                disabled={!novaModalidade || novaModalidade === "__custom__"}
              >
                Adicionar
              </Button>
              {novaModalidade === "__custom__" && (
                <div className="flex gap-2 items-center">
                  <input
                    value={customNome}
                    onChange={(e) => setCustomNome(e.target.value)}
                    placeholder="Nome da modalidade"
                    className="rounded-[12px] border border-line bg-white px-[14px] py-[9px] text-[13.5px] outline-none focus:border-royal"
                  />
                  <Button
                    variante="secondary"
                    onClick={() => {
                      adicionarModalidade(customNome);
                      setCustomNome("");
                      setNovaModalidade("");
                    }}
                    disabled={!customNome.trim()}
                  >
                    Adicionar
                  </Button>
                </div>
              )}
            </div>

            {vendaDoMes && (
              <div className="text-[12.5px] mb-3">
                <span className="text-muted">
                  Soma das modalidades:{" "}
                  <b className="text-ink tnum">{totalDistUnidades}</b> /{" "}
                  <b className="text-ink tnum">{vendaDoMes.unidades_vendidas}</b> registradas
                  no mês.
                </span>
                {conflitoSoma && (
                  <span className="ml-2 font-bold text-down-strong">
                    ⚠ não bate
                  </span>
                )}
              </div>
            )}

            <div className="flex justify-between gap-2 items-center flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const linhasCsv = linhasDist
                    .filter((l) => l.unidades_vendidas > 0)
                    .map((l) => [mesDist, l.modalidade, l.unidades_vendidas, l.vgv ?? ""]);
                  if (linhasCsv.length === 0) return;
                  baixarCsv(
                    `distribuicao-${mesDist || "mes"}.csv`,
                    montarCsv(
                      ["mes", "modalidade", "unidades_vendidas", "vgv"],
                      linhasCsv,
                    ),
                  );
                }}
                disabled={
                  linhasDist.filter((l) => l.unidades_vendidas > 0).length === 0
                }
                className="text-[12.5px] font-bold text-royal hover:underline disabled:text-faint disabled:no-underline"
              >
                Baixar CSV
              </button>
              <div className="flex gap-2 items-center ml-auto">
                {feedbackDist && (
                  <div
                    className={`text-[12.5px] ${feedbackDist.toLowerCase().includes("salva") ? "text-up-strong" : "text-down-strong"}`}
                  >
                    {feedbackDist}
                  </div>
                )}
                <Button onClick={salvarDistribuicao} disabled={salvandoDist}>
                  {salvandoDist ? "Salvando…" : "Salvar distribuição"}
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
