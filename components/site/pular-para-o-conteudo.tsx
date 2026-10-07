// D-29 (Fase 06.5, 06.5-UI-SPEC.md §"Site público"): o primeiro elemento focável de `/` e de
// `/privacidade`. Quem navega pelo teclado (ou por leitor de tela) aperta Tab uma vez e pula a faixa
// "em construção" e a barra superior inteira, direto para o `<main id="conteudo">`.
//
// `sr-only` até receber foco. No foco, cada propriedade que o `sr-only` liga é desfeita por uma
// utilitária própria (`fixed`, `w-auto`, `h-auto`, `m-0`, `overflow-visible`, `clip-path: none`,
// `px-4`) em vez de `not-sr-only`: o `not-sr-only` também põe `position: static` e `padding: 0`, que
// disputariam com `fixed` e `px-4` na ordem do CSS gerado — aqui não há disputa nenhuma.
//
// `z-[60]`, não o `z-50` do contrato: a barra superior do site já é `fixed z-50` e vem DEPOIS deste
// link no documento — com o mesmo `z-index`, ela pintaria por cima dele. Um degrau acima garante o
// "acima da barra fixa" que o contrato pede (o e2e `polimento-site.spec.ts` confere com
// `elementFromPoint`).
export function PularParaOConteudo() {
  return (
    <a
      href="#conteudo"
      data-testid="site-pular"
      className="sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:m-0 focus:inline-flex focus:h-auto focus:min-h-11 focus:w-auto focus:items-center focus:overflow-visible focus:rounded-full focus:bg-site-papel focus:px-4 focus:text-[15px] focus:font-semibold focus:whitespace-nowrap focus:text-site-tinta focus:ring-2 focus:ring-site-barro focus:[clip-path:none]"
    >
      Pular para o conteúdo
    </a>
  );
}
