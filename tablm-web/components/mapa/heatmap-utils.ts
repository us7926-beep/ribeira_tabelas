interface EntradaBruta {
  lat: number;
  lng: number;
  valor: number | null | undefined;
}

interface PontoNormalizado {
  lat: number;
  lng: number;
  peso: number;
}

/**
 * Normaliza uma lista de valores brutos (VGV, preço/m², etc) pro intervalo
 * `[minimoRelativo, 1]` — proporcional ao maior valor da lista.
 *
 * Piso em `minimoRelativo` (default 0.15) mantém pontos pequenos visíveis;
 * senão, um único empreendimento de VGV muito alto ofusca todos os outros
 * no heatmap.
 *
 * Filtra entradas sem valor útil (null/undefined/≤0).
 */
export function normalizarPontosHeatmap(
  entradas: EntradaBruta[],
  minimoRelativo = 0.15,
): PontoNormalizado[] {
  const validos = entradas.filter(
    (e): e is { lat: number; lng: number; valor: number } =>
      typeof e.valor === "number" && e.valor > 0,
  );
  if (validos.length === 0) return [];
  const max = Math.max(...validos.map((e) => e.valor));
  const espaco = 1 - minimoRelativo;
  return validos.map((e) => ({
    lat: e.lat,
    lng: e.lng,
    peso: minimoRelativo + espaco * (e.valor / max),
  }));
}
