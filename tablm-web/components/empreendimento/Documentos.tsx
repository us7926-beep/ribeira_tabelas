"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { apagarDocumento } from "@/app/(dashboard)/empreendimentos/[id]/actions";
import type { Documento } from "@/types";

const TIPOS = ["flyer", "memorial", "tabela", "planta", "outro"];

const ICONE: Record<string, string> = {
  flyer: "🖼️",
  memorial: "📄",
  tabela: "📊",
  planta: "📐",
  outro: "📎",
};

export default function Documentos({
  empreendimentoId,
  documentos,
}: {
  empreendimentoId: string;
  documentos: Documento[];
}) {
  const router = useRouter();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [tipo, setTipo] = useState("flyer");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [, startApagar] = useTransition();

  async function enviar() {
    if (!arquivo) return;
    setErro("");
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("empreendimento_id", empreendimentoId);
      fd.append("tipo", tipo);
      fd.append("arquivo", arquivo);
      const r = await fetch("/api/documentos/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Falha no upload");
      setArquivo(null);
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function baixar(id: string) {
    const r = await fetch(`/api/documentos/url?id=${id}`);
    const d = await r.json();
    if (d.url) window.open(d.url, "_blank");
    else setErro(d.detail ?? "Não consegui gerar o link");
  }

  function apagar(id: string) {
    startApagar(async () => {
      await apagarDocumento(id, empreendimentoId);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="bg-white rounded-2xl border border-line p-5 grid sm:grid-cols-[1fr_auto_auto] gap-2 items-center">
        <input
          type="file"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-lg file:border-0 file:bg-royal file:text-white file:px-4 file:py-2 file:font-semibold hover:file:bg-royal-dark"
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-royal"
        >
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          onClick={enviar}
          disabled={!arquivo || enviando}
          className="rounded-lg bg-royal hover:bg-royal-dark text-white font-semibold px-5 py-2 disabled:opacity-50"
        >
          {enviando ? "Enviando..." : "Enviar"}
        </button>
      </div>

      {erro && (
        <div className="mt-3 rounded-lg bg-red-50 text-neg text-sm px-3 py-2 border border-red-100">{erro}</div>
      )}

      {documentos.length === 0 ? (
        <p className="mt-5 text-muted">Nenhum documento ainda. Suba o primeiro acima.</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {documentos.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-3 bg-white rounded-xl border border-line px-4 py-3"
            >
              <span className="text-lg">{ICONE[doc.tipo ?? "outro"] ?? "📎"}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink truncate">{doc.nome}</div>
                <div className="text-xs text-muted">{doc.tipo}</div>
              </div>
              <button onClick={() => baixar(doc.id)} className="text-sm font-semibold text-royal hover:underline">
                baixar
              </button>
              <button onClick={() => apagar(doc.id)} className="text-sm text-neg hover:underline">
                apagar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
