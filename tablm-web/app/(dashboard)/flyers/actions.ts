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
  /** ID de incorporadora existente. Quando vazio, cria uma nova com novoNomeIncorporadora. */
  novaIncorporadoraId: string;
  /** Usado só quando novaIncorporadoraId vem vazio: nome para cadastrar a incorporadora. */
  novoNomeIncorporadora?: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  condicoes: string;
}

export type ResultadoRegistro = { ok: true } | { ok: false; erro: string };

/**
 * Cria o empreendimento (se for novo) e registra o evento/promoção detectado.
 * Retorna o erro em vez de lançar: Server Actions que lançam têm a mensagem
 * mascarada em produção pelo Next ("An error occurred in the Server Components
 * render..."), escondendo o motivo real do usuário.
 */
export async function registrarEventoDeFlyer(entrada: EntradaEvento): Promise<ResultadoRegistro> {
  const token = await getToken();

  let empId = entrada.empreendimentoId;
  let empCriado = false;
  if (!empId) {
    if (!entrada.novoNome.trim()) {
      return { ok: false, erro: "Informe o nome do empreendimento." };
    }
    let incId = entrada.novaIncorporadoraId;
    if (!incId) {
      const nomeInc = (entrada.novoNomeIncorporadora ?? "").trim();
      if (!nomeInc) {
        return {
          ok: false,
          erro: "Selecione uma incorporadora existente ou informe o nome de uma nova.",
        };
      }
      // Cria a incorporadora se ela ainda não existe. Se o passo seguinte
      // (criar empreendimento) falhar, ela fica cadastrada mesmo assim — o
      // backend não expõe DELETE /incorporadoras/{id}; numa nova tentativa ela
      // já aparece no select e o usuário escolhe direto.
      try {
        const inc = await api<{ id: string }>("/incorporadoras", {
          method: "POST",
          token,
          body: JSON.stringify({ nome: nomeInc }),
        });
        incId = inc.id;
      } catch (err) {
        return { ok: false, erro: (err as Error).message };
      }
    }
    try {
      const emp = await api<{ id: string }>("/empreendimentos", {
        method: "POST",
        token,
        body: JSON.stringify({
          incorporadora_id: incId,
          nome: entrada.novoNome.trim(),
        }),
      });
      empId = emp.id;
      empCriado = true;
    } catch (err) {
      return { ok: false, erro: (err as Error).message };
    }
  }

  try {
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
  } catch (err) {
    if (empCriado && empId) {
      await api(`/empreendimentos/${empId}`, { method: "DELETE", token }).catch(() => {});
    }
    return { ok: false, erro: (err as Error).message };
  }

  revalidatePath("/benchmark/eventos");
  return { ok: true };
}
