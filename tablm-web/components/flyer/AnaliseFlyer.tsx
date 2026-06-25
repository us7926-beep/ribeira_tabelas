"use client";

import { useState, useTransition } from "react";

import { registrarEventoDeFlyer } from "@/app/(dashboard)/flyers/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dropzone } from "@/components/ui/Dropzone";
import type { DeteccaoFlyer, Empreendimento, Incorporadora } from "@/types";

const campo =
  "w-full px-[15px] py-[12px] rounded-[12px] border border-line bg-white text-[14px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition";

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="bg-thead border border-line-soft rounded-[12px] px-3 py-2.5">
      <div className="text-[11px] font-bold tracking-[0.5px] uppercase text-muted">{rotulo}</div>
      <div className="text-ink font-bold mt-0.5">{valor || "—"}</div>
    </div>
  );
}

function Aba({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        ativo
          ? "px-[14px] py-[7px] rounded-[9px] bg-royal text-white text-[13px] font-bold"
          : "px-[14px] py-[7px] rounded-[9px] bg-thead text-muted text-[13px] font-semibold hover:bg-royal-tint hover:text-royal transition-colors"
      }
    >
      {children}
    </button>
  );
}

export default function AnaliseFlyer({
  incorporadoras,
  empreendimentos,
}: {
  incorporadoras: Incorporadora[];
  empreendimentos: Empreendimento[];
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [deteccao, setDeteccao] = useState<DeteccaoFlyer | null>(null);

  const [modo, setModo] = useState<"existente" | "novo">("novo");
  const [empId, setEmpId] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [incId, setIncId] = useState("");
  const [novaIncNome, setNovaIncNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [condicoes, setCondicoes] = useState("");
  const [salvando, startSalvar] = useTransition();

  async function analisar() {
    if (!arquivo) return;
    setErro("");
    setSucesso("");
    setAnalisando(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const r = await fetch("/api/flyer/analisar", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? "Falha na análise");
      const det = d as DeteccaoFlyer;
      setDeteccao(det);
      setNovoNome(det.nome_empreendimento ?? "");
      setDescricao(det.evento ?? "");
      setDataInicio(det.data_inicio ?? "");
      setDataFim(det.data_fim ?? "");
      setCondicoes(det.condicoes_comerciais ?? "");
      const detIncNome = (det.incorporadora ?? "").trim();
      const match = incorporadoras.find(
        (i) => i.nome.toLowerCase() === detIncNome.toLowerCase(),
      );
      if (match) {
        setIncId(match.id);
        setNovaIncNome("");
      } else if (detIncNome) {
        // IA identificou uma incorporadora que não está cadastrada — pré-seleciona "criar nova".
        setIncId("__criar__");
        setNovaIncNome(detIncNome);
      } else {
        setIncId("");
        setNovaIncNome("");
      }
      setModo(empreendimentos.length ? "existente" : "novo");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setAnalisando(false);
    }
  }

  function confirmar() {
    setErro("");
    if (modo === "existente" && !empId) {
      setErro("Selecione o empreendimento para vincular.");
      return;
    }
    if (modo === "novo") {
      if (!novoNome.trim()) {
        setErro("Informe o nome do empreendimento.");
        return;
      }
      if (!incId) {
        setErro("Selecione a incorporadora ou cadastre uma nova.");
        return;
      }
      if (incId === "__criar__" && !novaIncNome.trim()) {
        setErro("Informe o nome da nova incorporadora.");
        return;
      }
    }
    startSalvar(async () => {
      const res = await registrarEventoDeFlyer({
        empreendimentoId: modo === "existente" ? empId || null : null,
        novoNome,
        novaIncorporadoraId: incId === "__criar__" ? "" : incId,
        novoNomeIncorporadora: incId === "__criar__" ? novaIncNome : undefined,
        descricao,
        dataInicio,
        dataFim,
        condicoes,
      });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setSucesso("Evento registrado no benchmark.");
      setDeteccao(null);
      setArquivo(null);
    });
  }

  return (
    <div className="max-w-[640px]">
      <Card variant="lg">
        <Dropzone
          arquivo={arquivo}
          onArquivo={setArquivo}
          aceitar=".pdf,.png,.jpg,.jpeg"
          titulo="Arraste o flyer aqui"
          dica="PDF, PNG ou JPG · até 50 MB"
        />
        <div className="mt-4 flex justify-end">
          <Button onClick={analisar} disabled={!arquivo || analisando}>
            {analisando ? "Analisando..." : "Analisar flyer"}
          </Button>
        </div>
      </Card>

      {erro && (
        <div className="mt-4 rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="mt-4 rounded-[12px] bg-up-bg text-up-strong text-[13.5px] px-4 py-3 border border-up-line">
          {sucesso}
        </div>
      )}

      {deteccao && (
        <div
          className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50"
          onClick={() => setDeteccao(null)}
        >
          <div
            className="bg-white rounded-[16px] border border-line w-full max-w-[560px] p-[22px] max-h-[90vh] overflow-auto shadow-[0_8px_22px_rgba(35,71,197,0.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[11px] font-bold tracking-[1.6px] uppercase text-royal mb-1">
              Análise por IA
            </div>
            <h3 className="text-[18px] font-extrabold text-ink mb-4">
              Revise e registre no benchmark
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              <Info rotulo="Empreendimento" valor={deteccao.nome_empreendimento} />
              <Info rotulo="Incorporadora" valor={deteccao.incorporadora} />
            </div>

            <div className="mt-5">
              <div className="flex gap-2 mb-3">
                <Aba ativo={modo === "existente"} onClick={() => setModo("existente")}>
                  Vincular a existente
                </Aba>
                <Aba ativo={modo === "novo"} onClick={() => setModo("novo")}>
                  Criar novo
                </Aba>
              </div>

              {modo === "existente" ? (
                <select value={empId} onChange={(e) => setEmpId(e.target.value)} className={campo}>
                  <option value="">Selecione o empreendimento…</option>
                  {empreendimentos.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nome}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="grid gap-2">
                  <input
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    placeholder="Nome do empreendimento"
                    className={campo}
                  />
                  <select value={incId} onChange={(e) => setIncId(e.target.value)} className={campo}>
                    <option value="">Incorporadora…</option>
                    {incorporadoras.map((inc) => (
                      <option key={inc.id} value={inc.id}>
                        {inc.nome}
                      </option>
                    ))}
                    <option value="__criar__">+ Cadastrar nova incorporadora…</option>
                  </select>
                  {incId === "__criar__" && (
                    <input
                      value={novaIncNome}
                      onChange={(e) => setNovaIncNome(e.target.value)}
                      placeholder="Nome da nova incorporadora"
                      className={campo}
                      autoFocus
                    />
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-2">
              <label className="text-[11px] font-bold tracking-[0.5px] uppercase text-muted">
                Evento / promoção
              </label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
                className={campo}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  placeholder="Início DD/MM/AAAA"
                  className={campo}
                />
                <input
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  placeholder="Fim DD/MM/AAAA"
                  className={campo}
                />
              </div>
              <label className="text-[11px] font-bold tracking-[0.5px] uppercase text-muted">
                Condições comerciais
              </label>
              <textarea
                value={condicoes}
                onChange={(e) => setCondicoes(e.target.value)}
                rows={2}
                className={campo}
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variante="secondary" onClick={() => setDeteccao(null)}>
                Cancelar
              </Button>
              <Button onClick={confirmar} disabled={salvando}>
                {salvando ? "Salvando..." : "Confirmar e registrar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
