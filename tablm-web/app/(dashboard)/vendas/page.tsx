import VendasKpis from "@/components/vendas/VendasKpis";

export default function VendasPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-ink">Vendas</h1>
      <p className="text-muted mt-1">
        Suba uma tabela com a situação das unidades (Disponível/Vendido/Reservado) e veja os KPIs —
        vendidas, disponíveis, % vendido, VSO, VGV e ticket médio. As colunas são detectadas
        automaticamente.
      </p>
      <div className="mt-6">
        <VendasKpis />
      </div>
    </div>
  );
}
