import Link from "next/link";

import { ComparativoEmpreendimentos } from "@/components/empreendimentos/ComparativoEmpreendimentos";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Empreendimento, Incorporadora } from "@/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ ids?: string }>;
}

export default async function CompararPage({ searchParams }: PageProps) {
  const { ids = "" } = await searchParams;
  const idLista = ids.split(",").filter(Boolean);
  const token = await getToken();
  let empreendimentos: Empreendimento[] = [];
  let incorporadoras: Incorporadora[] = [];
  let erro = "";
  try {
    [empreendimentos, incorporadoras] = await Promise.all([
      api<Empreendimento[]>("/empreendimentos", { token }),
      api<Incorporadora[]>("/incorporadoras", { token }),
    ]);
  } catch (e) {
    erro = (e as Error).message;
  }

  const selecionados = idLista
    .map((id) => empreendimentos.find((e) => e.id === id))
    .filter((e): e is Empreendimento => !!e);
  const mapInc = new Map(incorporadoras.map((i) => [i.id, i]));

  return (
    <>
      <Link
        href="/empreendimentos"
        className="text-[13px] text-muted hover:text-royal font-semibold inline-flex items-center gap-1 mb-3"
      >
        ← Lista global
      </Link>
      <PageHeader
        eyebrow="Comparar"
        title={`Comparativo de ${selecionados.length} empreendimento${selecionados.length === 1 ? "" : "s"}`}
        subtitle="KPIs lado a lado para identificar o líder em cada métrica. Use os checkboxes em /empreendimentos para escolher quem entra."
      />

      {erro ? (
        <Card>
          <div className="text-[13.5px] text-down-strong">
            Não consegui carregar do backend: <b>{erro}</b>.
          </div>
        </Card>
      ) : selecionados.length === 0 ? (
        <Card>
          <div className="text-[13.5px] text-muted">
            Nenhum empreendimento selecionado. Volte para{" "}
            <Link href="/empreendimentos" className="text-royal font-semibold">
              /empreendimentos
            </Link>
            , marque 2 ou mais cards e clique em <b>Comparar (N)</b> no rodapé.
          </div>
        </Card>
      ) : selecionados.length === 1 ? (
        <Card>
          <div className="text-[13.5px] text-muted">
            Comparativo precisa de pelo menos 2 empreendimentos selecionados.
            <br />
            Você selecionou só <b className="text-ink">{selecionados[0].nome}</b>.
          </div>
        </Card>
      ) : (
        <ComparativoEmpreendimentos
          empreendimentos={selecionados}
          mapIncorporadora={mapInc}
        />
      )}
    </>
  );
}
