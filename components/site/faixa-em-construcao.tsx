import { CONTEUDO_SITE } from "@/conteudo/site";

// A faixa "obra", primeiro elemento do CORPO da página (logo depois do padding-top que reserva
// espaço para a barra fixa) — sem botão de fechar: D-14 decide que ela fica até o site sair do
// "em construção" de verdade, nunca dispensável por clique. `--color-site-sol`/`--color-site-tinta`
// é o par de contraste AA que o briefing manda conferir.
export function FaixaEmConstrucao() {
  return (
    <div
      data-testid="site-faixa-obra"
      className="border-b border-site-borda bg-site-sol px-4 py-2.5 text-center text-[14.5px] text-site-tinta"
    >
      <strong className="font-titulo-site font-semibold">{CONTEUDO_SITE.obra.destaque}</strong>
      {CONTEUDO_SITE.obra.resto}
    </div>
  );
}
