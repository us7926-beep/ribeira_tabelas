"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { Card } from "@/components/ui/Card";
import { diasAteVencer } from "@/lib/promocoes";
import type { Empreendimento, EventoPromocional, Incorporadora } from "@/types";

interface Props {
  eventos: EventoPromocional[];
  empreendimentos: Empreendimento[];
  incorporadoras: Incorporadora[];
}

const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_ANTES = 30;
const DIAS_DEPOIS = 90;
const JANELA = DIAS_ANTES + DIAS_DEPOIS;

const W = 1200;
const PAD_LEFT = 200;
const PAD_RIGHT = 24;
const PAD_TOP = 36;
const ROW_H = 26;
const BAR_H = 14;
const TRACK_W = W - PAD_LEFT - PAD_RIGHT;

function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
}

function dataBR(iso: string | null | undefined): string {
  const d = parseIsoDate(iso);
  if (!d) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

function mesAbreviado(d: Date): string {
  return ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][
    d.getUTCMonth()
  ];
}

export function TimelineCronograma({ eventos, empreendimentos, incorporadoras }: Props) {
  const router = useRouter();
  const mapEmp = useMemo(
    () => new Map(empreendimentos.map((e) => [e.id, e])),
    [empreendimentos],
  );
  const mapInc = useMemo(
    () => new Map(incorporadoras.map((i) => [i.id, i])),
    [incorporadoras],
  );

  const hoje = useMemo(() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }, []);

  const janela = useMemo(() => {
    const inicio = new Date(hoje.getTime() - DIAS_ANTES * DIA_MS);
    const fim = new Date(hoje.getTime() + DIAS_DEPOIS * DIA_MS);
    return { inicio, fim };
  }, [hoje]);

  const linhas = useMemo(() => {
    const visiveis = eventos
      .map((ev) => {
        const dFim = parseIsoDate(ev.data_fim);
        if (!dFim) return null;
        let dInicio = parseIsoDate(ev.data_inicio);
        if (!dInicio) {
          const alvo = new Date(dFim.getTime() - DIAS_ANTES * DIA_MS);
          dInicio = alvo < janela.inicio ? janela.inicio : alvo;
        }
        if (dFim < janela.inicio || dInicio > janela.fim) return null;
        const inicioClamp = dInicio < janela.inicio ? janela.inicio : dInicio;
        const fimClamp = dFim > janela.fim ? janela.fim : dFim;
        return { ev, dInicio: inicioClamp, dFim: fimClamp, dFimOriginal: dFim };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.dFimOriginal.getTime() - b.dFimOriginal.getTime())
      .slice(0, 30);
    return visiveis;
  }, [eventos, janela]);

  const totalAlemDoLimite = Math.max(
    0,
    eventos.filter((ev) => parseIsoDate(ev.data_fim)).length - linhas.length,
  );

  if (linhas.length === 0) {
    return null;
  }

  const H = PAD_TOP + linhas.length * ROW_H + 24;

  function xDe(d: Date): number {
    const dias = (d.getTime() - janela.inicio.getTime()) / DIA_MS;
    return PAD_LEFT + (dias / JANELA) * TRACK_W;
  }

  const xHoje = xDe(hoje);

  const ticksMes: { x: number; rotulo: string }[] = [];
  const cursor = new Date(janela.inicio);
  cursor.setUTCDate(1);
  while (cursor <= janela.fim) {
    if (cursor >= janela.inicio) {
      ticksMes.push({
        x: xDe(new Date(cursor)),
        rotulo: `${mesAbreviado(cursor)}/${String(cursor.getUTCFullYear()).slice(2)}`,
      });
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  function corBarra(ev: EventoPromocional): { fill: string; stroke: string } {
    const dias = diasAteVencer(ev.data_fim);
    if (dias === null) return { fill: "var(--color-thead)", stroke: "var(--color-line)" };
    if (dias < 0) return { fill: "var(--color-down-bg)", stroke: "var(--color-down-line)" };
    if (dias <= 3) return { fill: "var(--color-down)", stroke: "var(--color-down-strong)" };
    if (dias <= 7) return { fill: "var(--color-warn)", stroke: "var(--color-warn-strong)" };
    return { fill: "var(--color-up)", stroke: "var(--color-up-strong)" };
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <div className="text-[15px] font-bold text-ink">Cronograma</div>
          <div className="text-[12.5px] text-muted mt-0.5">
            Janela de {DIAS_ANTES} dias atrás até {DIAS_DEPOIS} dias à frente · {linhas.length} promoção(ões)
            {totalAlemDoLimite > 0 && ` · ${totalAlemDoLimite} fora da janela visível`}
          </div>
        </div>
      </div>
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ minWidth: `${Math.min(W, 720)}px`, height: `${H}px`, width: "100%" }}
        >
          {/* Grade vertical de meses */}
          {ticksMes.map((t) => (
            <g key={t.x}>
              <line
                x1={t.x}
                x2={t.x}
                y1={PAD_TOP - 6}
                y2={H - 8}
                stroke="var(--color-line-soft)"
                strokeWidth={1}
              />
              <text
                x={t.x}
                y={PAD_TOP - 12}
                fill="var(--color-faint)"
                fontSize={10.5}
                fontWeight={700}
                textAnchor="middle"
              >
                {t.rotulo}
              </text>
            </g>
          ))}

          {/* Linha vertical do "hoje" */}
          <line
            x1={xHoje}
            x2={xHoje}
            y1={PAD_TOP - 18}
            y2={H - 8}
            stroke="var(--color-royal)"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          <text
            x={xHoje}
            y={PAD_TOP - 22}
            fill="var(--color-royal)"
            fontSize={11}
            fontWeight={800}
            textAnchor="middle"
          >
            hoje
          </text>

          {/* Barras */}
          {linhas.map((linha, i) => {
            const y = PAD_TOP + i * ROW_H + ROW_H / 2;
            const x1 = xDe(linha.dInicio);
            const x2 = xDe(linha.dFim);
            const largura = Math.max(4, x2 - x1);
            const emp = mapEmp.get(linha.ev.empreendimento_id);
            const inc = emp ? mapInc.get(emp.incorporadora_id) : undefined;
            const nome = (emp?.nome ?? "Empreendimento").slice(0, 26);
            const cores = corBarra(linha.ev);
            const descricao = linha.ev.descricao ?? linha.ev.condicoes_comerciais ?? "";
            const sufixoTooltip = emp ? " · clique para abrir o dossiê" : "";
            const tooltip = [
              emp?.nome ?? "Empreendimento",
              inc?.nome,
              descricao,
              `${dataBR(linha.ev.data_inicio)} → ${dataBR(linha.ev.data_fim)}`,
            ]
              .filter(Boolean)
              .join(" · ") + sufixoTooltip;
            const abrirDossie = () => {
              if (emp) router.push(`/empreendimentos/${emp.id}`);
            };
            return (
              <g
                key={linha.ev.id}
                onClick={emp ? abrirDossie : undefined}
                onKeyDown={
                  emp
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          abrirDossie();
                        }
                      }
                    : undefined
                }
                tabIndex={emp ? 0 : -1}
                role={emp ? "button" : undefined}
                aria-label={emp ? `Abrir dossiê de ${emp.nome}` : undefined}
                className={emp ? "cursor-pointer hover:opacity-75 focus:opacity-75 outline-none transition-opacity" : undefined}
              >
                <text
                  x={PAD_LEFT - 10}
                  y={y + 4}
                  fill="var(--color-body)"
                  fontSize={11.5}
                  fontWeight={600}
                  textAnchor="end"
                >
                  {nome}
                </text>
                <rect
                  x={x1}
                  y={y - BAR_H / 2}
                  width={largura}
                  height={BAR_H}
                  rx={4}
                  fill={cores.fill}
                  stroke={cores.stroke}
                  strokeWidth={1}
                >
                  <title>{tooltip}</title>
                </rect>
              </g>
            );
          })}
        </svg>
      </div>
    </Card>
  );
}
