import { ListaPromocoes } from "@/components/promocoes/ListaPromocoes";
import { BotaoExportarPdf } from "@/components/ui/BotaoExportarPdf";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Empreendimento, EventoPromocional, Incorporadora } from "@/types";

export const dynamic = "force-dynamic";

export default async function PromocoesPage() {
  const token = await getToken();
  let eventos: EventoPromocional[] = [];
  let empreendimentos: Empreendimento[] = [];
  let incorporadoras: Incorporadora[] = [];
  try {
    [eventos, empreendimentos, incorporadoras] = await Promise.all([
      api<EventoPromocional[]>("/benchmark/eventos", { token }),
      api<Empreendimento[]>("/empreendimentos", { token }),
      api<Incorporadora[]>("/incorporadoras", { token }),
    ]);
  } catch {
    /* backend indisponível — ListaPromocoes mostra estado vazio */
  }

  return (
    <>
      <PageHeader
        eyebrow="Promoções"
        title="Calendário de promoções"
        subtitle="Acompanhe as promoções comerciais com prazo definido — vigentes, vencendo nos próximos 7 dias ou já expiradas."
        acao={<BotaoExportarPdf />}
      />
      <ListaPromocoes
        eventos={eventos}
        empreendimentos={empreendimentos}
        incorporadoras={incorporadoras}
      />
    </>
  );
}
