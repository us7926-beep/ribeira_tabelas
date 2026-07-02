"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Dropzone } from "@/components/ui/Dropzone";
import { KpiCard } from "@/components/ui/KpiCard";
import { KpiDelta } from "@/components/ui/KpiDelta";
import { exportarTabelaCsv } from "@/lib/csv";
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

interface PontoSerie {
  versao: string;
  data: string;
  pm2: number | null;
  ticket: number | null;
  vgv: number;
}

function moedaCompacta(n: number): string {
  if (n >= 1_000_000_000) return `R$ ${(n / 1_000_000_000).toFixed(1)} bi`;
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)} mi`;
  if (n >= 1000) return `R$ ${Math.round(n / 1000)} mil`;
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}

function moedaInt(n: number): string {
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}

/** Mini-sparkline para uma métrica (auto-normaliza no próprio range).
 * Mostra título, valor atual, delta vs início e linha + pontos. */
function MiniSpark({
  titulo,
  valores,
  labels,
  cor,
  fundo,
  formatar,
}: {
  titulo: string;
  valores: number[];
  labels: string[];
  cor: string;
  fundo: string;
  formatar: (n: number) => string;
}) {
  const W = 320;
  const H = 110;
  const padX = 16;
  const padY = 22;
  const minV = Math.min(...valores);
  const maxV = Math.max(...valores);
  const range = Math.max(1, maxV - minV);
  const xs = valores.map((_, i) =>
    valores.length > 1 ? padX + (i * (W - 2 * padX)) / (valores.length - 1) : W / 2,
  );
  const ys = valores.map((v) => H - padY - ((v - minV) / range) * (H - 2 * padY));
  const pontos = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  const areaPoligono = `${padX},${H - padY} ${pontos} ${W - padX},${H - padY}`;
  const atual = valores[valores.length - 1];
  const inicio = valores[0];
  const deltaPct = inicio === 0 ? 0 : ((atual - inicio) / inicio) * 100;
  const tomDelta =
    Math.abs(deltaPct) < 0.5 ? "text-muted" : deltaPct > 0 ? "text-up-strong" : "text-down-strong";
  const seta = Math.abs(deltaPct) < 0.5 ? "·" : deltaPct > 0 ? "▲" : "▼";

  return (
    <div className="rounded-[12px] border border-line-soft bg-white p-3">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div className="text-[11.5px] font-bold uppercase tracking-[0.4px] text-muted">
          {titulo}
        </div>
        <div className={`text-[12px] font-bold tnum ${tomDelta}`}>
          {seta} {Math.abs(deltaPct).toFixed(1)}%
        </div>
      </div>
      <div className="text-[18px] font-extrabold text-ink tnum mb-1">{formatar(atual)}</div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[100px]"
        preserveAspectRatio="none"
      >
        <polyline points={areaPoligono} fill={fundo} stroke="none" />
        <polyline points={pontos} fill="none" stroke={cor} strokeWidth={2} />
        {xs.map((x, i) => (
          <g key={i}>
            <circle cx={x} cy={ys[i]} r={3} fill={cor} stroke="#fff" strokeWidth={1.5} />
            <text
              x={x}
              y={H - 4}
              fill="#97A2B5"
              fontSize={9}
              fontWeight={600}
              textAnchor="middle"
            >
              {labels[i]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Trio de mini-sparklines: preço/m², ticket médio, VGV. Auto-normaliza
 * cada um no próprio range (escalas R$ muito diferentes entre eles). */
function SparklineTrio({ serie }: { serie: PontoSerie[] }) {
  const labels = serie.map((p) => p.versao);
  const pm2 = serie.map((p) => p.pm2).filter((v): v is number => v != null);
  const ticket = serie.map((p) => p.ticket).filter((v): v is number => v != null);
  const vgv = serie.map((p) => p.vgv);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {pm2.length >= 2 ? (
        <MiniSpark
          titulo="Preço/m² médio"
          valores={pm2}
          labels={labels.slice(0, pm2.length)}
          cor="#2347C5"
          fundo="#EAF0FE"
          formatar={moedaInt}
        />
      ) : (
        <div className="rounded-[12px] border border-line-soft bg-thead p-3 text-[12.5px] text-muted">
          Preço/m² indisponível (área das unidades não informada).
        </div>
      )}
      {ticket.length >= 2 ? (
        <MiniSpark
          titulo="Ticket médio"
          valores={ticket}
          labels={labels.slice(0, ticket.length)}
          cor="#15A34A"
          fundo="#E9FBF0"
          formatar={moedaCompacta}
        />
      ) : (
        <div className="rounded-[12px] border border-line-soft bg-thead p-3 text-[12.5px] text-muted">
          Ticket médio indisponível.
        </div>
      )}
      <MiniSpark
        titulo="VGV total"
        valores={vgv}
        labels={labels}
        cor="#E0B23A"
        fundo="#FBF3DD"
        formatar={moedaCompacta}
      />
    </div>
  );
}

/** Gera CSV das unidades e força download no browser. */
function baixarCsvUnidades(t: TabelaPrecos): void {
  const unidades = (t.unidades ?? []) as UnidadePreco[];
  if (unidades.length === 0) return;
  const colunas: { chave: string; label: string }[] = [
    { chave: "andar", label: "andar" },
    { chave: "unidade", label: "unidade" },
    { chave: "area_m2", label: "area_m2" },
    { chave: "vaga", label: "vaga" },
    { chave: "entrada", label: "entrada" },
    { chave: "parcelas_mensais", label: "parcelas_mensais" },
    { chave: "financiamento", label: "financiamento" },
    { chave: "preco_total", label: "preco_total" },
    { chave: "avaliacao", label: "avaliacao" },
  ];
  exportarTabelaCsv(
    `tabela-${t.versao.replace(/[\\/\s]+/g, "_")}.csv`,
    colunas,
    unidades,
  );
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
  // Sincronização de VSO com o CV CRM.
  const [sincronizando, setSincronizando] = useState(false);
  const [vsoResultado, setVsoResultado] = useState<{
    ok: boolean;
    texto: string;
  } | null>(null);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empreendimentoId]);

  async function sincronizarVsoCvcrm() {
    setSincronizando(true);
    setVsoResultado(null);
    try {
      const r = await fetch(
        `/api/empreendimentos/${empreendimentoId}/sincronizar-vso-cvcrm`,
        { method: "POST" },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Falha ao sincronizar");
      const c = d.contagem ?? {};
      setVsoResultado({
        ok: true,
        texto:
          `VSO ${c.vso}% — ${c.vendidas} vendidas / ${c.disponiveis} disponíveis` +
          (c.bloqueadas ? ` / ${c.bloqueadas} bloqueadas` : "") +
          ` de ${c.total_unidades} unidades.`,
      });
      router.refresh();
    } catch (e) {
      setVsoResultado({ ok: false, texto: (e as Error).message });
    } finally {
      setSincronizando(false);
    }
  }

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

  // Série dos 3 KPIs por versão (cronológica) — alimenta o SparklineTrio.
  const serie = useMemo<PontoSerie[]>(() => {
    return tabelas
      .slice()
      .reverse()
      .map((t) => {
        const k = kpisDaVersao(t);
        return {
          versao: t.versao,
          data: t.data_referencia,
          pm2: k.precoM2Medio,
          ticket: k.ticketMedio,
          vgv: k.vgvTotal,
        };
      });
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
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variante="secondary"
              onClick={sincronizarVsoCvcrm}
              disabled={sincronizando}
            >
              {sincronizando ? "Sincronizando…" : "↻ Sincronizar VSO do CV CRM"}
            </Button>
            <Button onClick={() => setModalAberto(true)}>+ Nova tabela</Button>
          </div>
        </div>

        {vsoResultado && (
          <div
            className={
              vsoResultado.ok
                ? "mt-3 rounded-[12px] bg-up-bg text-up-strong text-[13px] px-4 py-3 border border-up-line"
                : "mt-3 rounded-[12px] bg-down-bg text-down-strong text-[13px] px-4 py-3 border border-down-line"
            }
          >
            {vsoResultado.ok ? "✓ " : ""}
            {vsoResultado.texto}
          </div>
        )}

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

          {/* Trio de sparklines: preço/m², ticket, VGV (>= 2 versões). */}
          {serie.length >= 2 && (
            <Card variant="lg">
              <div className="text-[16px] font-bold text-ink mb-1">
                Evolução entre versões
              </div>
              <div className="text-[12.5px] text-muted mb-3">
                {serie.length} versão(ões) na linha do tempo · cada métrica se
                normaliza no próprio range, então as escalas diferentes (R$/m² vs VGV) ficam
                comparáveis lado a lado.
              </div>
              <SparklineTrio serie={serie} />
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
