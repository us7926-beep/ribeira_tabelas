import AnaliseFlyer from "@/components/flyer/AnaliseFlyer";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Empreendimento, Incorporadora } from "@/types";

export const dynamic = "force-dynamic";

export default async function FlyersPage() {
  const token = await getToken();
  let incorporadoras: Incorporadora[] = [];
  let empreendimentos: Empreendimento[] = [];
  try {
    incorporadoras = await api<Incorporadora[]>("/incorporadoras", { token });
    empreendimentos = await api<Empreendimento[]>("/empreendimentos", { token });
  } catch {
    /* backend/banco indisponível — análise ainda funciona; vínculo fica limitado */
  }

  return (
    <>
      <PageHeader
        eyebrow="Análise por IA"
        title="Detecção de flyers"
        subtitle="Suba um flyer ou material promocional — a IA identifica o empreendimento, a incorporadora e a promoção. Você revisa e registra no benchmark."
      />
      <AnaliseFlyer incorporadoras={incorporadoras} empreendimentos={empreendimentos} />
    </>
  );
}
