"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { atualizarEmpreendimento } from "@/app/(dashboard)/incorporadoras/actions";
import { Button } from "@/components/ui/Button";
import type { Empreendimento } from "@/types";

interface Props {
  aberto: boolean;
  empreendimento: Empreendimento | null;
  onFechar: () => void;
}

const campo =
  "px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition";

export function ModalEditarEmpreendimento({ aberto, empreendimento, onFechar }: Props) {
  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [padrao, setPadrao] = useState("");
  const [erro, setErro] = useState("");
  const [, startTransition] = useTransition();
  const [salvando, setSalvando] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!aberto || !empreendimento) return;
    setErro("");
    setNome(empreendimento.nome ?? "");
    setCidade(empreendimento.cidade ?? "");
    setBairro(empreendimento.bairro ?? "");
    setPadrao(empreendimento.padrao ?? "");
  }, [aberto, empreendimento]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !salvando) onFechar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberto, salvando, onFechar]);

  if (!aberto || !empreendimento || !mounted) return null;

  function salvar() {
    if (!nome.trim()) {
      setErro("Nome é obrigatório.");
      return;
    }
    setSalvando(true);
    setErro("");
    startTransition(async () => {
      const r = await atualizarEmpreendimento(
        empreendimento!.id,
        empreendimento!.incorporadora_id,
        { nome, cidade, bairro, padrao },
      );
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
        aria-label="Editar empreendimento"
        className="w-full max-w-[480px] bg-white rounded-[16px] shadow-card p-6 mt-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-[11px] font-bold tracking-[1.4px] uppercase text-royal">
              Empreendimento
            </div>
            <div className="text-[20px] font-extrabold text-ink mt-1">
              Editar empreendimento
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
            <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-bold text-body uppercase tracking-[0.4px]">
                Cidade
              </span>
              <input
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className={campo}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-bold text-body uppercase tracking-[0.4px]">
                Bairro
              </span>
              <input
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                className={campo}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold text-body uppercase tracking-[0.4px]">
              Padrão
            </span>
            <input
              value={padrao}
              onChange={(e) => setPadrao(e.target.value)}
              placeholder="Ex.: Alto, Médio, Econômico"
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
              {salvando ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
