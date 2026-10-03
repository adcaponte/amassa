// Os cabeçalhos HTTP dos anexos de fornecedor (Fase 06.2, plano 05). PURO, sem import: a rota de
// leitura monta o `Content-Disposition` aqui, e a rota de envio confere a origem aqui.

// Abre na aba (o navegador desenha) só o que é seguro desenhar: PDF e a foto (JPEG regravado pelo
// servidor). Planilha e CSV sempre baixam (`attachment`) — um CSV pode ser HTML disfarçado (Pitfall 7).
export function ehAbertoNaAba(extensao: string): boolean {
  return extensao === "pdf" || extensao === "jpg";
}

// Caracteres de controle (C0, DEL e C1) — nunca entram num cabeçalho (injeção por CR/LF, T-06.2-22).
const CONTROLES = /[\u0000-\u001f\u007f-\u009f]/g;

// O nome em ASCII para o `filename="…"` (Pitfall 6): sem marcas ("preços" → "precos"), barras viram
// hífen, e saem aspas, `;`, `\`, controles e tudo o que não for ASCII imprimível. Vazio vira "anexo".
function nomeEmAscii(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(CONTROLES, "")
    .replace(/[/\\]/g, "-")
    .replace(/[";]/g, "")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return limpo === "" ? "anexo" : limpo;
}

// RFC 5987: `encodeURIComponent` deixa passar `'()*`, que o `ext-value` não aceita.
function codificarRfc5987(texto: string): string {
  return encodeURIComponent(texto).replace(
    /['()*]/g,
    (caractere) => `%${caractere.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

// `Content-Disposition` de um anexo (Pattern 4): `inline` ou `attachment`; `filename="…"` em ASCII
// seguro para navegador velho e `filename*=UTF-8''…` com o nome de verdade, acento incluído. O nome do
// arquivo é `{nome do anexo}.{extensão no disco}` — a extensão é sempre a que o servidor decidiu.
export function disposicao({
  nome,
  extensao,
  inline,
}: {
  nome: string;
  extensao: string;
  inline: boolean;
}): string {
  const semControle = nome.replace(CONTROLES, "").trim();
  const ascii = `${nomeEmAscii(semControle)}.${extensao}`;
  const utf8 = `${semControle === "" ? "anexo" : semControle}.${extensao}`;
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${codificarRfc5987(utf8)}`;
}

// Pitfall 8 (CSRF no PUT): uma Server Action confere a origem sozinha; um Route Handler não. Sem
// `Origin` (requisição que não veio de um navegador, ou navegador antigo) → aceita: o cookie de sessão é
// `SameSite=Lax` e um PUT de outra origem dispara preflight que ninguém responde. Com `Origin`, o host
// dele tem de ser o host que o proxy recebeu (`x-forwarded-host`, primeiro valor) ou, sem proxy, o
// `host` — a mesma regra que o Next usa para Server Actions. Nunca `request.nextUrl.origin`: atrás do
// Caddy ele pode ser `0.0.0.0:3000`. `Origin` que não é URL (inclusive o literal "null") → recusa.
export function mesmaOrigem({
  origin,
  host,
  forwardedHost,
}: {
  origin: string | null | undefined;
  host: string | null | undefined;
  forwardedHost: string | null | undefined;
}): boolean {
  if (origin === null || origin === undefined || origin === "") {
    return true;
  }
  let hostDaOrigem: string;
  try {
    hostDaOrigem = new URL(origin).host;
  } catch {
    return false;
  }
  const primeiroEncaminhado = forwardedHost?.split(",")[0]?.trim();
  const esperado = primeiroEncaminhado || host?.trim();
  if (!esperado) {
    return false;
  }
  return hostDaOrigem.toLowerCase() === esperado.toLowerCase();
}
