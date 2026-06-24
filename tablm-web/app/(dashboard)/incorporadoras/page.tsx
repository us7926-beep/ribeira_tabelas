import Link from "next/link";

import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Incorporadora } from "@/types";

import { criarIncorporadora } from "./actions";

export const dynamic = "force-dynamic";

export default async function IncorporadorasPage() {
  let lista: Incorporadora[] = [];
  let erro = "";
  try {
    lista = await api<Incorporadora[]>("/incorporadoras", { token: await getToken() });
  } catch (e) {
    erro = (e as Error).message;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-extrabold text-ink">Incorporadoras</h1>
      <p className="text-muted mt-1">
        Cadastre e navegue pelas incorporadoras e seus empreendimentos.
      </p>

      <form action={criarIncorporadora} className="mt-6 flex gap-2">
        <input
          name="nome"
          required
          placeholder="Nome da incorporadora..."
          className="flex-1 rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-royal"
        />
        <button className="rounded-lg bg-royal hover:bg-royal-dark text-white font-semibold px-5">
          Adicionar
        </button>
      </form>

      {erro ? (
        <div className="mt-6 rounded-xl border border-amber/40 bg-amber/10 text-ink-soft px-4 py-3 text-sm">
          Não consegui carregar do backend: <b>{erro}</b>.
          <br />
          Ligue o Supabase no backend (`SUPABASE_URL`/`SUPABASE_KEY` no `api/.env`) e rode o SQL das tabelas.
        </div>
      ) : lista.length === 0 ? (
        <p className="mt-6 text-muted">Nenhuma incorporadora ainda. Adicione a primeira acima.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {lista.map((inc) => (
            <li key={inc.id}>
              <Link
                href={`/incorporadoras/${inc.id}`}
                className="flex items-center justify-between bg-white rounded-xl border border-line border-l-4 border-l-royal px-4 py-3 hover:bg-surface"
              >
                <span className="font-semibold text-ink">{inc.nome}</span>
                <span className="text-muted text-sm">ver empreendimentos →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
