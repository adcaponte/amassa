// As regras do ARQUIVO de um anexo de fornecedor (Fase 06.2, plano 05): os limites, a família pela
// extensão do nome (só para a conveniência do cliente), a classificação pela ASSINATURA (a regra do
// servidor), o texto do tamanho e o preenchimento automático da folha.
//
// PURO e leve, de propósito (key link do plano 05): nenhum import de `sharp`, `file-type`, React, Next
// ou do banco. A folha "Novo anexo" (componente cliente, plano 06) importa daqui as MESMAS constantes
// de limite que o servidor usa — e um `sharp` ou um `file-type` puxado para o pacote do navegador o
// quebraria. Quem chama o `file-type` é a rota (`app/gestao/api/fornecedores/anexos/route.ts`), que
// passa o resultado para `classificarArquivo`; o `sharp` mora em `lib/fornecedores/foto.ts` (plano 07).

// "20 MB" e "10 MB" na mesma conta do protótipo (`lim*1048576`, suposição A7 da pesquisa): MiB. Uma
// constante única evita que cliente e servidor discordem na fronteira.
export const LIMITE_DOCUMENTO_BYTES = 20 * 1024 * 1024;
export const LIMITE_FOTO_BYTES = 10 * 1024 * 1024;

// D-A03: a foto do anexo sai com o lado maior de 2000 px (o briefing), constante PRÓPRIA — os
// orçamentos continuam com 1600 (`lib/orcamentos/fotos.ts`). Quem a usa é `foto.ts`, no plano 07.
export const LADO_MAXIMO_PX = 2000;

export type FamiliaDoArquivo = "documento" | "foto" | "planilha";

// O que o servidor guarda: a família, a extensão do arquivo no disco e o tipo MIME que a rota de
// leitura vai servir. Foto sempre vira JPEG (o `sharp` regrava — plano 07).
export type ArquivoAceito =
  | { familia: "documento"; extensao: "pdf"; mime: "application/pdf" }
  | { familia: "foto"; extensao: "jpg"; mime: "image/jpeg" }
  | { familia: "planilha"; extensao: "xlsx" | "xls" | "csv"; mime: string };

// O que o `file-type` devolve (ou `undefined` quando não reconhece assinatura nenhuma).
export type TipoDetectado = { ext: string; mime: string } | undefined;

export type ResultadoDaClassificacao = { ok: true; tipo: ArquivoAceito } | { ok: false; motivo: "tipo" };

// As extensões que o cliente aceita no NOME do arquivo (a lista do protótipo, com WebP e XLS do
// briefing §3). É conveniência: o servidor decide pela assinatura.
export const EXTENSOES_ACEITAS_NO_NOME = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "xlsx",
  "xls",
  "csv",
] as const;

const FAMILIA_DA_EXTENSAO: Readonly<Record<(typeof EXTENSOES_ACEITAS_NO_NOME)[number], FamiliaDoArquivo>> = {
  pdf: "documento",
  jpg: "foto",
  jpeg: "foto",
  png: "foto",
  webp: "foto",
  heic: "foto",
  xlsx: "planilha",
  xls: "planilha",
  csv: "planilha",
};

// A extensão do nome do arquivo, em minúsculas, sem o ponto — "" se não houver (sem ponto, ou o ponto
// é o primeiro caractere, como em ".bashrc").
export function extensaoDoNome(nomeDoArquivo: string): string {
  const ponto = nomeDoArquivo.lastIndexOf(".");
  if (ponto <= 0 || ponto === nomeDoArquivo.length - 1) {
    return "";
  }
  return nomeDoArquivo.slice(ponto + 1).toLowerCase();
}

// A família que o NOME promete — `null` para o que não entra (`xlsm`, `zip`, `svg`…). Sem caixa:
// "JPEG" é foto.
export function familiaPelaExtensao(extensao: string): FamiliaDoArquivo | null {
  const chave = extensao.toLowerCase() as keyof typeof FAMILIA_DA_EXTENSAO;
  return Object.hasOwn(FAMILIA_DA_EXTENSAO, chave) ? FAMILIA_DA_EXTENSAO[chave] : null;
}

// Pitfall 7 / A-04: "parece texto" = nenhum byte nulo e quase nenhum byte de controle (no máximo 1% da
// amostra, fora de tab, LF e CR). "Decodifica como Latin-1" é verdade para QUALQUER byte — o que separa
// binário de texto é o NUL. Amostra vazia não é texto (arquivo vazio é recusado antes, na rota).
export function pareceTexto(amostra: Uint8Array): boolean {
  if (amostra.length === 0) {
    return false;
  }
  let controles = 0;
  for (const byte of amostra) {
    if (byte === 0x00) {
      return false;
    }
    const ehControle = (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) || byte === 0x7f;
    if (ehControle) {
      controles += 1;
    }
  }
  return controles * 100 <= amostra.length;
}

// Um CSV que, depois do BOM e de espaços, começa com `<` é HTML/SVG/XML disfarçado (Pitfall 7, T-06.2-18)
// — recusado, mesmo que o servidor sempre o sirva como `attachment` com `nosniff`.
function comecaComMarcacao(amostra: Uint8Array): boolean {
  let i = 0;
  if (amostra[0] === 0xef && amostra[1] === 0xbb && amostra[2] === 0xbf) {
    i = 3;
  }
  while (i < amostra.length && (amostra[i] === 0x20 || amostra[i] === 0x09 || amostra[i] === 0x0a || amostra[i] === 0x0d)) {
    i += 1;
  }
  return amostra[i] === 0x3c; // "<"
}

