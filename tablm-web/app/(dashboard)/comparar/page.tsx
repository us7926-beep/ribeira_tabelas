import Link from "next/link";

import { CompararApp } from "@/components/empreendimentos/CompararApp";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Empreendimento, Incorporadora } from "@/types";

export const dynamic = "force-dynamic";

type Modo = "kpis" | "unidades";

interface PageProps {
  searchParams: Promise<{ ids?: string; modo?: string }>;
}

export default async function CompararPage({ searchParams }: PageProps) {
  const { ids = "", modo = "kpis" } = await searchParams;
  const idLista = ids.split(",").filter(Boolean);
  const modoInicial: Modo = modo === "unidades" ? "unidades" : "kpis";
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
        subtitle="KPIs lado a lado ou unidade a unidade. Use o toggle abaixo para trocar entre visões."
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
        <CompararApp
          empreendimentos={selecionados}
          mapIncorporadora={mapInc}
          modoInicial={modoInicial}
        />
      )}
    </>
  );
}
