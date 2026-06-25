"use client";

import { useState } from "react";

interface Variacao {
  competencia: string;
  variacao: number;
}

interface Resultado {
  coluna_valor: string;
  percentual_total: number;
  linhas: number;
  registros: Record<string, unknown>[];
}

const campo =
  "rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-royal text-sm";

function baixarCsv(registros: Record<string, unknown>[]) {
  if (!registros.length) return;
  const cols = Object.keys(registros[0]);
  const linhas = [cols.join(",")];
  for (const reg of registros) {
    linhas.push(
      cols
        .map((c) => {
          const s = String(reg[c] ?? "").replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })
        .join(","),
    );
  }
  const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tabela_reajustada.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReajusteIncc({ variacoes }: { variacoes: Variacao[] }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [variacaoPct, setVariacaoPct] = useState(variacoes[0]?.variacao?.toString() ?? "");
  const [extraPct, setExtraPct] = useState("0");
  const [extraValor, setExtraValor] = useState("0");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [res, setRes] = useState<Resultado | null>(null);

  async function reajustar() {
    if (!arquivo) return;
    setErro("");
    setRes(null);
    setCarregando(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      fd.append("variacao_pct", variacaoPct || "0");
      fd.append("extra_pct", extraPct || "0");
      fd.append("extra_valor", extraValor || "0");
      const r = await fetch("/api/incc/reajustar", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Falha ao reajustar");
      setRes(d as Resultado);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  const colunas = res?.registros.length ? Object.keys(res.registros[0]) : [];

  return (
    <div>
      <div className="bg-white rounded-2xl border border-line p-6 grid gap-3 max-w-3xl">
        <div className="grid sm:grid-cols-3 gap-2">
          <label className="text-sm">
            <span className="block text-xs font-semibold text-muted mb-1">INCC do mês</span>
            <select
              value={variacaoPct}
              onChange={(e) => setVariacaoPct(e.target.value)}
              className={`${campo} w-full`}
            >
              {variacoes.length === 0 && <option value="">(BCB indisponível)</option>}
              {variacoes.map((v) => (
                <option key={v.competencia} value={v.variacao}>
                  {v.competencia} · {v.variacao.toLocaleString("pt-BR")}%
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs font-semibold text-muted mb-1">% extra</span>
            <input value={extraPct} onChange={(e) => setExtraPct(e.target.value)} className={`${campo} w-full`} />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-semibold text-muted mb-1">R$ extra/unidade</span>
            <input value={extraValor} onChange={(e) => setExtraValor(e.target.value)} className={`${campo} w-full`} />
          </label>
        </div>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-lg file:border-0 file:bg-royal file:text-white file:px-4 file:py-2 file:font-semibold hover:file:bg-royal-dark"
        />
        <button
          onClick={reajustar}
          disabled={!arquivo || carregando}
          className="rounded-lg bg-royal hover:bg-royal-dark text-white font-semibold px-5 py-2.5 disabled:opacity-50 w-fit"
        >
          {carregando ? "Reajustando..." : "Reajustar tabela"}
        </button>
      </div>

      {erro && (
        <div className="mt-4 rounded-lg bg-red-50 text-neg text-sm px-3 py-2 border border-red-100">{erro}</div>
      )}

      {res && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-muted">
              {res.linhas} unidades · reajuste total de <b>{res.percentual_total.toLocaleString("pt-BR")}%</b> sobre a
              coluna <b>{res.coluna_valor}</b>
            </div>
            <button
              onClick={() => baixarCsv(res.registros)}
              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-surface"
            >
              ⬇️ Baixar CSV
            </button>
          </div>
          <div className="overflow-auto bg-white rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  {colunas.map((c) => (
                    <th key={c} className="text-left font-semibold px-3 py-2 whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {res.registros.slice(0, 100).map((reg, i) => (
                  <tr key={i} className="border-t border-line">
                    {colunas.map((c) => (
                      <td
                        key={c}
                        className={`px-3 py-2 whitespace-nowrap ${
                          c === "valor_reajustado" ? "font-semibold text-royal tabular-nums" : "text-ink-soft"
                        }`}
                      >
                        {String(reg[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
