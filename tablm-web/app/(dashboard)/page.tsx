export default function Overview() {
  const cards = [
    { titulo: "Incorporadoras", valor: "—" },
    { titulo: "Empreendimentos", valor: "—" },
    { titulo: "Eventos detectados", valor: "—" },
  ];
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-ink">Visão geral</h1>
      <p className="text-muted mt-1">
        Plataforma de inteligência competitiva da Ribeira — migração para Next.js em andamento.
      </p>
      <div className="grid gap-4 sm:grid-cols-3 mt-6">
        {cards.map((card) => (
          <div
            key={card.titulo}
            className="bg-white rounded-2xl border border-line border-l-4 border-l-royal p-5"
          >
            <div className="text-sm font-semibold text-muted">{card.titulo}</div>
            <div className="text-3xl font-extrabold text-ink mt-1">{card.valor}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
