"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { ComparativoEmpreendimentos } from "@/components/empreendimentos/ComparativoEmpreendimentos";
import { ComparativoUnidades } from "@/components/empreendimentos/ComparativoUnidades";
import { Tabs } from "@/components/ui/Tabs";
import type { Empreendimento, Incorporadora } from "@/types";

type Modo = "kpis" | "unidades";

const ABAS: { id: Modo; label: string }[] = [
  { id: "kpis", label: "KPIs" },
  { id: "unidades", label: "Unidade a unidade" },
];

interface Props {
  empreendimentos: Empreendimento[];
  mapIncorporadora: Map<string, Incorporadora>;
  modoInicial: Modo;
}

export function CompararApp({ empreendimentos, mapIncorporadora, modoInicial }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [modo, setModo] = useState<Modo>(modoInicial);

  const trocar = useCallback(
    (novo: Modo) => {
      setModo(novo);
      const params = new URLSearchParams(sp?.toString() ?? "");
      if (novo === "kpis") params.delete("modo");
      else params.set("modo", novo);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, sp],
  );

  return (
    <>
      <Tabs abas={ABAS} ativa={modo} onTrocar={trocar} className="mb-5" />
      {modo === "kpis" ? (
        <ComparativoEmpreendimentos
          empreendimentos={empreendimentos}
          mapIncorporadora={mapIncorporadora}
        />
      ) : (
        <ComparativoUnidades empreendimentos={empreendimentos} />
      )}
    </>
  );
}
