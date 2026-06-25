import Link from "next/link";

import Documentos from "@/components/empreendimento/Documentos";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Documento, Empreendimento } from "@/types";

export const dynamic = "force-dynamic";

export default async function EmpreendimentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = await getToken();

  let emp: Empreendimento | null = null;
  let documentos: Documento[] = [];
  let erro = "";
  try {
    emp = await api<Empreendimento>(`/empreendimentos/${id}`, { token });
    documentos = await api<Documento[]>(`/empreendimentos/${id}/documentos`, { token });
  } catch (e) {
    erro = (e as Error).message;
  }

  return (
    <div className="max-w-3xl">
      <Link
        href={emp ? `/incorporadoras/${emp.incorporadora_id}` : "/incorporadoras"}
        className="text-sm text-muted hover:text-royal"
      >
        ← Voltar
      </Link>
      <h1 className="text-2xl font-extrabold text-ink mt-1">{emp?.nome ?? "Empreendimento"}</h1>
      <p className="text-muted mt-1">
        {[emp?.bairro, emp?.cidade].filter(Boolean).join(" · ") || "—"}
        {emp?.padrao ? ` · ${emp.padrao}` : ""}
      </p>

      <h2 className="text-lg font-bold text-ink mt-7 mb-3">Documentos</h2>
      {erro ? (
        <div className="rounded-xl border border-amber/40 bg-amber/10 text-ink-soft px-4 py-3 text-sm">
          Não consegui carregar do backend: <b>{erro}</b>.
        </div>
      ) : (
        <Documentos empreendimentoId={id} documentos={documentos} />
      )}
    </div>
  );
}
