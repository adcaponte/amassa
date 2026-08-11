// As frases fixas da interface de Fornos e as funções que traduzem tipo/nível em rótulo — só
// import de TIPO é permitido aqui (`import type`, nunca `import` de valor), no molde de
// `lib/encomendas/textos.ts`: o módulo não lê React nem o cliente do banco, e não importa
// nenhuma função de `lib/queimas/formato.ts` (a formatação de data usada em `fraseDoRodape`
// chega já pronta de quem chama — mesma disciplina de `gantt.ts`/`textos.ts` de Encomendas, que
// duplicam a aritmética de calendário em vez de importar `formato.ts`).
import type { tipoQueima } from "@/db/schema";
import type { NivelDeForno } from "@/lib/queimas/contador";

export type TipoDeQueima = (typeof tipoQueima.enumValues)[number];

// Estado vazio do índice (`/queimas`, D-01/D-02) — já vivia como placeholder na 2b
// (`app/(app)/queimas/page.tsx`); reaproveitado verbatim aqui, com `hrefBotao` ligado nesta fase.
export const FRASE_VAZIO_TITULO = "Nenhum forno cadastrado ainda.";
export const FRASE_VAZIO_CORPO =
  "Cadastre o primeiro forno para começar a contar as queimas em dois toques.";

export const ROTULO_NOVO_FORNO = "Novo forno";
export const ROTULO_QUEIMAR = "Queimar";

export const FRASE_FALHA_AO_SALVAR = "Não deu para salvar. Verifique a internet e tente de novo.";

// Estado de erro do índice (`/queimas`, E1/error) — mesmo par de `app/(app)/encomendas/error.tsx`.
export const FRASE_ERRO_TITULO = "Algo não funcionou.";
export const FRASE_ERRO_CORPO =
  "Não deu para carregar os fornos. Verifique a internet e tente de novo.";

// Estado de erro do detalhe do forno (`/queimas/[id]`, E6/error, plano 04-03) — mesmo título
// `FRASE_ERRO_TITULO` acima (reuso literal, projeto inteiro), corpo próprio desta tela.
export const FRASE_ERRO_CORPO_FORNO =
  "Não deu para carregar este forno. Verifique a internet e tente de novo.";

// Cabeçalhos das duas seções de histórico da página do forno (E6, plano 04-03) — manutenções
// primeiro (é o histórico de vida útil, o propósito do módulo), queimas depois.
export const ROTULO_HISTORICO_MANUTENCOES = "Manutenções";
export const ROTULO_HISTORICO_QUEIMAS = "Queimas";

// Fluxo de dois toques (D-04, Tarefa 3 do plano 04-01) — o toast de 7 segundos e as duas frases
// de falha que ele pode mostrar.
export const TOAST_QUEIMA_REGISTRADA = "Queima registrada.";
export const ROTULO_DESFAZER = "Desfazer";
export const TOAST_QUEIMA_DESFEITA = "Queima desfeita.";
export const FRASE_FALHA_AO_REGISTRAR_QUEIMA =
  "Não deu para registrar a queima. Verifique a internet e tente de novo.";
export const FRASE_FALHA_AO_DESFAZER = "Não deu para desfazer. Verifique a internet e tente de novo.";

// `switch` exaustivo sobre os três valores de `tipo_queima` — o `_exaustivo: never` no `default`
// é o que faz o compilador reclamar se um quarto tipo aparecer sem tratamento, no molde de
// `textoDaSituacao` (`lib/encomendas/textos.ts`).
export function rotuloDoTipo(tipo: TipoDeQueima): string {
  switch (tipo) {
    case "biscoito":
      return "Biscoito";
    case "esmalte":
      return "Esmalte";
    case "ouro":
      return "Ouro";
    default: {
      const _exaustivo: never = tipo;
      throw new Error(`rotuloDoTipo: tipo de queima não tratado: ${JSON.stringify(_exaustivo)}`);
    }
  }
}

// O medidor (`components/amassa/queimas/medidor.tsx`, FOR-05) — rótulos fixos sob a barra,
// literais de `04-DESIGN-SYSTEM.md` §8: "0 / atenção N / limite N".
export const ROTULO_MEDIDOR_ATENCAO = "atenção";
export const ROTULO_MEDIDOR_LIMITE = "limite";

// Selo textual por nível (FOR-04): "null" para "ok" — nenhum selo aparece nesse caso, decisão do
// próprio `cartao-forno.tsx`, não uma frase vazia sendo renderizada. `switch` exaustivo com o
// mesmo `_exaustivo: never` de `rotuloDoTipo`/`textoDaSituacao` — um quarto nível futuro quebra a
// compilação em vez de cair em silêncio. A copy nomeia o FATO e o que fazer, nunca quem deixou o
// forno passar do limite (prohibition deste plano).
export function textoDoNivel(nivel: NivelDeForno): string | null {
  switch (nivel) {
    case "ok":
      return null;
    case "atencao":
      return "Manutenção próxima";
    case "critico":
      return "Manutenção vencida";
    default: {
      const _exaustivo: never = nivel;
      throw new Error(`textoDoNivel: nível de forno não tratado: ${JSON.stringify(_exaustivo)}`);
    }
  }
}

// Rodapé do cartão (FOR-08, `04-DESIGN-SYSTEM.md` §8) — literal, não reescrever. `data` chega
// JÁ FORMATADA por quem chama (`formatarInstanteCurto`, `lib/queimas/formato.ts`): este módulo
// não importa valor nenhum de `formato.ts` (ver cabeçalho do arquivo), então a montagem da frase
// nunca formata data por conta própria.
export const FRASE_SEM_MANUTENCAO = "Sem manutenção registrada";

export function fraseDoRodape({
  data,
  responsavel,
  total,
}: {
  data: string | null;
  responsavel: string | null;
  total: number;
}): string {
  const totalTexto = `${total} no total`;

  if (data === null) {
    return `${FRASE_SEM_MANUTENCAO} · ${totalTexto}`;
  }

  const base = responsavel
    ? `Última manutenção em ${data} · ${responsavel}`
    : `Última manutenção em ${data}`;

  return `${base} · ${totalTexto}`;
}
