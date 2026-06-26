"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Dropzone } from "@/components/ui/Dropzone";
import { EditableField } from "@/components/ui/EditableField";
import type { Empreendimento, FichaIA } from "@/types";

type Valor = string | number | string[] | null;

interface Props {
  empreendimento: Empreendimento;
}

/** Campos do Empreendimento que aceitam preenchimento via IA. */
const CAMPOS_PREENCHIVEIS: (keyof Empreendimento)[] = [
  "nome", "bairro", "cidade", "padrao", "tipologias", "metragens",
  "total_unidades", "unidades_residenciais", "unidades_comerciais",
  "tipo_uso", "pavimentos", "torres", "elevadores_por_torre",
  "vagas_comunidade", "vagas_venda", "vagas_cobertas",
  "distancia_metro_km", "data_lancamento", "data_entrega",
  "cnpj_spe", "ri",
];

export function AbaFichaTecnica({ empreendimento }: Props) {
  const router = useRouter();
  const [alteracoes, setAlteracoes] = useState<Record<string, Valor>>({});
  const [origemIA, setOrigemIA] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Upload de book/memorial (modal).
  const [modalAberto, setModalAberto] = useState(false);
  const [arquivoBook, setArquivoBook] = useState<File | null>(null);
  const [enviandoBook, setEnviandoBook] = useState(false);
  const [erroModal, setErroModal] = useState("");
  /** Se marcado, chama /importar-book em vez de /ficha-dossie. */
  const [extrairTabela, setExtrairTabela] = useState(false);

  function valorAtual<K extends keyof Empreendimento>(chave: K) {
    if (chave in alteracoes) return alteracoes[chave as string] as Empreendimento[K];
    return empreendimento[chave];
  }

  function atualizar(chave: string, novo: Valor) {
    setAlteracoes((prev) => ({ ...prev, [chave]: novo }));
    setSucesso("");
  }

  /**
   * Aplica campos vindos da IA em `alteracoes` + marca origem.
   * `dados` pode ter chaves de Empreendimento direto (ficha-dossie) ou
   * algumas chaves equivalentes do FichaIA (busca online com fontes).
   * Devolve o número de campos efetivamente aplicados.
   */
  function aplicarPreenchimentoIA(dados: Partial<Record<string, unknown>>): number {
    const novasOrigens = new Set(origemIA);
    const novasAlteracoes = { ...alteracoes };
    let aplicados = 0;
    for (const chave of CAMPOS_PREENCHIVEIS) {
      const valor = dados[chave as string];
      if (valor === undefined || valor === null || valor === "") continue;
      if (Array.isArray(valor) && valor.length === 0) continue;
      novasAlteracoes[chave as string] = valor as Valor;
      novasOrigens.add(chave as string);
      aplicados += 1;
    }
    setAlteracoes(novasAlteracoes);
    setOrigemIA(novasOrigens);
    return aplicados;
  }

  async function buscarIA() {
    setErro("");
    setSucesso("");
    setBuscando(true);
    try {
      const r = await fetch("/api/gemini/buscar-empreendimento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: empreendimento.nome,
          cidade: empreendimento.cidade ?? "",
        }),
      });
      const dados: FichaIA = await r.json();
      if (!r.ok) throw new Error((dados as { detail?: string }).detail ?? "Falha na busca");
      const aplicados = aplicarPreenchimentoIA(dados as Partial<Record<string, unknown>>);
      setSucesso(
        aplicados
          ? `IA encontrou ${aplicados} campo(s). Revise e clique em Salvar.`
          : "IA não retornou dados novos.",
      );
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBuscando(false);
    }
  }

  async function subirBook() {
    if (!arquivoBook) {
      setErroModal("Selecione um arquivo PDF ou imagem.");
      return;
    }
    setErroModal("");
    setEnviandoBook(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivoBook);
      // Se o usuario marcou "extrair tambem tabela de precos", usa o endpoint
      // unificado: 1 upload, IA roda 2x, cria nova versao em tabelas_precos.
      const url = extrairTabela
        ? `/api/empreendimentos/${empreendimento.id}/importar-book`
        : `/api/empreendimentos/${empreendimento.id}/ficha-dossie`;
      if (extrairTabela) {
        fd.append("extrair_ficha", "true");
        fd.append("extrair_tabela", "true");
      }
      const r = await fetch(url, { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Falha ao analisar o documento");
      const ficha = (d?.ficha ?? {}) as Partial<Record<string, unknown>>;
      const aplicados = aplicarPreenchimentoIA(ficha);
      const trechoTabela = extrairTabela && d?.tabela
        ? " Nova versão da tabela criada e KPIs sincronizados."
        : "";
      setModalAberto(false);
      setArquivoBook(null);
      setExtrairTabela(false);
      setSucesso(
        `IA leu ${aplicados} campo(s) do book. Arquivo salvo na aba Documentos.${trechoTabela} Revise e clique em Salvar.`,
      );
      setErro("");
      router.refresh();
    } catch (e) {
      setErroModal((e as Error).message);
    } finally {
      setEnviandoBook(false);
    }
  }

  async function salvar() {
    if (Object.keys(alteracoes).length === 0) return;
    setErro("");
    setSucesso("");
    setSalvando(true);
    try {
      const r = await fetch(`/api/empreendimentos/${empreendimento.id}/ficha`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alteracoes),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Falha ao salvar");
      setAlteracoes({});
      setOrigemIA(new Set());
      setSucesso("Ficha atualizada.");
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  function campo(rotulo: string, chave: keyof Empreendimento, tipo: "texto" | "numero" | "data" | "chips" = "texto", step?: string) {
    return (
      <EditableField
        rotulo={rotulo}
        valor={valorAtual(chave) as never}
        tipo={tipo}
        step={step}
        origemIA={origemIA.has(chave as string)}
        onSalvar={(novo) => atualizar(chave as string, novo)}
      />
    );
  }

  const temAlteracoes = Object.keys(alteracoes).length > 0;

  return (
    <div className="flex flex-col gap-5 tablm-up">
      <Card variant="lg">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <div className="text-[12px] font-bold tracking-[1.4px] uppercase text-muted">
              Ficha técnica
            </div>
            <div className="text-[14px] text-muted mt-0.5">
              Clique em qualquer campo para editar. Use <b>Subir book/memorial</b> para
              extrair os dados de um PDF próprio, ou <b>Buscar online</b> para usar dados
              públicos (CNPJ SPE, RI, datas).
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variante="secondary" onClick={() => setModalAberto(true)}>
              📄 Subir book/memorial
            </Button>
            <Button variante="secondary" onClick={buscarIA} disabled={buscando}>
              {buscando ? "Buscando..." : "🔎 Buscar online"}
            </Button>
            <Button onClick={salvar} disabled={!temAlteracoes || salvando}>
              {salvando ? "Salvando..." : `Salvar (${Object.keys(alteracoes).length})`}
            </Button>
          </div>
        </div>

        {erro && (
          <div className="mb-3 rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line">
            {erro}
          </div>
        )}
        {sucesso && (
          <div className="mb-3 rounded-[12px] bg-up-bg text-up-strong text-[13.5px] px-4 py-3 border border-up-line">
            {sucesso}
          </div>
        )}

        <div className="text-[12px] font-bold tracking-[0.5px] uppercase text-faint mb-2">
          Identificação
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
          {campo("Nome", "nome")}
          {campo("Bairro", "bairro")}
          {campo("Cidade", "cidade")}
          {campo("Padrão", "padrao")}
          {campo("CNPJ SPE", "cnpj_spe")}
          {campo("RI", "ri")}
          {campo("Distância metrô (km)", "distancia_metro_km", "numero", "0.1")}
          {campo("Tipo de uso", "tipo_uso")}
        </div>

        <div className="text-[12px] font-bold tracking-[0.5px] uppercase text-faint mb-2">
          Produto
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
          {campo("Tipologias", "tipologias")}
          {campo("Metragens (chips)", "metragens", "chips")}
          {campo("Total de unidades", "total_unidades", "numero")}
          {campo("Estoque", "estoque", "numero")}
          {campo("Un. residenciais", "unidades_residenciais", "numero")}
          {campo("Un. comerciais", "unidades_comerciais", "numero")}
        </div>

        <div className="text-[12px] font-bold tracking-[0.5px] uppercase text-faint mb-2">
          Estrutura
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
          {campo("Pavimentos", "pavimentos", "numero")}
          {campo("Torres", "torres", "numero")}
          {campo("Elevadores/torre", "elevadores_por_torre", "numero")}
          {campo("Vagas comunidade", "vagas_comunidade", "numero")}
          {campo("Vagas venda", "vagas_venda", "numero")}
          {campo("Vagas cobertas", "vagas_cobertas", "numero")}
        </div>

        <div className="text-[12px] font-bold tracking-[0.5px] uppercase text-faint mb-2">
          Datas
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {campo("Lançamento", "data_lancamento", "data")}
          {campo("Entrega", "data_entrega", "data")}
        </div>
      </Card>

      {origemIA.size > 0 && (
        <Card>
          <div className="flex items-center gap-2 flex-wrap">
            <Chip tom="royal">via IA</Chip>
            <span className="text-[13px] text-muted">
              {origemIA.size} campo(s) preenchido(s) pela IA. Revise antes de salvar.
            </span>
          </div>
        </Card>
      )}

      {modalAberto && (
        <div
          className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50"
          onClick={() => !enviandoBook && setModalAberto(false)}
        >
          <div
            className="bg-white rounded-[16px] border border-line w-full max-w-[560px] p-[22px] max-h-[90vh] overflow-auto shadow-[0_8px_22px_rgba(35,71,197,0.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[11px] font-bold tracking-[1.6px] uppercase text-royal mb-1">
              Auto-preencher ficha
            </div>
            <h3 className="text-[18px] font-extrabold text-ink mb-3">
              Subir book / memorial descritivo
            </h3>
            <p className="text-[13.5px] text-muted mb-4 leading-relaxed">
              A IA lê o documento e preenche os campos da ficha. O arquivo é salvo na
              aba <b>Documentos</b> com tipo <b>book_empreendimento</b>.
            </p>
            <Dropzone
              arquivo={arquivoBook}
              onArquivo={setArquivoBook}
              aceitar=".pdf,.png,.jpg,.jpeg"
              titulo="Arraste o book aqui"
              dica="PDF, PNG ou JPG · até 25 MB"
            />
            <label className="flex items-start gap-2.5 mt-4 text-[13.5px] text-body cursor-pointer">
              <input
                type="checkbox"
                checked={extrairTabela}
                onChange={(e) => setExtrairTabela(e.target.checked)}
                className="accent-royal size-4 mt-0.5"
              />
              <span>
                <b>Extrair também tabela de preços</b> — se o book tem a tabela
                (unidades, condições, promoções), cria uma nova versão em
                <b> Tabela de Preços</b> e sincroniza os KPIs em um clique.
              </span>
            </label>
            {erroModal && (
              <div className="mt-3 rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line">
                {erroModal}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variante="secondary"
                onClick={() => {
                  setModalAberto(false);
                  setArquivoBook(null);
                  setErroModal("");
                }}
                disabled={enviandoBook}
              >
                Cancelar
              </Button>
              <Button onClick={subirBook} disabled={!arquivoBook || enviandoBook}>
                {enviandoBook ? "Analisando…" : "Analisar e preencher"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
