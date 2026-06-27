"""Simulador de Fluxo Comercial — cálculo stateless de valores por coluna
para múltiplas linhas (empreendimentos/unidades) e diferenças entre as
duas primeiras linhas.

Spec: FEATURE_SIMULADOR_FLUXO.md.

- Cada coluna tem um percentual do valor da unidade. Mensais/anuais/
  semestrais também têm quantidade — a parcela unitária = total ÷ qtd.
- `financiamento.percentual` é DERIVADO no frontend (100 - soma dos
  demais). O backend valida que a soma seja 100 ± 0.01 (tolerância).
- `quantidade` > 0 quando `percentual` > 0 (para colunas parceladas).
- `valor_unidade` > 0.

Sem persistência no Supabase — recebe linhas, devolve resultado.
"""
from pydantic import BaseModel, Field

# Colunas que aceitam quantidade (parcelado em N pagamentos)
_COLUNAS_PARCELADAS = {"mensais", "anuais", "semestrais"}


class ColunaSimples(BaseModel):
    percentual: float = Field(ge=0, le=100)
    data: str = ""


class ColunaParcelada(BaseModel):
    percentual: float = Field(ge=0, le=100)
    quantidade: int = Field(ge=0, default=0)
    data_inicio: str = ""


class FluxoConfig(BaseModel):
    ato: ColunaSimples
    dias30: ColunaSimples
    dias60: ColunaSimples
    dias90: ColunaSimples
    mensais: ColunaParcelada
    anuais: ColunaParcelada
    semestrais: ColunaParcelada
    parcela_unica: ColunaSimples
    financiamento: ColunaSimples


class LinhaIn(BaseModel):
    id: str
    valor_unidade: float = Field(gt=0)
    fluxo: FluxoConfig


class FluxoSimularIn(BaseModel):
    linhas: list[LinhaIn]


class ColunaResultado(BaseModel):
    """`total` = valor R$ alocado à coluna. `parcela` = total / qtd para
    parceladas; igual a total para as demais."""
    total: float
    parcela: float


class LinhaOut(BaseModel):
    id: str
    colunas: dict[str, ColunaResultado]
    soma_percentuais: float
    valida: bool


class FluxoSimularOut(BaseModel):
    linhas: list[LinhaOut]
    diferencas: dict[str, float] | None


def _soma_percentuais(fluxo: FluxoConfig) -> float:
    return (
        fluxo.ato.percentual
        + fluxo.dias30.percentual
        + fluxo.dias60.percentual
        + fluxo.dias90.percentual
        + fluxo.mensais.percentual
        + fluxo.anuais.percentual
        + fluxo.semestrais.percentual
        + fluxo.parcela_unica.percentual
        + fluxo.financiamento.percentual
    )


def _calcular_coluna(
    percentual: float,
    valor_unidade: float,
    quantidade: int = 0,
) -> ColunaResultado:
    """Calcula total R$ e parcela R$. Quantidade > 0 só para colunas
    parceladas — para as demais, parcela == total."""
    total = round((percentual / 100) * valor_unidade, 2)
    if quantidade > 0:
        parcela = round(total / quantidade, 2)
    else:
        parcela = total
    return ColunaResultado(total=total, parcela=parcela)


def _validar_quantidade(nome: str, percentual: float, quantidade: int) -> None:
    if percentual > 0 and quantidade <= 0:
        raise ValueError(
            f"Coluna '{nome}' tem percentual {percentual}% mas quantidade={quantidade}. "
            "Quantidade deve ser maior que zero quando o percentual é positivo."
        )


def _calcular_linha(linha: LinhaIn) -> LinhaOut:
    soma = round(_soma_percentuais(linha.fluxo), 2)
    valida = abs(soma - 100.0) <= 0.01

    if not valida:
        raise ValueError(
            f"Linha '{linha.id}': soma dos percentuais = {soma}% (esperado 100%, tolerância 0.01)."
        )

    _validar_quantidade("mensais", linha.fluxo.mensais.percentual, linha.fluxo.mensais.quantidade)
    _validar_quantidade("anuais", linha.fluxo.anuais.percentual, linha.fluxo.anuais.quantidade)
    _validar_quantidade(
        "semestrais", linha.fluxo.semestrais.percentual, linha.fluxo.semestrais.quantidade,
    )

    v = linha.valor_unidade
    f = linha.fluxo
    colunas = {
        "ato": _calcular_coluna(f.ato.percentual, v),
        "dias30": _calcular_coluna(f.dias30.percentual, v),
        "dias60": _calcular_coluna(f.dias60.percentual, v),
        "dias90": _calcular_coluna(f.dias90.percentual, v),
        "mensais": _calcular_coluna(f.mensais.percentual, v, f.mensais.quantidade),
        "anuais": _calcular_coluna(f.anuais.percentual, v, f.anuais.quantidade),
        "semestrais": _calcular_coluna(
            f.semestrais.percentual, v, f.semestrais.quantidade,
        ),
        "parcela_unica": _calcular_coluna(f.parcela_unica.percentual, v),
        "financiamento": _calcular_coluna(f.financiamento.percentual, v),
    }
    return LinhaOut(id=linha.id, colunas=colunas, soma_percentuais=soma, valida=True)


def _calcular_diferencas(linha_a: LinhaOut, linha_b: LinhaOut) -> dict[str, float]:
    """Delta por coluna entre as duas primeiras linhas (A - B). Positivo
    significa que A é mais cara que B naquela coluna."""
    return {
        nome: round(linha_a.colunas[nome].total - linha_b.colunas[nome].total, 2)
        for nome in linha_a.colunas.keys()
    }


def simular(req: FluxoSimularIn) -> FluxoSimularOut:
    """Pipeline principal — calcula cada linha e (se houver >=2) as
    diferenças entre as duas primeiras. Levanta ValueError em validações
    (caller mapeia para HTTPException 400)."""
    if not req.linhas:
        raise ValueError("Pelo menos uma linha é necessária.")

    linhas_out = [_calcular_linha(l) for l in req.linhas]
    diferencas = (
        _calcular_diferencas(linhas_out[0], linhas_out[1])
        if len(linhas_out) >= 2
        else None
    )
    return FluxoSimularOut(linhas=linhas_out, diferencas=diferencas)
