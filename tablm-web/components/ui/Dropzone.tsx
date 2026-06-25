"use client";

import { useRef, useState } from "react";

interface Props {
  aceitar?: string;
  multiplos?: boolean;
  arquivo?: File | null;
  onArquivo: (arq: File | null) => void;
  titulo?: string;
  dica?: string;
}

/**
 * Dropzone elegante (tracejado, ícone +). Aceita clique e drag-and-drop.
 */
export function Dropzone({
  aceitar = ".pdf,.png,.jpg,.jpeg,.xlsx,.csv",
  multiplos = false,
  arquivo,
  onArquivo,
  titulo = "Arraste o arquivo aqui",
  dica = "PDF, imagem, Excel ou CSV · até 50 MB",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);

  function lidarDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    const arq = e.dataTransfer.files?.[0];
    if (arq) onArquivo(arq);
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={lidarDrop}
      className={`border-[1.6px] border-dashed rounded-[14px] p-[38px_20px] text-center cursor-pointer transition ${
        arrastando
          ? "border-royal bg-[#F1F5FE]"
          : "border-[#C6D2EC] bg-[#F7F9FE] hover:border-royal hover:bg-[#F1F5FE]"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={aceitar}
        multiple={multiplos}
        className="hidden"
        onChange={(e) => onArquivo(e.target.files?.[0] ?? null)}
      />
      <div className="w-[46px] h-[46px] rounded-[13px] bg-royal-tint text-royal grid place-items-center text-[22px] font-extrabold mx-auto mb-3">
        +
      </div>
      <div className="text-[14.5px] font-semibold text-body">
        {arquivo ? arquivo.name : titulo}
      </div>
      <div className="text-[12.5px] text-faint mt-1">
        {arquivo ? "Clique para trocar o arquivo" : dica}
      </div>
    </div>
  );
}
