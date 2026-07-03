"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { atualizarIncorporadora } from "@/app/(dashboard)/incorporadoras/actions";
import { Button } from "@/components/ui/Button";
import type { Incorporadora } from "@/types";

interface Props {
  incorporadora: Incorporadora | null;
  onFechar: () => void;
}

const campo =
  "px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition";

/** Substitui o window.prompt() de renomear — input com validação, Escape,
 * feedback de erro em linha e trava durante o save. */
export function ModalRenomearIncorporadora({ incorporadora, onFechar }: Props) {
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!incorporadora) return;
    setNome(incorporadora.nome);
    setErro("");
  }, [incorporadora]);

  useEffect(() => {
    if (!incorporadora) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !salvando) onFechar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [incorporadora, salvando, onFechar]);

  if (!incorporadora || !mounted) return null;

  function salvar() {
    const trim = nome.trim();
    if (!trim) {
      setErro("Nome é obrigatório.");
      return;
    }
    if (trim === incorporadora!.nome) {
      onFechar(); // nada mudou — no-op sem chamada ao backend
      return;
    }
    setSalvando(true);
    setErro("");
    startTransition(async () => {
      const r = await atualizarIncorporadora(incorporadora!.id, trim);
      if (!r.ok) {
        setErro(r.erro);
      } else {
        onFechar();
      }
      setSalvando(false);
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 backdrop-blur-sm overflow-y-auto p-4 sm:p-8"
      onClick={() => !salvando && onFechar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Renomear incorporadora"
        className="w-full max-w-[420px] bg-white rounded-[16px] shadow-card p-6 mt-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-[11px] font-bold tracking-[1.4px] uppercase text-royal">
              Incorporadora
            </div>
            <div className="text-[20px] font-extrabold text-ink mt-1">
              Renomear incorporadora
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => !salvando && onFechar()}
            className="text-[20px] leading-none text-muted hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold text-body uppercase tracking-[0.4px]">
              Nome *
            </span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") salvar();
              }}
              autoFocus
              className={campo}
            />
          </label>

          {erro && (
            <div className="rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line">
              {erro}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-2">
            <Button variante="secondary" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
