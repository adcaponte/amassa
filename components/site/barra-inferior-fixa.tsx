// Barra fixa no rodapé, só até `md` (< 768px) — os MESMOS dois botões, na MESMA ordem da barra
// superior (SIT-05). `env(safe-area-inset-bottom)` soma a faixa de gestos do iOS ao
// `padding-bottom`, o mesmo padrão de `app/globals.css` (`--deslocamento-aviso`).
export function BarraInferiorFixa() {
  return (
    <nav
      data-testid="site-barra-inferior"
      className="fixed inset-x-0 bottom-0 z-50 flex gap-2.5 border-t border-site-borda bg-site-papel px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] md:hidden"
    >
      <a
        data-testid="site-botao-agenda"
        href="#agenda"
        className="flex min-h-[50px] flex-1 items-center justify-center rounded-full border-[1.5px] border-site-barro text-[15px] font-semibold text-site-barro"
      >
        Agenda
      </a>
      <a
        data-testid="site-botao-encomendas"
        href="#encomendas"
        className="flex min-h-[50px] flex-1 items-center justify-center rounded-full bg-site-barro text-[15px] font-semibold text-white"
      >
        Encomendas
      </a>
    </nav>
  );
}
