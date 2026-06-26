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
  /** Ficha técnica expandida (PATCH /empreendimentos/{id}/ficha). */
  metragens?: string[] | null;
  vagas_comunidade?: number | null;
  vagas_venda?: number | null;
  vagas_cobertas?: number | null;
  distancia_metro_km?: number | null;
  tipo_uso?: string | null;
  unidades_residenciais?: number | null;
  unidades_comerciais?: number | null;
  estoque?: number | null;
}

/** Linha de unidade extraída de uma tabela de preços. */
export interface UnidadePreco {
  andar?: string;
  unidade?: string;
  area_m2?: number | null;
  vaga?: string;
  entrada?: number | null;
  parcelas_mensais?: number | null;
  financiamento?: number | null;
  preco_total?: number | null;
  avaliacao?: number | null;
  [k: string]: unknown;
}

export interface CondicoesComerciais {
  avista?: { desconto_pct?: number };
  entrada?: { pct_ato?: number; parcelas_obra?: number; valor_parcela_medio?: number };
  financiamento?: { banco?: string; taxa_aa?: number | null; prazo_meses?: number };
  mensais?: { descricao: string; valor: number }[];
  anuais?: { descricao: string; valor: number }[];
  outros?: { descricao: string; valor: number }[];
  [k: string]: unknown;
}

export interface PromocaoTabela {
  descricao: string;
  data_inicio?: string;
  data_fim?: string;
  condicoes?: string;
}

export interface TabelaPrecos {
  id: string;
  empreendimento_id: string;
  versao: string;
  data_referencia: string;
  unidades: UnidadePreco[] | null;
  condicoes: CondicoesComerciais | null;
  promocoes: PromocaoTabela[] | null;
  raw_gemini?: Record<string, unknown> | null;
  criado_em?: string;
}

export interface VendaMensal {
  id: string;
  empreendimento_id: string;
  mes: string;
  unidades_vendidas: number;
  vgv_mes?: number | null;
  fonte?: "manual" | "planilha" | "ia";
  criado_em?: string;
}

export interface FluxoComercial {
  tabela_id: string;
  versao: string;
  data_referencia?: string;
  /** "YYYY-MM" do mês escolhido para puxar a distribuição real. */
  mes?: string;
  comparativo: {
    tipos: string[];
    por_tipo: Record<
      string,
      {
        ticket_medio: number;
        pct_total: number;
        valor_medio_parcela?: number | null;
        n_parcelas?: number | null;
        /** Quando vier da distribuição real, traz a contagem de unidades. */
        unidades?: number;
      }
    >;
    diferencas: { de: string; para: string; diferenca_reais: number; diferenca_pct: number }[];
    /** "real" quando há distribuição cadastrada no mês; "estimado" senão. */
    fonte: "real" | "estimado";
    /** Total de unidades vendidas que alimentaram a distribuição (0 quando estimado). */
    total_vendas: number;
  };
}

/** Linha de distribuição de vendas por modalidade num mês. */
export interface DistribuicaoModalidade {
  id?: string;
  empreendimento_id?: string;
  mes?: string;
  modalidade: string;
  unidades_vendidas: number;
  vgv: number | null;
  criado_em?: string;
  atualizado_em?: string;
}

/** Sugestão de modalidade (vinda das condicoes da última tabela ou do histórico). */
export interface ModalidadeSugerida {
  chave: string;
  label: string;
  fonte: "condicoes" | "historico";
}

/** Resposta de POST /gemini/buscar-empreendimento. Campos ausentes = não encontrados. */
export interface FichaIA {
  cnpj_spe?: string;
  ri?: string;
  data_lancamento?: string;
  data_entrega?: string;
  total_unidades?: number;
  pavimentos?: number;
  torres?: number;
  metragens?: string[];
  tipologias?: string;
  bairro?: string;
  distancia_metro_km?: number;
  padrao?: string;
  fontes?: string[];
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
