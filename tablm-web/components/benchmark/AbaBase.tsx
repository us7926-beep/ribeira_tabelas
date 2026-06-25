"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dropzone } from "@/components/ui/Dropzone";
import { KpiCard } from "@/components/ui/KpiCard";

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
  "w-full px-[15px] py-[13px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition";

function moeda(valor: number | null): string {
  if (valor == null) return "—";
  return "R$ " + Math.round(valor).toLocaleString("pt-BR");
}

export function AbaBase() {
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
    <div className="grid grid-cols-1 gap-5 tablm-up">
      <Card variant="lg">
        <div className="text-[16px] font-bold text-ink mb-0.5">Adicionar tabela à base</div>
        <div className="text-[12.5px] text-muted mb-4">
          CSV ou Excel. Detectamos automaticamente as colunas de valor e área.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
          <Dropzone
            arquivo={arquivo}
            onArquivo={setArquivo}
            aceitar=".csv,.xlsx,.xls"
            titulo="Arraste a tabela aqui"
            dica="CSV ou Excel · até 50 MB"
          />

          <div className="grid grid-cols-2 gap-2.5">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}>
              <option value="Nosso">Nosso</option>
              <option value="Concorrente">Concorrente</option>
            </select>
            <input
              value={incorporadora}
              onChange={(e) => setIncorporadora(e.target.value)}
              placeholder="Incorporadora"
              className={campo}
            />
            <input
              value={padrao}
              onChange={(e) => setPadrao(e.target.value)}
              placeholder="Padrão"
              className={campo}
            />
            <input
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Cidade"
              className={campo}
            />
            <input
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              placeholder="Bairro"
              className={`${campo} col-span-2`}
            />
            <div className="col-span-2 flex justify-end">
              <Button onClick={analisar} disabled={!arquivo || carregando}>
                {carregando ? "Processando..." : "Adicionar à base"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {erro && (
        <div className="rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line">
          {erro}
        </div>
      )}

      {res && (
        <div>
          <div className="text-[12.5px] text-muted mb-3">
            {res.linhas} unidades · colunas detectadas: valor=
            <b className="text-ink">{res.colunas_detectadas.valor}</b>, área=
            <b className="text-ink">{res.colunas_detectadas.area}</b>
            {res.colunas_detectadas.unidade ? (
              <>, unidade=<b className="text-ink">{res.colunas_detectadas.unidade}</b></>
            ) : null}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <KpiCard rotulo="Preço/m² médio" valor={moeda(res.kpis.preco_m2_medio)} />
            <KpiCard rotulo="Ticket médio" valor={moeda(res.kpis.ticket_medio)} />
            <KpiCard rotulo="VGV total" valor={moeda(res.kpis.vgv_total)} />
            <KpiCard rotulo="Unidades" valor={String(res.kpis.total_unidades)} />
          </div>
        </div>
      )}
    </div>
  );
}
