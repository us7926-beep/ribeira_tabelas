import AnaliseFlyer from "@/components/flyer/AnaliseFlyer";
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
    /* backend/banco indisponível — a análise ainda funciona; vínculo fica limitado */
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-ink">Análise de Flyer (IA)</h1>
      <p className="text-muted mt-1">
        Suba um flyer ou material promocional; a IA detecta empreendimento, incorporadora e a
        promoção, você revisa e registra no benchmark.
      </p>
      <div className="mt-6">
        <AnaliseFlyer incorporadoras={incorporadoras} empreendimentos={empreendimentos} />
      </div>
    </div>
  );
}
