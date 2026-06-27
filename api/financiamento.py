"""Cálculo de renda mínima necessária para financiamento imobiliário.

Stateless — não persiste em Supabase. Recebe parcela de obra + saldo a
financiar + modalidade/prazo e devolve a renda mínima.

Fórmulas (FEATURE_CALCULO_RENDA.md):
- renda = (parcela_obra_mensal + parcela_financiamento) / percentual_renda
- parcela_financiamento (Price): PV * i*(1+i)^n / ((1+i)^n - 1)
- i_mensal = (1 + taxa_anual/100)^(1/12) - 1
"""
from pydantic import BaseModel, Field

# Presets do Ministério das Cidades + Caixa (ref. abril/2026).
# Mantidos em sync com lib/financiamento.ts (frontend repete pra exibir
# label/descrição sem chamar backend).
_PRESETS: dict[str, dict] = {
    "mcmv_faixa1": {
        "taxa_anual": 4.50,
        "label": "MCMV Faixa 1",
        "descricao": "Renda familiar até R$ 3.200/mês • Média entre 4% e 5,25% a.a.",
    },
    "mcmv_faixa2": {
        "taxa_anual": 5.75,
        "label": "MCMV Faixa 2",
        "descricao": "Renda familiar até R$ 5.000/mês • Média entre 4,75% e 7% a.a.",
    },
    "mcmv_faixa3": {
        "taxa_anual": 7.66,
        "label": "MCMV Faixa 3",
        "descricao": "Renda familiar até R$ 9.600/mês • Média entre 6,5% e 8,16% a.a.",
    },
    "mcmv_faixa4": {
        "taxa_anual": 10.00,
        "label": "MCMV Faixa 4 (Classe Média)",
        "descricao": "Renda familiar até R$ 13.000/mês • 10% a 10,5% a.a.",
    },
    "sbpe": {
        "taxa_anual": 11.19,
        "label": "SBPE",
        "descricao": "Imóveis até R$ 2,25 mi • Taxa de balcão Caixa. TR não incluída.",
    },
    "personalizada": {
        "taxa_anual": None,
        "label": "Personalizada",
        "descricao": "Taxa informada manualmente.",
    },
}

_ALERTA_PONTUAIS = (
    "Parcelas pontuais não incluídas no cálculo de renda. "
    "O banco pode exigir reserva separada."
)
_ALERTA_SBPE = "Taxa SBPE sem TR. Use o CET real do banco."
_ALERTA_PRESETS = (
    "Taxas são estimativas (médias de referência). A taxa real depende "
    "do perfil de crédito e da instituição financeira."
)


class CalculoRendaIn(BaseModel):
    parcela_obra_mensal: float = Field(ge=0)
    saldo_financiar: float = Field(gt=0)
    modalidade: str
    taxa_personalizada_anual: float | None = None
    prazo_meses: int = Field(ge=12, le=420)
    percentual_renda: float = Field(default=0.30, ge=0.10, le=0.50)


class CalculoRendaOut(BaseModel):
    taxa_anual_usada: float
    taxa_mensal_usada: float
    parcela_financiamento: float
    total_mensal_comprometido: float
    renda_necessaria: float
    label_modalidade: str
    descricao_modalidade: str
    alertas: list[str]


def _taxa_anual_para_mensal(taxa_anual_pct: float) -> float:
    """Conversão composta: (1 + r_anual)^(1/12) - 1."""
    return (1 + taxa_anual_pct / 100) ** (1 / 12) - 1


def _parcela_price(pv: float, i_mensal: float, n: int) -> float:
    """PMT da Tabela Price. Quando i_mensal == 0, vira pv/n (juros zero)."""
    if i_mensal == 0:
        return pv / n
    fator = (1 + i_mensal) ** n
    return pv * (i_mensal * fator) / (fator - 1)


def calcular_renda_necessaria(req: CalculoRendaIn) -> CalculoRendaOut:
    """Pipeline principal. Resolve modalidade -> taxa, calcula parcela
    Price e renda necessária. Levanta ValueError para inputs inválidos
    (caller mapeia para HTTPException)."""
    if req.modalidade not in _PRESETS:
        raise ValueError(
            f"Modalidade '{req.modalidade}' desconhecida. "
            f"Aceitas: {', '.join(_PRESETS.keys())}."
        )

    preset = _PRESETS[req.modalidade]
    if req.modalidade == "personalizada":
        if req.taxa_personalizada_anual is None:
            raise ValueError(
                "taxa_personalizada_anual é obrigatória quando "
                "modalidade='personalizada'."
            )
        if not (1.0 <= req.taxa_personalizada_anual <= 30.0):
            raise ValueError(
                "taxa_personalizada_anual deve estar entre 1.0 e 30.0."
            )
        taxa_anual = float(req.taxa_personalizada_anual)
    else:
        taxa_anual = float(preset["taxa_anual"])

    taxa_mensal = _taxa_anual_para_mensal(taxa_anual)
    parcela_fin = _parcela_price(req.saldo_financiar, taxa_mensal, req.prazo_meses)
    total_mensal = req.parcela_obra_mensal + parcela_fin
    renda = total_mensal / req.percentual_renda

    alertas = [_ALERTA_PONTUAIS, _ALERTA_PRESETS]
    if req.modalidade == "sbpe":
        alertas.insert(1, _ALERTA_SBPE)

    return CalculoRendaOut(
        taxa_anual_usada=round(taxa_anual, 4),
        taxa_mensal_usada=round(taxa_mensal, 6),
        parcela_financiamento=round(parcela_fin, 2),
        total_mensal_comprometido=round(total_mensal, 2),
        renda_necessaria=round(renda, 2),
        label_modalidade=preset["label"],
        descricao_modalidade=preset["descricao"],
        alertas=alertas,
    )
