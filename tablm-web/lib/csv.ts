/** Geração e download de CSV no client. Sem deps. */

/** Escapa um valor segundo RFC 4180 mínima: aspas duplas no conteúdo
 * viram `""`; valores com vírgula, aspa ou quebra ficam entre aspas. */
export function escaparCelula(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor).replace(/"/g, '""');
  return /[",\n\r]/.test(texto) ? `"${texto}"` : texto;
}

/** Monta uma string CSV a partir de cabeçalho + linhas (array de arrays). */
export function montarCsv(cabecalho: readonly string[], linhas: readonly unknown[][]): string {
  const linhasSerializadas = [
    cabecalho.map(escaparCelula).join(","),
    ...linhas.map((linha) => linha.map(escaparCelula).join(",")),
  ];
  return linhasSerializadas.join("\n");
}

/** Dispara o download no browser. Use só client-side. */
export function baixarCsv(nomeArquivo: string, csv: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo.endsWith(".csv") ? nomeArquivo : `${nomeArquivo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Atalho: monta CSV a partir de registros + lista de colunas
 * `{chave, label}` e dispara o download. Cobre o caso comum de
 * "exportar essa tabela". */
export function exportarTabelaCsv<T>(
  nomeArquivo: string,
  colunas: readonly { chave: keyof T | string; label: string }[],
  registros: readonly T[],
): void {
  const cabecalho = colunas.map((c) => c.label);
  const linhas = registros.map((reg) =>
    colunas.map((c) => (reg as Record<string, unknown>)[c.chave as string]),
  );
  baixarCsv(nomeArquivo, montarCsv(cabecalho, linhas));
}
