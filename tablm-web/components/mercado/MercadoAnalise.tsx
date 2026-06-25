"use client";

import { useState } from "react";

interface KPIs {
  total_unidades: number;
  incorporadoras: number;
  preco_m2_medio: number | null;
  ticket_medio: number | null;
  vgv_total: number;
}

interface Resultado {
  linhas: number;
  colunas_detectadas: { valor: string; area: string; unidade: string | null };
  kpis: KPIs;
}

const campo =
  "rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-royal text-sm";

function moeda(valor: number | null): string {
  if (valor == null) return "—";
  return "R$ " + Math.round(valor).toLocaleString("pt-BR");
}

function Card({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="bg-white rounded-2xl border border-line border-l-4 border-l-royal p-5">
      <div className="text-sm font-semibold text-muted">{titulo}</div>
      <div className="text-2xl font-extrabold text-ink mt-1 tabular-nums">{valor}</div>
    </div>
  );
}

export default function MercadoAnalise() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [tipo, setTipo] = useState("Concorrente");
  const [incorporadora, setIncorporadora] = useState("");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [padrao, setPadrao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [res, setRes] = useState<Resultado | null>(null);

  async function analisar() {
    if (!arquivo) return;
    setErro("");
    setRes(null);
    setCarregando(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      fd.append("tipo", tipo);
      fd.append("incorporadora", incorporadora);
      fd.append("cidade", cidade);
      fd.append("bairro", bairro);
      fd.append("padrao", padrao);
      const r = await fetch("/api/mercado/comparativo", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Falha ao processar a planilha");
      setRes(d as Resultado);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="bg-white rounded-2xl border border-line p-6 grid gap-3">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-lg file:border-0 file:bg-royal file:text-white file:px-4 file:py-2 file:font-semibold hover:file:bg-royal-dark"
        />
        <div className="grid sm:grid-cols-3 gap-2">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}>
            <option value="Nosso">Nosso</option>
            <option value="Concorrente">Concorrente</option>
          </select>
          <input value={incorporadora} onChange={(e) => setIncorporadora(e.target.value)} placeholder="Incorporadora" className={campo} />
          <input value={padrao} onChange={(e) => setPadrao(e.target.value)} placeholder="Padrão" className={campo} />
          <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade" className={campo} />
          <input value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Bairro" className={campo} />
          <button
            onClick={analisar}
            disabled={!arquivo || carregando}
            className="rounded-lg bg-royal hover:bg-royal-dark text-white font-semibold px-5 disabled:opacity-50"
          >
            {carregando ? "Processando..." : "Analisar planilha"}
          </button>
        </div>
      </div>

      {erro && (
        <div className="mt-4 rounded-lg bg-red-50 text-neg text-sm px-3 py-2 border border-red-100">
          {erro}
        </div>
      )}

      {res && (
        <div className="mt-6">
          <div className="text-sm text-muted mb-3">
            {res.linhas} unidades · colunas detectadas: valor=<b>{res.colunas_detectadas.valor}</b>,
            área=<b>{res.colunas_detectadas.area}</b>
            {res.colunas_detectadas.unidade ? <>, unidade=<b>{res.colunas_detectadas.unidade}</b></> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card titulo="Preço/m² médio" valor={moeda(res.kpis.preco_m2_medio)} />
            <Card titulo="Ticket médio" valor={moeda(res.kpis.ticket_medio)} />
            <Card titulo="VGV total" valor={moeda(res.kpis.vgv_total)} />
            <Card titulo="Unidades" valor={String(res.kpis.total_unidades)} />
          </div>
        </div>
      )}
    </div>
  );
}
