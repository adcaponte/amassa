// Módulo puro, sem nenhum import: o detector compartilhado de SQLSTATE, ao lado de
// `lib/erro/textos.ts` e `lib/acessibilidade/rotulos.ts`.
//
// `drizzle-orm/node-postgres` embrulha todo erro de query num `DrizzleQueryError`, cujo `.code`
// vale `undefined` — o SQLSTATE real do `pg` mora em `erro.cause.code`. Abertura, Cotações e
// Queimas tinham cada um a sua cópia de um detector de uma linha só que olhava apenas a raiz do
// erro, nunca a causa: por isso NUNCA casavam, e as três telas mostravam a frase genérica de
// falha no lugar da mensagem humana (achado do plano 04.4-02, o mesmo defeito já corrigido em
// `lib/cadastros/acoes.ts`). Esta função olha os dois lugares — funciona tanto se um dia o
// driver parar de embrulhar quanto hoje, que embrulha.
export function codigoDoErroPostgres(erro: unknown): string | undefined {
  if (typeof erro !== "object" || erro === null) {
    return undefined;
  }
  if ("code" in erro && typeof erro.code === "string") {
    return erro.code;
  }
  if ("cause" in erro && typeof erro.cause === "object" && erro.cause !== null && "code" in erro.cause) {
    const codigoDaCausa = (erro.cause as { code?: unknown }).code;
    return typeof codigoDaCausa === "string" ? codigoDaCausa : undefined;
  }
  return undefined;
}

// SQLSTATE 23503 = foreign_key_violation — a linha referenciada deixou de existir entre a
// montagem do formulário e o envio; quem chama isto traduz para a frase humana certa, nunca o
// erro cru do banco.
export function ehViolacaoDeChaveEstrangeira(erro: unknown): boolean {
  return codigoDoErroPostgres(erro) === "23503";
}
