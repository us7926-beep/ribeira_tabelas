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

/** Renomeia uma incorporadora. Devolve `{ok, erro?}` (padrao do projeto). */
export async function atualizarIncorporadora(
  id: string,
  nome: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!id) return { ok: false, erro: "ID ausente" };
  const trim = nome.trim();
  if (!trim) return { ok: false, erro: "Nome é obrigatório" };
  try {
    await api(`/incorporadoras/${id}`, {
      method: "PATCH",
      token: await getToken(),
      body: JSON.stringify({ nome: trim }),
    });
    revalidatePath("/incorporadoras");
    revalidatePath(`/incorporadoras/${id}`);
    revalidatePath("/empreendimentos");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
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

/** Atualiza campos basicos do empreendimento (nome/cidade/bairro/padrao).
 * Reusa PATCH /empreendimentos/{id}/ficha — o backend ja aceita esses
 * campos (entre varios outros da ficha tecnica). */
export async function atualizarEmpreendimento(
  id: string,
  incorporadoraId: string,
  dados: {
    nome?: string;
    cidade?: string;
    bairro?: string;
    padrao?: string;
    cvcrm_id?: number | null;
  },
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!id) return { ok: false, erro: "ID ausente" };
  const { cvcrm_id, ...textos } = dados;
  const corpo: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(textos)) {
    const trim = (v ?? "").trim();
    if (trim) corpo[k] = trim;
  }
  // cvcrm_id é numérico — não passa pelo trim de string.
  if (typeof cvcrm_id === "number" && Number.isFinite(cvcrm_id)) {
    corpo.cvcrm_id = cvcrm_id;
  }
  if (Object.keys(corpo).length === 0) {
    return { ok: false, erro: "Nada para atualizar" };
  }
  try {
    await api(`/empreendimentos/${id}/ficha`, {
      method: "PATCH",
      token: await getToken(),
      body: JSON.stringify(corpo),
    });
    if (incorporadoraId) revalidatePath(`/incorporadoras/${incorporadoraId}`);
    revalidatePath("/incorporadoras");
    revalidatePath("/empreendimentos");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

/** Remove uma incorporadora. Backend devolve 409 quando há
 * empreendimentos vinculados — devolvemos uma mensagem amigável
 * pro frontend exibir em vez do "Erro 409" cru. */
export async function excluirIncorporadora(
  id: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!id) return { ok: false, erro: "ID ausente" };
  try {
    await api(`/incorporadoras/${id}`, {
      method: "DELETE",
      token: await getToken(),
    });
    revalidatePath("/incorporadoras");
    return { ok: true };
  } catch (e) {
    const msg = (e as Error).message;
    if (/409/.test(msg) || /vinculad/i.test(msg)) {
      return {
        ok: false,
        erro:
          "Esta incorporadora ainda tem empreendimentos vinculados — exclua-os primeiro (entre na incorporadora e use o × em cada card).",
      };
    }
    return { ok: false, erro: msg };
  }
}
