"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EditableField } from "@/components/ui/EditableField";
import type { Empreendimento, FichaIA } from "@/types";

type Valor = string | number | string[] | null;

interface Props {
  empreendimento: Empreendimento;
}

export function AbaFichaTecnica({ empreendimento }: Props) {
  const router = useRouter();
  const [alteracoes, setAlteracoes] = useState<Record<string, Valor>>({});
  const [origemIA, setOrigemIA] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  function valorAtual<K extends keyof Empreendimento>(chave: K) {
    if (chave in alteracoes) return alteracoes[chave as string] as Empreendimento[K];
    return empreendimento[chave];
  }

  function atualizar(chave: string, novo: Valor) {
    setAlteracoes((prev) => ({ ...prev, [chave]: novo }));
    setSucesso("");
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
      // Aplica somente campos retornados; marca como origem IA.
      const novasOrigens = new Set(origemIA);
      const novasAlteracoes = { ...alteracoes };
      const mapeamento: { [K in keyof FichaIA]: keyof Empreendimento } = {
        cnpj_spe: "cnpj_spe",
        ri: "ri",
        data_lancamento: "data_lancamento",
        data_entrega: "data_entrega",
        total_unidades: "total_unidades",
        pavimentos: "pavimentos",
        torres: "torres",
        metragens: "metragens",
        tipologias: "tipologias",
        bairro: "bairro",
        distancia_metro_km: "distancia_metro_km",
        padrao: "padrao",
        fontes: undefined as never,
      };
      let aplicados = 0;
      for (const [chaveIA, valor] of Object.entries(dados)) {
        if (chaveIA === "fontes") continue;
        if (valor === undefined || valor === null || valor === "") continue;
        const chaveCampo = mapeamento[chaveIA as keyof FichaIA];
        if (!chaveCampo) continue;
        novasAlteracoes[chaveCampo as string] = valor as Valor;
        novasOrigens.add(chaveCampo as string);
        aplicados += 1;
      }
      setAlteracoes(novasAlteracoes);
      setOrigemIA(novasOrigens);
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
              Clique em qualquer campo para editar. Use <b>Buscar via IA</b> para preencher
              automaticamente CNPJ SPE, RI, datas e mais.
            </div>
          </div>
          <div className="flex gap-2">
            <Button variante="secondary" onClick={buscarIA} disabled={buscando}>
              {buscando ? "Buscando..." : "🔎 Buscar via IA"}
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
    </div>
  );
}
