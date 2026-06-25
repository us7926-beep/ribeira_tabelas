import { BenchmarkApp } from "@/components/benchmark/BenchmarkApp";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Empreendimento, EventoPromocional, Incorporadora } from "@/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ aba?: string }>;

export default async function BenchmarkPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const token = await getToken();
  const { aba } = await searchParams;

  let incorporadoras: Incorporadora[] = [];
  let empreendimentos: Empreendimento[] = [];
  let eventos: EventoPromocional[] = [];
  try {
    [incorporadoras, empreendimentos, eventos] = await Promise.all([
      api<Incorporadora[]>("/incorporadoras", { token }),
      api<Empreendimento[]>("/empreendimentos", { token }),
      api<EventoPromocional[]>("/benchmark/eventos", { token }),
    ]);
  } catch {
    /* backend indisponível — UI mostra estado vazio elegantemente */
  }

  const abaInicial =
    aba === "h2h" || aba === "swot" || aba === "oportunidades" || aba === "movimentos" || aba === "base"
      ? aba
      : "panorama";

  return (
    <>
      <PageHeader
        eyebrow="Inteligência competitiva"
        title="Benchmark Competitivo"
        subtitle="Mapeie a concorrência, veja onde você lidera e onde está exposto — e antecipe os movimentos do mercado."
      />
      <BenchmarkApp
        incorporadoras={incorporadoras}
        empreendimentos={empreendimentos}
        eventos={eventos}
        abaInicial={abaInicial}
      />
    </>
  );
}
