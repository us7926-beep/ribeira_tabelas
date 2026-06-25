import Link from "next/link";

import Documentos from "@/components/empreendimento/Documentos";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { PageHeader } from "@/components/ui/PageHeader";
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

  const subtitulo =
    [emp?.bairro, emp?.cidade].filter(Boolean).join(" · ") +
    (emp?.padrao ? ` · padrão ${emp.padrao}` : "") || "Empreendimento";

  return (
    <>
      <Link
        href={emp ? `/incorporadoras/${emp.incorporadora_id}` : "/incorporadoras"}
        className="text-[13px] text-muted hover:text-royal font-semibold inline-flex items-center gap-1 mb-3"
      >
        ← Voltar
      </Link>
      <PageHeader
        eyebrow="Empreendimento"
        title={emp?.nome ?? "Empreendimento"}
        subtitle={subtitulo}
      />

      {emp && (
        <div className="flex flex-wrap gap-2 mb-5 tablm-up">
          {emp.padrao && <Chip tom="royal">{emp.padrao}</Chip>}
          {emp.total_unidades && <Chip>{emp.total_unidades} unidades</Chip>}
          {emp.torres && <Chip>{emp.torres} torres</Chip>}
        </div>
      )}

      <h2 className="text-[16px] font-bold text-ink mb-3">Repositório de documentos</h2>
      {erro ? (
        <Card>
          <div className="text-[14px] text-warn-strong">
            Não consegui carregar do backend: <b>{erro}</b>.
          </div>
        </Card>
      ) : (
        <Documentos empreendimentoId={id} documentos={documentos} />
      )}
    </>
  );
}
