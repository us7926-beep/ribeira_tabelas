import VendasKpis from "@/components/vendas/VendasKpis";
import { BotaoExportarPdf } from "@/components/ui/BotaoExportarPdf";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Empreendimento } from "@/types";

export const dynamic = "force-dynamic";

export default async function VendasPage() {
  let empreendimentos: Empreendimento[] = [];
  try {
    empreendimentos = await api<Empreendimento[]>("/empreendimentos", {
      token: await getToken(),
    });
  } catch {
    /* backend indisponível — VendasKpis abre o select vazio */
  }

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Vendas"
        subtitle="Suba a tabela com a situação das unidades (Disponível / Vendido / Reservado) e veja VSO, VGV e ticket. As colunas são detectadas automaticamente."
        acao={<BotaoExportarPdf />}
      />
      <VendasKpis empreendimentos={empreendimentos} />
    </>
  );
}
