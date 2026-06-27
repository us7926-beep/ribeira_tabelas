import Link from "next/link";

import { ImportarEmpreendimentoBook } from "@/components/incorporadoras/ImportarEmpreendimentoBook";
import { ListaIncorporadorasFiltro } from "@/components/incorporadoras/ListaIncorporadorasFiltro";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Incorporadora } from "@/types";

import { criarIncorporadora } from "./actions";

export const dynamic = "force-dynamic";

const campo =
  "flex-1 rounded-[12px] border border-line bg-white px-[15px] py-[12px] text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition";

export default async function IncorporadorasPage() {
  let lista: Incorporadora[] = [];
  let erro = "";
  try {
    lista = await api<Incorporadora[]>("/incorporadoras", { token: await getToken() });
  } catch (e) {
    erro = (e as Error).message;
  }

  return (
    <>
      <PageHeader
        eyebrow="Carteira"
        title="Incorporadoras"
        subtitle="Navegue pela hierarquia de incorporadoras e seus empreendimentos. A Ribeira aparece destacada com bolinha royal; concorrentes em cinza."
        acao={
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/empreendimentos"
              className="text-[12.5px] font-bold text-royal hover:underline"
            >
              Ver todos os empreendimentos →
            </Link>
            <ImportarEmpreendimentoBook incorporadoras={lista} />
          </div>
        }
      />

      <Card variant="lg" className="mb-5 tablm-up">
        <form action={criarIncorporadora} className="flex gap-3">
          <input name="nome" required placeholder="Nome da incorporadora…" className={campo} />
          <Button type="submit">Adicionar</Button>
        </form>
      </Card>

      {erro ? (
        <div className="rounded-[12px] border border-warn-line bg-warn-bg text-warn-strong px-4 py-3 text-[13.5px]">
          Não consegui carregar do backend: <b>{erro}</b>.
        </div>
      ) : lista.length === 0 ? (
        <Card>
          <div className="text-[14px] text-muted">
            Nenhuma incorporadora ainda. Adicione a primeira no formulário acima.
          </div>
        </Card>
      ) : (
        <ListaIncorporadorasFiltro lista={lista} />
      )}
    </>
  );
}
