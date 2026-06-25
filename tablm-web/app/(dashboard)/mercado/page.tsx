import MercadoAnalise from "@/components/mercado/MercadoAnalise";

export default function MercadoPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-ink">Mercado</h1>
      <p className="text-muted mt-1">
        Suba uma tabela de preços (CSV ou Excel) e veja os KPIs — preço/m² médio, ticket, VGV e
        número de unidades. As colunas de valor e área são detectadas automaticamente.
      </p>
      <div className="mt-6">
        <MercadoAnalise />
      </div>
    </div>
  );
}
