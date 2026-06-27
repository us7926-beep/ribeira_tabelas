"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/Button";
import type { Empreendimento, TabelaPrecos, UnidadePreco } from "@/types";

interface Props {
  aberto: boolean;
  empreendimentos: Empreendimento[];
  onFechar: () => void;
  onConfirmar: (args: {
    empreendimentoId: string;
    empreendimentoNome: string;
    unidadeLabel: string;
    valorUnidade: number;
  }) => void;
}

const campo =
  "px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition";

function moeda(n: number): string {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function labelUnidade(u: UnidadePreco): string {
  const partes: string[] = [];
  if (u.andar) partes.push(`${u.andar}º`);
  if (u.unidade) partes.push(String(u.unidade));
  if (u.area_m2) partes.push(`${u.area_m2}m²`);
  return partes.join(" · ") || "Unidade";
}

/** Modal específico (padrão ModalEvento) para escolher empreendimento +
 * unidade antes de adicionar uma linha no Simulador. Carrega unidades
 * via /api/empreendimentos/{id}/tabelas-precos (versão mais recente
 * [0].unidades[] — não existe endpoint /unidades dedicado). */
export function ModalSelecionarUnidade({
  aberto,
  empreendimentos,
  onFechar,
  onConfirmar,
}: Props) {
  const [empId, setEmpId] = useState("");
  const [unidades, setUnidades] = useState<UnidadePreco[]>([]);
  const [unidadeIdx, setUnidadeIdx] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!aberto) {
      setEmpId("");
      setUnidades([]);
      setUnidadeIdx(null);
      setErro(null);
    }
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  useEffect(() => {
    if (!empId) {
      setUnidades([]);
      setUnidadeIdx(null);
      return;
    }
    setCarregando(true);
    setErro(null);
    (async () => {
      try {
        const r = await fetch(`/api/empreendimentos/${empId}/tabelas-precos`);
        const d = await r.json();
        if (!r.ok) throw new Error(d?.detail ?? `Erro ${r.status}`);
        const tabelas = d as TabelaPrecos[];
        const ultima = tabelas[0];
        const us = (ultima?.unidades ?? []).filter(
          (u) => typeof u.preco_total === "number" && u.preco_total > 0,
        );
        setUnidades(us as UnidadePreco[]);
        setUnidadeIdx(us.length > 0 ? 0 : null);
      } catch (e) {
        setErro((e as Error).message);
        setUnidades([]);
      } finally {
        setCarregando(false);
      }
    })();
  }, [empId]);

  const empNome = useMemo(
    () => empreendimentos.find((e) => e.id === empId)?.nome ?? "",
    [empreendimentos, empId],
  );

  if (!aberto || !mounted) return null;

  function confirmar() {
    if (!empId || unidadeIdx == null) return;
    const u = unidades[unidadeIdx];
    if (!u || typeof u.preco_total !== "number") return;
    onConfirmar({
      empreendimentoId: empId,
      empreendimentoNome: empNome,
      unidadeLabel: labelUnidade(u),
      valorUnidade: u.preco_total,
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 backdrop-blur-sm overflow-y-auto p-4 sm:p-8"
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Selecionar empreendimento e unidade"
        className="w-full max-w-[520px] bg-white rounded-[16px] shadow-card p-6 mt-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-[11px] font-bold tracking-[1.4px] uppercase text-royal">
              Simulador
            </div>
            <div className="text-[20px] font-extrabold text-ink mt-1">
              Adicionar empreendimento
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onFechar}
            className="text-[20px] leading-none text-muted hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold text-body uppercase tracking-[0.4px]">
              Empreendimento
            </span>
            <select
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              className={campo}
            >
              <option value="">Selecione…</option>
              {empreendimentos.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nome}
                </option>
              ))}
            </select>
          </label>

          {empId && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-bold text-body uppercase tracking-[0.4px]">
                Unidade
              </span>
              {carregando ? (
                <div className="text-[13.5px] text-muted">Carregando unidades…</div>
              ) : erro ? (
                <div className="text-[13.5px] text-down-strong">{erro}</div>
              ) : unidades.length === 0 ? (
                <div className="text-[13.5px] text-muted">
                  Empreendimento sem tabela de preços com unidades.
                </div>
              ) : (
                <select
                  value={unidadeIdx ?? ""}
                  onChange={(e) => setUnidadeIdx(Number(e.target.value))}
                  className={campo}
                >
                  {unidades.map((u, i) => (
                    <option key={`${u.andar ?? ""}-${u.unidade ?? ""}-${i}`} value={i}>
                      {labelUnidade(u)} — {moeda(u.preco_total ?? 0)}
                    </option>
                  ))}
                </select>
              )}
            </label>
          )}

          <div className="flex justify-end gap-2 mt-3">
            <Button variante="secondary" onClick={onFechar}>
              Cancelar
            </Button>
            <Button
              onClick={confirmar}
              disabled={!empId || unidadeIdx == null || unidades.length === 0}
            >
              Adicionar linha
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
