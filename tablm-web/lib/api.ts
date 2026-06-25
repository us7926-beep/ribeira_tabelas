/** Cliente HTTP do backend FastAPI. Base via NEXT_PUBLIC_API_URL. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ApiInit = RequestInit & { token?: string | null };

export async function api<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  const resposta = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (!resposta.ok) {
    let detalhe = `Erro ${resposta.status}`;
    try {
      detalhe = (await resposta.json()).detail ?? detalhe;
    } catch {
      /* corpo não-JSON */
    }
    throw new Error(detalhe);
  }
  if (resposta.status === 204) return undefined as T;
  return resposta.json() as Promise<T>;
}
