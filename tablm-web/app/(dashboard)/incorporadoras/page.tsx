import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Incorporadora } from "@/types";

import { criarIncorporadora } from "./actions";

export const dynamic = "force-dynamic";

const campo =
  "flex-1 rounded-[12px] border border-line bg-white px-[15px] py-[12px] text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition";

export default async function IncorporadorasPage() {
  let lista: Incorporadora[] = [];
  let erro = "";
  try {
    lista = await api<Incorporadora[]>("/incorporadoras", { token: await getToken() });
  } catch (e) {
    erro = (e as Error).message;
  }

  return (
    <>
      <PageHeader
        eyebrow="Carteira"
        title="Incorporadoras"
        subtitle="Navegue pela hierarquia de incorporadoras e seus empreendimentos. A Ribeira aparece destacada com bolinha royal; concorrentes em cinza."
      />

      <Card variant="lg" className="mb-5 tablm-up">
        <form action={criarIncorporadora} className="flex gap-3">
          <input name="nome" required placeholder="Nome da incorporadora…" className={campo} />
          <Button type="submit">Adicionar</Button>
        </form>
      </Card>

      {erro ? (
        <div className="rounded-[12px] border border-warn-line bg-warn-bg text-warn-strong px-4 py-3 text-[13.5px]">
          Não consegui carregar do backend: <b>{erro}</b>.
        </div>
      ) : lista.length === 0 ? (
        <Card>
          <div className="text-[14px] text-muted">
            Nenhuma incorporadora ainda. Adicione a primeira no formulário acima.
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 tablm-up">
          {lista.map((inc) => {
            const nossa = inc.nome.toLowerCase().includes("ribeira");
            return (
              <Link
                key={inc.id}
                href={`/incorporadoras/${inc.id}`}
                className="bg-white border border-line rounded-[14px] p-[18px_20px] shadow-[0_1px_3px_rgba(20,40,90,0.05)] hover:border-royal transition-colors flex items-center gap-3"
              >
                <span
                  className={
                    nossa
                      ? "w-[10px] h-[10px] rounded-full bg-royal shrink-0"
                      : "w-[10px] h-[10px] rounded-full bg-[#D4DAE6] shrink-0"
                  }
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-ink text-[15px] truncate">{inc.nome}</div>
                  <div className="text-[12px] text-faint mt-0.5">
                    {nossa ? "Nossa" : "Concorrente"}
                  </div>
                </div>
                {nossa && <Chip tom="royal">RIBEIRA</Chip>}
                <span className="text-[12px] text-muted">→</span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
