// Módulo puro, sem nenhum import: a regra de "gravar ou avisar" das Anotações da casa (D-08/
// GES-10) — a mesma disciplina de `lib/orcamentos/situacao.ts`, regra de negócio testada sem
// React nem cliente de banco. Só `import type` é permitido aqui (critério de aceite da Tarefa 2,
// conferido por grep) — este módulo nunca lê o relógio por conta própria: todo instante chega
// SEMPRE por argumento, nunca lido de dentro daqui.
//
// Esta regra tem DOIS consumidores (key_link do plano, no molde de
// `lib/orcamentos/situacao.ts::situacaoDoOrcamento`): a ação (`lib/anotacoes/acoes.ts`) chama
// `decidirGravacao` para decidir se GRAVA ou AVISA antes de escrever no banco; o componente
// (`components/amassa/inicio/editor-de-anotacoes.tsx`) chama `textoDaAutoria` para decidir o que
// MOSTRAR. Uma função, duas leituras, nenhuma segunda regra.
//
// A comparação de `decidirGravacao` só é SEGURA dentro da transação que grava, depois de travar
// a linha única com `select ... for update` (feito em `lib/anotacoes/acoes.ts`). Comparada FORA
// de uma transação — por exemplo "ler agora, comparar depois, gravar por último" — a janela
// entre a leitura e a escrita é exatamente o defeito que D-08 pede para fechar: duas gravações
// concorrentes que leem o mesmo `atualizado_em` "velho" concluiriam as duas que podem gravar.

export const LIMITE_DE_CARACTERES = 10_000;

export type DecisaoDeGravacao = "gravar" | "avisar";

export type EntradaDeDecisao = {
  // O instante ISO que o cliente tinha na tela quando começou a editar — o `atualizadoEm` que
  // veio junto da última leitura, ou o que o próprio servidor devolveu na última gravação bem-
  // sucedida daquele cliente. `null` para quem abriu a tela e nunca viu nenhuma marca ainda (a
  // primeira leitura de uma sessão) — quem nunca viu nada não pode estar sobrescrevendo algo que
  // conheça, então o veredito é sempre "gravar".
  vistoEm: string | null;
  // O `atualizado_em` ATUAL da linha, lido DENTRO da transação, depois do `select ... for
  // update` — nunca um valor lido antes de travar a linha.
  atualizadoEmNoServidor: string;
};

// Compara INSTANTES (`Date.parse` dos dois lados, comparação numérica), nunca strings
// formatadas — duas representações do mesmo instante ("2026-12-18T14:20:00.000Z" e
// "2026-12-18T14:20:00+00:00") contam como iguais, porque `Date.parse` normaliza as duas para o
// mesmo número de milissegundos desde a época.
export function decidirGravacao({
  vistoEm,
  atualizadoEmNoServidor,
}: EntradaDeDecisao): DecisaoDeGravacao {
  if (vistoEm === null) {
    return "gravar";
  }
  const vistoEmMs = Date.parse(vistoEm);
  const atualizadoEmNoServidorMs = Date.parse(atualizadoEmNoServidor);
  return vistoEmMs === atualizadoEmNoServidorMs ? "gravar" : "avisar";
}

export type EntradaDeAutoria = {
  nome: string | null;
  atualizadoEm: string;
};

// "‹nome› salvou às ‹HH›h‹MM›" (D-08, a linha de autoria verbatim de 04.6-CONTEXT.md) — a hora
// entra pela formatação de Brasília do próprio módulo, só `Intl` nativo (mesma disciplina de
// `lib/inicio/saudacao.ts`); este módulo NÃO lê o relógio, o instante sempre chega por
// argumento. `nome` nulo (ninguém salvou ainda — o estado que a semente da migração 0022 cria)
// devolve `null`: a linha de autoria não aparece, em vez de mostrar uma autoria vazia (GES-10,
// aresta `empty`).
//
// Hora e minuto sempre com dois dígitos (`hour: "2-digit"`), no molde do relógio digital —
// "9h05" ficaria ambíguo lido rápido no ateliê ("9h" mais "05" de quê?), "09h05" não.
export function textoDaAutoria({ nome, atualizadoEm }: EntradaDeAutoria): string | null {
  if (nome === null) {
    return null;
  }
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(atualizadoEm));
  const hora = partes.find((parte) => parte.type === "hour")?.value ?? "00";
  const minuto = partes.find((parte) => parte.type === "minute")?.value ?? "00";
  return `${nome} salvou às ${hora}h${minuto}`;
}
