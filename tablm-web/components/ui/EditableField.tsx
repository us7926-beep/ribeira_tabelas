"use client";

import { useEffect, useRef, useState } from "react";

import { Chip } from "./Chip";

type Tipo = "texto" | "numero" | "data" | "chips";

interface Props {
  rotulo: string;
  valor: string | number | null | undefined | string[];
  tipo?: Tipo;
  origemIA?: boolean;
  /** Marca visualmente que este campo está vazio e é considerado importante
   * (nome/bairro/cidade/padrão/tipologias/metragens/datas). Ajuda a chamar
   * atenção depois de uma extração ruim pra o usuário preencher à mão ou
   * subir book de novo. */
  vazioSuspeito?: boolean;
  placeholder?: string;
  step?: string;
  onSalvar: (novo: string | number | string[] | null) => void;
}

function formatar(valor: Props["valor"], tipo: Tipo) {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (tipo === "chips" && Array.isArray(valor)) {
    return valor.length ? valor.join(", ") : "—";
  }
  if (tipo === "data" && typeof valor === "string") {
    const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  return String(valor);
}

/** Click-to-edit. Texto, número, data, chips de strings. Marca origem opcional (IA). */
export function EditableField({
  rotulo,
  valor,
  tipo = "texto",
  origemIA,
  vazioSuspeito,
  placeholder,
  step,
  onSalvar,
}: Props) {
  const [editando, setEditando] = useState(false);
  const [bruto, setBruto] = useState<string>(() => {
    if (Array.isArray(valor)) return valor.join(", ");
    if (valor === null || valor === undefined) return "";
    return String(valor);
  });
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (Array.isArray(valor)) setBruto(valor.join(", "));
    else if (valor === null || valor === undefined) setBruto("");
    else setBruto(String(valor));
  }, [valor]);

  useEffect(() => {
    if (editando) inputRef.current?.focus();
  }, [editando]);

  function confirmar() {
    setEditando(false);
    if (tipo === "chips") {
      const arr = bruto
        .split(/[,;]\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      onSalvar(arr.length ? arr : null);
      return;
    }
    if (tipo === "numero") {
      if (bruto === "") return onSalvar(null);
      const n = Number(bruto.replace(",", "."));
      onSalvar(Number.isFinite(n) ? n : null);
      return;
    }
    onSalvar(bruto.trim() || null);
  }

  const inputType = tipo === "numero" ? "number" : tipo === "data" ? "date" : "text";
  // vazioSuspeito só quando a IA foi rodada e ficou sem preencher: prioridade
  // origemIA > vazioSuspeito. Sem edição em curso.
  const destacarVazio = vazioSuspeito && !origemIA && !editando;

  return (
    <div
      className={`bg-white border rounded-[12px] px-3 py-2.5 transition cursor-text ${
        origemIA
          ? "border-royal ring-[3px] ring-royal/[0.12]"
          : destacarVazio
            ? "border-warn-line bg-warn-bg/40"
            : "border-line hover:border-royal/40"
      }`}
      onClick={() => !editando && setEditando(true)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold tracking-[0.5px] uppercase text-muted">
          {rotulo}
        </div>
        {origemIA ? (
          <Chip tom="royal">via IA</Chip>
        ) : destacarVazio ? (
          <Chip tom="warn">faltando</Chip>
        ) : null}
      </div>
      {editando ? (
        <input
          ref={inputRef}
          type={inputType}
          step={step}
          value={bruto}
          placeholder={placeholder}
          onChange={(e) => setBruto(e.target.value)}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirmar();
            if (e.key === "Escape") setEditando(false);
          }}
          className="w-full mt-1 text-[15px] font-semibold text-ink bg-transparent outline-none"
        />
      ) : (
        <div className="text-[15px] font-semibold text-ink mt-0.5 break-words">
          {formatar(valor, tipo)}
        </div>
      )}
    </div>
  );
}
