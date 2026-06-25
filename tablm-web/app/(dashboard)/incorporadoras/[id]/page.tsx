import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Empreendimento, Incorporadora } from "@/types";

import { criarEmpreendimento } from "../actions";

export const dynamic = "force-dynamic";

const campo =
  "rounded-[12px] border border-line bg-white px-[15px] py-[12px] text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition";

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
    <>
      <Link
        href="/incorporadoras"
        className="text-[13px] text-muted hover:text-royal font-semibold inline-flex items-center gap-1 mb-3"
      >
        ← Incorporadoras
      </Link>
      <PageHeader
        eyebrow="Carteira"
        title={nome}
        subtitle="Empreendimentos desta incorporadora. Use para abrir o repositório de documentos e o histórico de eventos."
      />

      <Card variant="lg" className="mb-5 tablm-up">
        <form action={criarEmpreendimento} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input type="hidden" name="incorporadora_id" value={id} />
          <input
            name="nome"
            required
            placeholder="Nome do empreendimento *"
            className={`${campo} sm:col-span-2`}
          />
          <input name="cidade" placeholder="Cidade" className={campo} />
          <input name="bairro" placeholder="Bairro" className={campo} />
          <input name="padrao" placeholder="Padrão (ex.: Alto)" className={`${campo} sm:col-span-2`} />
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit">Adicionar empreendimento</Button>
          </div>
        </form>
      </Card>

      {erro ? (
        <div className="rounded-[12px] border border-warn-line bg-warn-bg text-warn-strong px-4 py-3 text-[13.5px]">
          Não consegui carregar do backend: <b>{erro}</b>.
        </div>
      ) : empreendimentos.length === 0 ? (
        <Card>
          <div className="text-[14px] text-muted">
            Nenhum empreendimento ainda. Adicione o primeiro no formulário acima.
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 tablm-up">
          {empreendimentos.map((emp) => (
            <Link
              key={emp.id}
              href={`/empreendimentos/${emp.id}`}
              className="bg-white border border-line rounded-[14px] p-[18px_20px] shadow-[0_1px_3px_rgba(20,40,90,0.05)] hover:border-royal transition-colors block"
            >
              <div className="font-bold text-ink text-[15px]">{emp.nome}</div>
              <div className="text-[12.5px] text-faint mt-0.5">
                {[emp.bairro, emp.cidade].filter(Boolean).join(" · ") || "—"}
              </div>
              {emp.padrao && (
                <div className="mt-2">
                  <Chip tom="royal">{emp.padrao}</Chip>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
