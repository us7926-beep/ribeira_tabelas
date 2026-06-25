"use server";

import { revalidatePath } from "next/cache";

import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

/** "DD/MM/AAAA" -> "AAAA-MM-DD" (para colunas date do Postgres). Vazio -> null. */
function paraISO(br: string): string | null {
  const m = (br || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export interface EntradaEvento {
  empreendimentoId: string | null;
  novoNome: string;
  novaIncorporadoraId: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  condicoes: string;
}

/** Cria o empreendimento (se for novo) e registra o evento/promoção detectado. */
export async function registrarEventoDeFlyer(entrada: EntradaEvento) {
  const token = await getToken();

  let empId = entrada.empreendimentoId;
  if (!empId) {
    if (!entrada.novoNome.trim() || !entrada.novaIncorporadoraId) {
      throw new Error("Para criar um empreendimento, informe o nome e a incorporadora.");
    }
    const emp = await api<{ id: string }>("/empreendimentos", {
      method: "POST",
      token,
      body: JSON.stringify({
        incorporadora_id: entrada.novaIncorporadoraId,
        nome: entrada.novoNome.trim(),
      }),
    });
    empId = emp.id;
  }

  await api("/benchmark/eventos", {
    method: "POST",
    token,
    body: JSON.stringify({
      empreendimento_id: empId,
      descricao: entrada.descricao || null,
      data_inicio: paraISO(entrada.dataInicio),
      data_fim: paraISO(entrada.dataFim),
      condicoes_comerciais: entrada.condicoes || null,
    }),
  });

  revalidatePath("/benchmark/eventos");
}
