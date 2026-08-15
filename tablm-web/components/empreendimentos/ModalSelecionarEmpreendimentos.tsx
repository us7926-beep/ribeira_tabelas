"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import type { Empreendimento } from "@/types";

interface Props {
  aberto: boolean;
  empreendimentos: Empreendimento[];
  /** Ids já pré-selecionados (não podem ser desmarcados quando `travarIds` inclui o mesmo id). */
  idsSelecionados: string[];
  /** Ids "obrigatórios" — geralmente o próprio empreendimento quando aberto do dossiê. */
  travarIds?: string[];
  /** Título do modal ("Comparar tabelas de outros empreendimentos"). */
  titulo?: string;
  onFechar: () => void;
  /** Chamado quando o usuário confirma a seleção (2+ ids). */
  onConfirmar: (ids: string[]) => void;
}

export function ModalSelecionarEmpreendimentos({
  aberto,
  empreendimentos,
  idsSelecionados,
  travarIds = [],
  titulo = "Selecionar empreendimentos",
  onFechar,
  onConfirmar,
}: Props) {
  const [busca, setBusca] = useState("");
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    setSelecao(new Set(idsSelecionados));
    setBusca("");
  }, [aberto, idsSelecionados]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return empreendimentos;
    return empreendimentos.filter((e) => {
      const alvo = `${e.nome ?? ""} ${e.cidade ?? ""} ${e.bairro ?? ""} ${e.padrao ?? ""}`.toLowerCase();
      return alvo.includes(termo);
    });
  }, [empreendimentos, busca]);

  function alternar(id: string) {
    if (travarIds.includes(id)) return; // não pode desmarcar o próprio
    setSelecao((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  const listaSelecao = [...selecao];
  const podeConfirmar = listaSelecao.length >= 2;

  if (!aberto || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 backdrop-blur-sm overflow-y-auto p-4 sm:p-8"
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="w-full max-w-[640px] bg-white rounded-[16px] shadow-card mt-8 flex flex-col max-h-[calc(100vh-6rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-line-soft">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-[11px] font-bold tracking-[1.4px] uppercase text-royal">
                Comparativo
              </div>
              <div className="text-[20px] font-extrabold text-ink mt-1">{titulo}</div>
              <div className="text-[13px] text-muted mt-1">
                Selecione 2 ou mais empreendimentos. O selecionado atual não pode ser
                desmarcado.
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
          <input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="🔎 Buscar por nome, cidade, bairro ou padrão…"
            className="w-full px-[15px] py-[10px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition"
          />
          {listaSelecao.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {listaSelecao.map((id) => {
                const emp = empreendimentos.find((e) => e.id === id);
                if (!emp) return null;
                const travado = travarIds.includes(id);
                return (
                  <span
                    key={id}
                    className={`inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-[20px] px-2.5 py-1 ${
                      travado
                        ? "bg-royal text-white"
                        : "bg-royal-tint text-royal"
                    }`}
                  >
                    {emp.nome}
                    {!travado && (
                      <button
                        type="button"
                        onClick={() => alternar(id)}
                        aria-label={`Remover ${emp.nome}`}
                        className="text-[14px] leading-none hover:opacity-70"
                      >
                        ×
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtrados.length === 0 ? (
            <div className="p-6 text-[13.5px] text-muted">
              Nenhum empreendimento encontrado para <b>{busca}</b>.
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-line-soft">
              {filtrados.map((e) => {
                const marcado = selecao.has(e.id);
                const travado = travarIds.includes(e.id);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => alternar(e.id)}
                      disabled={travado}
                      className={`w-full text-left px-6 py-3 flex items-center gap-3 hover:bg-thead transition ${
                        marcado ? "bg-royal-tint/40" : ""
                      } ${travado ? "cursor-not-allowed" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        readOnly
                        disabled={travado}
                        className="size-4 accent-royal"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-semibold text-ink truncate">
                          {e.nome}
                          {travado && (
                            <Chip tom="royal" className="ml-2">
                              atual
                            </Chip>
                          )}
                        </div>
                        <div className="text-[12px] text-muted truncate">
                          {[e.bairro, e.cidade, e.padrao].filter(Boolean).join(" · ") ||
                            "sem localização"}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="p-6 border-t border-line-soft flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[13px] text-muted">
            {listaSelecao.length === 0
              ? "Nenhum selecionado."
              : listaSelecao.length === 1
                ? "Selecione mais 1."
                : `${listaSelecao.length} selecionados.`}
          </div>
          <div className="flex items-center gap-2">
            <Button variante="secondary" onClick={onFechar}>
              Cancelar
            </Button>
            <Button
              disabled={!podeConfirmar}
              onClick={() => onConfirmar(listaSelecao)}
            >
              Comparar {listaSelecao.length > 0 ? `(${listaSelecao.length})` : ""}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
