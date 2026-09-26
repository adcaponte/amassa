// Pipeline de foto de orçamento — a primeira vez que o projeto guarda um arquivo enviado por
// alguém (D-26/D-27, ORC-14). Duas responsabilidades, deliberadamente separadas:
//
//   1. `validarTipoRealDaFoto` confere que os BYTES são mesmo uma imagem aceita, pelos
//      primeiros bytes (`file-type`) — nunca pela extensão do nome original nem pelo
//      Content-Type que o navegador declarou, os dois são texto que quem envia controla.
//   2. `tratarFotoDeOrcamento` transforma bytes de uma imagem em outro buffer: reduzido,
//      reorientado e sem metadado.
//
// Este módulo só TRANSFORMA bytes — nunca toca disco. Gravar o resultado é trabalho de
// `lib/orcamentos/acoes.ts`, com o caminho vindo de `lib/orcamentos/caminho-fotos.ts` (plano
// 03) — a mesma separação de responsabilidade que o resto do projeto já segue.
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

import { FRASE_ARQUIVO_MUITO_GRANDE, FRASE_ARQUIVO_NAO_E_IMAGEM } from "./textos";

// ~15 MB, como uma foto sai de um celular atual sem compressão adicional (D-26). Nomeada,
// nunca um número solto no meio do código — `next.config.ts` (`bodySizeLimit`) e a rota de
// upload leem esta MESMA constante, nunca um segundo "15_000_000" escrito à mão em outro lugar.
export const TAMANHO_MAXIMO_BYTES = 15_000_000;

// O lado maior da imagem tratada, em pixels (D-26). `withoutEnlargement` no pipeline abaixo
// garante que uma foto menor que isto NUNCA é ampliada — só reduzida quando for maior.
export const LADO_MAXIMO_PX = 1600;

// Construída na CARGA do módulo, a partir do que ESTA instalação do sharp/libvips realmente
// decodifica — nunca uma lista fixa escrita à mão. Isto resolve a Assumption A1 da pesquisa
// (04.5-RESEARCH.md: "não verificado com um arquivo HEIC real") sem precisar de uma foto de
// iPhone de verdade: o módulo simplesmente PERGUNTA à biblioteca instalada, agora, o que ela
// sabe decodificar. Se o build do libvips não tiver suporte a HEIF, a foto HEIC é recusada
// aqui, com uma frase que diz o que fazer, em vez de estourar no meio do redimensionamento.
//
// `sharp.format.heif.input.buffer` reflete a capacidade REAL da instalação atual (compilada com
// libheif ou não) — não uma suposição do código. O mesmo codec "heif" do sharp cobre tanto AVIF
// quanto HEIC/HEIC nativo de iPhone; por isso as duas variantes de mime entram juntas quando o
// suporte existe.
function construirTiposAceitos(): ReadonlySet<string> {
  const tipos = new Set(["image/jpeg", "image/png", "image/webp"]);

  const suportaHeic = Boolean(sharp.format.heif?.input?.buffer);
  if (suportaHeic) {
    tipos.add("image/heic");
    tipos.add("image/heif");
  }

  // Veredito registrado uma vez, na carga do módulo — quem operar o servidor (Alpine/musl em
  // produção, Pitfall 3 da pesquisa) vê no log se HEIC está de fato disponível nesta
  // instalação, sem precisar ler código nem esperar a primeira reclamação de foto de iPhone
  // recusada.
  console.log(
    suportaHeic
      ? '[lib/orcamentos/fotos] HEIC/HEIF suportado por esta instalação do sharp (sharp.format.heif.input.buffer=true) — fotos de iPhone em HEIC nativo são aceitas.'
      : '[lib/orcamentos/fotos] HEIC/HEIF NÃO suportado por esta instalação do sharp — fotos de iPhone em HEIC nativo serão recusadas com a mensagem de tipo inválido (ative "Mais compatível" no aparelho, ou envie JPEG/PNG/WEBP).',
  );

  return tipos;
}