const FAMILIA_FOTO_DETECTADA = new Set(["jpg", "png", "webp", "heic"]);

// A regra do servidor: "assinatura, não extensão" (D-A04, Achado 4 da pesquisa). Recebe o que o
// `file-type` achou NO CONTEÚDO, a extensão do nome original (só desempata o OLE e libera o CSV) e uma
// amostra dos primeiros bytes (só para a regra do CSV). Na recusa devolve o motivo, sem montar frase —
// a rota escolhe a frase.
//
// - `pdf` → documento.
// - `xlsx` → planilha (o `file-type` já confere o `[Content_Types].xml`; um zip qualquer sai `zip`).
// - `cfb` (OLE) SÓ com nome `.xls` → planilha `application/vnd.ms-excel` (um `.doc` também é OLE).
// - `jpg`/`png`/`webp`/`heic` → foto (vira JPEG no plano 07).
// - sem assinatura + nome `.csv` + amostra de texto que não começa com `<` → planilha `text/csv`.
// - qualquer outra coisa (`zip`, `xlsm`, SVG, HTML, `cfb` sem `.xls`) → recusa.
export function classificarArquivo({
  detectado,
  extensaoDoNome,
  amostra,
}: {
  detectado: TipoDetectado;
  extensaoDoNome: string;
  amostra: Uint8Array;
}): ResultadoDaClassificacao {
  const extensao = extensaoDoNome.toLowerCase();

  if (detectado) {
    if (detectado.ext === "pdf") {
      return { ok: true, tipo: { familia: "documento", extensao: "pdf", mime: "application/pdf" } };
    }
    if (detectado.ext === "xlsx") {
      return {
        ok: true,
        tipo: {
          familia: "planilha",
          extensao: "xlsx",
          mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      };
    }
    if (detectado.ext === "cfb" && extensao === "xls") {
      return { ok: true, tipo: { familia: "planilha", extensao: "xls", mime: "application/vnd.ms-excel" } };
    }
    if (FAMILIA_FOTO_DETECTADA.has(detectado.ext)) {
      return { ok: true, tipo: { familia: "foto", extensao: "jpg", mime: "image/jpeg" } };
    }
    return { ok: false, motivo: "tipo" };
  }

  if (extensao === "csv" && pareceTexto(amostra) && !comecaComMarcacao(amostra)) {
    return { ok: true, tipo: { familia: "planilha", extensao: "csv", mime: "text/csv" } };
  }
  return { ok: false, motivo: "tipo" };
}

// O tamanho como o protótipo escreve (`fmtTam`): a partir de 1 MiB, "{x,y} MB" com uma casa e
// vírgula; abaixo, "{n} KB" inteiro, nunca menos que 1.
export function textoDoTamanho(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const TETO_DO_NOME_DO_ANEXO = 120;

// O nome que a folha sugere: o nome do arquivo sem a ÚLTIMA extensão, aparado e cortado em 120 pontos
// de código (o teto do Zod e do check `fornecedor_anexos_nome_comprimento`).
export function nomeDoAnexoPeloArquivo(nomeDoArquivo: string): string {
  const ponto = nomeDoArquivo.lastIndexOf(".");
  const semExtensao = ponto > 0 ? nomeDoArquivo.slice(0, ponto) : nomeDoArquivo;
  return [...semExtensao.normalize("NFC").trim()].slice(0, TETO_DO_NOME_DO_ANEXO).join("").trim();
}

// O preenchimento automático ao escolher o arquivo (UI-SPEC "Preenchimento automático", herdado do
// protótipo): o Nome só se estiver vazio; PDF → Tipo "Tabela de preços" e "Vale a partir de" = hoje
// (só se vazia); planilha → "Tabela de preços", a data como está; foto → "Outro". O tipo só muda se a
// pessoa ainda não o trocou à mão — e a data só se preenche quando o tipo vira tabela aqui (a data só
// vale para tabela; o servidor recusa as duas juntas fora dela). `tipo: null` = não mexer no tipo.
// `hoje` chega por parâmetro (data civil de Brasília), nunca daqui.
export function preenchimentoPeloArquivo({
  nomeDoArquivo,
  hoje,
  nomeAtual,
  valeDesdeAtual,
  tipoTocadoPelaPessoa,
}: {
  nomeDoArquivo: string;
  hoje: string;
  nomeAtual: string;
  valeDesdeAtual: string;
  tipoTocadoPelaPessoa: boolean;
}): { nome: string; tipo: "tabela" | "outro" | null; valeDesde: string } {
  const nome = nomeAtual.trim() === "" ? nomeDoAnexoPeloArquivo(nomeDoArquivo) : nomeAtual;
  const familia = familiaPelaExtensao(extensaoDoNome(nomeDoArquivo));

  if (tipoTocadoPelaPessoa || familia === null) {
    return { nome, tipo: null, valeDesde: valeDesdeAtual };
  }
  if (familia === "documento") {
    return { nome, tipo: "tabela", valeDesde: valeDesdeAtual === "" ? hoje : valeDesdeAtual };
  }
  if (familia === "planilha") {
    return { nome, tipo: "tabela", valeDesde: valeDesdeAtual };
  }
  return { nome, tipo: "outro", valeDesde: valeDesdeAtual };
}
