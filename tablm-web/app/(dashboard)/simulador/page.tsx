import { SimuladorFluxo } from "@/components/fluxo/SimuladorFluxo";
import { BotaoExportarPdf } from "@/components/ui/BotaoExportarPdf";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Empreendimento } from "@/types";

export const dynamic = "force-dynamic";

export default async function SimuladorPage() {
  const token = await getToken();
  let empreendimentos: Empreendimento[] = [];
  let erro = "";
  try {
    empreendimentos = await api<Empreendimento[]>("/empreendimentos", { token });
  } catch (e) {
    erro = (e as Error).message;
  }

  return (
    <>
      <PageHeader
        eyebrow="Fluxo Comercial"
        title="Simulador de Fluxo"
        subtitle="Compare até 4 empreendimentos lado a lado configurando livremente percentuais e parcelas por coluna. Calcula valores em R$ e renda mínima necessária em tempo real."
        acao={<BotaoExportarPdf />}
      />

      {erro ? (
        <Card>
          <div className="text-[13.5px] text-down-strong">
            Não consegui carregar os empreendimentos: <b>{erro}</b>.
          </div>
        </Card>
      ) : (
        <SimuladorFluxo empreendimentos={empreendimentos} />
      )}
    </>
  );
}
