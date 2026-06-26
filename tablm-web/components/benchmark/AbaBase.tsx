"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { criarEmpreendimentoDaIA } from "@/app/(dashboard)/benchmark/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Dropzone } from "@/components/ui/Dropzone";
import { KpiCard } from "@/components/ui/KpiCard";
import type { Empreendimento, Incorporadora } from "@/types";

interface KPIs {
  total_unidades: number;
  incorporadoras: number;
  preco_m2_medio: number | null;
  ticket_medio: number | null;
  vgv_total: number;
}

interface PromocaoIA {
  descricao: string;
  data_inicio?: string;
  data_fim?: string;
  condicoes?: string;
}

interface IAResultado {
  nome_empreendimento?: string;
  incorporadora?: string;
  cidade?: string;
  bairro?: string;
  padrao?: string;
  promocoes?: PromocaoIA[];
}

interface Resultado {
  linhas: number;
  colunas_detectadas: { valor: string; area: string; unidade: string | null };
  kpis: KPIs;
  ia?: IAResultado;
}

const campo =
  "w-full px-[15px] py-[13px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition";

function moeda(valor: number | null): string {
  if (valor == null) return "—";
  return "R$ " + Math.round(valor).toLocaleString("pt-BR");
}

function paraISO(br: string): string | null {
  const m = (br || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function AbaBase({
  empreendimentos = [],
  incorporadoras = [],
}: {
  empreendimentos?: Empreendimento[];
  incorporadoras?: Incorporadora[];
}) {
  const router = useRouter();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [tipo, setTipo] = useState("Concorrente");
  const [incorporadora, setIncorporadora] = useState("");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [padrao, setPadrao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [res, setRes] = useState<Resultado | null>(null);

  // Vinculação a um empreendimento (persiste KPIs no banco).
  const [empId, setEmpId] = useState("");
  const [tipoKpi, setTipoKpi] = useState<"mercado" | "vendas">("mercado");
  const [vinculando, setVinculando] = useState(false);
  const [vinculado, setVinculado] = useState("");

  // Criar empreendimento direto a partir do que a IA detectou.
  const [novoIncId, setNovoIncId] = useState("");
  const [novaIncNome, setNovaIncNome] = useState("");
  const [criando, setCriando] = useState(false);

  // Promoções detectadas pela IA — controla quais já foram registradas.
  const [promocoesRegistradas, setPromocoesRegistradas] = useState<Set<number>>(new Set());
  const [registrandoIdx, setRegistrandoIdx] = useState<number | null>(null);

  async function analisar() {
    if (!arquivo) return;
    setErro("");
    setRes(null);
    setVinculado("");
    setPromocoesRegistradas(new Set());
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

  async function registrarPromocao(idx: number, promo: PromocaoIA) {
    if (!empId) {
      setErro("Escolha o empreendimento para vincular a promoção.");
      return;
    }
    setErro("");
    setRegistrandoIdx(idx);
    try {
      const r = await fetch("/api/benchmark/eventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empreendimento_id: empId,
          descricao: promo.descricao,
          data_inicio: paraISO(promo.data_inicio ?? ""),
          data_fim: paraISO(promo.data_fim ?? ""),
          condicoes_comerciais: promo.condicoes ?? "",
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail ?? "Falha ao registrar promoção");
      }
      setPromocoesRegistradas((prev) => new Set(prev).add(idx));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setRegistrandoIdx(null);
    }
  }

  const ia = res?.ia;
  const promocoes = ia?.promocoes ?? [];

  /** Empreendimento detectado pela IA ja existe? Compara por nome (lowercase). */
  const empExistente = useMemo(() => {
    const nomeIA = (ia?.nome_empreendimento ?? "").trim().toLowerCase();
    if (!nomeIA) return undefined;
    return empreendimentos.find((e) => e.nome.trim().toLowerCase() === nomeIA);
  }, [ia, empreendimentos]);

  /** Pré-seleciona incorporadora se a IA bateu com uma cadastrada. */
  useMemo(() => {
    if (!ia) return;
    const nomeInc = (ia.incorporadora ?? "").trim().toLowerCase();
    if (!nomeInc) {
      setNovoIncId("__criar__");
      setNovaIncNome("");
      return;
    }
    const match = incorporadoras.find((i) => i.nome.trim().toLowerCase() === nomeInc);
    if (match) {
      setNovoIncId(match.id);
      setNovaIncNome("");
    } else {
      setNovoIncId("__criar__");
      setNovaIncNome(ia.incorporadora ?? "");
    }
  }, [ia, incorporadoras]);

  /** Cria empreendimento (e inc se preciso) + vincula KPIs imediatamente. */
  async function criarEVincular() {
    if (!arquivo || !ia?.nome_empreendimento) return;
    setErro("");
    setVinculado("");
    setCriando(true);
    try {
      const resCriar = await criarEmpreendimentoDaIA({
        nomeEmp: ia.nome_empreendimento,
        incorporadoraId: novoIncId === "__criar__" ? "" : novoIncId,
        novaIncorporadoraNome: novoIncId === "__criar__" ? novaIncNome : undefined,
        bairro: ia.bairro,
        cidade: ia.cidade,
        padrao: ia.padrao,
      });
      if (!resCriar.ok) {
        setErro(resCriar.erro);
        return;
      }
      // Imediatamente persiste os KPIs do upload no empreendimento recém-criado.
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      fd.append("tipo", tipoKpi);
      const r = await fetch(
        `/api/empreendimentos/${resCriar.empreendimentoId}/kpis`,
        { method: "POST", body: fd },
      );
      const d = await r.json();
      if (!r.ok) {
        setErro(
          `Empreendimento criado, mas falhou ao salvar KPIs: ${d.detail ?? "erro"}`,
        );
        router.refresh();
        return;
      }
      setVinculado(
        `"${ia.nome_empreendimento}" criado e KPIs salvos. Benchmark já reflete os números reais.`,
      );
      setEmpId(resCriar.empreendimentoId);
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCriando(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 tablm-up">
      <Card variant="lg">
        <div className="text-[16px] font-bold text-ink mb-0.5">Adicionar tabela à base</div>
        <div className="text-[12.5px] text-muted mb-4">
          PDF, imagem, CSV ou Excel. Detectamos automaticamente as colunas de valor e área —
          quando for PDF/imagem, a IA lê as unidades e identifica promoções.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
          <Dropzone
            arquivo={arquivo}
            onArquivo={setArquivo}
            aceitar=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls"
            titulo="Arraste a tabela aqui"
            dica="PDF, imagem, CSV ou Excel · até 25 MB"
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
                {carregando ? "Processando..." : "Analisar tabela"}
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

          {ia && (
            <Card>
              <div className="flex items-center gap-2 flex-wrap">
                <Chip tom="royal">IA</Chip>
                <span className="text-[13.5px] text-body">
                  Detectei <b>{res.linhas} unidades</b>
                  {ia.nome_empreendimento && (
                    <>
                      {" "}em <b className="text-ink">{ia.nome_empreendimento}</b>
                    </>
                  )}
                  {ia.incorporadora && (
                    <>
                      {" "}(<b>{ia.incorporadora}</b>)
                    </>
                  )}
                  {ia.bairro && (
                    <>
                      {" · "}
                      <b>{ia.bairro}</b>
                    </>
                  )}
                  {ia.padrao && (
                    <>
                      {" · padrão "}
                      <b>{ia.padrao}</b>
                    </>
                  )}
                  .
                </span>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <KpiCard rotulo="Preço/m² médio" valor={moeda(res.kpis.preco_m2_medio)} />
            <KpiCard rotulo="Ticket médio" valor={moeda(res.kpis.ticket_medio)} />
            <KpiCard rotulo="VGV total" valor={moeda(res.kpis.vgv_total)} />
            <KpiCard rotulo="Unidades" valor={String(res.kpis.total_unidades)} />
          </div>

          {/* Criar empreendimento direto (quando IA detectou um nome inédito). */}
          {ia?.nome_empreendimento && !empExistente && (
            <Card variant="lg">
              <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                <div>
                  <div className="text-[16px] font-bold text-ink">
                    + Criar &quot;{ia.nome_empreendimento}&quot; e vincular KPIs
                  </div>
                  <div className="text-[12.5px] text-muted mt-0.5">
                    A IA não encontrou esse empreendimento na sua Carteira. Em um clique,
                    cadastro ele (e a incorporadora, se nova) e já gravo os KPIs desta tabela.
                  </div>
                </div>
                <Chip tom="royal">via IA</Chip>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 items-end">
                <select
                  value={novoIncId}
                  onChange={(e) => setNovoIncId(e.target.value)}
                  className={campo}
                >
                  <option value="">Incorporadora…</option>
                  {incorporadoras.map((inc) => (
                    <option key={inc.id} value={inc.id}>
                      {inc.nome}
                    </option>
                  ))}
                  <option value="__criar__">+ Cadastrar nova incorporadora…</option>
                </select>
                {novoIncId === "__criar__" ? (
                  <input
                    value={novaIncNome}
                    onChange={(e) => setNovaIncNome(e.target.value)}
                    placeholder="Nome da nova incorporadora"
                    className={campo}
                  />
                ) : (
                  <div />
                )}
                <select
                  value={tipoKpi}
                  onChange={(e) => setTipoKpi(e.target.value as "mercado" | "vendas")}
                  className={campo}
                >
                  <option value="mercado">Tabela de mercado</option>
                  <option value="vendas">Tabela de vendas</option>
                </select>
                <Button
                  onClick={criarEVincular}
                  disabled={criando || (novoIncId === "__criar__" && !novaIncNome.trim())}
                >
                  {criando
                    ? "Criando…"
                    : `Criar "${ia.nome_empreendimento}" + salvar KPIs`}
                </Button>
              </div>
            </Card>
          )}

          {empExistente && (
            <Card>
              <div className="flex items-center gap-2 flex-wrap text-[13.5px] text-body">
                <Chip tom="up">já cadastrado</Chip>
                Empreendimento <b className="text-ink">{empExistente.nome}</b> já está na sua
                Carteira. Use o painel abaixo para vincular os KPIs.
              </div>
            </Card>
          )}

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

          {/* Promoções detectadas pela IA */}
          {promocoes.length > 0 && (
            <Card variant="lg">
              <div className="flex items-center gap-2 mb-3">
                <Chip tom="warn">Promoções detectadas</Chip>
                <span className="text-[13.5px] text-muted">
                  Registre cada uma como evento no benchmark (timeline de Movimentos).
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {promocoes.map((p, i) => {
                  const registrada = promocoesRegistradas.has(i);
                  return (
                    <div
                      key={i}
                      className="bg-thead border border-line-soft rounded-[12px] p-4 flex flex-col gap-2"
                    >
                      <div className="text-[14px] font-bold text-ink">{p.descricao}</div>
                      <div className="flex items-center gap-3 flex-wrap text-[12.5px] text-muted">
                        {(p.data_inicio || p.data_fim) && (
                          <span className="tnum">
                            {p.data_inicio || "—"} → {p.data_fim || "—"}
                          </span>
                        )}
                        {p.condicoes && (
                          <span className="text-body">
                            <b>Condições:</b> {p.condicoes}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-end mt-1">
                        {registrada ? (
                          <Chip tom="up">Registrada</Chip>
                        ) : (
                          <Button
                            variante="secondary"
                            onClick={() => registrarPromocao(i, p)}
                            disabled={!empId || registrandoIdx === i}
                          >
                            {registrandoIdx === i ? "Registrando..." : "Registrar como evento"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {!empId && (
                <div className="text-[12.5px] text-warn-strong mt-3">
                  Selecione o empreendimento acima para vincular as promoções.
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
