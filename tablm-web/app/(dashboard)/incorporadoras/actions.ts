"use server";

import { revalidatePath } from "next/cache";

import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

export async function criarIncorporadora(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return;
  await api("/incorporadoras", {
    method: "POST",
    token: await getToken(),
    body: JSON.stringify({ nome }),
  });
  revalidatePath("/incorporadoras");
}

export async function criarEmpreendimento(formData: FormData) {
  const incorporadora_id = String(formData.get("incorporadora_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!incorporadora_id || !nome) return;
  const corpo = {
    incorporadora_id,
    nome,
    cidade: String(formData.get("cidade") ?? "").trim() || undefined,
    bairro: String(formData.get("bairro") ?? "").trim() || undefined,
    padrao: String(formData.get("padrao") ?? "").trim() || undefined,
  };
  await api("/empreendimentos", {
    method: "POST",
    token: await getToken(),
    body: JSON.stringify(corpo),
  });
  revalidatePath(`/incorporadoras/${incorporadora_id}`);
}

/** Remove um empreendimento. Devolve `{ok, erro?}` para o cliente
 * exibir o motivo sem mascarar (Next 16 mascara erros lançados em
 * server actions na produção). */
export async function excluirEmpreendimento(
  id: string,
  incorporadoraId: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!id) return { ok: false, erro: "ID ausente" };
  try {
    await api(`/empreendimentos/${id}`, {
      method: "DELETE",
      token: await getToken(),
    });
    if (incorporadoraId) revalidatePath(`/incorporadoras/${incorporadoraId}`);
    revalidatePath("/incorporadoras");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}
