"use client";

import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { KpiCard } from "@/components/ui/KpiCard";
import {
  calcularRendaNecessaria,
  PRESETS_TAXA,
  type PresetTaxa,
} from "@/lib/financiamento";
import type {
  CalculoRendaResponse,
  ModalidadeFinanciamento,
} from "@/types";

interface Props {
  /** Inicial. Editável no UI. */
  parcelaObraMensal?: number;
  /** Inicial. Editável no UI. */
  saldoFinanciar?: number;
  /** Modo "embutido": quando true, os 2 inputs principais ficam
   * read-only (vêm de outro componente — ex.: o Simulador). */
  controlado?: boolean;
}

const PRAZOS = [120, 180, 240, 300, 360, 420] as const;

const campo =
  "px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition";

function moeda(n: number): string {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CalculoRendaFinanciamento({
  parcelaObraMensal: parcelaInicial = 0,
  saldoFinanciar: saldoInicial = 0,
  controlado = false,
}: Props) {
  const [parcelaObra, setParcelaObra] = useState(parcelaInicial);
  const [saldo, setSaldo] = useState(saldoInicial);
  const [modalidade, setModalidade] = useState<ModalidadeFinanciamento>("mcmv_faixa3");
  const [taxaCustom, setTaxaCustom] = useState<number | null>(null);
  const [prazo, setPrazo] = useState(360);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<CalculoRendaResponse | null>(null);

  // Sincroniza props quando o modo controlado muda os valores externos.
  useEffect(() => {
    if (controlado) setParcelaObra(parcelaInicial);
  }, [controlado, parcelaInicial]);
  useEffect(() => {
    if (controlado) setSaldo(saldoInicial);
  }, [controlado, saldoInicial]);

  // Debounce 500ms — recalcula quando qualquer input muda.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (saldo <= 0) {
      setResultado(null);
      setErro(null);
      return;
    }
    if (modalidade === "personalizada" && (taxaCustom == null || taxaCustom <= 0)) {
      setResultado(null);
      setErro(null);
      return;
    }
    timer.current = setTimeout(async () => {
      setCarregando(true);
      setErro(null);
      try {
        const d = await calcularRendaNecessaria({
          parcela_obra_mensal: parcelaObra,
          saldo_financiar: saldo,
          modalidade,
          taxa_personalizada_anual:
            modalidade === "personalizada" ? taxaCustom : null,
          prazo_meses: prazo,
        });
        setResultado(d);
      } catch (e) {
        setErro((e as Error).message);
        setResultado(null);
      } finally {
        setCarregando(false);
      }
    }, 500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [parcelaObra, saldo, modalidade, taxaCustom, prazo]);

  const presetAtual: PresetTaxa | undefined = PRESETS_TAXA.find(
    (p) => p.id === modalidade,
  );

  return (
    <Card variant="lg" className="tablm-up">
      <div className="text-[16px] font-bold text-ink mb-1">
        Renda mínima necessária
      </div>
      <div className="text-[12.5px] text-muted mb-4">
        Calcula a renda familiar mínima a partir da parcela de obra +
        parcela do financiamento (Tabela Price), comprometendo até 30% da
        renda.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-bold text-body uppercase tracking-[0.4px]">
            Parcela mensal de obra (R$)
          </span>
          <input
            type="number"
            min={0}
            value={parcelaObra || ""}
            onChange={(e) => setParcelaObra(Number(e.target.value) || 0)}
            readOnly={controlado}
            className={`${campo} ${controlado ? "bg-thead" : ""}`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-bold text-body uppercase tracking-[0.4px]">
            Saldo a financiar (R$)
          </span>
          <input
            type="number"
            min={0}
            value={saldo || ""}
            onChange={(e) => setSaldo(Number(e.target.value) || 0)}
            readOnly={controlado}
            className={`${campo} ${controlado ? "bg-thead" : ""}`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-bold text-body uppercase tracking-[0.4px]">
            Modalidade
          </span>
          <select
            value={modalidade}
            onChange={(e) =>
              setModalidade(e.target.value as ModalidadeFinanciamento)
            }
            className={campo}
          >
            {PRESETS_TAXA.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {p.taxaAnual != null ? ` — ${p.taxaAnual}% a.a.` : ""}
              </option>
            ))}
          </select>
          {presetAtual && presetAtual.faixaRenda !== "—" && (
            <span className="text-[11.5px] text-faint">
              {presetAtual.faixaRenda} · {presetAtual.descricao}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-bold text-body uppercase tracking-[0.4px]">
            Prazo (meses)
          </span>
          <select
            value={prazo}
            onChange={(e) => setPrazo(Number(e.target.value))}
            className={campo}
          >
            {PRAZOS.map((p) => (
              <option key={p} value={p}>
                {p} meses
              </option>
            ))}
          </select>
        </label>
        {modalidade === "personalizada" && (
          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className="text-[12.5px] font-bold text-body uppercase tracking-[0.4px]">
              Taxa personalizada (% a.a., 1.0 a 30.0)
            </span>
            <input
              type="number"
              min={1}
              max={30}
              step={0.01}
              value={taxaCustom ?? ""}
              onChange={(e) =>
                setTaxaCustom(e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="Ex.: 9.50"
              className={campo}
            />
          </label>
        )}
      </div>

      {erro && (
        <div className="rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line mb-3">
          {erro}
        </div>
      )}

      {!resultado && !carregando && saldo <= 0 && (
        <div className="text-[13.5px] text-muted">
          Informe um saldo a financiar maior que zero para calcular.
        </div>
      )}

      {!resultado &&
        !carregando &&
        saldo > 0 &&
        modalidade === "personalizada" &&
        (taxaCustom == null || taxaCustom <= 0) && (
          <div className="text-[13.5px] text-muted">
            Informe uma taxa personalizada válida (1.0 a 30.0).
          </div>
        )}

      {resultado && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <KpiCard
              rotulo="Taxa a.a."
              valor={`${resultado.taxa_anual_usada.toFixed(2)}%`}
              hint={`${(resultado.taxa_mensal_usada * 100).toFixed(4)}% a.m.`}
            />
            <KpiCard
              rotulo="Parcela financ."
              valor={moeda(resultado.parcela_financiamento)}
              hint={`${prazo} meses (Price)`}
            />
            <KpiCard
              rotulo="Total mensal"
              valor={moeda(resultado.total_mensal_comprometido)}
              hint="obra + financ."
            />
            <KpiCard
              rotulo="Renda mínima"
              valor={
                <span className="text-royal">
                  {moeda(resultado.renda_necessaria)}
                </span>
              }
              hint="30% comprometido"
            />
          </div>

          {resultado.alertas.length > 0 && (
            <div className="rounded-[12px] bg-warn-bg border border-warn-line px-4 py-3">
              <div className="text-[12px] font-bold uppercase tracking-[0.5px] text-warn-strong mb-2">
                Alertas
              </div>
              <ul className="flex flex-col gap-1.5 text-[12.5px] text-warn-strong leading-relaxed">
                {resultado.alertas.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden>⚠</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {carregando && (
            <div className="mt-3 text-[12.5px] text-muted">Recalculando…</div>
          )}
        </>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {presetAtual && <Chip tom="royal">{presetAtual.label}</Chip>}
        {carregando && !resultado && (
          <span className="text-[12.5px] text-muted">Calculando…</span>
        )}
      </div>
    </Card>
  );
}
