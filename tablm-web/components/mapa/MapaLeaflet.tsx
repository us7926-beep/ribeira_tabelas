"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import type { Empreendimento, Incorporadora } from "@/types";

// Corrige o ícone padrão do Leaflet (Next não serve os PNGs por padrão).
// Usa data-URI de SVG minimalista com as cores do design system.
function iconePin(cor: string): L.DivIcon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" width="32" height="40">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 11 16 24 16 24s16-13 16-24C32 7.163 24.837 0 16 0z" fill="${cor}"/>
      <circle cx="16" cy="16" r="6" fill="white"/>
    </svg>`;
  return L.divIcon({
    className: "",
    html: svg,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -36],
  });
}

const PIN_RIBEIRA = iconePin("#2347C5"); // royal
const PIN_CONCORRENTE = iconePin("#6B7689"); // muted

interface ItemPin {
  empreendimento: Empreendimento;
  incorporadora?: Incorporadora;
  lat: number;
  lng: number;
  ehRibeira: boolean;
}

interface EstadoGeocode {
  carregando: boolean;
  encontrados: number;
  falhas: number;
}

interface Props {
  empreendimentos: Empreendimento[];
  incorporadoras: Incorporadora[];
}

function ehRibeiraNome(nome: string | undefined): boolean {
  return (nome ?? "").toLowerCase().includes("ribeira");
}

async function geocode(bairro: string, cidade: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({ bairro, cidade });
  try {
    const r = await fetch(`/api/geocode?${params.toString()}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (typeof d?.lat === "number" && typeof d?.lng === "number") {
      return { lat: d.lat, lng: d.lng };
    }
    return null;
  } catch {
    return null;
  }
}

