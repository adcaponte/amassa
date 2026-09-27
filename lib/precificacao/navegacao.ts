// As URLs da aba Peças, montadas num lugar só.
//
// Existe por causa do achado 8 da verificação humana (04.5-14): a exclusão de uma ficha
// EXCLUSIVA não funcionava porque QUATRO montagens de URL espalhadas pelos componentes
// escreviam "/financeiro?aba=pecas..." à mão e cada uma descartava o `?exclusivas=1` que
// mantém as peças exclusivas na lista. Sem esse parâmetro a lista volta a escondê-las, o
// diálogo de confirmação deixa de existir no DOM, e o botão "Apagar" não faz nada.
//
// Módulo puro: nenhum React, nenhum acesso ao banco, testado em
// `tests/unit/precificacao-navegacao.test.ts`.

export type DestinoDaAbaPecas = {
  // `?peca=` — abre a ficha (um id, ou "novo" para a ficha em branco).
  peca?: string | null;
  // `?apagarPeca=` — abre a confirmação de exclusão daquela ficha.
  apagarPeca?: string | null;
  // `?aviso=` — o aviso que a tela mostra ao chegar (ex.: "peca-salva").
  aviso?: string | null;
  // `?exclusivas=1` — a lista mostra também as peças exclusivas de pedido (D-19). Ausente
  // quando `false`: é o padrão da tela, e um `exclusivas=0` na URL só faria ruído.
  mostrarExclusivas?: boolean;
};

export function hrefDaAbaPecas(destino: DestinoDaAbaPecas = {}): string {
  // `URLSearchParams` escapa sozinho — nenhuma concatenação crua de id na query string.
  const parametros = new URLSearchParams({ aba: "pecas" });

  if (destino.peca) {
    parametros.set("peca", destino.peca);
  }
  if (destino.apagarPeca) {
    parametros.set("apagarPeca", destino.apagarPeca);
  }
  if (destino.mostrarExclusivas) {
    parametros.set("exclusivas", "1");
  }
  if (destino.aviso) {
    parametros.set("aviso", destino.aviso);
  }

  return `/financeiro?${parametros.toString()}`;
}
