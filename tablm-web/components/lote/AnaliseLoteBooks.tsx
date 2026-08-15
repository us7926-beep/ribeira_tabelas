"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import type { Incorporadora } from "@/types";

type StatusItem = "aguardando" | "processando" | "concluido" | "erro" | "criando" | "criado";

interface FichaExtraida {
  nome?: string;
  bairro?: string;
  cidade?: string;
  padrao?: string;
  total_unidades?: number;
  [k: string]: unknown;
}

interface TabelaExtraida {
  nome_empreendimento?: string;
  incorporadora?: string;
  cidade?: string;
  bairro?: string;
  padrao?: string;
  total_unidades?: number;
  unidades?: unknown[];
  promocoes?: unknown[];
}

interface ResultadoExtracao {
  arquivo_nome: string;
  ficha: FichaExtraida;
  tabela: TabelaExtraida;
  erros?: { ficha?: string; tabela?: string };
}

interface ItemFila {
  id: string;
  file: File;
  status: StatusItem;
  resultado?: ResultadoExtracao;
  aprovado: boolean;
  /** Incorporadora escolhida quando a IA não detecta ou usuário quer forçar. */
  incorporadoraId: string;
  /** Nome de incorporadora nova quando não há id selecionado. */
  incorporadoraNome: string;
  /** Se marcado, chama importar-book com extrair_tabela=true. */
  extrairTabela: boolean;
  erro?: string;
  empreendimentoIdCriado?: string;
  empreendimentoNomeCriado?: string;
}

interface Props {
  incorporadoras: Incorporadora[];
}

/** Tenta ler primeiro da ficha; se vazio, cai no equivalente da tabela.
 * "nome" na ficha vira "nome_empreendimento" na tabela; os outros usam a
 * mesma chave. */
function ficha_ou_tabela(
  item: ItemFila,
  chave: "nome" | "bairro" | "cidade" | "padrao",
): string {
  const f = item.resultado?.ficha?.[chave];
  if (f) return String(f);
  const alt = chave === "nome" ? "nome_empreendimento" : chave;
  const t = item.resultado?.tabela?.[alt as keyof TabelaExtraida];
  return t ? String(t) : "";
}

function detectarIncorporadora(item: ItemFila): string {
  return String(item.resultado?.tabela?.incorporadora ?? "").trim();
}

function contarUnidades(item: ItemFila): number {
  return Array.isArray(item.resultado?.tabela?.unidades)
    ? item.resultado!.tabela!.unidades!.length
    : 0;
}

function idNovo(): string {
  return Math.random().toString(36).slice(2, 10);
}

const CLASSE_STATUS: Record<StatusItem, { tom: "royal" | "up" | "down" | "warn" | "neutro"; label: string }> = {
  aguardando: { tom: "neutro", label: "Aguardando" },
  processando: { tom: "royal", label: "Processando…" },
  concluido: { tom: "up", label: "Extraído" },
  erro: { tom: "down", label: "Erro" },
  criando: { tom: "warn", label: "Criando…" },
  criado: { tom: "up", label: "Criado ✓" },
};