function AjustarBounds({ pins }: { pins: ItemPin[] }) {
  const mapa = useMap();
  useEffect(() => {
    if (pins.length === 0) return;
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
    mapa.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [mapa, pins]);
  return null;
}

const PADROES_UI = ["Alto", "Médio", "Econômico", "Luxo"] as const;

export function MapaLeaflet({ empreendimentos, incorporadoras }: Props) {
  const mapaInc = useMemo(
    () => new Map(incorporadoras.map((i) => [i.id, i])),
    [incorporadoras],
  );

  const [pins, setPins] = useState<ItemPin[]>([]);
  const [estado, setEstado] = useState<EstadoGeocode>({
    carregando: true,
    encontrados: 0,
    falhas: 0,
  });
  const [filtroPadrao, setFiltroPadrao] = useState<string>("");
  const [filtroRibeira, setFiltroRibeira] = useState<"todos" | "ribeira" | "concorrente">(
    "todos",
  );
  const abortadorRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancela geocodes de renders anteriores.
    abortadorRef.current?.abort();
    const controller = new AbortController();
    abortadorRef.current = controller;

    let cancelado = false;
    setPins([]);
    setEstado({ carregando: true, encontrados: 0, falhas: 0 });

    (async () => {
      let encontrados = 0;
      let falhas = 0;
      const proximos: ItemPin[] = [];
      // Em série — respeita o rate limit do Nominatim mesmo se o backend cair
      // no primeiro request (cache também ajuda).
      for (const emp of empreendimentos) {
        if (controller.signal.aborted || cancelado) return;
        const coords = await geocode(emp.bairro ?? "", emp.cidade ?? "");
        if (controller.signal.aborted || cancelado) return;
        if (coords) {
          const inc = mapaInc.get(emp.incorporadora_id);
          proximos.push({
            empreendimento: emp,
            incorporadora: inc,
            lat: coords.lat,
            lng: coords.lng,
            ehRibeira: ehRibeiraNome(inc?.nome),
          });
          encontrados += 1;
          setPins([...proximos]);
        } else {
          falhas += 1;
        }
        setEstado({ carregando: true, encontrados, falhas });
      }
      if (!cancelado) {
        setEstado({ carregando: false, encontrados, falhas });
      }
    })();

    return () => {
      cancelado = true;
      controller.abort();
    };
  }, [empreendimentos, mapaInc]);

  const pinsFiltrados = useMemo(() => {
    return pins.filter((p) => {
      if (filtroPadrao && (p.empreendimento.padrao ?? "") !== filtroPadrao) return false;
      if (filtroRibeira === "ribeira" && !p.ehRibeira) return false;
      if (filtroRibeira === "concorrente" && p.ehRibeira) return false;
      return true;
    });
  }, [pins, filtroPadrao, filtroRibeira]);

  const centroInicial: [number, number] = pins[0]
    ? [pins[0].lat, pins[0].lng]
    : [-23.5, -46.2]; // centro aproximado de SP

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap text-[13px]">
        <label className="flex items-center gap-2">
          <span className="text-muted">Padrão:</span>
          <select
            value={filtroPadrao}
            onChange={(e) => setFiltroPadrao(e.target.value)}
            className="px-2.5 py-1.5 rounded-[10px] border border-line bg-white text-[13px]"
          >
            <option value="">Todos</option>
            {PADROES_UI.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Tipo:</span>
          <select
            value={filtroRibeira}
            onChange={(e) =>
              setFiltroRibeira(e.target.value as "todos" | "ribeira" | "concorrente")
            }
            className="px-2.5 py-1.5 rounded-[10px] border border-line bg-white text-[13px]"
          >
            <option value="todos">Todos</option>
            <option value="ribeira">Ribeira</option>
            <option value="concorrente">Concorrente</option>
          </select>
        </label>
        <div className="text-muted ml-auto">
          {estado.carregando
            ? `Geolocalizando… ${estado.encontrados} de ${empreendimentos.length}`
            : `${pinsFiltrados.length} pins${
                estado.falhas > 0 ? ` · ${estado.falhas} sem endereço resolvido` : ""
              }`}
        </div>
      </div>
      <div
        className="rounded-[16px] overflow-hidden border border-line"
        style={{ height: "calc(100vh - 260px)", minHeight: 480 }}
      >
        <MapContainer
          center={centroInicial}
          zoom={12}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <AjustarBounds pins={pinsFiltrados} />
          {pinsFiltrados.map((p) => (
            <Marker
              key={p.empreendimento.id}
              position={[p.lat, p.lng]}
              icon={p.ehRibeira ? PIN_RIBEIRA : PIN_CONCORRENTE}
            >
              <Popup>
                <div className="text-[13px] font-semibold text-ink">
                  {p.empreendimento.nome}
                </div>
                <div className="text-[11.5px] text-muted mt-0.5">
                  {[p.empreendimento.bairro, p.empreendimento.cidade, p.empreendimento.padrao]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {p.incorporadora && (
                  <div className="text-[11.5px] text-muted mt-0.5">
                    {p.incorporadora.nome}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-2 text-[11.5px]">
                  {typeof p.empreendimento.preco_m2_medio === "number" && (
                    <>
                      <span className="text-muted">Preço/m²</span>
                      <span className="text-right font-semibold text-ink">
                        R$ {Math.round(p.empreendimento.preco_m2_medio).toLocaleString("pt-BR")}
                      </span>
                    </>
                  )}
                  {typeof p.empreendimento.ticket_medio === "number" && (
                    <>
                      <span className="text-muted">Ticket</span>
                      <span className="text-right font-semibold text-ink">
                        R$ {Math.round(p.empreendimento.ticket_medio).toLocaleString("pt-BR")}
                      </span>
                    </>
                  )}
                  {typeof p.empreendimento.vso === "number" && (
                    <>
                      <span className="text-muted">VSO</span>
                      <span className="text-right font-semibold text-ink">
                        {Math.round(p.empreendimento.vso)}%
                      </span>
                    </>
                  )}
                </div>
                <Link
                  href={`/empreendimentos/${p.empreendimento.id}`}
                  className="block mt-2 text-[12px] font-bold text-royal hover:underline"
                >
                  Abrir dossiê →
                </Link>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
