"""Comparação entre duas versões de uma tabela, por coluna-chave."""
import pandas as pd


def comparar_versoes(df_antiga: pd.DataFrame, df_nova: pd.DataFrame, coluna_chave: str) -> dict:
    """Compara duas versões de uma tabela e retorna linhas adicionadas, removidas e alteradas.

    ``coluna_chave`` identifica unicamente cada linha (ex.: número da unidade).
    """
    antiga = df_antiga.set_index(coluna_chave)
    nova = df_nova.set_index(coluna_chave)

    chaves_antigas = set(antiga.index)
    chaves_novas = set(nova.index)

    adicionadas = nova.loc[sorted(chaves_novas - chaves_antigas)].reset_index()
    removidas = antiga.loc[sorted(chaves_antigas - chaves_novas)].reset_index()

    chaves_comuns = sorted(chaves_antigas & chaves_novas)
    colunas_comuns = [c for c in antiga.columns if c in nova.columns]

    alteracoes = []
    for chave in chaves_comuns:
        linha_antiga = antiga.loc[chave]
        linha_nova = nova.loc[chave]
        diffs = {
            col: (linha_antiga[col], linha_nova[col])
            for col in colunas_comuns
            if linha_antiga[col] != linha_nova[col]
        }
        if diffs:
            alteracoes.append({"chave": chave, "diferencas": diffs})

    return {
        "adicionadas": adicionadas,
        "removidas": removidas,
        "alteradas": alteracoes,
        "total_adicionadas": len(adicionadas),
        "total_removidas": len(removidas),
        "total_alteradas": len(alteracoes),
    }