export const TIPOS_ACEITOS: ReadonlySet<string> = construirTiposAceitos();

export type ResultadoDeValidacaoDeFoto = { ok: true } | { ok: false; erro: string };

// Primeira coisa que `anexarFotoDeOrcamento` chama, ANTES de qualquer processamento e ANTES de
// tocar disco (T-04.5-46) — a ordem dos dois testes importa: o tamanho é conferido primeiro
// porque é o mais barato (`bytes.length`, sem ler o conteúdo), e só então os bytes são
// realmente inspecionados. Nenhum dos dois caminhos de recusa chama o `sharp` — recusar não
// precisa decodificar imagem nenhuma.
export async function validarTipoRealDaFoto(bytes: Buffer): Promise<ResultadoDeValidacaoDeFoto> {
  if (bytes.length > TAMANHO_MAXIMO_BYTES) {
    return { ok: false, erro: FRASE_ARQUIVO_MUITO_GRANDE };
  }

  // `file-type` olha os primeiros bytes de verdade (magic bytes) — nunca a extensão do nome
  // original nem o Content-Type que o navegador declarou, os dois são texto que quem envia
  // controla e um arquivo malicioso pode mentir. Um buffer vazio ou de outro formato (texto,
  // PDF) devolve `undefined` ou um mime fora de `TIPOS_ACEITOS` — os dois caem na mesma frase.
  const tipo = await fileTypeFromBuffer(bytes);
  if (!tipo || !TIPOS_ACEITOS.has(tipo.mime)) {
    return { ok: false, erro: FRASE_ARQUIVO_NAO_E_IMAGEM };
  }

  return { ok: true };
}

export type FotoTratada = {
  buffer: Buffer;
  larguraPx: number;
  alturaPx: number;
  bytes: number;
};

// O pipeline (04.5-RESEARCH.md, Pattern 2), nesta ordem exata — a ordem É a regra de
// privacidade, não um detalhe de estilo:
export async function tratarFotoDeOrcamento(bytesRecebidos: Buffer): Promise<FotoTratada> {
  const { data: buffer, info } = await sharp(bytesRecebidos)
    // SEM argumento: lê a tag EXIF Orientation, gira os PIXELS de acordo, e REMOVE a tag em
    // seguida — "Auto-orient based on the EXIF Orientation tag, then remove the tag" (doc
    // oficial do sharp, sharp.pixelplumbing.com/api-operation#rotate). Sem isto, uma foto
    // vertical tirada de lado sairia deitada depois que o resto do EXIF for descartado — um
    // bug real de orientação, não só um detalhe de metadado.
    .rotate()
    .resize({ width: LADO_MAXIMO_PX, height: LADO_MAXIMO_PX, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    // 🔴 NENHUMA chamada a `.withMetadata()` neste pipeline, em lugar nenhum — nem aqui, nem
    // em qualquer alteração futura deste arquivo. O comportamento PADRÃO do sharp já remove
    // TODO metadado do resultado (EXIF, GPS, ICC): "By default all metadata will be removed"
    // (doc oficial, sharp.pixelplumbing.com/api-output#withmetadata). É assim que D-26
    // ("privacidade do cliente é o ponto, não o redimensionamento") é cumprido — por padrão,
    // sem código extra. Chamar `.withMetadata()` aqui, MESMO sem argumento, faria o OPOSTO do
    // que a fase exige: manteria EXIF/GPS no arquivo final. Este é exatamente o erro que um
    // desenvolvedor futuro cometeria "para preservar qualidade" ou "para manter a orientação"
    // (a orientação já foi resolvida pelo `.rotate()` acima, nos PIXELS — não precisa da tag).
    // Não adicione essa chamada. Se um teste de metadado começar a falhar, o bug está em quem
    // tentou "consertar" isto, não no teste.
    .toBuffer({ resolveWithObject: true });

  return {
    buffer,
    larguraPx: info.width,
    alturaPx: info.height,
    bytes: info.size,
  };
}
