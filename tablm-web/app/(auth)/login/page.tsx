"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-royal text-white p-12">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-white/15 grid place-items-center font-extrabold text-lg">T</div>
          <div>
            <div className="font-bold text-lg leading-none">TabLM</div>
            <div className="text-[11px] tracking-[0.15em] text-white/70 mt-1">RIBEIRA EMPREENDIMENTOS</div>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-extrabold leading-tight">
            Inteligência competitiva para o seu portfólio imobiliário.
          </h1>
          <p className="mt-4 text-white/75 max-w-md">
            Hierarquia de empreendimentos, análise de flyers por IA, eventos de mercado
            e comparação de concorrência — num só lugar.
          </p>
        </div>
        <div className="text-white/55 text-sm">© Ribeira Empreendimentos</div>
      </div>

      <div className="flex items-center justify-center p-8 bg-surface">
        <form onSubmit={entrar} className="w-full max-w-sm">
          <div className="text-xs font-bold tracking-widest text-muted">BEM-VINDO DE VOLTA</div>
          <h2 className="text-2xl font-extrabold text-ink mt-1 mb-6">Entrar na sua conta</h2>
          {erro && (
            <div className="mb-4 rounded-lg bg-red-50 text-neg text-sm px-3 py-2 border border-red-100">
              {erro}
            </div>
          )}
          <label className="block text-sm font-semibold text-ink-soft mb-1">Usuário</label>
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            className="w-full rounded-lg border border-line bg-white px-3 py-2 mb-4 outline-none focus:border-royal"
          />
          <label className="block text-sm font-semibold text-ink-soft mb-1">Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg border border-line bg-white px-3 py-2 mb-6 outline-none focus:border-royal"
          />
          <button
            disabled={carregando}
            className="w-full rounded-lg bg-royal hover:bg-royal-dark text-white font-semibold py-2.5 disabled:opacity-60"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
