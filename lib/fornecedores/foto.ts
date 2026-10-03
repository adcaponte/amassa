// A foto de um anexo de fornecedor (Fase 06.2, plano 07; D-07, D-A03, pesquisa Achados 3 e 5): o
// catálogo fotografado no celular, a captura de tela de uma tabela de preços. Este módulo só TRANSFORMA
// bytes — nunca toca disco nem banco. Quem grava o resultado é a rota do PUT
// (`app/gestao/api/fornecedores/anexos/route.ts`), que é também quem decide, pela assinatura
// (`file-type`), que o arquivo é uma foto. O `sharp` mora SÓ aqui: nem a folha (cliente) nem
// `arquivo.ts` (puro, importado pela folha) o importam.
//
// O molde é `tratarFotoDeOrcamento` (`lib/orcamentos/fotos.ts`), com duas diferenças deliberadas:
//   - o lado maior é `LADO_MAXIMO_PX` de `arquivo.ts` — 2000 px, do briefing (D-A03); os orçamentos
//     continuam com 1600 e NÃO mudam nesta fase;
//   - `flatten` em branco (Achado 5): um PNG/WebP com transparência vira JPEG PRETO sem ele — a captura
//     de tela de uma tabela com fundo transparente ficaria ilegível.
import sharp from "sharp";

import { LADO_MAXIMO_PX } from "./arquivo";

// O `sharp` não abriu a entrada: a assinatura dizia foto, mas o conteúdo não decodifica — na prática, o
// HEIC de iPhone (o `sharp` pré-compilado não traz o decodificador HEVC, Achado 3) ou uma foto
// corrompida. A rota traduz em 415: com a frase do HEIC quando a assinatura era `heic` (D-07), com a do
// tipo nos outros casos. Em NENHUM dos dois a foto é guardada como veio (ela manteria o EXIF/GPS).
export class FotoQueNaoAbre extends Error {
  constructor(causa: unknown) {
    super("O sharp não abriu a foto do anexo.", { cause: causa });
    this.name = "FotoQueNaoAbre";
  }
}

export type FotoDeAnexoTratada = {
  buffer: Buffer;
  bytes: number;
};

// O pipeline, nesta ordem — a ordem É a regra de privacidade, não um detalhe de estilo.
export async function tratarFotoDeAnexo(bytesRecebidos: Buffer): Promise<FotoDeAnexoTratada> {
  try {
    const { data: buffer, info } = await sharp(bytesRecebidos)
      // SEM argumento: lê a tag EXIF Orientation, gira os PIXELS de acordo e REMOVE a tag. Sem isto,
      // uma foto vertical tirada de lado sairia deitada depois que o resto do EXIF for descartado.
      .rotate()
      // Lado maior ≤ 2000 px, proporção mantida; uma foto menor NUNCA é ampliada.
      .resize({ width: LADO_MAXIMO_PX, height: LADO_MAXIMO_PX, fit: "inside", withoutEnlargement: true })
      // A transparência vira branco, não preto (Achado 5).
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82, mozjpeg: true })
      // 🔴 NENHUMA chamada que preserve metadado neste pipeline, em lugar nenhum — nem aqui, nem em
      // qualquer alteração futura deste arquivo. O comportamento PADRÃO do sharp já remove TODO
      // metadado do resultado (EXIF, GPS, ICC): "By default all metadata will be removed" (doc oficial,
      // sharp.pixelplumbing.com/api-output#withmetadata). É assim que a foto do anexo perde a
      // localização de onde foi tirada (T-06.2-25, T-06.2-27) — por padrão, sem código extra. Pedir ao
      // sharp que mantenha o metadado, MESMO sem argumento, faria o OPOSTO do que a fase exige: manteria
      // EXIF/GPS no arquivo final. É exatamente o erro que um desenvolvedor futuro cometeria "para
      // preservar qualidade" ou "para manter a orientação" (a orientação já foi resolvida pelo
      // `.rotate()` acima, nos PIXELS — não precisa da tag). Não adicione essa chamada. Se um teste de
      // metadado começar a falhar, o bug está em quem tentou "consertar" isto, não no teste.
      .toBuffer({ resolveWithObject: true });
    return { buffer, bytes: info.size };
  } catch (erro) {
    throw new FotoQueNaoAbre(erro);
  }
}
