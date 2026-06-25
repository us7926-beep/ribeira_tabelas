import VendasKpis from "@/components/vendas/VendasKpis";
import { PageHeader } from "@/components/ui/PageHeader";

export default function VendasPage() {
  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Vendas"
        subtitle="Suba a tabela com a situação das unidades (Disponível / Vendido / Reservado) e veja VSO, VGV e ticket. As colunas são detectadas automaticamente."
      />
      <VendasKpis />
    </>
  );
}
