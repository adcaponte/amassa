// Módulo puro, sem nenhum import — o que a lista de clientes precisa decidir sem banco: a busca e o
// "quantos" vindos da URL, o escape do `like` e a sub-linha de cada pessoa. É usado pelas DUAS telas
// do mesmo cadastro (D-01): Cadastros → Clientes e Agenda → Pessoas.

type ValorDaUrl = string | readonly string[] | null | undefined;

// UI-D23: 50 por vez; "Mostrar mais 50" soma 50. O teto de 500 é o máximo que uma página carrega de
// uma vez — `?quantos=` só aceita múltiplos de 50 entre 50 e 500, escritos só com dígitos.
export const QUANTOS_POR_VEZ = 50;
export const TETO_DE_QUANTOS = 500;

// O nome do cliente tem até 160 caracteres — buscar por mais que isso nunca acha nada.
const TETO_DA_BUSCA = 160;

export function quantosDaUrl(valor: ValorDaUrl): number {
  if (typeof valor !== "string" || !/^\d{1,5}$/.test(valor)) {
    return QUANTOS_POR_VEZ;
  }
  const numero = Number(valor);
  if (numero > TETO_DE_QUANTOS) {
    return TETO_DE_QUANTOS;
  }
  if (numero < QUANTOS_POR_VEZ || numero % QUANTOS_POR_VEZ !== 0) {
    return QUANTOS_POR_VEZ;
  }
  return numero;
}

// `?busca=` — o texto digitado, aparado e cortado no tamanho de um nome; lista repetida ou nada → "".
export function buscaDaUrl(valor: ValorDaUrl): string {
  if (typeof valor !== "string") {
    return "";
  }
  return [...valor.trim()].slice(0, TETO_DA_BUSCA).join("");
}

// O termo vai ao banco como PARÂMETRO de `like ... escape '\'` (T-05-19): os curingas que a pessoa
// digitou (`%`, `_`) e a própria barra de escape viram texto literal — "50%" acha "50%", não tudo.
export function escaparPadraoDeBusca(texto: string): string {
  return texto.replace(/[\\%_]/g, (caractere) => `\\${caractere}`);
}

export type TurmaDaSubLinha = { nome: string; dia: string };

// "{telefone} · {turma} ({dia abreviado}) · …" ou, sem turma, "… · sem turma fixa" (05-UI-SPEC.md
// §"Aba Pessoas", item 3). As turmas entram no plano 07; até lá a lista passa `turmas: []`.
export function subLinhaDaPessoa(pessoa: {
  telefone: string | null;
  turmas: readonly TurmaDaSubLinha[];
}): string {
  const partes: string[] = [];
  if (pessoa.telefone !== null) {
    partes.push(pessoa.telefone);
  }
  if (pessoa.turmas.length === 0) {
    partes.push("sem turma fixa");
  } else {
    for (const turma of pessoa.turmas) {
      partes.push(`${turma.nome} (${turma.dia})`);
    }
  }
  return partes.join(" · ");
}
