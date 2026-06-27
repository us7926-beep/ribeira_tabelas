"use client";

import { FLUXO_COLUNAS } from "@/lib/fluxoColunas";
import type { ColunaParcelada, ColunaSimples, FluxoConfig } from "@/types";

interface Props {
  fluxo: FluxoConfig;
  onChange: (mutator: (f: FluxoConfig) => FluxoConfig) => void;
}

const inputBase =
  "w-full px-2 py-1.5 rounded-[8px] border border-line bg-white text-[13px] tnum outline-none focus:border-royal";

function isParcelada(
  campo: ColunaSimples | ColunaParcelada,
): campo is ColunaParcelada {
  return "quantidade" in campo;
}

/** Grid de configuração — uma linha por coluna do fluxo (iterando sobre
 * FLUXO_COLUNAS, fonte única). Financiamento read-only (derivado). */
export function FluxoGridConfig({ fluxo, onChange }: Props) {
  return (
    <div className="border border-line-soft rounded-[12px] overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="bg-thead text-muted">
          <tr>
            <th className="text-left font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5">
              Coluna
            </th>
            <th className="text-right font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5 w-[110px]">
              %
            </th>
            <th className="text-right font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5 w-[100px]">
              Parcelas
            </th>
            <th className="text-left font-bold text-[11.5px] uppercase tracking-[0.4px] px-3 py-2.5 w-[160px]">
              Data
            </th>
          </tr>
        </thead>
        <tbody>
          {FLUXO_COLUNAS.map((col) => {
            const campo = fluxo[col.id];
            const parc = isParcelada(campo) ? campo : null;
            return (
              <tr
                key={col.id}
                className={
                  col.derivada
                    ? "border-t border-line-soft bg-royal-tint/40"
                    : "border-t border-line-soft"
                }
              >
                <td className="px-3 py-2 font-semibold text-ink">
                  {col.label}
                  {col.derivada && (
                    <span className="ml-2 text-[10.5px] font-bold uppercase tracking-[0.3px] text-royal">
                      derivado
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={campo.percentual || ""}
                    readOnly={col.derivada}
                    title={col.derivada ? "100 − soma das demais" : undefined}
                    onChange={(e) => {
                      const v = Math.max(0, Number(e.target.value) || 0);
                      onChange((f) => ({
                        ...f,
                        [col.id]: { ...f[col.id], percentual: v },
                      }));
                    }}
                    className={`${inputBase} text-right ${col.derivada ? "bg-thead cursor-not-allowed" : ""}`}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  {col.aceitaQuantidade && parc ? (
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={parc.quantidade || ""}
                      onChange={(e) => {
                        const v = Math.max(0, parseInt(e.target.value || "0", 10) || 0);
                        onChange((f) => ({
                          ...f,
                          [col.id]: { ...f[col.id], quantidade: v } as ColunaParcelada,
                        }));
                      }}
                      className={`${inputBase} text-right`}
                    />
                  ) : (
                    <span className="text-[12px] text-faint">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="date"
                    value={parc ? parc.data_inicio : (campo as ColunaSimples).data}
                    onChange={(e) => {
                      onChange((f) => {
                        const c = f[col.id];
                        if (isParcelada(c)) {
                          return {
                            ...f,
                            [col.id]: { ...c, data_inicio: e.target.value } as ColunaParcelada,
                          };
                        }
                        return {
                          ...f,
                          [col.id]: { ...c, data: e.target.value } as ColunaSimples,
                        };
                      });
                    }}
                    className={inputBase}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
