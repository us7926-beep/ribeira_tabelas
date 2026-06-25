export interface Incorporadora {
  id: string;
  nome: string;
  criado_em?: string;
}

export interface Empreendimento {
  id: string;
  incorporadora_id: string;
  nome: string;
  cidade?: string | null;
  bairro?: string | null;
  padrao?: string | null;
  tipologias?: string | null;
  total_unidades?: number | null;
  data_lancamento?: string | null;
  data_entrega?: string | null;
  pavimentos?: number | null;
  torres?: number | null;
  elevadores_por_torre?: number | null;
  cnpj_spe?: string | null;
  ri?: string | null;
  criado_em?: string;
  /** KPIs derivados das planilhas. Preenchidos por POST /empreendimentos/{id}/kpis. */
  preco_m2_medio?: number | null;
  ticket_medio?: number | null;
  vso?: number | null;
  vgv_total?: number | null;
  total_unidades_calc?: number | null;
  unidades_vendidas?: number | null;
  unidades_disponiveis?: number | null;
  kpis_atualizados_em?: string | null;
}

export interface Documento {
  id: string;
  empreendimento_id: string;
  nome: string;
  tipo?: string | null;
  storage_path: string;
  criado_em?: string;
}

export interface EventoPromocional {
  id: string;
  empreendimento_id: string;
  documento_id?: string | null;
  descricao?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  condicoes_comerciais?: string | null;
  raw_gemini?: Record<string, unknown> | null;
  criado_em?: string;
}

/** Resposta da detecção de flyer (POST /gemini/analisar-flyer). */
export interface DeteccaoFlyer {
  nome_empreendimento: string;
  incorporadora: string;
  evento: string;
  data_inicio: string;
  data_fim: string;
  condicoes_comerciais: string;
}
