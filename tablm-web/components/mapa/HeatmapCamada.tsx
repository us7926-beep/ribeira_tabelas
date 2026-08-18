"use client";

import L from "leaflet";
import "leaflet.heat";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

interface Ponto {
  lat: number;
  lng: number;
  /** Intensidade (0..1). Cálculo do "peso" fica com quem chama. */
  peso: number;
}

interface Props {
  pontos: Ponto[];
  /** Raio em pixels do "borrão" de cada ponto. Padrão 35. */
  raio?: number;
  /** Blur em pixels. Padrão 25. */
  blur?: number;
  /** Peso mínimo pra aparecer no mapa (evita ruído). Padrão 0.05. */
  minOpacidade?: number;
}

/**
 * Renderiza uma camada `L.heatLayer` acima do mapa. É desmontada
 * automaticamente quando o componente sai do DOM.
 *
 * A escala de cor padrão do leaflet.heat (azul → verde → amarelo → vermelho)
 * combina com o design system (royal → up → warn → down) sem custom gradient.
 */
export function HeatmapCamada({ pontos, raio = 35, blur = 25, minOpacidade = 0.05 }: Props) {
  const mapa = useMap();

  useEffect(() => {
    if (pontos.length === 0) return;
    // Tipagem oficial de leaflet.heat: [lat, lng, intensidade?]
    const dados = pontos.map<[number, number, number]>((p) => [p.lat, p.lng, p.peso]);
    const camada = L.heatLayer(dados, {
      radius: raio,
      blur,
      minOpacity: minOpacidade,
      // gradient padrão fica visualmente bom sobre OSM
    });
    camada.addTo(mapa);
    return () => {
      camada.remove();
    };
  }, [mapa, pontos, raio, blur, minOpacidade]);

  return null;
}
