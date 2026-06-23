from decimal import Decimal

import pytest

from src.incc import fator_reajuste, reajustar_valor


def test_fator_reajuste_basico():
    fator = fator_reajuste("850.00", "905.30")
    assert fator == Decimal("905.30") / Decimal("850.00")


def test_fator_reajuste_indice_zero_levanta_erro():
    with pytest.raises(ValueError):
        fator_reajuste("0", "100")


def test_reajustar_valor_precisao_decimal():
    resultado = reajustar_valor("1000.00", "850.00", "905.30")
    assert resultado == Decimal("1065.06")


def test_reajustar_valor_sem_mudanca_de_indice():
    resultado = reajustar_valor("500.00", "900.00", "900.00")
    assert resultado == Decimal("500.00")
