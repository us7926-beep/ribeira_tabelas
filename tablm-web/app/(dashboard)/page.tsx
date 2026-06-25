import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Empreendimento, EventoPromocional, Incorporadora } from "@/types";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const token = await getToken();
  let incorporadoras = 0;
  let empreendimentos = 0;
  let eventos = 0;
  let erro = false;
  try {
    const [a, b, c] = await Promise.all([
      api<Incorporadora[]>("/incorporadoras", { token }),
      api<Empreendimento[]>("/empreendimentos", { token }),
      api<EventoPromocional[]>("/benchmark/eventos", { token }),
    ]);
    incorporadoras = a.length;
    empreendimentos = b.length;
    eventos = c.length;
  } catch {
    erro = true;
  }

  const cards = [
    { titulo: "Incorporadoras", valor: erro ? "—" : String(incorporadoras) },
    { titulo: "Empreendimentos", valor: erro ? "—" : String(empreendimentos) },
    { titulo: "Eventos detectados", valor: erro ? "—" : String(eventos) },
  ];

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-ink">Visão geral</h1>
      <p className="text-muted mt-1">
        Plataforma de inteligência competitiva da Ribeira.
      </p>
      <div className="grid gap-4 sm:grid-cols-3 mt-6">
        {cards.map((card) => (
          <div
            key={card.titulo}
            className="bg-white rounded-2xl border border-line border-l-4 border-l-royal p-5"
          >
            <div className="text-sm font-semibold text-muted">{card.titulo}</div>
            <div className="text-3xl font-extrabold text-ink mt-1">{card.valor}</div>
          </div>
        ))}
      </div>
      {erro && (
        <p className="mt-4 text-sm text-muted">
          (Inicie o backend e configure o Supabase para ver os números.)
        </p>
      )}
    </div>
  );
}
