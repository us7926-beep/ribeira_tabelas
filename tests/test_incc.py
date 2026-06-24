"""Testes da lógica de cálculo do reajuste (sem dependência externa)."""
from decimal import Decimal

import pandas as pd
import pytest

from src.incc import (
    fator_reajuste,
    reajustar_tabela_mensal,
    reajustar_valor,
    reajustar_valor_mensal,
)


# --- reajuste por variação mensal (caminho feliz) --------------------------- #
def test_deve_aplicar_apenas_percentual_quando_sem_acrescimo():
    # 1000 + 0,88% = 1008,80
    assert reajustar_valor_mensal("1000.00", "0.88") == Decimal("1008.80")


def test_deve_somar_percentual_e_valor_bruto_quando_ambos_informados():
    # 1000 * (1 + 1.88/100) + 500 = 1018,80 + 500
    assert reajustar_valor_mensal("1000.00", "1.88", "500.00") == Decimal("1518.80")


def test_deve_aplicar_apenas_valor_bruto_quando_percentual_zero():
    assert reajustar_valor_mensal("1000.00", "0", "250.00") == Decimal("1250.00")


def test_deve_retornar_decimal_com_duas_casas_quando_reajusta():
    # Exemplo real: INCC 0,77% + 1% adicional (= 1,77%) + R$ 500 sobre 350.000.
    resultado = reajustar_valor_mensal(350000, 1.77, 500)
    assert isinstance(resultado, Decimal)
    assert resultado == Decimal("356695.00")


# --- entradas em formatos diferentes (casos de borda) ----------------------- #
def test_deve_converter_virgula_decimal_quando_valor_em_string():
    # "1000,00" e "0,88" (formato brasileiro) devem ser interpretados.
    assert reajustar_valor_mensal("1000,00", "0,88") == Decimal("1008.80")


# --- fator entre dois índices ----------------------------------------------- #
def test_deve_calcular_fator_quando_indices_validos():
    assert fator_reajuste("850.00", "905.30") == Decimal("905.30") / Decimal("850.00")


def test_deve_levantar_value_error_quando_indice_inicial_zero():
    with pytest.raises(ValueError):
        fator_reajuste("0", "100")


def test_deve_reajustar_pelo_fator_quando_indices_validos():
    # 1000 * (905.30/850) = 1065,0588... -> 1065,06
    assert reajustar_valor("1000.00", "850.00", "905.30") == Decimal("1065.06")


def test_deve_manter_valor_quando_indice_nao_muda():
    assert reajustar_valor("500.00", "900.00", "900.00") == Decimal("500.00")


# --- reajuste de tabela ----------------------------------------------------- #
def test_deve_criar_coluna_reajustada_sem_mutar_original_quando_reajusta_tabela():
    df = pd.DataFrame({"unidade": [1, 2], "valor": [1000.0, 2000.0]})
    resultado = reajustar_tabela_mensal(df, "valor", "0.88")

    assert resultado["valor_reajustado"].tolist() == [1008.80, 2017.60]
    assert "valor_reajustado" not in df.columns  # original intacto
