"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ModalEvento } from "@/components/promocoes/ModalEvento";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { baixarCsv, montarCsv } from "@/lib/csv";
import { diasAteVencer } from "@/lib/promocoes";
import type { Empreendimento, EventoPromocional } from "@/types";

interface Props {
  empreendimento: Empreendimento;
  empreendimentos: Empreendimento[];
}

function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

type Filtro = "todas" | "ativas" | "expiradas";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "ativas", label: "Ativas" },
  { id: "todas", label: "Todas" },
  { id: "expiradas", label: "Expiradas" },
];

export function AbaPromocoes({ empreendimento, empreendimentos }: Props) {
  const [eventos, setEventos] = useState<EventoPromocional[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("ativas");
  const [modalAberto, setModalAberto] = useState(false);
  const [eventoEditando, setEventoEditando] = useState<EventoPromocional | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const r = await fetch("/api/benchmark/eventos");
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Falha ao carregar");
      const lista = (d as EventoPromocional[]).filter(
        (ev) => ev.empreendimento_id === empreendimento.id,
      );
      setEventos(lista);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [empreendimento.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    return eventos
      .filter((ev) => {
        const d = diasAteVencer(ev.data_fim);
        if (filtro === "ativas") return d !== null && d >= 0;
        if (filtro === "expiradas") return d !== null && d < 0;
        return true;
      })
      .sort((a, b) => {
        const da = diasAteVencer(a.data_fim) ?? Number.POSITIVE_INFINITY;
        const db = diasAteVencer(b.data_fim) ?? Number.POSITIVE_INFINITY;
        return da - db;
      });
  }, [eventos, filtro]);

  const contagem = useMemo(() => {
    let ativas = 0;
    let expiradas = 0;
    for (const ev of eventos) {
      const d = diasAteVencer(ev.data_fim);
      if (d === null) continue;
      if (d >= 0) ativas += 1;
      else expiradas += 1;
    }
    return { ativas, expiradas, total: eventos.length };
  }, [eventos]);

  function exportarCsv() {
    if (filtrados.length === 0) return;
    const cabecalho = [
      "descricao",
      "condicoes_comerciais",
      "data_inicio",
      "data_fim",
      "dias_ate_vencer",
    ];
    const linhas = filtrados.map((ev) => [
      ev.descricao ?? "",
      ev.condicoes_comerciais ?? "",
      ev.data_inicio ?? "",
      ev.data_fim ?? "",
      diasAteVencer(ev.data_fim) ?? "",
    ]);
    const nome = `promocoes-${empreendimento.nome.replace(/[\\/\s]+/g, "_")}.csv`;
    baixarCsv(nome, montarCsv(cabecalho, linhas));
  }

  return (
    <div className="flex flex-col gap-5 tablm-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex gap-1.5 bg-white border border-line rounded-[13px] p-[5px]">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={
                  filtro === f.id
                    ? "px-[18px] py-[9px] rounded-[9px] bg-royal text-white text-[14px] font-semibold"
                    : "px-[18px] py-[9px] rounded-[9px] text-muted text-[14px] font-semibold hover:bg-[#F1F4FB] hover:text-royal transition-colors"
                }
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-[12.5px] text-muted">
            {contagem.ativas} ativa(s) · {contagem.expiradas} expirada(s)
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportarCsv}
            disabled={filtrados.length === 0}
            className="text-[12.5px] font-bold text-royal hover:underline disabled:text-faint disabled:no-underline"
          >
            Baixar CSV
          </button>
          <Button
            variante="secondary"
            onClick={() => {
              setEventoEditando(null);
              setModalAberto(true);
            }}
          >
            + Nova promoção
          </Button>
        </div>
      </div>

      {carregando ? (
        <Card>
          <div className="text-[13.5px] text-muted">Carregando promoções…</div>
        </Card>
      ) : erro ? (
        <Card>
          <div className="text-[13.5px] text-down-strong">{erro}</div>
        </Card>
      ) : filtrados.length === 0 ? (
        <Card>
          <div className="text-[13.5px] text-muted">
            Nenhuma promoção {filtro === "ativas" ? "ativa" : filtro === "expiradas" ? "expirada" : ""} para
            este empreendimento. Use <b>+ Nova promoção</b> ou suba um flyer pela{" "}
            <b>Análise por IA</b>.
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filtrados.map((ev) => {
            const dias = diasAteVencer(ev.data_fim);
            let tom: "up" | "warn" | "down" | "neutro" = "neutro";
            let rotulo = "Sem prazo";
            if (dias !== null) {
              if (dias < 0) {
                tom = "down";
                rotulo = `Expirou há ${Math.abs(dias)} dia(s)`;
              } else if (dias === 0) {
                tom = "down";
                rotulo = "Expira hoje";
              } else if (dias <= 7) {
                tom = "warn";
                rotulo = `Expira em ${dias} dia(s)`;
              } else {
                tom = "up";
                rotulo = `Expira em ${dias} dia(s)`;
              }
            }
            return (
              <Card key={ev.id}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <Chip tom={tom}>{rotulo}</Chip>
                    </div>
                    <div className="text-[13.5px] text-body leading-relaxed">
                      {ev.descricao || ev.condicoes_comerciais || "Promoção sem descrição"}
                    </div>
                    <div className="text-[12px] text-faint mt-2 tnum">
                      {dataBR(ev.data_inicio)} → {dataBR(ev.data_fim)}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEventoEditando(ev);
                      setModalAberto(true);
                    }}
                    className="text-[12.5px] font-bold text-royal hover:underline shrink-0"
                  >
                    Editar
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ModalEvento
        aberto={modalAberto}
        evento={eventoEditando}
        empreendimentos={empreendimentos}
        empreendimentoIdInicial={empreendimento.id}
        onFechar={() => {
          setModalAberto(false);
          setEventoEditando(null);
        }}
        onMudou={carregar}
      />
    </div>
  );
}
