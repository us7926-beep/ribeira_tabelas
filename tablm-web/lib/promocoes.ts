import type { EventoPromocional } from "@/types";

/** Dias até `data_fim` (negativo = expirado). `null` se data ausente/inválida. */
export function diasAteVencer(dataFim: string | null | undefined): number | null {
  if (!dataFim) return null;
  const m = dataFim.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const fim = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);
  return Math.round((fim.getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000));
}

/** Conta eventos com `data_fim` no horizonte (não expirados). */
export function contarVencendo(eventos: EventoPromocional[]): {
  vencendo7d: number;
  vencendo3d: number;
} {
  let v7 = 0;
  let v3 = 0;
  for (const ev of eventos) {
    const d = diasAteVencer(ev.data_fim);
    if (d === null || d < 0) continue;
    if (d <= 7) v7 += 1;
    if (d <= 3) v3 += 1;
  }
  return { vencendo7d: v7, vencendo3d: v3 };
}
