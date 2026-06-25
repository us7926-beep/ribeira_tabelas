import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Empreendimento, EventoPromocional } from "@/types";

export const dynamic = "force-dynamic";

function dataBR(iso?: string | null): string {
  const m = (iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function periodo(ev: EventoPromocional): string {
  const ini = dataBR(ev.data_inicio);
  const fim = dataBR(ev.data_fim);
  if (ini && fim) return `${ini} – ${fim}`;
  return ini || fim || dataBR(ev.criado_em);
}

export default async function EventosPage() {
  const token = await getToken();
  let eventos: EventoPromocional[] = [];
  let empreendimentos: Empreendimento[] = [];
  let erro = "";
  try {
    eventos = await api<EventoPromocional[]>("/benchmark/eventos", { token });
    empreendimentos = await api<Empreendimento[]>("/empreendimentos", { token });
  } catch (e) {
    erro = (e as Error).message;
  }
  const nomePorId = new Map(empreendimentos.map((e) => [e.id, e.nome]));

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-extrabold text-ink">Eventos &amp; Promoções</h1>
      <p className="text-muted mt-1">
        Eventos detectados nos flyers pela IA, do mais recente ao mais antigo.
      </p>

      {erro ? (
        <div className="mt-6 rounded-xl border border-amber/40 bg-amber/10 text-ink-soft px-4 py-3 text-sm">
          Não consegui carregar do backend: <b>{erro}</b>.
        </div>
      ) : eventos.length === 0 ? (
        <p className="mt-6 text-muted">
          Nenhum evento ainda. Suba um flyer em <b>Análise de Flyer</b> para registrar o primeiro.
        </p>
      ) : (
        <ol className="mt-6 relative border-l-2 border-line pl-6 space-y-5">
          {eventos.map((ev) => (
            <li key={ev.id} className="relative">
              <span className="absolute -left-[31px] top-2 size-3 rounded-full bg-royal ring-4 ring-white" />
              <div className="bg-white rounded-xl border border-line p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-ink">
                    {nomePorId.get(ev.empreendimento_id) ?? "Empreendimento"}
                  </div>
                  <div className="text-xs text-muted whitespace-nowrap">{periodo(ev)}</div>
                </div>
                {ev.descricao && <div className="text-sm text-ink-soft mt-1">{ev.descricao}</div>}
                {ev.condicoes_comerciais && (
                  <div className="text-sm text-muted mt-2">
                    <b className="text-ink-soft">Condições:</b> {ev.condicoes_comerciais}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
