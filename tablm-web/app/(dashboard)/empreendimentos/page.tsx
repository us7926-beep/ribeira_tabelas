import Link from "next/link";

import { ListaGlobalEmpreendimentos } from "@/components/empreendimentos/ListaGlobalEmpreendimentos";
import { BotaoExportarPdf } from "@/components/ui/BotaoExportarPdf";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Empreendimento, Incorporadora } from "@/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    inc?: string;
    padrao?: string;
    cidade?: string;
    bairro?: string;
    q?: string;
  }>;
}

export default async function EmpreendimentosPage({ searchParams }: PageProps) {
  const sp = await searchParams;
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
      <Link
        href="/incorporadoras"
        className="text-[13px] text-muted hover:text-royal font-semibold inline-flex items-center gap-1 mb-3"
      >
        ← Carteira
      </Link>
      <PageHeader
        eyebrow="Carteira"
        title="Todos os empreendimentos"
        subtitle="Visão global cross-incorporadora. Filtre por padrão, cidade ou bairro e exporte o subset visível para CSV."
        acao={<BotaoExportarPdf />}
      />

      {erro ? (
        <div className="rounded-[12px] border border-warn-line bg-warn-bg text-warn-strong px-4 py-3 text-[13.5px]">
          Não consegui carregar do backend: <b>{erro}</b>.
        </div>
      ) : (
        <ListaGlobalEmpreendimentos
          empreendimentos={empreendimentos}
          incorporadoras={incorporadoras}
          incorporadoraIdInicial={sp.inc}
          padraoInicial={sp.padrao}
          cidadeInicial={sp.cidade}
          bairroInicial={sp.bairro}
          buscaInicial={sp.q}
        />
      )}
    </>
  );
}
