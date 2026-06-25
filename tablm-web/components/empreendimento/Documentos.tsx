"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { apagarDocumento } from "@/app/(dashboard)/empreendimentos/[id]/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Dropzone } from "@/components/ui/Dropzone";
import type { Documento } from "@/types";

const TIPOS = [
  "flyer",
  "memorial",
  "tabela",
  "tabela_precos",
  "planta",
  "book_concorrente",
  "material_interno",
  "ri_documento",
  "outro",
];

const TOM: Record<string, "royal" | "up" | "warn" | "neutro" | "down"> = {
  flyer: "royal",
  memorial: "neutro",
  tabela: "up",
  tabela_precos: "up",
  planta: "warn",
  book_concorrente: "down",
  material_interno: "royal",
  ri_documento: "warn",
  outro: "neutro",
};

const campo =
  "rounded-[12px] border border-line bg-white px-[15px] py-[12px] text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition";

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
    <div className="flex flex-col gap-4">
      <Card variant="lg">
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_auto_auto] gap-3 items-end">
          <Dropzone
            arquivo={arquivo}
            onArquivo={setArquivo}
            titulo="Arraste o documento aqui"
            dica="PDF, imagem, Excel, CSV"
          />
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Button onClick={enviar} disabled={!arquivo || enviando}>
            {enviando ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </Card>

      {erro && (
        <div className="rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line">
          {erro}
        </div>
      )}

      {documentos.length === 0 ? (
        <Card>
          <div className="text-[14px] text-muted">
            Nenhum documento ainda. Suba o primeiro acima.
          </div>
        </Card>
      ) : (
        <div className="overflow-hidden border border-line-soft rounded-[12px] bg-white">
          <div className="grid grid-cols-[1fr_120px_180px] bg-thead text-[12px] font-bold text-muted uppercase tracking-[0.4px]">
            <div className="px-4 py-3">Nome</div>
            <div className="px-4 py-3">Tipo</div>
            <div className="px-4 py-3 text-right">Ações</div>
          </div>
          {documentos.map((doc) => (
            <div
              key={doc.id}
              className="grid grid-cols-[1fr_120px_180px] border-t border-line-soft text-[14px] items-center"
            >
              <div className="px-4 py-[13px] font-semibold text-ink truncate">{doc.nome}</div>
              <div className="px-4 py-[13px]">
                <Chip tom={TOM[doc.tipo ?? "outro"] ?? "neutro"}>{doc.tipo ?? "outro"}</Chip>
              </div>
              <div className="px-4 py-[13px] text-right flex justify-end gap-3">
                <button
                  onClick={() => baixar(doc.id)}
                  className="text-[13px] font-bold text-royal hover:underline"
                >
                  Baixar
                </button>
                <button
                  onClick={() => apagar(doc.id)}
                  className="text-[13px] font-bold text-down hover:underline"
                >
                  Apagar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
