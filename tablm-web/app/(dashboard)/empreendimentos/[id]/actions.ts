"use server";

import { revalidatePath } from "next/cache";

import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

export async function apagarDocumento(docId: string, empId: string) {
  await api(`/documentos/${docId}`, { method: "DELETE", token: await getToken() });
  revalidatePath(`/empreendimentos/${empId}`);
}
