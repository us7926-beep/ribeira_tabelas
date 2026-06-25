"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const campo =
  "w-full rounded-[12px] border border-line bg-white px-[15px] py-[13px] text-[15px] outline-none focus:border-royal focus:ring-[3px] focus:ring-royal/[0.12] transition";

function MiniStat({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <div>
      <div className="text-[26px] font-extrabold text-white tnum leading-none">{valor}</div>
      <div className="text-[12px] text-white/65 mt-1.5 leading-tight">{rotulo}</div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const resposta = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, senha }),
      });
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}));
        throw new Error(dados.detail ?? "Usuário ou senha inválidos");
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Painel de marca (46%) */}
      <div
        className="hidden lg:flex flex-col justify-between text-white p-12 w-[46%] min-w-[420px] relative overflow-hidden"
        style={{
          background:
            "linear-gradient(155deg,#2347C5 0%,#1A38A8 55%,#122A82 100%)",
        }}
      >
        {/* círculo decorativo */}
        <div
          className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle,#fff 0,transparent 70%)" }}
        />
        <div className="relative flex items-center gap-3">
          <div className="size-11 rounded-[12px] bg-white grid place-items-center text-royal font-extrabold text-[20px]">
            T
          </div>
          <div className="leading-tight">
            <div className="font-extrabold text-[18px]">TabLM</div>
            <div className="text-[10.5px] tracking-[1.6px] text-white/65 mt-1 uppercase">
              Ribeira Empreendimentos
            </div>
          </div>
        </div>

        <div className="relative">
          <h1 className="text-[42px] font-extrabold leading-[1.05] tracking-[-1px] max-w-md">
            Inteligência de tabelas para o seu portfólio imobiliário.
          </h1>
          <p className="mt-6 text-[15px] text-white/75 leading-relaxed max-w-md">
            Dashboards de vendas, comparação de concorrência, reajuste por INCC e detecção de
            padrões — tudo em um só lugar.
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-6">
          <MiniStat valor="5" rotulo="módulos" />
          <MiniStat valor="248" rotulo="unidades na base" />
          <MiniStat valor="INCC-DI" rotulo="fonte oficial BCB" />
        </div>
      </div>

      {/* Formulário (54%) */}
      <div className="flex-1 flex items-center justify-center p-8 bg-canvas">
        <form onSubmit={entrar} className="w-full max-w-[380px]">
          <div className="text-[12px] font-bold tracking-[1.6px] uppercase text-royal mb-2">
            Bem-vindo de volta
          </div>
          <h2 className="text-[28px] font-extrabold text-ink tracking-[-0.5px] mb-6">
            Entrar na sua conta
          </h2>

          {erro && (
            <div className="mb-4 rounded-[12px] bg-down-bg text-down-strong text-[13.5px] px-4 py-3 border border-down-line">
              {erro}
            </div>
          )}

          <label className="block text-[13px] font-semibold text-body mb-1.5">Usuário</label>
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            required
            className={`${campo} mb-4`}
          />

          <label className="block text-[13px] font-semibold text-body mb-1.5">Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
            className={`${campo} mb-5`}
          />

          <label className="flex items-center gap-2 mb-6 text-[13px] text-muted">
            <input type="checkbox" className="accent-royal size-4" defaultChecked />
            Manter conectado
          </label>

          <button
            disabled={carregando}
            className="w-full rounded-[12px] bg-royal hover:bg-royal-hover text-white font-bold text-[15.5px] py-[14px] shadow-[0_6px_16px_rgba(35,71,197,0.28)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
