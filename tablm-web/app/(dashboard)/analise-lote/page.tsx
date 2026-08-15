import Link from "next/link";

import { AnaliseLoteBooks } from "@/components/lote/AnaliseLoteBooks";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Incorporadora } from "@/types";

export const dynamic = "force-dynamic";

export default async function AnaliseLotePage() {
  const token = await getToken();
  let incorporadoras: Incorporadora[] = [];
  let erro = "";
  try {
    incorporadoras = await api<Incorporadora[]>("/incorporadoras", { token });
  } catch (e) {
    erro = (e as Error).message;
  }

  return (
    <>
      <Link
        href="/incorporadoras"
        className="text-[13px] text-muted hover:text-royal font-semibold inline-flex items-center gap-1 mb-3"
      >
        ← Carteira
      </Link>
      <PageHeader
        eyebrow="Análise em lote"
        title="Books em lote"
        subtitle="Arraste vários PDFs de books/memorial de uma vez. A IA extrai ficha e tabela de cada um; você revê tudo junto e cria N empreendimentos com 1 clique."
      />
      {erro && (
        <Card className="mb-4">
          <div className="text-[13.5px] text-down-strong">
            Não consegui carregar incorporadoras: <b>{erro}</b>. Você ainda pode
            processar os books; a IA tenta detectar a incorporadora pelo texto.
          </div>
        </Card>
      )}
      <AnaliseLoteBooks incorporadoras={incorporadoras} />
    </>
  );
}
