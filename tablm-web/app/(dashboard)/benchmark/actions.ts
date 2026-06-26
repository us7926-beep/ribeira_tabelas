"use server";

import { revalidatePath } from "next/cache";

import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

export interface EntradaCriarEmpDaIA {
  nomeEmp: string;
  /** Vazio quando vai criar uma nova incorporadora. */
  incorporadoraId: string;
  /** Usado quando incorporadoraId for vazio. */
  novaIncorporadoraNome?: string;
  bairro?: string;
  cidade?: string;
  padrao?: string;
}

export type ResultadoCriarEmp =
  | { ok: true; empreendimentoId: string }
  | { ok: false; erro: string };

/**
 * Cria empreendimento (e incorporadora, se necessário) a partir dos dados
 * detectados pela IA na Aba Base do Benchmark. Padrão idêntico ao flyer:
 * retorna {ok, erro} em vez de lançar (Next mascara em produção).
 */
export async function criarEmpreendimentoDaIA(
  entrada: EntradaCriarEmpDaIA,
): Promise<ResultadoCriarEmp> {
  const token = await getToken();
  if (!entrada.nomeEmp.trim()) {
    return { ok: false, erro: "Informe o nome do empreendimento." };
  }
  let incId = entrada.incorporadoraId;
  if (!incId) {
    const nomeInc = (entrada.novaIncorporadoraNome ?? "").trim();
    if (!nomeInc) {
      return {
        ok: false,
        erro: "Selecione uma incorporadora existente ou informe o nome de uma nova.",
      };
    }
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
        nome: entrada.nomeEmp.trim(),
        bairro: entrada.bairro?.trim() || undefined,
        cidade: entrada.cidade?.trim() || undefined,
        padrao: entrada.padrao?.trim() || undefined,
      }),
    });
    revalidatePath("/benchmark");
    revalidatePath(`/incorporadoras/${incId}`);
    return { ok: true, empreendimentoId: emp.id };
  } catch (err) {
    return { ok: false, erro: (err as Error).message };
  }
}
