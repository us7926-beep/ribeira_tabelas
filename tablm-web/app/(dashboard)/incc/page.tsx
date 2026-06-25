import ReajusteIncc from "@/components/incc/ReajusteIncc";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface Variacao {
  competencia: string;
  variacao: number;
}

export default async function InccPage() {
  let variacoes: Variacao[] = [];
  try {
    variacoes = await api<Variacao[]>("/incc/variacoes?meses=18", { token: await getToken() });
  } catch {
    /* BCB indisponível — usuário pode digitar o % manualmente no extra */
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-ink">Reajuste por INCC</h1>
      <p className="text-muted mt-1">
        Escolha o INCC-DI do mês (fonte: Banco Central, série 192), suba a tabela de valores e
        aplique o reajuste — com % ou R$ extra opcionais. Exporte o resultado em CSV.
      </p>
      <div className="mt-6">
        <ReajusteIncc variacoes={variacoes} />
      </div>
    </div>
  );
}
