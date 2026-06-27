"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import type { Empreendimento, EventoPromocional } from "@/types";

interface Props {
  aberto: boolean;
  /** Quando definido, abre em modo edição. Sem ele, criar novo. */
  evento?: EventoPromocional | null;
  empreendimentos: Empreendimento[];
  /** Pré-selecionar empreendimento quando criar do zero (ex.: vindo de um card). */
  empreendimentoIdInicial?: string;
  onFechar: () => void;
  /** Avisado após salvar/deletar com sucesso para o pai recarregar a lista. */
  onMudou: () => void;
}

export function ModalEvento({
  aberto,
  evento,
  empreendimentos,
  empreendimentoIdInicial,
  onFechar,
  onMudou,
}: Props) {
  const modoEdicao = !!evento;
  const [empId, setEmpId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [condicoes, setCondicoes] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!aberto) return;
    setErro("");
    if (evento) {
      setEmpId(evento.empreendimento_id);
      setDescricao(evento.descricao ?? "");
      setCondicoes(evento.condicoes_comerciais ?? "");
      setDataInicio((evento.data_inicio ?? "").slice(0, 10));
      setDataFim((evento.data_fim ?? "").slice(0, 10));
    } else {
      setEmpId(empreendimentoIdInicial ?? "");
      setDescricao("");
      setCondicoes("");
      setDataInicio("");
      setDataFim("");
    }
  }, [aberto, evento, empreendimentoIdInicial]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !salvando && !excluindo) onFechar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberto, salvando, excluindo, onFechar]);

  if (!aberto) return null;

  async function salvar() {
    if (!empId) {
      setErro("Selecione um empreendimento.");
      return;
    }
    if (dataInicio && dataFim && dataFim < dataInicio) {
      setErro("Data fim não pode ser anterior à data início.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const corpo: Record<string, unknown> = {
        empreendimento_id: empId,
        descricao: descricao.trim() || null,
        condicoes_comerciais: condicoes.trim() || null,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
      };
      const url = modoEdicao
        ? `/api/benchmark/eventos/${evento!.id}`
        : `/api/benchmark/eventos`;
      const r = await fetch(url, {
        method: modoEdicao ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Falha ao salvar");
      onMudou();
      onFechar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!evento) return;
    if (!confirm("Excluir esta promoção? A ação não pode ser desfeita.")) return;
    setExcluindo(true);
    setErro("");
    try {
      const r = await fetch(`/api/benchmark/eventos/${evento.id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail ?? "Falha ao excluir");
      }
      onMudou();
      onFechar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 backdrop-blur-sm overflow-y-auto p-4 sm:p-8"
      onClick={() => !salvando && !excluindo && onFechar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={modoEdicao ? "Editar promoção" : "Nova promoção"}
        className="w-full max-w-[520px] bg-white rounded-[16px] shadow-card p-6 mt-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-[11px] font-bold tracking-[1.4px] uppercase text-royal">
              Promoção
            </div>
            <div className="text-[20px] font-extrabold text-ink mt-1">
              {modoEdicao ? "Editar promoção" : "Nova promoção"}
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => !salvando && !excluindo && onFechar()}
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
              className="px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition"
            >
              <option value="">Selecione…</option>
              {empreendimentos.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold text-body uppercase tracking-[0.4px]">
              Descrição
            </span>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: ITBI grátis até 31/01"
              className="px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold text-body uppercase tracking-[0.4px]">
              Condições comerciais
            </span>
            <textarea
              value={condicoes}
              onChange={(e) => setCondicoes(e.target.value)}
              rows={3}
              placeholder="Detalhes da promoção (opcional)"
              className="px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition resize-y"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-bold text-body uppercase tracking-[0.4px]">
                Data início
              </span>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-bold text-body uppercase tracking-[0.4px]">
                Data fim
              </span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition"
              />
            </label>
          </div>

          {erro && (
            <div className="rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line">
              {erro}
            </div>
          )}

          <div className="flex justify-between gap-2 mt-2 flex-wrap">
            {modoEdicao ? (
              <Button
                variante="ghost"
                onClick={excluir}
                disabled={excluindo || salvando}
                className="!text-down-strong"
              >
                {excluindo ? "Excluindo…" : "Excluir"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2 ml-auto">
              <Button variante="secondary" onClick={onFechar} disabled={salvando || excluindo}>
                Cancelar
              </Button>
              <Button onClick={salvar} disabled={salvando || excluindo}>
                {salvando ? "Salvando…" : modoEdicao ? "Salvar alterações" : "Criar promoção"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
