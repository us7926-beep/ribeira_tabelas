"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Dropzone } from "@/components/ui/Dropzone";
import type { TabelaPrecos, UnidadePreco } from "@/types";

function moeda(n: number | null | undefined): string {
  if (n == null) return "—";
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}

function dataBR(iso: string | undefined): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

interface Props {
  empreendimentoId: string;
}

export function AbaTabela({ empreendimentoId }: Props) {
  const router = useRouter();
  const [tabelas, setTabelas] = useState<TabelaPrecos[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [tabelaIdx, setTabelaIdx] = useState(0);
  const [modalAberto, setModalAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [versao, setVersao] = useState("");
  const [dataRef, setDataRef] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  /** Se marcado, chama /importar-book em vez de /tabelas-precos. */
  const [extrairFicha, setExtrairFicha] = useState(false);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empreendimentoId]);

  async function carregar() {
    setCarregando(true);
    try {
      const r = await fetch(`/api/empreendimentos/${empreendimentoId}/tabelas-precos`);
      const d = await r.json();
      if (Array.isArray(d)) setTabelas(d);
    } finally {
      setCarregando(false);
    }
  }

  async function enviarTabela() {
    if (!arquivo && !versao) {
      setErro("Selecione um arquivo ou informe a versão.");
      return;
    }
    setErro("");
    setEnviando(true);
    try {
      const fd = new FormData();
      if (arquivo) fd.append("arquivo", arquivo);
      if (versao) fd.append("versao", versao);
      if (dataRef) fd.append("data_referencia", dataRef);
      // Se o usuario quer extrair tambem a ficha tecnica, usa o endpoint
      // unificado (1 upload, IA roda 2x: ficha + tabela).
      const url =
        arquivo && extrairFicha
          ? `/api/empreendimentos/${empreendimentoId}/importar-book`
          : `/api/empreendimentos/${empreendimentoId}/tabelas-precos`;
      if (arquivo && extrairFicha) {
        fd.append("extrair_ficha", "true");
        fd.append("extrair_tabela", "true");
      }
      const r = await fetch(url, { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Falha ao enviar tabela");
      setModalAberto(false);
      setArquivo(null);
      setVersao("");
      setDataRef("");
      setExtrairFicha(false);
      await carregar();
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const tabela = tabelas[tabelaIdx];
  const unidades = (tabela?.unidades ?? []) as UnidadePreco[];
  const promocoes = tabela?.promocoes ?? [];
  const condicoes = tabela?.condicoes ?? {};

  const linhasMostradas = useMemo(() => unidades.slice(0, 100), [unidades]);

  return (
    <div className="flex flex-col gap-5 tablm-up">
      <Card variant="lg">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="text-[12px] font-bold tracking-[1.4px] uppercase text-muted">
              Versões da tabela de preços
            </div>
            <div className="text-[14px] text-muted mt-0.5">
              Histórico completo — preserva cada versão enviada para comparação futura.
            </div>
          </div>
          <Button onClick={() => setModalAberto(true)}>+ Nova tabela</Button>
        </div>

        {carregando ? (
          <div className="text-[13.5px] text-muted mt-4">Carregando…</div>
        ) : tabelas.length === 0 ? (
          <div className="text-[13.5px] text-muted mt-4">
            Nenhuma versão ainda. Envie a primeira tabela pelo botão acima.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 mt-4">
            {tabelas.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setTabelaIdx(i)}
                className={
                  i === tabelaIdx
                    ? "px-3 py-1.5 rounded-[10px] bg-royal text-white text-[12.5px] font-bold"
                    : "px-3 py-1.5 rounded-[10px] bg-white border border-line text-body text-[12.5px] font-semibold hover:border-royal hover:text-royal transition-colors"
                }
              >
                {t.versao} · {dataBR(t.data_referencia)}
              </button>
            ))}
          </div>
        )}
      </Card>

      {tabela && (
        <>
          <Card>
            <div className="flex flex-wrap gap-3 items-center">
              <Chip tom="royal">{tabela.versao}</Chip>
              <span className="text-[13.5px] text-body">
                <b className="text-ink">{unidades.length}</b> unidades · referência{" "}
                <b className="text-ink">{dataBR(tabela.data_referencia)}</b>
              </span>
            </div>
          </Card>

          {unidades.length > 0 && (
            <Card variant="lg">
              <div className="text-[16px] font-bold text-ink mb-3">Grid de unidades</div>
              <div className="overflow-x-auto border border-line-soft rounded-[12px]">
                <table className="w-full text-[13.5px]">
                  <thead className="bg-thead text-muted">
                    <tr>
                      {["Andar", "Unidade", "Área", "Vaga", "Entrada", "Mensais", "Financ.", "Preço", "Avaliação"].map((h) => (
                        <th
                          key={h}
                          className="text-left font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {linhasMostradas.map((u, i) => (
                      <tr key={i} className="border-t border-line-soft">
                        <td className="px-3 py-2 whitespace-nowrap text-body">{String(u.andar ?? "—")}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-ink font-semibold">{String(u.unidade ?? "—")}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-body tnum">
                          {u.area_m2 != null ? `${u.area_m2} m²` : "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-body">{String(u.vaga ?? "—")}</td>
                        <td className="px-3 py-2 whitespace-nowrap tnum text-body">{moeda(u.entrada ?? null)}</td>
                        <td className="px-3 py-2 whitespace-nowrap tnum text-body">{moeda(u.parcelas_mensais ?? null)}</td>
                        <td className="px-3 py-2 whitespace-nowrap tnum text-body">{moeda(u.financiamento ?? null)}</td>
                        <td className="px-3 py-2 whitespace-nowrap tnum text-royal font-bold">{moeda(u.preco_total ?? null)}</td>
                        <td className="px-3 py-2 whitespace-nowrap tnum text-body">{moeda(u.avaliacao ?? null)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {unidades.length > 100 && (
                <div className="text-[12px] text-faint mt-2">
                  Mostrando 100 de {unidades.length} unidades.
                </div>
              )}
            </Card>
          )}

          <Card variant="lg">
            <div className="text-[16px] font-bold text-ink mb-3">Condições comerciais</div>
            <div className="text-[13.5px] text-body grid gap-2">
              {Object.keys(condicoes).length === 0 && (
                <div className="text-muted">Sem condições estruturadas (este upload não trouxe).</div>
              )}
              {condicoes.avista && (
                <div>
                  <b>À vista:</b> desconto {condicoes.avista.desconto_pct ?? 0}%
                </div>
              )}
              {condicoes.entrada && (
                <div>
                  <b>Entrada:</b> {condicoes.entrada.pct_ato ?? "—"}% ato + {condicoes.entrada.parcelas_obra ?? "—"} parcelas (médio {moeda(condicoes.entrada.valor_parcela_medio ?? null)})
                </div>
              )}
              {condicoes.financiamento && (
                <div>
                  <b>Financiamento:</b> {condicoes.financiamento.banco || "—"} · {condicoes.financiamento.taxa_aa ?? "—"}% a.a. · {condicoes.financiamento.prazo_meses ?? "—"} meses
                </div>
              )}
              {(condicoes.mensais ?? []).length > 0 && (
                <div>
                  <b>Mensais:</b>{" "}
                  {condicoes.mensais!.map((m) => `${m.descricao} ${moeda(m.valor)}`).join(", ")}
                </div>
              )}
              {(condicoes.anuais ?? []).length > 0 && (
                <div>
                  <b>Anuais:</b>{" "}
                  {condicoes.anuais!.map((m) => `${m.descricao} ${moeda(m.valor)}`).join(", ")}
                </div>
              )}
            </div>
          </Card>

          {promocoes.length > 0 && (
            <Card variant="lg">
              <div className="text-[16px] font-bold text-ink mb-3">Promoções detectadas</div>
              <div className="flex flex-col gap-2.5">
                {promocoes.map((p, i) => (
                  <div key={i} className="bg-thead border border-line-soft rounded-[12px] p-3">
                    <div className="text-[14px] font-bold text-ink">{p.descricao}</div>
                    {(p.data_inicio || p.data_fim) && (
                      <div className="text-[12.5px] text-muted tnum mt-0.5">
                        {p.data_inicio || "—"} → {p.data_fim || "—"}
                      </div>
                    )}
                    {p.condicoes && (
                      <div className="text-[12.5px] text-body mt-0.5">{p.condicoes}</div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {modalAberto && (
        <div
          className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50"
          onClick={() => setModalAberto(false)}
        >
          <div
            className="bg-white rounded-[16px] border border-line w-full max-w-[640px] p-[22px] max-h-[90vh] overflow-auto shadow-[0_8px_22px_rgba(35,71,197,0.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[11px] font-bold tracking-[1.6px] uppercase text-royal mb-1">
              Nova versão
            </div>
            <h3 className="text-[18px] font-extrabold text-ink mb-4">Subir tabela de preços</h3>

            <Dropzone
              arquivo={arquivo}
              onArquivo={setArquivo}
              aceitar=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls"
              titulo="Arraste a tabela do empreendimento"
              dica="PDF, imagem, CSV ou Excel · IA lê o PDF"
            />
            <label className="flex items-start gap-2.5 mt-3 text-[13.5px] text-body cursor-pointer">
              <input
                type="checkbox"
                checked={extrairFicha}
                onChange={(e) => setExtrairFicha(e.target.checked)}
                className="accent-royal size-4 mt-0.5"
              />
              <span>
                <b>Extrair também ficha técnica</b> — se o book traz dados como
                bairro, padrão, vagas, datas e CNPJ, a IA atualiza esses campos do
                empreendimento de uma vez.
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <input
                value={versao}
                onChange={(e) => setVersao(e.target.value)}
                placeholder="Versão (ex.: Jun/2026)"
                className="w-full px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition"
              />
              <input
                value={dataRef}
                onChange={(e) => setDataRef(e.target.value)}
                type="date"
                placeholder="Data de referência"
                className="w-full px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition"
              />
            </div>

            {erro && (
              <div className="mt-3 rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line">
                {erro}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button variante="secondary" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button onClick={enviarTabela} disabled={enviando}>
                {enviando ? "Enviando…" : "Salvar tabela"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
