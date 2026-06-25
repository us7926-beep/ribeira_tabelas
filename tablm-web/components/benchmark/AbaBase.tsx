"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Dropzone } from "@/components/ui/Dropzone";
import { KpiCard } from "@/components/ui/KpiCard";
import type { Empreendimento } from "@/types";

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

export function AbaBase({ empreendimentos = [] }: { empreendimentos?: Empreendimento[] }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [tipo, setTipo] = useState("Concorrente");
  const [incorporadora, setIncorporadora] = useState("");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [padrao, setPadrao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [res, setRes] = useState<Resultado | null>(null);

  // Estado da vinculação a um empreendimento (persiste KPIs no backend).
  const [empId, setEmpId] = useState("");
  const [tipoKpi, setTipoKpi] = useState<"mercado" | "vendas">("mercado");
  const [vinculando, setVinculando] = useState(false);
  const [vinculado, setVinculado] = useState("");

  async function analisar() {
    if (!arquivo) return;
    setErro("");
    setRes(null);
    setVinculado("");
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

  async function vincular() {
    if (!arquivo || !empId) return;
    setErro("");
    setVinculado("");
    setVinculando(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      fd.append("tipo", tipoKpi);
      const r = await fetch(`/api/empreendimentos/${empId}/kpis`, { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Falha ao persistir KPIs");
      const nomeEmp = empreendimentos.find((e) => e.id === empId)?.nome ?? "empreendimento";
      setVinculado(`KPIs salvos em "${nomeEmp}" — Benchmark já reflete os números reais.`);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setVinculando(false);
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
                {carregando ? "Processando..." : "Analisar planilha"}
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

      {vinculado && (
        <div className="rounded-[12px] bg-up-bg text-up-strong text-[13.5px] px-4 py-3 border border-up-line">
          {vinculado}
        </div>
      )}

      {res && (
        <>
          <div className="text-[12.5px] text-muted">
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

          {/* Vincular a um empreendimento — persiste KPIs no banco */}
          <Card variant="lg">
            <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
              <div>
                <div className="text-[16px] font-bold text-ink">Vincular ao empreendimento</div>
                <div className="text-[12.5px] text-muted mt-0.5">
                  Salva os KPIs no empreendimento escolhido. O Benchmark passa a refletir os
                  números reais (no Panorama, Head-to-head e Oportunidades).
                </div>
              </div>
              <Chip tom="royal">Opcional</Chip>
            </div>
            {empreendimentos.length === 0 ? (
              <div className="text-[13.5px] text-muted">
                Cadastre um empreendimento em <b>Carteira</b> antes de vincular.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-[1.5fr_180px_auto] gap-2.5 items-end">
                <select value={empId} onChange={(e) => setEmpId(e.target.value)} className={campo}>
                  <option value="">Selecione o empreendimento…</option>
                  {empreendimentos.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nome}
                    </option>
                  ))}
                </select>
                <select
                  value={tipoKpi}
                  onChange={(e) => setTipoKpi(e.target.value as "mercado" | "vendas")}
                  className={campo}
                >
                  <option value="mercado">Tabela de mercado</option>
                  <option value="vendas">Tabela de vendas</option>
                </select>
                <Button onClick={vincular} disabled={!empId || vinculando}>
                  {vinculando ? "Salvando..." : "Salvar KPIs"}
                </Button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
