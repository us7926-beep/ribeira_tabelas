"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Tabs } from "@/components/ui/Tabs";
import { diasAteVencer } from "@/lib/promocoes";
import type { Empreendimento, EventoPromocional, Incorporadora } from "@/types";

interface Props {
  eventos: EventoPromocional[];
  empreendimentos: Empreendimento[];
  incorporadoras: Incorporadora[];
  statusInicial?: string;
  incorporadoraIdInicial?: string;
  padraoInicial?: string;
  buscaInicial?: string;
}

type Filtro = "ativas" | "vencendo" | "todas" | "expiradas";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "ativas", label: "Ativas" },
  { id: "vencendo", label: "Vencendo em 7d" },
  { id: "todas", label: "Todas" },
  { id: "expiradas", label: "Expiradas" },
];

const TODAS_INCS = "todas";
const TODOS_PADROES = "todos";

function ehFiltroValido(v: string | undefined): v is Filtro {
  return v === "ativas" || v === "vencendo" || v === "todas" || v === "expiradas";
}

function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function ListaPromocoes({
  eventos,
  empreendimentos,
  incorporadoras,
  statusInicial,
  incorporadoraIdInicial,
  padraoInicial,
  buscaInicial,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [filtro, setFiltro] = useState<Filtro>(
    ehFiltroValido(statusInicial) ? statusInicial : "ativas",
  );
  const [busca, setBusca] = useState(buscaInicial ?? "");
  const [incorporadoraId, setIncorporadoraId] = useState(
    incorporadoraIdInicial ?? TODAS_INCS,
  );
  const [padrao, setPadrao] = useState(padraoInicial ?? TODOS_PADROES);

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

  function trocarFiltro(f: Filtro) {
    setFiltro(f);
    atualizarUrl("status", f === "ativas" ? "" : f, "");
  }
  function trocarBusca(v: string) {
    setBusca(v);
    atualizarUrl("q", v, "");
  }
  function trocarIncorporadora(v: string) {
    setIncorporadoraId(v);
    atualizarUrl("inc", v, TODAS_INCS);
  }
  function trocarPadrao(v: string) {
    setPadrao(v);
    atualizarUrl("padrao", v, TODOS_PADROES);
  }
  function limparFiltros() {
    setFiltro("ativas");
    setBusca("");
    setIncorporadoraId(TODAS_INCS);
    setPadrao(TODOS_PADROES);
    router.replace(pathname, { scroll: false });
  }

  const mapEmp = useMemo(
    () => new Map(empreendimentos.map((e) => [e.id, e])),
    [empreendimentos],
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

  const incsOrdenadas = useMemo(
    () => [...incorporadoras].sort((a, b) => a.nome.localeCompare(b.nome)),
    [incorporadoras],
  );

  const filtroAtivo =
    filtro !== "ativas" ||
    busca.trim() !== "" ||
    incorporadoraId !== TODAS_INCS ||
    padrao !== TODOS_PADROES;

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return eventos
      .filter((ev) => {
        const dias = diasAteVencer(ev.data_fim);
        if (filtro === "ativas") return dias !== null && dias >= 0;
        if (filtro === "vencendo") return dias !== null && dias >= 0 && dias <= 7;
        if (filtro === "expiradas") return dias !== null && dias < 0;
        return true;
      })
      .filter((ev) => {
        if (incorporadoraId === TODAS_INCS) return true;
        const emp = mapEmp.get(ev.empreendimento_id);
        return emp?.incorporadora_id === incorporadoraId;
      })
      .filter((ev) => {
        if (padrao === TODOS_PADROES) return true;
        const emp = mapEmp.get(ev.empreendimento_id);
        return emp?.padrao === padrao;
      })
      .filter((ev) => {
        if (!termo) return true;
        const emp = mapEmp.get(ev.empreendimento_id);
        const inc = emp ? mapInc.get(emp.incorporadora_id) : undefined;
        return (
          (emp?.nome ?? "").toLowerCase().includes(termo) ||
          (inc?.nome ?? "").toLowerCase().includes(termo) ||
          (ev.descricao ?? "").toLowerCase().includes(termo) ||
          (ev.condicoes_comerciais ?? "").toLowerCase().includes(termo)
        );
      })
      .sort((a, b) => {
        const da = diasAteVencer(a.data_fim) ?? Number.POSITIVE_INFINITY;
        const db = diasAteVencer(b.data_fim) ?? Number.POSITIVE_INFINITY;
        return da - db;
      });
  }, [eventos, filtro, busca, incorporadoraId, padrao, mapEmp, mapInc]);

  const contagem = useMemo(() => {
    const c = { ativas: 0, vencendo: 0, expiradas: 0 };
    for (const ev of eventos) {
      const d = diasAteVencer(ev.data_fim);
      if (d === null) continue;
      if (d >= 0) c.ativas += 1;
      if (d >= 0 && d <= 7) c.vencendo += 1;
      if (d < 0) c.expiradas += 1;
    }
    return c;
  }, [eventos]);

  return (
    <div className="flex flex-col gap-5 tablm-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs abas={FILTROS} ativa={filtro} onTrocar={trocarFiltro} />
        <input
          placeholder="Buscar empreendimento, incorporadora ou condição…"
          value={busca}
          onChange={(e) => trocarBusca(e.target.value)}
          className="flex-1 max-w-[420px] px-[15px] py-[10px] rounded-[12px] border border-line bg-white text-[13.5px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition"
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={incorporadoraId}
          onChange={(e) => trocarIncorporadora(e.target.value)}
          className="px-[14px] py-[9px] rounded-[12px] border border-line bg-white text-[13.5px] text-ink outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition"
        >
          <option value={TODAS_INCS}>Todas incorporadoras</option>
          {incsOrdenadas.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nome}
            </option>
          ))}
        </select>
        <select
          value={padrao}
          onChange={(e) => trocarPadrao(e.target.value)}
          className="px-[14px] py-[9px] rounded-[12px] border border-line bg-white text-[13.5px] text-ink outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition"
        >
          <option value={TODOS_PADROES}>Todos padrões</option>
          {padroes.map((p) => (
            <option key={p} value={p}>
              {p}
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="rounded-[12px] bg-up-bg border border-up-line px-4 py-3">
          <div className="text-[12px] font-bold uppercase tracking-[0.5px] text-up-strong">
            Ativas
          </div>
          <div className="text-[26px] font-extrabold text-up-strong tnum mt-1">
            {contagem.ativas}
          </div>
        </div>
        <div className="rounded-[12px] bg-warn-bg border border-warn-line px-4 py-3">
          <div className="text-[12px] font-bold uppercase tracking-[0.5px] text-warn-strong">
            Vencendo 7d
          </div>
          <div className="text-[26px] font-extrabold text-warn-strong tnum mt-1">
            {contagem.vencendo}
          </div>
        </div>
        <div className="rounded-[12px] bg-down-bg border border-down-line px-4 py-3">
          <div className="text-[12px] font-bold uppercase tracking-[0.5px] text-down-strong">
            Expiradas
          </div>
          <div className="text-[26px] font-extrabold text-down-strong tnum mt-1">
            {contagem.expiradas}
          </div>
        </div>
        <div className="rounded-[12px] bg-thead border border-line px-4 py-3">
          <div className="text-[12px] font-bold uppercase tracking-[0.5px] text-muted">
            Total
          </div>
          <div className="text-[26px] font-extrabold text-ink tnum mt-1">
            {eventos.length}
          </div>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <Card>
          <div className="text-[13.5px] text-muted">
            Nenhuma promoção para o filtro selecionado. Tente outro filtro ou registre
            eventos pelo <Link href="/flyers" className="text-royal font-semibold">
              Análise por IA
            </Link>.
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filtrados.map((ev) => {
            const emp = mapEmp.get(ev.empreendimento_id);
            const inc = emp ? mapInc.get(emp.incorporadora_id) : undefined;
            const dias = diasAteVencer(ev.data_fim);
            let tom: "up" | "warn" | "down" | "neutro" = "neutro";
            let rotulo = "Sem prazo";
            if (dias !== null) {
              if (dias < 0) {
                tom = "down";
                rotulo = `Expirou há ${Math.abs(dias)} dia(s)`;
              } else if (dias === 0) {
                tom = "down";
                rotulo = "Expira hoje";
              } else if (dias <= 7) {
                tom = "warn";
                rotulo = `Expira em ${dias} dia(s)`;
              } else {
                tom = "up";
                rotulo = `Expira em ${dias} dia(s)`;
              }
            }
            return (
              <Card key={ev.id}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {emp ? (
                        <Link
                          href={`/empreendimentos/${emp.id}`}
                          className="text-[15px] font-bold text-ink hover:text-royal hover:underline"
                        >
                          {emp.nome}
                        </Link>
                      ) : (
                        <span className="text-[15px] font-bold text-ink">
                          Empreendimento
                        </span>
                      )}
                      {inc && (
                        <span className="text-[12.5px] text-muted">· {inc.nome}</span>
                      )}
                      <Chip tom={tom}>{rotulo}</Chip>
                    </div>
                    <div className="text-[13.5px] text-body leading-relaxed">
                      {ev.descricao || ev.condicoes_comerciais || "Promoção sem descrição"}
                    </div>
                    <div className="text-[12px] text-faint mt-2 tnum">
                      {dataBR(ev.data_inicio)} → {dataBR(ev.data_fim)}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
