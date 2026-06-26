import ReajusteIncc from "@/components/incc/ReajusteIncc";
import { BotaoExportarPdf } from "@/components/ui/BotaoExportarPdf";
import { PageHeader } from "@/components/ui/PageHeader";
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
    <>
      <PageHeader
        eyebrow="Atualização monetária"
        title="Reajustar por INCC"
        subtitle="Escolha o INCC-DI do mês (BCB série 192), suba a tabela e aplique o reajuste com % ou R$ extra opcionais."
        acao={<BotaoExportarPdf />}
      />
      <ReajusteIncc variacoes={variacoes} />
    </>
  );
}
