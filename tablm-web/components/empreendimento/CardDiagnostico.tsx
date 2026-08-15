"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";

type Tag = "forca" | "fraqueza" | "oportunidade" | "risco" | "neutro";

interface Bullet {
  texto: string;
  tag: Tag;
  kpi_referencia?: string | null;
}

interface Parecer {
  id: string;
  resumo_executivo: string;
  bullets: Bullet[];
  criado_em: string;
}

interface Resposta {
  atual: Parecer | null;
  historico: Parecer[];
}

interface Props {
  empreendimentoId: string;
}

const TAG_LABEL: Record<Tag, string> = {
  forca: "Força",
  fraqueza: "Fraqueza",
  oportunidade: "Oportunidade",
  risco: "Risco",
  neutro: "Neutro",
};

const TAG_TOM: Record<Tag, "up" | "down" | "warn" | "royal" | "neutro"> = {
  forca: "up",
  oportunidade: "royal",
  risco: "down",
  fraqueza: "warn",
  neutro: "neutro",
};

function formatarData(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function CardDiagnostico({ empreendimentoId }: Props) {
  const [parecer, setParecer] = useState<Parecer | null>(null);
  const [historico, setHistorico] = useState<Parecer[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string>("");

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      const r = await fetch(`/api/empreendimentos/${empreendimentoId}/diagnostico`);
      if (!r.ok) throw new Error(`Erro ${r.status}`);
      const d: Resposta = await r.json();
      setParecer(d.atual);
      setHistorico(d.historico ?? []);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empreendimentoId]);

  async function gerar() {
    setGerando(true);
    setErro("");
    try {
      const r = await fetch(`/api/empreendimentos/${empreendimentoId}/diagnostico`, {
        method: "POST",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? `Erro ${r.status}`);
      // Recarrega histórico (o novo virou o atual).
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  return (
    <Card variant="lg" className="mb-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <div className="text-[12px] font-bold tracking-[1.4px] uppercase text-royal">
            Diagnóstico competitivo
          </div>
          <div className="text-[14px] text-muted mt-0.5">
            Parecer automático via IA a partir dos seus KPIs + concorrentes
            (mesma cidade e padrão). Regenere quando os números mudarem.
          </div>
        </div>
        <Button onClick={gerar} disabled={gerando || carregando}>
          {gerando
            ? "Gerando…"
            : parecer
              ? "↻ Atualizar diagnóstico"
              : "🔎 Gerar diagnóstico"}
        </Button>
      </div>

      {erro && (
        <div className="rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line">
          {erro}
        </div>
      )}

      {carregando && !parecer ? (
        <div className="text-[13.5px] text-muted">Carregando…</div>
      ) : parecer ? (
        <div className="flex flex-col gap-3">
          {parecer.resumo_executivo && (
            <div className="text-[15px] font-semibold text-ink leading-snug">
              {parecer.resumo_executivo}
            </div>
          )}
          <ul className="flex flex-col gap-2">
            {parecer.bullets.map((b, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-[12px] border border-line bg-thead px-4 py-3"
              >
                <Chip tom={TAG_TOM[b.tag]} className="shrink-0 mt-0.5">
                  {TAG_LABEL[b.tag]}
                </Chip>
                <span className="text-[14px] text-body leading-snug">
                  {b.texto}
                  {b.kpi_referencia && (
                    <span className="text-[11.5px] text-muted ml-2">
                      · {b.kpi_referencia}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 flex-wrap text-[12px] text-muted">
            <span>Gerado em {formatarData(parecer.criado_em)}</span>
            {historico.length > 0 && (
              <span>
                {historico.length} versão(ões) anterior(es) preservada(s) no histórico
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="text-[13.5px] text-muted">
          Nenhum diagnóstico ainda. Clique em <strong>🔎 Gerar diagnóstico</strong>{" "}
          para a IA emitir 3 a 5 bullets de leitura competitiva a partir dos
          seus KPIs.
        </div>
      )}
    </Card>
  );
}
