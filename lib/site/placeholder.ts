// A guarda anti-placeholder do site público (D-28, Fase 06.5). Até 06/10/2026 o site subia com
// colchete onde faltava dado real ("Rua [nome da rua]", "(62) 9 0000-0000"); a regra agora é campo
// vazio que não renderiza (D-32). Esta função é o que impede o colchete de voltar: a partir da
// inauguração, um texto com placeholder derruba o `verificar` (teste unitário sobre
// `conteudo/site.ts`) e a varredura e2e (texto renderizado de `/` e `/privacidade`).
//
// Antes de `DATA_DA_GUARDA` ela não acusa nada — os slots vazios já não renderizam, então nada falso
// vai ao ar antes disso, e o dono pode estar no meio de preencher o conteúdo. O "hoje" é sempre
// INJETADO (dia civil de Brasília, `AAAA-MM-DD`): o teste prova os dois lados da data sem esperar o
// calendário, e o módulo não lê relógio nenhum.
//
// Módulo puro, zero import — o mesmo padrão de `lib/site/whatsapp.ts`.
//
// O que conta como placeholder:
// - colchete COM conteúdo (`[nome da rua]`, `[00]`) — o desenho do protótipo para "falta dado";
// - um telefone com `0000-0000` — o número de mentira do protótipo.
// "Abrimos em dezembro." NÃO é placeholder: é verdade até a inauguração, e o dono a troca pelo
// horário real em dezembro (UI-SPEC, Site público).

export const DATA_DA_GUARDA = "2026-12-01";

const DIA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;
const COLCHETE_COM_CONTEUDO = /\[[^\]]+\]/;
const TELEFONE_DE_MENTIRA = "0000-0000";

export function placeholdersNoAr(textos: string[], hoje: string): string[] {
  // Um "hoje" mal formado não pode virar "antes da guarda" em silêncio (comparação de texto com
  // string vazia sempre dá "menor") — falha alto, para o teste que o chamou reprovar.
  if (!DIA_CIVIL.test(hoje)) {
    throw new Error(`placeholdersNoAr: "hoje" deve ser um dia civil AAAA-MM-DD, veio "${hoje}".`);
  }

  if (hoje < DATA_DA_GUARDA) return [];

  return textos.filter((texto) => COLCHETE_COM_CONTEUDO.test(texto) || texto.includes(TELEFONE_DE_MENTIRA));
}
