// Módulo puro: recebe o estado atual, o e-mail e o instante — nunca lê o relógio por dentro
// (é isso que torna as janelas de tempo testáveis sem esperar 15 minutos de verdade). Não
// importa React nem o cliente do banco (regra da pasta `lib/` em `01-ARQUITETURA.md` §3) e
// não tem nenhum import: nem sabe que o Postgres existe, e por isso não pode vazar quais
// e-mails têm conta ali.
//
// Cinco erros no mesmo e-mail em 15 minutos bloqueiam por 15 minutos (`01-ARQUITETURA.md`
// §4). O contador em memória que envolve este módulo mora em `tentativas-memoria.ts`.

export const LIMITE_DE_ERROS = 5;
export const JANELA_EM_MINUTOS = 15;
export const BLOQUEIO_EM_MINUTOS = 15;

const JANELA_MS = JANELA_EM_MINUTOS * 60_000;
const BLOQUEIO_MS = BLOQUEIO_EM_MINUTOS * 60_000;

/** Timestamps (ms, `Date.now()`) dos erros ainda potencialmente relevantes de um e-mail. */
export type RegistroDeErros = readonly number[];

/** Estado de todos os e-mails, indexado pelo e-mail já normalizado (minúsculas). */
export type EstadoTentativas = Readonly<Record<string, RegistroDeErros>>;

export type DecisaoPedido =
  | { liberado: true }
  | { liberado: false; segundosParaLiberar: number };

export const ESTADO_VAZIO: EstadoTentativas = {};

function normalizarEmail(email: string): string {
  return email.toLowerCase();
}

// A janela desliza a cada leitura: um erro que já passou de `JANELA_EM_MINUTOS` deixa de
// contar, não importa quantos outros erros vieram depois dele. Não é um balde que só esvazia
// no fim.
function errosRelevantes(registro: RegistroDeErros | undefined, agora: number): RegistroDeErros {
  if (!registro) return [];
  return registro.filter((instante) => agora - instante < JANELA_MS);
}

/**
 * Decide se um pedido de login para `email` pode prosseguir. Não altera o estado — quem
 * altera é `registrarErro`/`registrarAcerto`, chamadas depois que o resultado da tentativa é
 * conhecido.
 */
export function avaliarPedido(estado: EstadoTentativas, email: string, agora: number): DecisaoPedido {
  const chave = normalizarEmail(email);
  const relevantes = errosRelevantes(estado[chave], agora);

  if (relevantes.length < LIMITE_DE_ERROS) {
    return { liberado: true };
  }

  // O quinto erro (o mais recente dos relevantes) é o que fecha o bloqueio; ele dura
  // `BLOQUEIO_EM_MINUTOS` a partir dali, não a partir de agora.
  const ultimoErro = relevantes[relevantes.length - 1];
  const liberaEm = ultimoErro + BLOQUEIO_MS;

  if (agora >= liberaEm) {
    return { liberado: true };
  }

  return { liberado: false, segundosParaLiberar: Math.ceil((liberaEm - agora) / 1000) };
}

/**
 * Registra um erro de senha para `email` em `agora` e devolve o novo estado (o recebido não é
 * mutado). Erros fora da janela são descartados aqui — é assim que o bloqueio expira sozinho:
 * quando o próximo evento tocar este e-mail, os erros vencidos já não contam mais.
 */
export function registrarErro(estado: EstadoTentativas, email: string, agora: number): EstadoTentativas {
  const chave = normalizarEmail(email);
  const relevantes = errosRelevantes(estado[chave], agora);

  return { ...estado, [chave]: [...relevantes, agora] };
}

/** Um acerto zera o contador daquele e-mail imediatamente. */
export function registrarAcerto(estado: EstadoTentativas, email: string): EstadoTentativas {
  const chave = normalizarEmail(email);
  if (!(chave in estado)) return estado;

  const novoEstado = { ...estado };
  delete novoEstado[chave];
  return novoEstado;
}
