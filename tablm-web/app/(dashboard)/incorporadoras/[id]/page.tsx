import Link from "next/link";

import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Empreendimento, Incorporadora } from "@/types";

import { criarEmpreendimento } from "../actions";

export const dynamic = "force-dynamic";

export default async function IncorporadoraDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = await getToken();

  let nome = "Incorporadora";
  let empreendimentos: Empreendimento[] = [];
  let erro = "";
  try {
    const incs = await api<Incorporadora[]>("/incorporadoras", { token });
    nome = incs.find((i) => i.id === id)?.nome ?? nome;
    empreendimentos = await api<Empreendimento[]>(
      `/empreendimentos?incorporadora_id=${id}`,
      { token },
    );
  } catch (e) {
    erro = (e as Error).message;
  }

  return (
    <div className="max-w-3xl">
      <Link href="/incorporadoras" className="text-sm text-muted hover:text-royal">
        ← Incorporadoras
      </Link>
      <h1 className="text-2xl font-extrabold text-ink mt-1">{nome}</h1>
      <p className="text-muted mt-1">Empreendimentos desta incorporadora.</p>

      <form action={criarEmpreendimento} className="mt-6 grid sm:grid-cols-2 gap-2">
        <input type="hidden" name="incorporadora_id" value={id} />
        <input
          name="nome"
          required
          placeholder="Nome do empreendimento *"
          className="rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-royal"
        />
        <input
          name="cidade"
          placeholder="Cidade"
          className="rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-royal"
        />
        <input
          name="bairro"
          placeholder="Bairro"
          className="rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-royal"
        />
        <input
          name="padrao"
          placeholder="Padrão (ex.: Médio-Alto)"
          className="rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-royal"
        />
        <button className="sm:col-span-2 rounded-lg bg-royal hover:bg-royal-dark text-white font-semibold py-2.5">
          Adicionar empreendimento
        </button>
      </form>

      {erro ? (
        <div className="mt-6 rounded-xl border border-amber/40 bg-amber/10 text-ink-soft px-4 py-3 text-sm">
          Não consegui carregar do backend: <b>{erro}</b>. Ligue o Supabase no `api/.env`.
        </div>
      ) : empreendimentos.length === 0 ? (
        <p className="mt-6 text-muted">Nenhum empreendimento ainda. Adicione o primeiro acima.</p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {empreendimentos.map((emp) => (
            <Link
              key={emp.id}
              href={`/empreendimentos/${emp.id}`}
              className="block bg-white rounded-xl border border-line border-l-4 border-l-royal p-4 hover:bg-surface"
            >
              <div className="font-semibold text-ink">{emp.nome}</div>
              <div className="text-sm text-muted mt-1">
                {[emp.bairro, emp.cidade].filter(Boolean).join(" · ") || "—"}
              </div>
              {emp.padrao && (
                <div className="inline-block mt-2 text-xs font-semibold text-royal bg-royal/10 px-2 py-0.5 rounded-full">
                  {emp.padrao}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
