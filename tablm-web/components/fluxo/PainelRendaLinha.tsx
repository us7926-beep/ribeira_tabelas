"use client";

import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { KpiCard } from "@/components/ui/KpiCard";
import { calcularRendaNecessaria, PRESETS_TAXA } from "@/lib/financiamento";
import type {
  CalculoRendaResponse,
  ConfigRendaLinha,
  ResultadoLinha,
  SimuladorLinha,
} from "@/types";

interface Props {
  linha: SimuladorLinha;
  resultado: ResultadoLinha | undefined;
  config: ConfigRendaLinha;
  onChange: (parcial: Partial<ConfigRendaLinha>) => void;
}

const PRAZOS = [120, 180, 240, 300, 360, 420] as const;
const campo =
  "px-[12px] py-[8px] rounded-[10px] border border-line bg-white text-[13.5px] outline-none focus:border-royal";

function moeda(n: number): string {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Painel de Renda por linha. Lê saldo (financiamento.total) e parcela
 * obra (mensais.parcela) do resultado já calculado pelo /fluxo/simular.
 * Chama /financiamento/calcular-renda quando modalidade/prazo mudam.
 * Debounce 500ms. */
export function PainelRendaLinha({ linha, resultado, config, onChange }: Props) {
  const saldo = resultado?.colunas.financiamento.total ?? 0;
  const parcelaObra = resultado?.colunas.mensais.parcela ?? 0;

  const [renda, setRenda] = useState<CalculoRendaResponse | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (saldo <= 0) {
      setRenda(null);
      setErro(null);
      return;
    }
    if (
      config.modalidade === "personalizada" &&
      (config.taxaPersonalizada == null || config.taxaPersonalizada <= 0)
    ) {
      setRenda(null);
      return;
    }
    timer.current = setTimeout(async () => {
      setCarregando(true);
      setErro(null);
      try {
        const d = await calcularRendaNecessaria({
          parcela_obra_mensal: parcelaObra,
          saldo_financiar: saldo,
          modalidade: config.modalidade,
          taxa_personalizada_anual:
            config.modalidade === "personalizada"
              ? config.taxaPersonalizada
              : null,
          prazo_meses: config.prazoMeses,
        });
        setRenda(d);
      } catch (e) {
        setErro((e as Error).message);
        setRenda(null);
      } finally {
        setCarregando(false);
      }
    }, 500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [saldo, parcelaObra, config.modalidade, config.taxaPersonalizada, config.prazoMeses]);

  return (
    <Card variant="lg">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <div className="text-[11px] font-bold tracking-[1.4px] uppercase text-muted">
            Renda necessária
          </div>
          <div className="text-[16px] font-bold text-ink mt-0.5">
            {linha.empreendimentoNome}{" "}
            <span className="text-muted font-normal">/ {linha.unidadeLabel}</span>
          </div>
        </div>
        <Chip tom={linha.cor}>{renda?.label_modalidade ?? "—"}</Chip>
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-faint uppercase tracking-[0.4px]">
            Modalidade
          </span>
          <select
            value={config.modalidade}
            onChange={(e) =>
              onChange({ modalidade: e.target.value as ConfigRendaLinha["modalidade"] })
            }
            className={campo}
          >
            {PRESETS_TAXA.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-faint uppercase tracking-[0.4px]">
            Prazo
          </span>
          <select
            value={config.prazoMeses}
            onChange={(e) => onChange({ prazoMeses: Number(e.target.value) })}
            className={campo}
          >
            {PRAZOS.map((p) => (
              <option key={p} value={p}>
                {p} meses
              </option>
            ))}
          </select>
        </label>
        {config.modalidade === "personalizada" && (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-faint uppercase tracking-[0.4px]">
              Taxa % a.a.
            </span>
            <input
              type="number"
              min={1}
              max={30}
              step={0.01}
              value={config.taxaPersonalizada ?? ""}
              onChange={(e) =>
                onChange({
                  taxaPersonalizada:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="Ex.: 9.50"
              className={`${campo} w-[110px]`}
            />
          </label>
        )}
      </div>

      {erro && (
        <div className="rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line mb-3">
          {erro}
        </div>
      )}

      {saldo <= 0 ? (
        <div className="text-[13.5px] text-muted">
          Configure a coluna <b>Financiamento</b> (residual) na linha para calcular renda.
        </div>
      ) : !renda && !carregando ? (
        <div className="text-[13.5px] text-muted">
          {config.modalidade === "personalizada"
            ? "Informe uma taxa personalizada válida."
            : "Aguardando cálculo…"}
        </div>
      ) : null}

      {renda && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              rotulo="Saldo a financiar"
              valor={moeda(saldo)}
              hint={`${renda.taxa_anual_usada.toFixed(2)}% a.a.`}
            />
            <KpiCard
              rotulo="Parcela obra"
              valor={moeda(parcelaObra)}
              hint="mensal"
            />
            <KpiCard
              rotulo="Parcela financ."
              valor={moeda(renda.parcela_financiamento)}
              hint={`${config.prazoMeses}m (Price)`}
            />
            <KpiCard
              rotulo="Renda mínima"
              valor={
                <span className="text-royal">{moeda(renda.renda_necessaria)}</span>
              }
              hint={`Total mensal ${moeda(renda.total_mensal_comprometido)}`}
            />
          </div>

          {renda.alertas.length > 0 && (
            <div className="mt-3 rounded-[12px] bg-warn-bg border border-warn-line px-4 py-3">
              <ul className="flex flex-col gap-1.5 text-[12.5px] text-warn-strong leading-relaxed">
                {renda.alertas.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden>⚠</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
