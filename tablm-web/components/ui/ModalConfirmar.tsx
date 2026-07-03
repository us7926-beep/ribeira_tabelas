"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/Button";

interface Props {
  aberto: boolean;
  titulo: string;
  /** Texto de apoio — descreva o efeito da ação (o que some junto). */
  descricao?: React.ReactNode;
  /** Rótulo do botão de confirmação (default "Excluir"). */
  rotuloConfirmar?: string;
  /** Trava fechar/cancelar enquanto a ação roda. */
  ocupado?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/** Diálogo de confirmação do design system — substitui o `confirm()` nativo.
 * Portal no document.body (escapa de wrappers com transform), Escape fecha,
 * clique no backdrop cancela, tudo travado enquanto `ocupado`. */
export function ModalConfirmar({
  aberto,
  titulo,
  descricao,
  rotuloConfirmar = "Excluir",
  ocupado = false,
  onConfirmar,
  onCancelar,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !ocupado) onCancelar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberto, ocupado, onCancelar]);

  if (!aberto || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
      onClick={() => !ocupado && onCancelar()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={titulo}
        className="w-full max-w-[420px] bg-white rounded-[16px] shadow-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[17px] font-extrabold text-ink">{titulo}</div>
        {descricao && (
          <div className="text-[13.5px] text-muted mt-2 leading-relaxed">{descricao}</div>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <Button variante="secondary" onClick={onCancelar} disabled={ocupado}>
            Cancelar
          </Button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={ocupado}
            className="px-[18px] py-[10px] rounded-[12px] bg-down-strong text-white text-[14px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {ocupado ? "Aguarde…" : rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
