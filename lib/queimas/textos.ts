// As frases fixas da interface de Fornos e a função que traduz um tipo de queima em rótulo —
// só import de TIPO é permitido aqui (`import type`, nunca `import` de valor), no molde de
// `lib/encomendas/textos.ts`: o módulo não lê React nem o cliente do banco.
import type { tipoQueima } from "@/db/schema";

export type TipoDeQueima = (typeof tipoQueima.enumValues)[number];

// Estado vazio do índice (`/queimas`, D-01/D-02) — já vivia como placeholder na 2b
// (`app/(app)/queimas/page.tsx`); reaproveitado verbatim aqui, com `hrefBotao` ligado nesta fase.
export const FRASE_VAZIO_TITULO = "Nenhum forno cadastrado ainda.";
export const FRASE_VAZIO_CORPO =
  "Cadastre o primeiro forno para começar a contar as queimas em dois toques.";

export const ROTULO_NOVO_FORNO = "Novo forno";
export const ROTULO_QUEIMAR = "Queimar";

export const FRASE_FALHA_AO_SALVAR = "Não deu para salvar. Verifique a internet e tente de novo.";

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
