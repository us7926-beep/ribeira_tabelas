"use server";

import { revalidatePath } from "next/cache";

import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

export async function apagarDocumento(
  docId: string,
  empId: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  // Padrão {ok, erro}: Server Action que lança tem a mensagem mascarada
  // em produção pelo Next — o caller precisa do detalhe pra exibir.
  try {
    await api(`/documentos/${docId}`, { method: "DELETE", token: await getToken() });
    revalidatePath(`/empreendimentos/${empId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}
