"use client";

import dynamic from "next/dynamic";

import type { Empreendimento, Incorporadora } from "@/types";

// Leaflet toca window ao carregar o módulo — precisa ficar client-only.
const MapaLeaflet = dynamic(
  () => import("./MapaLeaflet").then((m) => m.MapaLeaflet),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-[16px] border border-line bg-thead text-muted text-[13.5px] py-20 text-center">
        Carregando mapa…
      </div>
    ),
  },
);

interface Props {
  empreendimentos: Empreendimento[];
  incorporadoras: Incorporadora[];
}

export function MapaEmpreendimentos(props: Props) {
  return <MapaLeaflet {...props} />;
}
