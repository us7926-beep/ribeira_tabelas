"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Dropzone } from "@/components/ui/Dropzone";
import { KpiCard } from "@/components/ui/KpiCard";
import { KpiDelta } from "@/components/ui/KpiDelta";
import type { TabelaPrecos, UnidadePreco } from "@/types";

function moeda(n: number | null | undefined): string {
  if (n == null) return "—";
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}

function dataBR(iso: string | undefined): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

interface KpisVersao {
  precoM2Medio: number | null;
  ticketMedio: number | null;
  vgvTotal: number;
  totalUnidades: number;
}

/** Recalcula KPIs a partir das unidades já persistidas em tabelas_precos. */
function kpisDaVersao(t: TabelaPrecos | undefined): KpisVersao {
  const unidades = (t?.unidades ?? []) as UnidadePreco[];
  let vgv = 0;
  let nPrecos = 0;
  let somaPm2 = 0;
  let nPm2 = 0;
  for (const u of unidades) {
    const preco = typeof u.preco_total === "number" ? u.preco_total : null;
    const area = typeof u.area_m2 === "number" ? u.area_m2 : null;
    if (preco && preco > 0) {
      vgv += preco;
      nPrecos += 1;
      if (area && area > 0) {
        somaPm2 += preco / area;
        nPm2 += 1;
      }
    }
  }
  return {
    precoM2Medio: nPm2 ? Math.round(somaPm2 / nPm2) : null,
    ticketMedio: nPrecos ? Math.round(vgv / nPrecos) : null,
    vgvTotal: Math.round(vgv),
    totalUnidades: unidades.length,
  };
}

/** Diff entre duas versões da tabela (matching por andar+unidade). */
interface DeltaCampo {
  campo: "preco_total" | "entrada" | "parcelas_mensais" | "financiamento";
  antes: number;
  depois: number;
}
interface DiffTabela {
  adicionadas: UnidadePreco[];
  removidas: UnidadePreco[];
  alteradas: { antes: UnidadePreco; depois: UnidadePreco; deltas: DeltaCampo[] }[];
}

function chaveUnidade(u: UnidadePreco): string {
  return `${String(u.andar ?? "")}|${String(u.unidade ?? "")}`;
}

const CAMPOS_DELTA: DeltaCampo["campo"][] = [
  "preco_total",
  "entrada",
  "parcelas_mensais",
  "financiamento",
];

function compararTabelas(antes: UnidadePreco[], depois: UnidadePreco[]): DiffTabela {
  const mapA = new Map<string, UnidadePreco>();
  antes.forEach((u) => mapA.set(chaveUnidade(u), u));
  const mapB = new Map<string, UnidadePreco>();
  depois.forEach((u) => mapB.set(chaveUnidade(u), u));

  const adicionadas: UnidadePreco[] = [];
  const removidas: UnidadePreco[] = [];
  const alteradas: DiffTabela["alteradas"] = [];

  for (const [chave, depoisU] of mapB) {
    const antesU = mapA.get(chave);
    if (!antesU) {
      adicionadas.push(depoisU);
      continue;
    }
    const deltas: DeltaCampo[] = [];
    for (const campo of CAMPOS_DELTA) {
      const a = (antesU as Record<string, unknown>)[campo];
      const b = (depoisU as Record<string, unknown>)[campo];
      if (typeof a === "number" && typeof b === "number" && a !== b) {
        deltas.push({ campo, antes: a, depois: b });
      }
    }
    if (deltas.length > 0) alteradas.push({ antes: antesU, depois: depoisU, deltas });
  }
  for (const [chave, antesU] of mapA) {
    if (!mapB.has(chave)) removidas.push(antesU);
  }
  return { adicionadas, removidas, alteradas };
}

const ROTULO_CAMPO: Record<DeltaCampo["campo"], string> = {
  preco_total: "Preço",
  entrada: "Entrada",
  parcelas_mensais: "Mensais",
  financiamento: "Financiamento",
};

