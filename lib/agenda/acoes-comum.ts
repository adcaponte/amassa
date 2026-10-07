// Tipos e auxiliares PUROS das ações da Agenda (D-24/P10, plano 06.5-27 — saíram de `acoes.ts`).
// SEM diretiva e SEM import que alcance o banco: é o único arquivo sem "use server" cujos valores o
// índice `acoes.ts` poderia reexportar, porque o índice entra no pacote do cliente.

// Mesma forma de `lib/producao/acoes.ts` — cada módulo redeclara, não há tipo compartilhado.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

// O lançamento devolve o erro de CADA campo (embaixo do campo, foco no primeiro) — a folha mostra
// a frase onde ela pertence; `erro` é a primeira, para quem só quer uma.
export type ResultadoDoLancamento<T> =
  | { ok: true; dados: T }
  | { ok: false; erro: string; campos?: Record<string, string> };

export function errosPorCampo(problemas: readonly { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const problema of problemas) {
    const campo = String(problema.path[0] ?? "");
    if (campo !== "" && !(campo in campos)) {
      campos[campo] = problema.message;
    }
  }
  return campos;
}

export function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}
