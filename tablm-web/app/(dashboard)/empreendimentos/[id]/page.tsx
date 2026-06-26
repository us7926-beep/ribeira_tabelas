import Link from "next/link";

import { BotaoExportarPdf } from "@/components/ui/BotaoExportarPdf";
import { EmpreendimentoDossie } from "@/components/empreendimento/EmpreendimentoDossie";
import { Chip } from "@/components/ui/Chip";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Documento, Empreendimento } from "@/types";

export const dynamic = "force-dynamic";

type Aba = "ficha" | "tabela" | "fluxo" | "vendas" | "documentos";
type SearchParams = Promise<{ aba?: string }>;

export default async function EmpreendimentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { aba } = await searchParams;
  const token = await getToken();

  let emp: Empreendimento | null = null;
  let documentos: Documento[] = [];
  let erro = "";
  try {
    [emp, documentos] = await Promise.all([
      api<Empreendimento>(`/empreendimentos/${id}`, { token }),
      api<Documento[]>(`/empreendimentos/${id}/documentos`, { token }),
    ]);
  } catch (e) {
    erro = (e as Error).message;
  }

  const subtitulo =
    [emp?.bairro, emp?.cidade].filter(Boolean).join(" · ") +
      (emp?.padrao ? ` · padrão ${emp.padrao}` : "") || "Empreendimento";

  const abaInicial: Aba =
    aba === "tabela" || aba === "fluxo" || aba === "vendas" || aba === "documentos"
      ? aba
      : "ficha";

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
        acao={<BotaoExportarPdf />}
      />

      {emp && (
        <div className="flex flex-wrap gap-2 mb-5 tablm-up">
          {emp.padrao && <Chip tom="royal">{emp.padrao}</Chip>}
          {emp.tipo_uso && <Chip>{emp.tipo_uso}</Chip>}
          {emp.total_unidades_calc ? (
            <Chip tom="up">{emp.total_unidades_calc} un (calc.)</Chip>
          ) : emp.total_unidades ? (
            <Chip>{emp.total_unidades} un</Chip>
          ) : null}
          {emp.torres && <Chip>{emp.torres} torres</Chip>}
          {emp.distancia_metro_km != null && (
            <Chip>
              metrô{" "}
              {emp.distancia_metro_km < 1
                ? `${Math.round(emp.distancia_metro_km * 1000)} m`
                : `${emp.distancia_metro_km.toLocaleString("pt-BR")} km`}
            </Chip>
          )}
        </div>
      )}

      {erro && (
        <div className="rounded-[12px] border border-warn-line bg-warn-bg text-warn-strong px-4 py-3 text-[13.5px] mb-4">
          Não consegui carregar do backend: <b>{erro}</b>.
        </div>
      )}

      {emp && (
        <EmpreendimentoDossie
          empreendimento={emp}
          documentos={documentos}
          abaInicial={abaInicial}
        />
      )}
    </>
  );
}
