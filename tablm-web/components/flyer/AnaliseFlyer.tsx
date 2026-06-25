"use client";

import { useState, useTransition } from "react";

import { registrarEventoDeFlyer } from "@/app/(dashboard)/flyers/actions";
import type { DeteccaoFlyer, Empreendimento, Incorporadora } from "@/types";

const campo =
  "w-full rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-royal text-sm";

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="bg-surface rounded-lg px-3 py-2">
      <div className="text-[11px] font-semibold text-muted">{rotulo}</div>
      <div className="text-ink font-semibold">{valor || "—"}</div>
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
      className={`text-sm font-semibold px-3 py-1.5 rounded-lg ${
        ativo ? "bg-royal text-white" : "bg-surface text-ink-soft"
      }`}
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
      const match = incorporadoras.find(
        (i) => i.nome.toLowerCase() === (det.incorporadora ?? "").toLowerCase(),
      );
      setIncId(match?.id ?? "");
      setModo(empreendimentos.length ? "existente" : "novo");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setAnalisando(false);
    }
  }

  function confirmar() {
    setErro("");
    startSalvar(async () => {
      try {
        await registrarEventoDeFlyer({
          empreendimentoId: modo === "existente" ? empId || null : null,
          novoNome,
          novaIncorporadoraId: incId,
          descricao,
          dataInicio,
          dataFim,
          condicoes,
        });
        setSucesso("Evento registrado no benchmark! ✅");
        setDeteccao(null);
        setArquivo(null);
      } catch (e) {
        setErro((e as Error).message);
      }
    });
  }

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-2xl border border-line p-6">
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-lg file:border-0 file:bg-royal file:text-white file:px-4 file:py-2 file:font-semibold hover:file:bg-royal-dark"
        />
        <button
          onClick={analisar}
          disabled={!arquivo || analisando}
          className="mt-4 rounded-lg bg-royal hover:bg-royal-dark text-white font-semibold px-5 py-2.5 disabled:opacity-50"
        >
          {analisando ? "Analisando com IA..." : "🤖 Analisar flyer"}
        </button>
      </div>

      {erro && (
        <div className="mt-4 rounded-lg bg-red-50 text-neg text-sm px-3 py-2 border border-red-100">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="mt-4 rounded-lg bg-green-50 text-pos text-sm px-3 py-2 border border-green-100">
          {sucesso}
        </div>
      )}

      {deteccao && (
        <div
          className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50"
          onClick={() => setDeteccao(null)}
        >
          <div
            className="bg-white rounded-2xl border border-line w-full max-w-lg p-6 max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-ink">A IA detectou</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
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
                  <option value="">Selecione o empreendimento...</option>
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
                    <option value="">Incorporadora...</option>
                    {incorporadoras.map((inc) => (
                      <option key={inc.id} value={inc.id}>
                        {inc.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-2">
              <label className="text-xs font-semibold text-muted">Evento / promoção</label>
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
              <label className="text-xs font-semibold text-muted">Condições comerciais</label>
              <textarea
                value={condicoes}
                onChange={(e) => setCondicoes(e.target.value)}
                rows={2}
                className={campo}
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setDeteccao(null)}
                className="rounded-lg border border-line px-4 py-2 text-ink-soft"
              >
                Cancelar
              </button>
              <button
                onClick={confirmar}
                disabled={salvando}
                className="rounded-lg bg-royal hover:bg-royal-dark text-white font-semibold px-5 py-2 disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Confirmar e registrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
