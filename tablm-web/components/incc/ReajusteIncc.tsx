"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dropzone } from "@/components/ui/Dropzone";
import { RoyalCard } from "@/components/ui/RoyalCard";

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
  "w-full rounded-[12px] border border-line bg-white px-[15px] py-[13px] text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition";

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

function formatarCompetencia(c: string) {
  const m = c.match(/^(\d{4})-(\d{2})/);
  if (!m) return c;
  const mes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(m[2]) - 1];
  return `${mes} ${m[1]}`;
}

export default function ReajusteIncc({ variacoes }: { variacoes: Variacao[] }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [variacaoPct, setVariacaoPct] = useState(variacoes[0]?.variacao?.toString() ?? "");
  const [extraPct, setExtraPct] = useState("0");
  const [extraValor, setExtraValor] = useState("0");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [res, setRes] = useState<Resultado | null>(null);

  const inccAtual = useMemo(
    () => variacoes.find((v) => v.variacao.toString() === variacaoPct) ?? variacoes[0],
    [variacoes, variacaoPct],
  );
  const totalPct = (Number(variacaoPct) || 0) + (Number(extraPct) || 0);

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
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
      {/* Coluna esquerda — 3 cards */}
      <div className="flex flex-col gap-4">
        <Card variant="lg">
          <div className="text-[12px] font-bold tracking-[1.4px] uppercase text-muted mb-2">
            Índice INCC do mês
          </div>
          <div className="text-[14px] font-bold text-ink mb-3">
            INCC-DI {inccAtual ? formatarCompetencia(inccAtual.competencia) : "—"}
          </div>
          <select
            value={variacaoPct}
            onChange={(e) => setVariacaoPct(e.target.value)}
            className={campo}
          >
            {variacoes.length === 0 && <option value="">(BCB indisponível)</option>}
            {variacoes.map((v) => (
              <option key={v.competencia} value={v.variacao}>
                {formatarCompetencia(v.competencia)} · {v.variacao.toLocaleString("pt-BR")}%
              </option>
            ))}
          </select>
          <div className="text-[11.5px] text-faint mt-3">
            Fonte oficial: Banco Central · série 192.
          </div>
        </Card>

        <Card variant="lg">
          <div className="text-[12px] font-bold tracking-[1.4px] uppercase text-muted mb-3">
            Acréscimo adicional
          </div>
          <label className="block text-[12px] font-semibold text-body mb-1.5">% adicional</label>
          <input value={extraPct} onChange={(e) => setExtraPct(e.target.value)} className={`${campo} mb-3`} />
          <label className="block text-[12px] font-semibold text-body mb-1.5">R$ por unidade</label>
          <input value={extraValor} onChange={(e) => setExtraValor(e.target.value)} className={campo} />
        </Card>

        <RoyalCard>
          <div className="text-[11px] font-bold tracking-[1.6px] uppercase text-white/75 mb-2">
            Reajuste a aplicar
          </div>
          <div className="text-[42px] font-extrabold tnum leading-none mb-1">
            {totalPct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
          </div>
          <div className="text-[12.5px] text-white/80 leading-relaxed">
            INCC {(Number(variacaoPct) || 0).toLocaleString("pt-BR")}% + extra {(Number(extraPct) || 0).toLocaleString("pt-BR")}%
            {Number(extraValor) ? ` + R$ ${Number(extraValor).toLocaleString("pt-BR")} por unidade` : ""}.
          </div>
        </RoyalCard>
      </div>

      {/* Coluna direita — upload + tabela */}
      <div className="flex flex-col gap-4">
        <Card variant="lg">
          <div className="text-[16px] font-bold text-ink mb-0.5">Tabela base</div>
          <div className="text-[12.5px] text-muted mb-4">
            Suba o CSV/Excel com a coluna de valor — detectamos automaticamente.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1.6fr_auto] gap-4 items-end">
            <Dropzone
              arquivo={arquivo}
              onArquivo={setArquivo}
              aceitar=".csv,.xlsx,.xls"
              titulo="Arraste a tabela base aqui"
              dica="CSV ou Excel · até 50 MB"
            />
            <Button onClick={reajustar} disabled={!arquivo || carregando}>
              {carregando ? "Reajustando..." : "Reajustar tabela"}
            </Button>
          </div>
        </Card>

        {erro && (
          <div className="rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line">
            {erro}
          </div>
        )}

        {res && (
          <Card variant="lg">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <div className="text-[16px] font-bold text-ink">Tabela reajustada</div>
                <div className="text-[12.5px] text-muted mt-0.5">
                  {res.linhas} unidades · reajuste de{" "}
                  <b className="text-royal">
                    {res.percentual_total.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                  </b>{" "}
                  sobre <b className="text-ink">{res.coluna_valor}</b>
                </div>
              </div>
              <Button variante="secondary" onClick={() => baixarCsv(res.registros)}>
                ⬇ Baixar CSV
              </Button>
            </div>

            <div className="overflow-auto border border-line-soft rounded-[12px]">
              <table className="w-full text-[14px]">
                <thead className="bg-thead text-muted">
                  <tr>
                    {colunas.map((c) => (
                      <th
                        key={c}
                        className="text-left font-bold text-[12px] uppercase tracking-[0.4px] px-4 py-3 whitespace-nowrap"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {res.registros.slice(0, 100).map((reg, i) => (
                    <tr key={i} className="border-t border-line-soft">
                      {colunas.map((c) => (
                        <td
                          key={c}
                          className={`px-4 py-[13px] whitespace-nowrap ${
                            c === "valor_reajustado"
                              ? "font-bold text-royal tnum"
                              : c.startsWith("dif") || c === "diferenca"
                                ? "text-up font-semibold tnum"
                                : "text-body tnum"
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
          </Card>
        )}
      </div>
    </div>
  );
}
