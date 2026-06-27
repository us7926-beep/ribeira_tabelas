"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { KpiCard } from "@/components/ui/KpiCard";
import { baixarCsv, montarCsv } from "@/lib/csv";
import type { Empreendimento, Incorporadora } from "@/types";

interface Props {
  empreendimentos: Empreendimento[];
  incorporadoras: Incorporadora[];
  incorporadoraIdInicial?: string;
  padraoInicial?: string;
  cidadeInicial?: string;
  bairroInicial?: string;
  buscaInicial?: string;
}

const TODAS = "todas";
const TODOS = "todos";

function moedaCurta(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000) return `R$ ${(n / 1_000_000_000).toFixed(1)} bi`;
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)} mi`;
  if (n >= 1000) return `R$ ${Math.round(n / 1000)} mil`;
  return `R$ ${Math.round(n)}`;
}

export function ListaGlobalEmpreendimentos({
  empreendimentos,
  incorporadoras,
  incorporadoraIdInicial,
  padraoInicial,
  cidadeInicial,
  bairroInicial,
  buscaInicial,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [busca, setBusca] = useState(buscaInicial ?? "");
  const [incorporadoraId, setIncorporadoraId] = useState(incorporadoraIdInicial ?? TODAS);
  const [padrao, setPadrao] = useState(padraoInicial ?? TODOS);
  const [cidade, setCidade] = useState(cidadeInicial ?? TODOS);
  const [bairro, setBairro] = useState(bairroInicial ?? TODOS);

  const atualizarUrl = useCallback(
    (chave: string, valor: string, vazio: string) => {
      const params = new URLSearchParams(sp?.toString() ?? "");
      if (!valor || valor === vazio) params.delete(chave);
      else params.set(chave, valor);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, sp],
  );

  const mapInc = useMemo(
    () => new Map(incorporadoras.map((i) => [i.id, i])),
    [incorporadoras],
  );

  const padroes = useMemo(() => {
    const s = new Set<string>();
    for (const e of empreendimentos) if (e.padrao) s.add(e.padrao);
    return Array.from(s).sort();
  }, [empreendimentos]);

  const cidades = useMemo(() => {
    const s = new Set<string>();
    for (const e of empreendimentos) if (e.cidade) s.add(e.cidade);
    return Array.from(s).sort();
  }, [empreendimentos]);

  const bairros = useMemo(() => {
    const s = new Set<string>();
    for (const e of empreendimentos) {
      if (!e.bairro) continue;
      if (cidade !== TODOS && e.cidade !== cidade) continue;
      s.add(e.bairro);
    }
    return Array.from(s).sort();
  }, [empreendimentos, cidade]);

  const incsOrdenadas = useMemo(
    () => [...incorporadoras].sort((a, b) => a.nome.localeCompare(b.nome)),
    [incorporadoras],
  );

  const filtroAtivo =
    busca.trim() !== "" ||
    incorporadoraId !== TODAS ||
    padrao !== TODOS ||
    cidade !== TODOS ||
    bairro !== TODOS;

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return empreendimentos.filter((e) => {
      if (incorporadoraId !== TODAS && e.incorporadora_id !== incorporadoraId) return false;
      if (padrao !== TODOS && e.padrao !== padrao) return false;
      if (cidade !== TODOS && e.cidade !== cidade) return false;
      if (bairro !== TODOS && e.bairro !== bairro) return false;
      if (!termo) return true;
      const inc = mapInc.get(e.incorporadora_id);
      return (
        e.nome.toLowerCase().includes(termo) ||
        (e.bairro ?? "").toLowerCase().includes(termo) ||
        (e.cidade ?? "").toLowerCase().includes(termo) ||
        (inc?.nome ?? "").toLowerCase().includes(termo)
      );
    });
  }, [empreendimentos, busca, incorporadoraId, padrao, cidade, bairro, mapInc]);

  function limparFiltros() {
    setBusca("");
    setIncorporadoraId(TODAS);
    setPadrao(TODOS);
    setCidade(TODOS);
    setBairro(TODOS);
    router.replace(pathname, { scroll: false });
  }

  function exportarCsv() {
    if (filtrados.length === 0) return;
    const cabecalho = [
      "nome",
      "incorporadora",
      "cidade",
      "bairro",
      "padrao",
      "preco_m2_medio",
      "ticket_medio",
      "vgv_total",
      "vso",
      "unidades_vendidas",
      "unidades_disponiveis",
      "total_unidades",
    ];
    const linhas = filtrados.map((e) => [
      e.nome,
      mapInc.get(e.incorporadora_id)?.nome ?? "",
      e.cidade ?? "",
      e.bairro ?? "",
      e.padrao ?? "",
      e.preco_m2_medio ?? "",
      e.ticket_medio ?? "",
      e.vgv_total ?? "",
      e.vso ?? "",
      e.unidades_vendidas ?? "",
      e.unidades_disponiveis ?? "",
      e.total_unidades_calc ?? e.total_unidades ?? "",
    ]);
    baixarCsv("empreendimentos-global.csv", montarCsv(cabecalho, linhas));
  }

  // KPIs do subset visível
  const kpis = useMemo(() => {
    const vgv = filtrados.reduce((a, e) => a + (e.vgv_total ?? 0), 0);
    const vsoMedio =
      filtrados.length > 0
        ? Math.round(
            filtrados.reduce((a, e) => a + (e.vso ?? 0), 0) / filtrados.length,
          )
        : 0;
    const ticketMedio =
      filtrados.length > 0
        ? Math.round(
            filtrados.reduce((a, e) => a + (e.ticket_medio ?? 0), 0) / filtrados.length,
          )
        : 0;
    return { vgv, vsoMedio, ticketMedio };
  }, [filtrados]);

  return (
    <div className="flex flex-col gap-5 tablm-up">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          placeholder={`🔍 Buscar entre ${empreendimentos.length} empreendimento(s)…`}
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            atualizarUrl("q", e.target.value, "");
          }}
          className="flex-1 max-w-[420px] px-[15px] py-[10px] rounded-[12px] border border-line bg-white text-[13.5px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition"
        />
        <span className="text-[12.5px] text-muted">
          {filtrados.length} de {empreendimentos.length}
        </span>
        <div className="ml-auto">
          <button
            type="button"
            onClick={exportarCsv}
            disabled={filtrados.length === 0}
            className="text-[12.5px] font-bold text-royal hover:underline disabled:text-faint disabled:no-underline"
          >
            Baixar CSV
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <select
          value={incorporadoraId}
          onChange={(e) => {
            setIncorporadoraId(e.target.value);
            atualizarUrl("inc", e.target.value, TODAS);
          }}
          className="px-[14px] py-[9px] rounded-[12px] border border-line bg-white text-[13.5px] text-ink outline-none focus:border-royal"
        >
          <option value={TODAS}>Todas incorporadoras</option>
          {incsOrdenadas.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nome}
            </option>
          ))}
        </select>
        <select
          value={padrao}
          onChange={(e) => {
            setPadrao(e.target.value);
            atualizarUrl("padrao", e.target.value, TODOS);
          }}
          className="px-[14px] py-[9px] rounded-[12px] border border-line bg-white text-[13.5px] text-ink outline-none focus:border-royal"
        >
          <option value={TODOS}>Todos padrões</option>
          {padroes.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={cidade}
          onChange={(e) => {
            setCidade(e.target.value);
            atualizarUrl("cidade", e.target.value, TODOS);
            // Reseta bairro quando troca cidade
            if (bairro !== TODOS) {
              setBairro(TODOS);
              atualizarUrl("bairro", "", TODOS);
            }
          }}
          className="px-[14px] py-[9px] rounded-[12px] border border-line bg-white text-[13.5px] text-ink outline-none focus:border-royal"
        >
          <option value={TODOS}>Todas cidades</option>
          {cidades.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={bairro}
          onChange={(e) => {
            setBairro(e.target.value);
            atualizarUrl("bairro", e.target.value, TODOS);
          }}
          disabled={bairros.length === 0}
          className="px-[14px] py-[9px] rounded-[12px] border border-line bg-white text-[13.5px] text-ink outline-none focus:border-royal disabled:opacity-50"
        >
          <option value={TODOS}>Todos bairros</option>
          {bairros.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        {filtroAtivo && (
          <button
            onClick={limparFiltros}
            className="text-[12.5px] font-bold text-royal hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <KpiCard
          rotulo="Empreendimentos"
          valor={String(filtrados.length)}
          hint={
            filtroAtivo
              ? `subset filtrado (${empreendimentos.length} no total)`
              : "total da carteira"
          }
        />
        <KpiCard rotulo="VGV somado" valor={moedaCurta(kpis.vgv)} />
        <KpiCard
          rotulo="Ticket médio"
          valor={moedaCurta(kpis.ticketMedio)}
          hint={`VSO médio ${kpis.vsoMedio}%`}
        />
      </div>

      {filtrados.length === 0 ? (
        <Card>
          <div className="text-[13.5px] text-muted">
            Nenhum empreendimento bate com os filtros. Use{" "}
            <button onClick={limparFiltros} className="text-royal font-semibold hover:underline">
              limpar filtros
            </button>{" "}
            ou cadastre novos pela{" "}
            <Link href="/incorporadoras" className="text-royal font-semibold">
              Carteira
            </Link>
            .
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtrados.map((emp) => {
            const inc = mapInc.get(emp.incorporadora_id);
            return (
              <Link
                key={emp.id}
                href={`/empreendimentos/${emp.id}`}
                className="bg-white border border-line rounded-[14px] p-[18px_20px] shadow-[0_1px_3px_rgba(20,40,90,0.05)] hover:border-royal transition-colors block"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="font-bold text-ink text-[15px] min-w-0 truncate">
                    {emp.nome}
                  </div>
                  {emp.padrao && <Chip tom="royal">{emp.padrao}</Chip>}
                </div>
                <div className="text-[12.5px] text-faint">
                  {[emp.bairro, emp.cidade].filter(Boolean).join(" · ") || "—"}
                  {inc && (
                    <>
                      {" · "}
                      <span className="text-muted">{inc.nome}</span>
                    </>
                  )}
                </div>
                <div className="flex gap-4 mt-3 text-[12px] tnum">
                  <div>
                    <span className="text-muted">VSO </span>
                    <span className="font-bold text-ink">
                      {emp.vso != null ? `${Math.round(emp.vso)}%` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted">Ticket </span>
                    <span className="font-bold text-ink">{moedaCurta(emp.ticket_medio)}</span>
                  </div>
                  <div>
                    <span className="text-muted">VGV </span>
                    <span className="font-bold text-ink">{moedaCurta(emp.vgv_total)}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