/** Sparkline simples em SVG da série de preço/m² médio. */
function Sparkline({
  serie,
}: {
  serie: { versao: string; data: string; pm2: number }[];
}) {
  const W = 640;
  const H = 140;
  const padX = 24;
  const padY = 18;
  const xs = serie.map((_, i) => padX + (i * (W - 2 * padX)) / (serie.length - 1));
  const valores = serie.map((p) => p.pm2);
  const minV = Math.min(...valores);
  const maxV = Math.max(...valores);
  const range = Math.max(1, maxV - minV);
  const ys = valores.map((v) => H - padY - ((v - minV) / range) * (H - 2 * padY));
  const pontos = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  const areaPoligono = `${padX},${H - padY} ${pontos} ${W - padX},${H - padY}`;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[160px]"
        preserveAspectRatio="none"
      >
        <polyline points={areaPoligono} fill="#EAF0FE" stroke="none" />
        <polyline points={pontos} fill="none" stroke="#2347C5" strokeWidth={2.5} />
        {xs.map((x, i) => (
          <g key={i}>
            <circle cx={x} cy={ys[i]} r={4} fill="#2347C5" stroke="#fff" strokeWidth={2} />
            <text
              x={x}
              y={ys[i] - 10}
              fill="#14203A"
              fontSize={11}
              fontWeight={700}
              textAnchor="middle"
            >
              {"R$ " + Math.round(serie[i].pm2).toLocaleString("pt-BR")}
            </text>
            <text
              x={x}
              y={H - 4}
              fill="#97A2B5"
              fontSize={10}
              fontWeight={600}
              textAnchor="middle"
            >
              {serie[i].versao}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Gera CSV das unidades e força download no browser. */
function baixarCsvUnidades(t: TabelaPrecos): void {
  const unidades = (t.unidades ?? []) as UnidadePreco[];
  if (unidades.length === 0) return;
  const colunas = [
    "andar", "unidade", "area_m2", "vaga",
    "entrada", "parcelas_mensais", "financiamento",
    "preco_total", "avaliacao",
  ] as const;
  const linhas: string[] = [colunas.join(",")];
  for (const u of unidades) {
    linhas.push(
      colunas
        .map((c) => {
          const v = (u as Record<string, unknown>)[c];
          if (v === undefined || v === null) return "";
          const s = String(v).replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })
        .join(","),
    );
  }
  const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tabela-${t.versao.replace(/[\\/\s]+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  empreendimentoId: string;
}

export function AbaTabela({ empreendimentoId }: Props) {
  const router = useRouter();
  const [tabelas, setTabelas] = useState<TabelaPrecos[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [tabelaIdx, setTabelaIdx] = useState(0);
  const [modalAberto, setModalAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [versao, setVersao] = useState("");
  const [dataRef, setDataRef] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  /** Se marcado, chama /importar-book em vez de /tabelas-precos. */
  const [extrairFicha, setExtrairFicha] = useState(false);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empreendimentoId]);

  async function carregar() {
    setCarregando(true);
    try {
      const r = await fetch(`/api/empreendimentos/${empreendimentoId}/tabelas-precos`);
      const d = await r.json();
      if (Array.isArray(d)) setTabelas(d);
    } finally {
      setCarregando(false);
    }
  }

  async function enviarTabela() {
    if (!arquivo && !versao) {
      setErro("Selecione um arquivo ou informe a versão.");
      return;
    }
    setErro("");
    setEnviando(true);
    try {
      const fd = new FormData();
      if (arquivo) fd.append("arquivo", arquivo);
      if (versao) fd.append("versao", versao);
      if (dataRef) fd.append("data_referencia", dataRef);
      // Se o usuario quer extrair tambem a ficha tecnica, usa o endpoint
      // unificado (1 upload, IA roda 2x: ficha + tabela).
      const url =
        arquivo && extrairFicha
          ? `/api/empreendimentos/${empreendimentoId}/importar-book`
          : `/api/empreendimentos/${empreendimentoId}/tabelas-precos`;
      if (arquivo && extrairFicha) {
        fd.append("extrair_ficha", "true");
        fd.append("extrair_tabela", "true");
      }
      const r = await fetch(url, { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Falha ao enviar tabela");
      setModalAberto(false);
      setArquivo(null);
      setVersao("");
      setDataRef("");
      setExtrairFicha(false);
      await carregar();
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const tabela = tabelas[tabelaIdx];
  const unidades = (tabela?.unidades ?? []) as UnidadePreco[];
  const promocoes = tabela?.promocoes ?? [];
  const condicoes = tabela?.condicoes ?? {};

  const linhasMostradas = useMemo(() => unidades.slice(0, 100), [unidades]);

  // KPIs da versão atual (recalculados das unidades) + da anterior (pra delta).
  const kpisAtual = useMemo(() => kpisDaVersao(tabela), [tabela]);
  // "Anterior" = próxima na lista (ordenada por data_referencia DESC).
  const kpisAnterior = useMemo(
    () => kpisDaVersao(tabelas[tabelaIdx + 1]),
    [tabelas, tabelaIdx],
  );
  const temAnterior = tabelas.length > tabelaIdx + 1;
  const versaoAnterior = tabelas[tabelaIdx + 1];

  function deltaPct(atual: number | null, anterior: number | null): number | null {
    if (!atual || !anterior) return null;
    return Math.round(((atual - anterior) / anterior) * 1000) / 10;
  }

  // Versão de comparação (default = anterior). Permite comparar com qualquer versão.
  const [comparaIdx, setComparaIdx] = useState<number | null>(null);
  const idxAlvoComparacao = comparaIdx ?? tabelaIdx + 1;
  const tabelaB = tabelas[idxAlvoComparacao];

  const diff = useMemo(() => {
    if (!tabela || !tabelaB) return null;
    return compararTabelas(
      (tabelaB.unidades ?? []) as UnidadePreco[],
      (tabela.unidades ?? []) as UnidadePreco[],
    );
  }, [tabela, tabelaB]);

  // Série de preço/m² médio por versão (cronológica) — para sparkline SVG.
  const serie = useMemo(() => {
    return tabelas
      .slice()
      .reverse()
      .map((t) => ({
        versao: t.versao,
        data: t.data_referencia,
        pm2: kpisDaVersao(t).precoM2Medio,
      }))
      .filter((p) => p.pm2 != null) as { versao: string; data: string; pm2: number }[];
  }, [tabelas]);

  return (
    <div className="flex flex-col gap-5 tablm-up">
      <Card variant="lg">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="text-[12px] font-bold tracking-[1.4px] uppercase text-muted">
              Versões da tabela de preços
            </div>
            <div className="text-[14px] text-muted mt-0.5">
              Histórico completo — preserva cada versão enviada para comparação futura.
            </div>
          </div>
          <Button onClick={() => setModalAberto(true)}>+ Nova tabela</Button>
        </div>

        {carregando ? (
          <div className="text-[13.5px] text-muted mt-4">Carregando…</div>
        ) : tabelas.length === 0 ? (
          <div className="text-[13.5px] text-muted mt-4">
            Nenhuma versão ainda. Envie a primeira tabela pelo botão acima.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 mt-4">
            {tabelas.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setTabelaIdx(i)}
                className={
                  i === tabelaIdx
                    ? "px-3 py-1.5 rounded-[10px] bg-royal text-white text-[12.5px] font-bold"
                    : "px-3 py-1.5 rounded-[10px] bg-white border border-line text-body text-[12.5px] font-semibold hover:border-royal hover:text-royal transition-colors"
                }
              >
                {t.versao} · {dataBR(t.data_referencia)}
              </button>
            ))}
          </div>
        )}
      </Card>

      {tabela && (
        <>
          <Card>
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-3 items-center">
                <Chip tom="royal">{tabela.versao}</Chip>
                <span className="text-[13.5px] text-body">
                  <b className="text-ink">{unidades.length}</b> unidades · referência{" "}
                  <b className="text-ink">{dataBR(tabela.data_referencia)}</b>
                </span>
              </div>
              {unidades.length > 0 && (
                <Button
                  variante="secondary"
                  onClick={() => baixarCsvUnidades(tabela)}
                >
                  📊 Baixar CSV
                </Button>
              )}
            </div>
          </Card>

          {/* KPIs da versão atual + delta vs versão anterior. */}
          {(kpisAtual.precoM2Medio || kpisAtual.ticketMedio || kpisAtual.vgvTotal) && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
              <KpiCard
                rotulo="Preço/m² médio"
                valor={kpisAtual.precoM2Medio ? moeda(kpisAtual.precoM2Medio) : "—"}
                delta={
                  temAnterior && deltaPct(kpisAtual.precoM2Medio, kpisAnterior.precoM2Medio) != null ? (
                    <KpiDelta
                      direcao={
                        deltaPct(kpisAtual.precoM2Medio, kpisAnterior.precoM2Medio)! > 0
                          ? "alta"
                          : deltaPct(kpisAtual.precoM2Medio, kpisAnterior.precoM2Medio)! < 0
                            ? "baixa"
                            : "neutro"
                      }
                    >
                      {Math.abs(deltaPct(kpisAtual.precoM2Medio, kpisAnterior.precoM2Medio)!)}% vs {versaoAnterior?.versao}
                    </KpiDelta>
                  ) : undefined
                }
              />
              <KpiCard
                rotulo="Ticket médio"
                valor={kpisAtual.ticketMedio ? moeda(kpisAtual.ticketMedio) : "—"}
                delta={
                  temAnterior && deltaPct(kpisAtual.ticketMedio, kpisAnterior.ticketMedio) != null ? (
                    <KpiDelta
                      direcao={
                        deltaPct(kpisAtual.ticketMedio, kpisAnterior.ticketMedio)! > 0
                          ? "alta"
                          : deltaPct(kpisAtual.ticketMedio, kpisAnterior.ticketMedio)! < 0
                            ? "baixa"
                            : "neutro"
                      }
                    >
                      {Math.abs(deltaPct(kpisAtual.ticketMedio, kpisAnterior.ticketMedio)!)}% vs {versaoAnterior?.versao}
                    </KpiDelta>
                  ) : undefined
                }
              />
              <KpiCard
                rotulo="VGV total"
                valor={moeda(kpisAtual.vgvTotal)}
                hint={`${kpisAtual.totalUnidades} unidades`}
              />
            </div>
          )}

          {/* Sparkline: evolução do preço/m² médio por versão (>= 2 pontos). */}
          {serie.length >= 2 && (
            <Card variant="lg">
              <div className="text-[16px] font-bold text-ink mb-1">
                Evolução de preço/m² médio
              </div>
              <div className="text-[12.5px] text-muted mb-3">
                {serie.length} versão(ões) na linha do tempo.
              </div>
              <Sparkline serie={serie} />
            </Card>
          )}

          {/* Diff por unidade entre a versão atual e outra (default = anterior). */}
          {temAnterior && diff && (
            <Card variant="lg">
              <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                <div>
                  <div className="text-[16px] font-bold text-ink">
                    Diferenças entre versões
                  </div>
                  <div className="text-[12.5px] text-muted mt-0.5">
                    Comparando <b className="text-royal">{tabela.versao}</b> com{" "}
                    <b className="text-ink">{tabelaB?.versao}</b>. Match por andar+unidade.
                  </div>
                </div>
                <select
                  value={String(idxAlvoComparacao)}
                  onChange={(e) => setComparaIdx(Number(e.target.value))}
                  className="rounded-[12px] border border-line bg-white px-[15px] py-[10px] text-[13.5px] outline-none focus:border-royal"
                >
                  {tabelas.map((t, i) =>
                    i === tabelaIdx ? null : (
                      <option key={t.id} value={i}>
                        Comparar com {t.versao}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="rounded-[12px] bg-up-bg border border-up-line px-4 py-3">
                  <div className="text-[12px] font-bold uppercase tracking-[0.5px] text-up-strong">
                    Adicionadas
                  </div>
                  <div className="text-[26px] font-extrabold text-up-strong tnum mt-1">
                    {diff.adicionadas.length}
                  </div>
                </div>
                <div className="rounded-[12px] bg-royal-tint border border-transparent px-4 py-3">
                  <div className="text-[12px] font-bold uppercase tracking-[0.5px] text-royal">
                    Alteradas
                  </div>
                  <div className="text-[26px] font-extrabold text-royal tnum mt-1">
                    {diff.alteradas.length}
                  </div>
                </div>
                <div className="rounded-[12px] bg-down-bg border border-down-line px-4 py-3">
                  <div className="text-[12px] font-bold uppercase tracking-[0.5px] text-down-strong">
                    Removidas
                  </div>
                  <div className="text-[26px] font-extrabold text-down-strong tnum mt-1">
                    {diff.removidas.length}
                  </div>
                </div>
              </div>

              {diff.alteradas.length > 0 && (
                <div className="overflow-x-auto border border-line-soft rounded-[12px]">
                  <table className="w-full text-[13.5px]">
                    <thead className="bg-thead text-muted">
                      <tr>
                        <th className="text-left font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5">
                          Unidade
                        </th>
                        <th className="text-left font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5">
                          Campo
                        </th>
                        <th className="text-right font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5">
                          Antes
                        </th>
                        <th className="text-right font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5">
                          Depois
                        </th>
                        <th className="text-right font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5">
                          Δ
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {diff.alteradas.slice(0, 80).flatMap((a) =>
                        a.deltas.map((d, di) => {
                          const delta = d.depois - d.antes;
                          const cor =
                            delta > 0 ? "text-up" : delta < 0 ? "text-down" : "text-muted";
                          return (
                            <tr
                              key={`${chaveUnidade(a.depois)}-${d.campo}-${di}`}
                              className="border-t border-line-soft"
                            >
                              <td className="px-3 py-2 whitespace-nowrap text-ink font-semibold">
                                {String(a.depois.andar ?? "—")} ·{" "}
                                {String(a.depois.unidade ?? "—")}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-body">
                                {ROTULO_CAMPO[d.campo]}
                              </td>
                              <td className="px-3 py-2 text-right tnum text-faint">
                                {moeda(d.antes)}
                              </td>
                              <td className="px-3 py-2 text-right tnum font-bold text-ink">
                                {moeda(d.depois)}
                              </td>
                              <td className={`px-3 py-2 text-right tnum font-bold ${cor}`}>
                                {delta > 0 ? "▲" : delta < 0 ? "▼" : ""} {moeda(Math.abs(delta))}
                              </td>
                            </tr>
                          );
                        }),
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {diff.alteradas.length > 80 && (
                <div className="text-[12px] text-faint mt-2">
                  Mostrando 80 das {diff.alteradas.length} unidades alteradas.
                </div>
              )}

              {diff.adicionadas.length === 0 &&
                diff.removidas.length === 0 &&
                diff.alteradas.length === 0 && (
                  <div className="text-[13.5px] text-muted">
                    As duas versões estão idênticas (nenhuma mudança nas unidades).
                  </div>
                )}
            </Card>
          )}

          {unidades.length > 0 && (
            <Card variant="lg">
              <div className="text-[16px] font-bold text-ink mb-3">Grid de unidades</div>
              <div className="overflow-x-auto border border-line-soft rounded-[12px]">
                <table className="w-full text-[13.5px]">
                  <thead className="bg-thead text-muted">
                    <tr>
                      {["Andar", "Unidade", "Área", "Vaga", "Entrada", "Mensais", "Financ.", "Preço", "Avaliação"].map((h) => (
                        <th
                          key={h}
                          className="text-left font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {linhasMostradas.map((u, i) => (
                      <tr key={i} className="border-t border-line-soft">
                        <td className="px-3 py-2 whitespace-nowrap text-body">{String(u.andar ?? "—")}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-ink font-semibold">{String(u.unidade ?? "—")}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-body tnum">
                          {u.area_m2 != null ? `${u.area_m2} m²` : "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-body">{String(u.vaga ?? "—")}</td>
                        <td className="px-3 py-2 whitespace-nowrap tnum text-body">{moeda(u.entrada ?? null)}</td>
                        <td className="px-3 py-2 whitespace-nowrap tnum text-body">{moeda(u.parcelas_mensais ?? null)}</td>
                        <td className="px-3 py-2 whitespace-nowrap tnum text-body">{moeda(u.financiamento ?? null)}</td>
                        <td className="px-3 py-2 whitespace-nowrap tnum text-royal font-bold">{moeda(u.preco_total ?? null)}</td>
                        <td className="px-3 py-2 whitespace-nowrap tnum text-body">{moeda(u.avaliacao ?? null)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {unidades.length > 100 && (
                <div className="text-[12px] text-faint mt-2">
                  Mostrando 100 de {unidades.length} unidades.
                </div>
              )}
            </Card>
          )}

          <Card variant="lg">
            <div className="text-[16px] font-bold text-ink mb-3">Condições comerciais</div>
            <div className="text-[13.5px] text-body grid gap-2">
              {Object.keys(condicoes).length === 0 && (
                <div className="text-muted">Sem condições estruturadas (este upload não trouxe).</div>
              )}
              {condicoes.avista && (
                <div>
                  <b>À vista:</b> desconto {condicoes.avista.desconto_pct ?? 0}%
                </div>
              )}
              {condicoes.entrada && (
                <div>
                  <b>Entrada:</b> {condicoes.entrada.pct_ato ?? "—"}% ato + {condicoes.entrada.parcelas_obra ?? "—"} parcelas (médio {moeda(condicoes.entrada.valor_parcela_medio ?? null)})
                </div>
              )}
              {condicoes.financiamento && (
                <div>
                  <b>Financiamento:</b> {condicoes.financiamento.banco || "—"} · {condicoes.financiamento.taxa_aa ?? "—"}% a.a. · {condicoes.financiamento.prazo_meses ?? "—"} meses
                </div>
              )}
              {(condicoes.mensais ?? []).length > 0 && (
                <div>
                  <b>Mensais:</b>{" "}
                  {condicoes.mensais!.map((m) => `${m.descricao} ${moeda(m.valor)}`).join(", ")}
                </div>
              )}
              {(condicoes.anuais ?? []).length > 0 && (
                <div>
                  <b>Anuais:</b>{" "}
                  {condicoes.anuais!.map((m) => `${m.descricao} ${moeda(m.valor)}`).join(", ")}
                </div>
              )}
            </div>
          </Card>

          {promocoes.length > 0 && (
            <Card variant="lg">
              <div className="text-[16px] font-bold text-ink mb-3">Promoções detectadas</div>
              <div className="flex flex-col gap-2.5">
                {promocoes.map((p, i) => (
                  <div key={i} className="bg-thead border border-line-soft rounded-[12px] p-3">
                    <div className="text-[14px] font-bold text-ink">{p.descricao}</div>
                    {(p.data_inicio || p.data_fim) && (
                      <div className="text-[12.5px] text-muted tnum mt-0.5">
                        {p.data_inicio || "—"} → {p.data_fim || "—"}
                      </div>
                    )}
                    {p.condicoes && (
                      <div className="text-[12.5px] text-body mt-0.5">{p.condicoes}</div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {modalAberto && (
        <div
          className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50"
          onClick={() => setModalAberto(false)}
        >
          <div
            className="bg-white rounded-[16px] border border-line w-full max-w-[640px] p-[22px] max-h-[90vh] overflow-auto shadow-[0_8px_22px_rgba(35,71,197,0.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[11px] font-bold tracking-[1.6px] uppercase text-royal mb-1">
              Nova versão
            </div>
            <h3 className="text-[18px] font-extrabold text-ink mb-4">Subir tabela de preços</h3>

            <Dropzone
              arquivo={arquivo}
              onArquivo={setArquivo}
              aceitar=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls"
              titulo="Arraste a tabela do empreendimento"
              dica="PDF, imagem, CSV ou Excel · IA lê o PDF"
            />
            <label className="flex items-start gap-2.5 mt-3 text-[13.5px] text-body cursor-pointer">
              <input
                type="checkbox"
                checked={extrairFicha}
                onChange={(e) => setExtrairFicha(e.target.checked)}
                className="accent-royal size-4 mt-0.5"
              />
              <span>
                <b>Extrair também ficha técnica</b> — se o book traz dados como
                bairro, padrão, vagas, datas e CNPJ, a IA atualiza esses campos do
                empreendimento de uma vez.
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <input
                value={versao}
                onChange={(e) => setVersao(e.target.value)}
                placeholder="Versão (ex.: Jun/2026)"
                className="w-full px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition"
              />
              <input
                value={dataRef}
                onChange={(e) => setDataRef(e.target.value)}
                type="date"
                placeholder="Data de referência"
                className="w-full px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition"
              />
            </div>

            {erro && (
              <div className="mt-3 rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line">
                {erro}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button variante="secondary" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button onClick={enviarTabela} disabled={enviando}>
                {enviando ? "Enviando…" : "Salvar tabela"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
