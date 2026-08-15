"use client";

import { useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import type { Empreendimento, TabelaPrecos, UnidadePreco } from "@/types";

interface Props {
  empreendimentos: Empreendimento[];
}

interface EstadoTabela {
  carregando: boolean;
  erro: string;
  versao?: TabelaPrecos;
}

function moeda(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}

function moedaDecimal(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return "R$ " + n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function pM2(u: UnidadePreco): number | null {
  const preco = typeof u.preco_total === "number" ? u.preco_total : null;
  const area = typeof u.area_m2 === "number" ? u.area_m2 : null;
  if (!preco || !area || area <= 0) return null;
  return preco / area;
}

function rotuloUnidade(u: UnidadePreco): string {
  const partes = [u.andar, u.unidade].filter((p) => p && String(p).trim()).map(String);
  if (partes.length === 0) return "sem id";
  return partes.join(" · ");
}

export function ComparativoUnidades({ empreendimentos }: Props) {
  const [tabelas, setTabelas] = useState<Record<string, EstadoTabela>>({});
  /** Chave: `${empreendimentoId}::${indexUnidade}` -> selecionada. */
  const [selecao, setSelecao] = useState<Set<string>>(new Set());

  useEffect(() => {
    const abortadores: AbortController[] = [];
    setTabelas(Object.fromEntries(empreendimentos.map((e) => [e.id, { carregando: true, erro: "" }])));
    empreendimentos.forEach((e) => {
      const controller = new AbortController();
      abortadores.push(controller);
      fetch(`/api/empreendimentos/${e.id}/tabelas-precos`, { signal: controller.signal })
        .then(async (r) => {
          if (!r.ok) throw new Error(`Erro ${r.status}`);
          const lista: TabelaPrecos[] = await r.json();
          const versao = lista?.[0];
          setTabelas((atual) => ({
            ...atual,
            [e.id]: { carregando: false, erro: "", versao },
          }));
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          setTabelas((atual) => ({
            ...atual,
            [e.id]: { carregando: false, erro: (err as Error).message },
          }));
        });
    });
    return () => abortadores.forEach((a) => a.abort());
  }, [empreendimentos]);

  function alternarUnidade(chave: string) {
    setSelecao((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });
  }

  function marcarTodas(empId: string, unidades: UnidadePreco[]) {
    setSelecao((atual) => {
      const proximo = new Set(atual);
      unidades.forEach((_, i) => proximo.add(`${empId}::${i}`));
      return proximo;
    });
  }

  function desmarcarTodas(empId: string) {
    setSelecao((atual) => {
      const proximo = new Set(atual);
      [...proximo].forEach((k) => {
        if (k.startsWith(`${empId}::`)) proximo.delete(k);
      });
      return proximo;
    });
  }

  function limparTudo() {
    setSelecao(new Set());
  }

  const selecionadas = useMemo(() => {
    const linhas: Array<{
      empreendimento: Empreendimento;
      indice: number;
      unidade: UnidadePreco;
      pm2: number | null;
    }> = [];
    empreendimentos.forEach((e) => {
      const tabela = tabelas[e.id]?.versao;
      const unidades = (tabela?.unidades ?? []) as UnidadePreco[];
      unidades.forEach((u, i) => {
        if (selecao.has(`${e.id}::${i}`)) {
          linhas.push({ empreendimento: e, indice: i, unidade: u, pm2: pM2(u) });
        }
      });
    });
    return linhas;
  }, [empreendimentos, tabelas, selecao]);

  const totalSelecionadas = selecionadas.length;

  // Líder por métrica (menor preço/m² = líder; maior área = líder).
  const menorPm2 = useMemo(() => {
    const validos = selecionadas.map((s) => s.pm2).filter((n): n is number => n != null);
    return validos.length >= 2 ? Math.min(...validos) : null;
  }, [selecionadas]);

  return (
    <div className="flex flex-col gap-5">
      <Card variant="lg" className="tablm-up">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <div className="text-[12px] font-bold tracking-[1.4px] uppercase text-royal">
              Passo 1
            </div>
            <div className="text-[18px] font-extrabold text-ink mt-1">
              Escolha as unidades para comparar
            </div>
            <div className="text-[13px] text-muted mt-1">
              Cada coluna mostra as unidades da versão mais recente da tabela.
              Marque quantas quiser em cada empreendimento — total selecionadas:{" "}
              <b className="text-ink">{totalSelecionadas}</b>.
            </div>
          </div>
          {totalSelecionadas > 0 && (
            <button
              type="button"
              onClick={limparTudo}
              className="text-[13px] font-semibold text-royal hover:underline"
            >
              Limpar seleção
            </button>
          )}
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${empreendimentos.length}, minmax(220px, 1fr))` }}>
          {empreendimentos.map((e) => {
            const estado = tabelas[e.id];
            const unidades = (estado?.versao?.unidades ?? []) as UnidadePreco[];
            const marcadas = unidades.reduce(
              (n, _, i) => n + (selecao.has(`${e.id}::${i}`) ? 1 : 0),
              0,
            );
            return (
              <div key={e.id} className="rounded-[12px] border border-line bg-thead flex flex-col min-h-0">
                <div className="px-4 py-3 border-b border-line-soft">
                  <div className="text-[13px] font-bold text-ink truncate">{e.nome}</div>
                  <div className="text-[11.5px] text-muted truncate">
                    {[e.bairro, e.cidade, e.padrao].filter(Boolean).join(" · ") || "—"}
                  </div>
                  {estado?.versao?.versao && (
                    <div className="text-[11px] text-muted mt-1">
                      Versão: <b>{estado.versao.versao}</b>
                    </div>
                  )}
                </div>
                {estado?.carregando ? (
                  <div className="px-4 py-3 text-[12.5px] text-muted">Carregando…</div>
                ) : estado?.erro ? (
                  <div className="px-4 py-3 text-[12.5px] text-down-strong">{estado.erro}</div>
                ) : unidades.length === 0 ? (
                  <div className="px-4 py-3 text-[12.5px] text-muted">
                    Nenhuma tabela de preços cadastrada.
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-2 flex items-center justify-between gap-2 text-[11.5px]">
                      <span className="text-muted">
                        {marcadas} de {unidades.length}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => marcarTodas(e.id, unidades)}
                          className="font-semibold text-royal hover:underline"
                        >
                          Marcar todas
                        </button>
                        <button
                          type="button"
                          onClick={() => desmarcarTodas(e.id)}
                          className="font-semibold text-muted hover:text-ink hover:underline"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>
                    <ul className="flex-1 overflow-y-auto max-h-[320px] divide-y divide-line-soft bg-white">
                      {unidades.map((u, i) => {
                        const chave = `${e.id}::${i}`;
                        const marcado = selecao.has(chave);
                        return (
                          <li key={chave}>
                            <label
                              className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-thead text-[12.5px] ${
                                marcado ? "bg-royal-tint/40" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={marcado}
                                onChange={() => alternarUnidade(chave)}
                                className="size-3.5 accent-royal shrink-0"
                              />
                              <span className="flex-1 min-w-0 truncate font-semibold text-ink">
                                {rotuloUnidade(u)}
                              </span>
                              <span className="text-[11.5px] text-muted tnum shrink-0">
                                {typeof u.area_m2 === "number" ? `${u.area_m2}m²` : ""}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card variant="lg">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <div className="text-[12px] font-bold tracking-[1.4px] uppercase text-royal">
              Passo 2
            </div>
            <div className="text-[18px] font-extrabold text-ink mt-1">
              Tabela consolidada
            </div>
            <div className="text-[13px] text-muted mt-1">
              Unidades marcadas lado a lado. Célula verde marca o menor
              preço/m² quando há 2 ou mais para comparar.
            </div>
          </div>
        </div>
        {totalSelecionadas === 0 ? (
          <div className="text-[13.5px] text-muted py-6 text-center">
            Marque unidades acima para comparar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-thead text-muted">
                <tr>
                  <th className="text-left font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-3 sticky left-0 bg-thead min-w-[220px]">
                    Empreendimento · Unidade
                  </th>
                  <th className="text-right font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-3">
                    Área
                  </th>
                  <th className="text-right font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-3">
                    Preço
                  </th>
                  <th className="text-right font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-3">
                    Preço/m²
                  </th>
                  <th className="text-right font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-3">
                    Entrada
                  </th>
                  <th className="text-right font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-3">
                    Mensais
                  </th>
                  <th className="text-right font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-3">
                    Financiamento
                  </th>
                </tr>
              </thead>
              <tbody>
                {selecionadas.map((s, i) => {
                  const ehLider = menorPm2 != null && s.pm2 === menorPm2;
                  return (
                    <tr
                      key={`${s.empreendimento.id}::${s.indice}::${i}`}
                      className="border-t border-line-soft"
                    >
                      <td className="px-3 py-3 sticky left-0 bg-white">
                        <div className="font-semibold text-ink truncate max-w-[220px]">
                          {rotuloUnidade(s.unidade)}
                        </div>
                        <div className="text-[11.5px] text-muted truncate max-w-[220px]">
                          {s.empreendimento.nome}
                        </div>
                      </td>
                      <td className="px-3 py-3 tnum text-right">
                        {typeof s.unidade.area_m2 === "number"
                          ? `${s.unidade.area_m2} m²`
                          : "—"}
                      </td>
                      <td className="px-3 py-3 tnum text-right">
                        {moeda(s.unidade.preco_total ?? null)}
                      </td>
                      <td
                        className={
                          ehLider
                            ? "px-3 py-3 tnum text-right font-extrabold text-up-strong bg-up-bg"
                            : "px-3 py-3 tnum text-right"
                        }
                      >
                        <span className="inline-flex items-center gap-1.5 justify-end">
                          {s.pm2 != null ? moedaDecimal(s.pm2) : "—"}
                          {ehLider && <Chip tom="up">menor</Chip>}
                        </span>
                      </td>
                      <td className="px-3 py-3 tnum text-right">
                        {moeda(s.unidade.entrada ?? null)}
                      </td>
                      <td className="px-3 py-3 tnum text-right">
                        {moeda(s.unidade.parcelas_mensais ?? null)}
                      </td>
                      <td className="px-3 py-3 tnum text-right">
                        {moeda(s.unidade.financiamento ?? null)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
