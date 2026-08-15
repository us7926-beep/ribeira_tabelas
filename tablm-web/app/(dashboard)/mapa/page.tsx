import Link from "next/link";

import { MapaEmpreendimentos } from "@/components/mapa/MapaEmpreendimentos";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Empreendimento, Incorporadora } from "@/types";

export const dynamic = "force-dynamic";

export default async function MapaPage() {
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

  return (
    <>
      <PageHeader
        eyebrow="Mapa"
        title="Mapa de empreendimentos"
        subtitle="Todos os empreendimentos da carteira geolocalizados. Pins da Ribeira em royal; concorrentes em cinza. Clique num pin para abrir o dossiê."
      />

      {erro ? (
        <Card>
          <div className="text-[13.5px] text-down-strong">
            Não consegui carregar do backend: <b>{erro}</b>.
          </div>
        </Card>
      ) : empreendimentos.length === 0 ? (
        <Card>
          <div className="text-[13.5px] text-muted">
            Nenhum empreendimento cadastrado. Adicione via{" "}
            <Link href="/incorporadoras" className="text-royal font-semibold">
              /incorporadoras
            </Link>
            {" "}ou pela{" "}
            <Link href="/analise-lote" className="text-royal font-semibold">
              análise em lote
            </Link>
            .
          </div>
        </Card>
      ) : (
        <MapaEmpreendimentos
          empreendimentos={empreendimentos}
          incorporadoras={incorporadoras}
        />
      )}
    </>
  );
}
