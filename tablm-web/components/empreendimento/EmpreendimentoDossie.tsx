"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import Documentos from "@/components/empreendimento/Documentos";
import { Tabs } from "@/components/ui/Tabs";
import type { Documento, Empreendimento } from "@/types";

import { AbaFichaTecnica } from "./AbaFichaTecnica";
import { AbaFluxoComercial } from "./AbaFluxoComercial";
import { AbaTabela } from "./AbaTabela";
import { AbaVendasMensais } from "./AbaVendasMensais";

type Aba = "ficha" | "tabela" | "fluxo" | "vendas" | "documentos";

const ABAS: { id: Aba; label: string }[] = [
  { id: "ficha", label: "Ficha Técnica" },
  { id: "tabela", label: "Tabela de Preços" },
  { id: "fluxo", label: "Fluxo Comercial" },
  { id: "vendas", label: "Histórico de Vendas" },
  { id: "documentos", label: "Documentos" },
];

interface Props {
  empreendimento: Empreendimento;
  documentos: Documento[];
  abaInicial?: Aba;
}

export function EmpreendimentoDossie({
  empreendimento,
  documentos,
  abaInicial = "ficha",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [aba, setAba] = useState<Aba>(abaInicial);

  const trocarAba = useCallback(
    (nova: Aba) => {
      setAba(nova);
      const params = new URLSearchParams(sp?.toString() ?? "");
      if (nova === "ficha") params.delete("aba");
      else params.set("aba", nova);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, sp],
  );

  return (
    <>
      <Tabs abas={ABAS} ativa={aba} onTrocar={trocarAba} className="mb-5" />

      {aba === "ficha" && <AbaFichaTecnica empreendimento={empreendimento} />}
      {aba === "tabela" && <AbaTabela empreendimentoId={empreendimento.id} />}
      {aba === "fluxo" && <AbaFluxoComercial empreendimentoId={empreendimento.id} />}
      {aba === "vendas" && (
        <AbaVendasMensais
          empreendimentoId={empreendimento.id}
          totalUnidades={empreendimento.total_unidades_calc ?? empreendimento.total_unidades}
        />
      )}
      {aba === "documentos" && (
        <Documentos empreendimentoId={empreendimento.id} documentos={documentos} />
      )}
    </>
  );
}