export function AnaliseLoteBooks({ incorporadoras }: Props) {
  const [itens, setItens] = useState<ItemFila[]>([]);
  const [processandoLote, setProcessandoLote] = useState(false);
  const [criandoLote, setCriandoLote] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalAprovaveis = useMemo(
    () => itens.filter((i) => i.status === "concluido" && i.aprovado).length,
    [itens],
  );
  const totalCriados = useMemo(
    () => itens.filter((i) => i.status === "criado").length,
    [itens],
  );

  function adicionarArquivos(files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (arr.length === 0) return;
    const novos: ItemFila[] = arr.map((file) => ({
      id: idNovo(),
      file,
      status: "aguardando",
      aprovado: false,
      incorporadoraId: "",
      incorporadoraNome: "",
      extrairTabela: true,
    }));
    setItens((atual) => [...atual, ...novos]);
    // dispara processamento em série pra não estourar Gemini
    setTimeout(() => processarFila([...itens, ...novos]), 0);
  }

  async function processarFila(fila: ItemFila[]) {
    if (processandoLote) return;
    setProcessandoLote(true);
    try {
      for (const item of fila) {
        if (item.status !== "aguardando") continue;
        setItens((atual) =>
          atual.map((i) => (i.id === item.id ? { ...i, status: "processando" } : i)),
        );
        try {
          const formData = new FormData();
          formData.append("arquivo", item.file);
          const r = await fetch("/api/books/extrair", { method: "POST", body: formData });
          const d = await r.json();
          if (!r.ok) {
            setItens((atual) =>
              atual.map((i) =>
                i.id === item.id
                  ? { ...i, status: "erro", erro: d.detail ?? `Erro ${r.status}` }
                  : i,
              ),
            );
          } else {
            const resultado = d as ResultadoExtracao;
            setItens((atual) =>
              atual.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      status: "concluido",
                      resultado,
                      aprovado: true, // aprovado por padrão; usuário pode desmarcar
                      // pré-seleciona incorporadora pelo nome detectado
                      incorporadoraNome: String(resultado.tabela?.incorporadora ?? "").trim(),
                    }
                  : i,
              ),
            );
          }
        } catch (e) {
          setItens((atual) =>
            atual.map((i) =>
              i.id === item.id ? { ...i, status: "erro", erro: (e as Error).message } : i,
            ),
          );
        }
      }
    } finally {
      setProcessandoLote(false);
    }
  }

  function alternarAprovado(id: string) {
    setItens((atual) =>
      atual.map((i) => (i.id === id ? { ...i, aprovado: !i.aprovado } : i)),
    );
  }

  function alterarIncorporadora(id: string, campo: "id" | "nome", valor: string) {
    setItens((atual) =>
      atual.map((i) =>
        i.id === id
          ? {
              ...i,
              incorporadoraId: campo === "id" ? valor : "",
              incorporadoraNome: campo === "nome" ? valor : i.incorporadoraNome,
            }
          : i,
      ),
    );
  }

  function alternarExtrairTabela(id: string) {
    setItens((atual) =>
      atual.map((i) => (i.id === id ? { ...i, extrairTabela: !i.extrairTabela } : i)),
    );
  }

  function removerItem(id: string) {
    setItens((atual) => atual.filter((i) => i.id !== id));
  }

  function retentar(id: string) {
    setItens((atual) => atual.map((i) => (i.id === id ? { ...i, status: "aguardando", erro: undefined } : i)));
    // Reprocessa só esse item
    const item = itens.find((i) => i.id === id);
    if (item) setTimeout(() => processarFila([{ ...item, status: "aguardando" }]), 0);
  }

  async function criarEmpreendimentos() {
    setCriandoLote(true);
    try {
      const aprovados = itens.filter((i) => i.status === "concluido" && i.aprovado);
      for (const item of aprovados) {
        setItens((atual) =>
          atual.map((i) => (i.id === item.id ? { ...i, status: "criando" } : i)),
        );
        try {
          const formData = new FormData();
          formData.append("arquivo", item.file);
          if (item.incorporadoraId) formData.append("incorporadora_id", item.incorporadoraId);
          else if (item.incorporadoraNome)
            formData.append("incorporadora_nome", item.incorporadoraNome);
          formData.append("extrair_tabela", String(item.extrairTabela));
          const r = await fetch("/api/empreendimentos/importar-book", {
            method: "POST",
            body: formData,
          });
          const d = await r.json();
          if (!r.ok) {
            setItens((atual) =>
              atual.map((i) =>
                i.id === item.id
                  ? { ...i, status: "erro", erro: d.detail ?? `Erro ${r.status}` }
                  : i,
              ),
            );
          } else {
            setItens((atual) =>
              atual.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      status: "criado",
                      empreendimentoIdCriado: d.empreendimento?.id ?? d.id,
                      empreendimentoNomeCriado:
                        d.empreendimento?.nome ?? d.nome ?? item.resultado?.ficha?.nome ?? "",
                    }
                  : i,
              ),
            );
          }
        } catch (e) {
          setItens((atual) =>
            atual.map((i) =>
              i.id === item.id ? { ...i, status: "erro", erro: (e as Error).message } : i,
            ),
          );
        }
      }
    } finally {
      setCriandoLote(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card variant="lg">
        <div className="text-[12px] font-bold tracking-[1.4px] uppercase text-royal mb-2">
          Passo 1
        </div>
        <div className="text-[18px] font-extrabold text-ink mb-1">Envie os PDFs</div>
        <div className="text-[13px] text-muted mb-3">
          Arraste um ou vários books/memoriais em PDF. A IA processa em fila (um
          por vez para não estourar cota) e você acompanha aqui embaixo.
        </div>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            adicionarArquivos(e.dataTransfer.files);
          }}
          className={`border-[1.6px] border-dashed rounded-[14px] p-[38px_20px] text-center cursor-pointer transition ${
            arrastando
              ? "border-royal bg-[#F1F5FE]"
              : "border-[#C6D2EC] bg-[#F7F9FE] hover:border-royal hover:bg-[#F1F5FE]"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              adicionarArquivos(e.target.files);
              e.currentTarget.value = ""; // permite subir o mesmo arquivo de novo
            }}
          />
          <div className="w-[46px] h-[46px] rounded-[13px] bg-royal-tint text-royal grid place-items-center text-[22px] font-extrabold mx-auto mb-3">
            +
          </div>
          <div className="text-[14.5px] font-semibold text-body">
            Arraste books PDF aqui ou clique
          </div>
          <div className="text-[12.5px] text-faint mt-1">
            Pode selecionar vários de uma vez · até 25 MB por arquivo
          </div>
        </div>
      </Card>

      {itens.length > 0 && (
        <Card variant="lg">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
            <div>
              <div className="text-[12px] font-bold tracking-[1.4px] uppercase text-royal">
                Passo 2
              </div>
              <div className="text-[18px] font-extrabold text-ink mt-1">
                Revisar fila ({itens.length} arquivo{itens.length === 1 ? "" : "s"})
              </div>
              <div className="text-[13px] text-muted mt-1">
                Confira os campos extraídos. Desmarque o que não quer criar,
                escolha incorporadora quando a IA não detectar.
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-muted">
                {totalAprovaveis} aprovado{totalAprovaveis === 1 ? "" : "s"}
              </span>
              <Button
                disabled={totalAprovaveis === 0 || criandoLote || processandoLote}
                onClick={criarEmpreendimentos}
              >
                {criandoLote
                  ? "Criando…"
                  : `Criar ${totalAprovaveis} empreendimento${totalAprovaveis === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>

          <ul className="flex flex-col divide-y divide-line-soft">
            {itens.map((item) => {
              const status = CLASSE_STATUS[item.status];
              const nomeExtraido = ficha_ou_tabela(item, "nome");
              const cidadeExtraida = ficha_ou_tabela(item, "cidade");
              const bairroExtraido = ficha_ou_tabela(item, "bairro");
              const padraoExtraido = ficha_ou_tabela(item, "padrao");
              const incorporadoraDetectada = detectarIncorporadora(item);
              const nUnidades = contarUnidades(item);
              return (
                <li key={item.id} className="py-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {item.status === "concluido" && (
                        <input
                          type="checkbox"
                          checked={item.aprovado}
                          onChange={() => alternarAprovado(item.id)}
                          className="size-4 accent-royal mt-1 shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[14px] font-semibold text-ink truncate">
                            {item.file.name}
                          </span>
                          <Chip tom={status.tom}>{status.label}</Chip>
                          {item.status === "criado" && item.empreendimentoIdCriado && (
                            <Link
                              href={`/empreendimentos/${item.empreendimentoIdCriado}`}
                              className="text-[12px] font-semibold text-royal hover:underline"
                            >
                              abrir →
                            </Link>
                          )}
                        </div>
                        {item.erro && (
                          <div className="text-[12.5px] text-down-strong mt-1">
                            {item.erro}
                          </div>
                        )}
                        {item.status === "concluido" && (
                          <div className="text-[12.5px] text-muted mt-1 flex flex-wrap gap-x-3 gap-y-1">
                            {nomeExtraido && (
                              <span>
                                <b className="text-ink">{nomeExtraido}</b>
                              </span>
                            )}
                            {[bairroExtraido, cidadeExtraida, padraoExtraido]
                              .filter(Boolean)
                              .join(" · ") && (
                              <span>
                                {[bairroExtraido, cidadeExtraida, padraoExtraido]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            )}
                            {nUnidades > 0 && (
                              <span>
                                <b className="text-ink">{nUnidades}</b> unidade
                                {nUnidades === 1 ? "" : "s"} na tabela
                              </span>
                            )}
                            {item.resultado?.erros?.tabela && (
                              <span className="text-warn-strong">
                                tabela falhou: {item.resultado.erros.tabela}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === "erro" && (
                        <button
                          type="button"
                          onClick={() => retentar(item.id)}
                          className="text-[12px] font-semibold text-royal hover:underline"
                        >
                          Retentar
                        </button>
                      )}
                      {item.status !== "criado" && (
                        <button
                          type="button"
                          onClick={() => removerItem(item.id)}
                          aria-label={`Remover ${item.file.name}`}
                          className="text-[16px] leading-none text-muted hover:text-down-strong"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  {item.status === "concluido" && item.aprovado && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 ml-7">
                      <label className="text-[12px] flex flex-col gap-1">
                        <span className="font-semibold text-muted uppercase tracking-[0.4px]">
                          Incorporadora existente
                        </span>
                        <select
                          value={item.incorporadoraId}
                          onChange={(e) => alterarIncorporadora(item.id, "id", e.target.value)}
                          className="px-3 py-2 rounded-[10px] border border-line bg-white text-[13px]"
                        >
                          <option value="">
                            — usar nome{incorporadoraDetectada ? " detectado" : ""} —
                          </option>
                          {incorporadoras.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label
                        className={`text-[12px] flex flex-col gap-1 ${
                          item.incorporadoraId ? "opacity-50" : ""
                        }`}
                      >
                        <span className="font-semibold text-muted uppercase tracking-[0.4px]">
                          Ou nova (nome)
                        </span>
                        <input
                          value={item.incorporadoraNome}
                          onChange={(e) => alterarIncorporadora(item.id, "nome", e.target.value)}
                          disabled={!!item.incorporadoraId}
                          placeholder={incorporadoraDetectada || "Nome da nova incorporadora"}
                          className="px-3 py-2 rounded-[10px] border border-line bg-white text-[13px] disabled:bg-thead"
                        />
                      </label>
                      <label className="text-[12px] flex items-center gap-2 self-end pb-2">
                        <input
                          type="checkbox"
                          checked={item.extrairTabela}
                          onChange={() => alternarExtrairTabela(item.id)}
                          className="size-4 accent-royal"
                        />
                        <span className="text-body">
                          Extrair também a tabela de preços
                        </span>
                      </label>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {totalCriados > 0 && (
            <div className="mt-4 rounded-[12px] bg-up-bg text-up-strong text-[13px] px-4 py-3 border border-up-line">
              ✓ {totalCriados} empreendimento{totalCriados === 1 ? "" : "s"} criado
              {totalCriados === 1 ? "" : "s"}. Clique em <b>abrir →</b> em cada
              linha pra ir pro dossiê.
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
