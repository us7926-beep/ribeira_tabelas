"use client";

import { Button } from "@/components/ui/Button";

/** Dispara o diálogo de impressão do navegador — o usuário escolhe "Salvar como PDF". */
export function BotaoExportarPdf() {
  return (
    <Button
      variante="secondary"
      onClick={() => window.print()}
      className="print-hide"
    >
      🖨 Exportar PDF
    </Button>
  );
}
