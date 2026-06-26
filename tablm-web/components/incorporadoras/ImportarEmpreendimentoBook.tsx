"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Dropzone } from "@/components/ui/Dropzone";
import type { Empreendimento, Incorporadora } from "@/types";

interface Props {
  incorporadoras: Incorporadora[];
}

const campo =
  "w-full px-[15px] py-[13px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition";

interface RespostaImportar {
  ok?: boolean;
  empreendimento?: Empreendimento;
  incorporadora_id?: string;
  documento?: { id: string };
  ficha?: Record<string, unknown>;
  tabela?: Record<string, unknown> | null;
  detail?: string;
}

/**
 * Modal para criar empreendimento (+ incorporadora se nova) a partir de um
 * book/memorial. A IA detecta o nome do empreendimento e da incorporadora —
 * basta selecionar/cadastrar a inc. O empreendimento cria sozinho com a ficha
 * extraida e, opcionalmente, uma versao da tabela de precos.
 */
export function ImportarEmpreendimentoBook({ incorporadoras }: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [incId, setIncId] = useState("");
  const [novaIncNome, setNovaIncNome] = useState("");
  const [extrairTabela, setExtrairTabela] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<RespostaImportar | null>(null);

  function resetar() {
    setArquivo(null);
    setIncId("");
    setNovaIncNome("");
    setExtrairTabela(true);
    setErro("");
    setResultado(null);
  }

  async function importar() {
    if (!arquivo) {
      setErro("Selecione um arquivo PDF ou imagem.");
      return;
    }
    if (incId === "__criar__" && !novaIncNome.trim()) {
      setErro("Informe o nome da nova incorporadora.");
      return;
    }
    setErro("");
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      if (incId && incId !== "__criar__") fd.append("incorporadora_id", incId);
      if (incId === "__criar__") fd.append("incorporadora_nome", novaIncNome.trim());
      if (extrairTabela) fd.append("extrair_tabela", "true");
      const r = await fetch("/api/empreendimentos/importar-book", {
        method: "POST",
        body: fd,
      });
      const d: RespostaImportar = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Falha ao importar");
      setResultado(d);
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  function fechar() {
    if (enviando) return;
    setAberto(false);
    resetar();
  }

  return (
    <>
      <Button variante="secondary" onClick={() => setAberto(true)}>
        📄 Importar via book
      </Button>

      {aberto && (
        <div
          className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50"
          onClick={fechar}
        >
          <div
            className="bg-white rounded-[16px] border border-line w-full max-w-[640px] p-[22px] max-h-[90vh] overflow-auto shadow-[0_8px_22px_rgba(35,71,197,0.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[11px] font-bold tracking-[1.6px] uppercase text-royal mb-1">
              Carteira → IA
            </div>
            <h3 className="text-[18px] font-extrabold text-ink mb-3">
              Importar empreendimento via book
            </h3>
            <p className="text-[13.5px] text-muted mb-4 leading-relaxed">
              Solte o PDF do book/memorial — a IA detecta o empreendimento,
              cria a ficha técnica e, se for o caso, a nova incorporadora.
            </p>

            {!resultado && (
              <>
                <Dropzone
                  arquivo={arquivo}
                  onArquivo={setArquivo}
                  aceitar=".pdf,.png,.jpg,.jpeg"
                  titulo="Arraste o book aqui"
                  dica="PDF, PNG ou JPG · até 25 MB"
                />

                <div className="mt-4 grid gap-2.5">
                  <label className="text-[12px] font-bold tracking-[0.5px] uppercase text-muted">
                    Incorporadora
                  </label>
                  <select
                    value={incId}
                    onChange={(e) => setIncId(e.target.value)}
                    className={campo}
                  >
                    <option value="">Detectar a partir do book</option>
                    {incorporadoras.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nome}
                      </option>
                    ))}
                    <option value="__criar__">+ Cadastrar nova incorporadora…</option>
                  </select>
                  {incId === "__criar__" && (
                    <input
                      value={novaIncNome}
                      onChange={(e) => setNovaIncNome(e.target.value)}
                      placeholder="Nome da nova incorporadora"
                      className={campo}
                    />
                  )}
                </div>

                <label className="flex items-start gap-2.5 mt-4 text-[13.5px] text-body cursor-pointer">
                  <input
                    type="checkbox"
                    checked={extrairTabela}
                    onChange={(e) => setExtrairTabela(e.target.checked)}
                    className="accent-royal size-4 mt-0.5"
                  />
                  <span>
                    <b>Extrair também tabela de preços</b> — cria uma versão em
                    <b> Tabela de Preços</b> e sincroniza os KPIs em um clique.
                  </span>
                </label>

                {erro && (
                  <div className="mt-3 rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line">
                    {erro}
                  </div>
                )}

                <div className="mt-5 flex justify-end gap-2">
                  <Button variante="secondary" onClick={fechar} disabled={enviando}>
                    Cancelar
                  </Button>
                  <Button onClick={importar} disabled={!arquivo || enviando}>
                    {enviando ? "Analisando…" : "Importar"}
                  </Button>
                </div>
              </>
            )}

            {resultado?.ok && resultado.empreendimento && (
              <div className="flex flex-col gap-3">
                <div className="rounded-[12px] bg-up-bg text-up-strong text-[13.5px] px-4 py-3 border border-up-line">
                  Empreendimento <b>{resultado.empreendimento.nome}</b> criado{" "}
                  {resultado.tabela ? "com nova versão de tabela e KPIs sincronizados." : "com a ficha extraída."}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Chip tom="royal">via IA</Chip>
                  {resultado.empreendimento.bairro && (
                    <span className="text-[13px] text-muted">
                      Bairro <b className="text-ink">{resultado.empreendimento.bairro}</b>
                    </span>
                  )}
                  {resultado.empreendimento.padrao && (
                    <span className="text-[13px] text-muted">
                      Padrão <b className="text-ink">{resultado.empreendimento.padrao}</b>
                    </span>
                  )}
                </div>
                <div className="flex gap-2 justify-end mt-2">
                  <Button variante="secondary" onClick={fechar}>
                    Fechar
                  </Button>
                  <Link href={`/empreendimentos/${resultado.empreendimento.id}`}>
                    <Button>Abrir empreendimento</Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
