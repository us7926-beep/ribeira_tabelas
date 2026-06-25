"use client";

const campo =
  "flex items-center gap-2 bg-white border border-line rounded-[12px] px-[14px] py-[10px] text-[13px] cursor-pointer hover:border-royal hover:text-royal transition-colors";

interface Filtro {
  rotulo: string;
  valor: string;
  opcoes: string[];
  onTrocar: (v: string) => void;
}

interface Props {
  filtros: Filtro[];
  atualizado?: string;
}

/** Barra de Recorte: chips de filtros + texto de atualização da base. */
export function Recorte({ filtros, atualizado }: Props) {
  return (
    <div className="flex items-center flex-wrap gap-3 mb-5">
      <div className="text-[11px] font-bold tracking-[1.3px] uppercase text-muted mr-1">
        Recorte
      </div>
      {filtros.map((f) => (
        <label key={f.rotulo} className={campo}>
          <span className="text-[11px] font-bold tracking-[0.5px] uppercase text-muted">
            {f.rotulo}
          </span>
          <select
            value={f.valor}
            onChange={(e) => f.onTrocar(e.target.value)}
            className="bg-transparent outline-none font-semibold text-ink"
          >
            {f.opcoes.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </label>
      ))}
      {atualizado && (
        <div className="ml-auto text-[12px] text-faint">{atualizado}</div>
      )}
    </div>
  );
}
