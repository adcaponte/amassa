// Módulo puro: nenhum import — recebe o registro de usuário encontrado (ou nada), a senha
// digitada e a própria função de conferência de hash como argumento, em vez de importar
// `@node-rs/argon2` ou `@/db`. Devolve o usuário autenticado ou uma recusa.
//
// A mensagem é única de propósito: apontar qual dos dois motivos causou a recusa transformaria
// a tela de login num verificador de quem tem conta no ateliê (`01-ARQUITETURA.md` §4, T-02a-13).
export const MENSAGEM_CREDENCIAIS_INVALIDAS = "Confira o e-mail e a senha e tente de novo.";

export type UsuarioParaCredencial = {
  senhaHash: string;
  ativo: boolean;
};

export type ConferirHash = (hashArmazenado: string, senha: string) => Promise<boolean>;

export type ResultadoCredenciais<T extends UsuarioParaCredencial = UsuarioParaCredencial> =
  | { autenticado: true; usuario: T }
  | { autenticado: false; mensagem: string };

// Congelado (Object.freeze) porque esta é a mesma referência devolvida em TODO caminho de
// recusa (senha errada, e-mail desconhecido, usuário desativado, hash corrompido) — sem o
// freeze, nada impede um chamador futuro de fazer `resultado.mensagem = algumaCoisa` e
// corromper silenciosamente a mensagem de recusa para todas as requisições concorrentes no
// mesmo processo, até o processo reiniciar.
const RECUSA: Readonly<{ autenticado: false; mensagem: string }> = Object.freeze({
  autenticado: false,
  mensagem: MENSAGEM_CREDENCIAIS_INVALIDAS,
});

/**
 * Avalia credenciais em tempo constante: a conferência de hash roda em TODOS os caminhos —
 * inclusive sem usuário (contra `hashDeReferencia`) e com usuário desativado — para que o
 * tempo de resposta não denuncie quais e-mails existem nem quais estão ativos (T-02a-14).
 * `hashDeReferencia` deve ser gerado uma única vez, na inicialização do processo, a partir de
 * um valor aleatório descartado em seguida — nunca uma constante escrita no arquivo.
 */
export async function avaliarCredenciais<T extends UsuarioParaCredencial>(
  usuarioEncontrado: T | undefined,
  senhaDigitada: string,
  conferirHash: ConferirHash,
  hashDeReferencia: string,
): Promise<ResultadoCredenciais<T>> {
  const hashParaConferir = usuarioEncontrado ? usuarioEncontrado.senhaHash : hashDeReferencia;

  let senhaConfere: boolean;
  try {
    senhaConfere = await conferirHash(hashParaConferir, senhaDigitada);
  } catch {
    // Hash corrompido no banco não pode vazar o erro interno para a tela.
    return RECUSA;
  }

  if (usuarioEncontrado && usuarioEncontrado.ativo && senhaConfere) {
    return { autenticado: true, usuario: usuarioEncontrado };
  }

  return RECUSA;
}
