"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import Documentos from "@/components/empreendimento/Documentos";
import { Tabs } from "@/components/ui/Tabs";
import type { Documento, Empreendimento } from "@/types";

import { AbaFichaTecnica } from "./AbaFichaTecnica";
import { AbaFluxoComercial } from "./AbaFluxoComercial";
import { AbaPromocoes } from "./AbaPromocoes";
import { AbaTabela } from "./AbaTabela";
import { AbaVendasMensais } from "./AbaVendasMensais";

type Aba = "ficha" | "tabela" | "fluxo" | "vendas" | "promocoes" | "documentos";

const ABAS: { id: Aba; label: string }[] = [
  { id: "ficha", label: "Ficha Técnica" },
  { id: "tabela", label: "Tabela de Preços" },
  { id: "fluxo", label: "Fluxo Comercial" },
  { id: "vendas", label: "Histórico de Vendas" },
  { id: "promocoes", label: "Promoções" },
  { id: "documentos", label: "Documentos" },
];

interface Props {
  empreendimento: Empreendimento;
  documentos: Documento[];
  /** Lista global de empreendimentos — usada pelo modal de promoções
   * para permitir trocar de empreendimento ao editar. */
  empreendimentos?: Empreendimento[];
  abaInicial?: Aba;
}

export function EmpreendimentoDossie({
  empreendimento,
  documentos,
  empreendimentos = [],
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
      {aba === "promocoes" && (
        <AbaPromocoes
          empreendimento={empreendimento}
          empreendimentos={empreendimentos.length > 0 ? empreendimentos : [empreendimento]}
        />
      )}
      {aba === "documentos" && (
        <Documentos empreendimentoId={empreendimento.id} documentos={documentos} />
      )}
    </>
  );
}
