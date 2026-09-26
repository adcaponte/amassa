import { promises as fs } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

// Um caso por fato, o nome do caso diz o fato — mesmo estilo de
// `tests/unit/financeiro-dinheiro.test.ts`.
//
// `sharp` é envolvido num Proxy que só CONTA chamadas à função (nunca muda o comportamento —
// `Reflect.apply` delega para a implementação real) para provar a afirmação do must_have "o
// caminho de recusa nunca chama a biblioteca de imagem". `sharp.format` e o resto da API
// continuam acessíveis normalmente através do Proxy (o `get` trap não é sobrescrito, cai no
// padrão `Reflect.get`), então `lib/orcamentos/fotos.ts::construirTiposAceitos` (que lê
// `sharp.format.heif` na carga do módulo) funciona sem mudança.
let chamadasAoSharp = 0;

vi.mock("sharp", async (importOriginal) => {
  const real = await importOriginal<typeof import("sharp")>();
  const comContagem = new Proxy(real.default, {
    apply(alvo, thisArg, args) {
      chamadasAoSharp += 1;
      return Reflect.apply(alvo, thisArg, args as Parameters<typeof alvo>);
    },
  });
  return { ...real, default: comContagem };
});

import sharp from "sharp";
import {
  TAMANHO_MAXIMO_BYTES,
  TIPOS_ACEITOS,
  tratarFotoDeOrcamento,
  validarTipoRealDaFoto,
} from "@/lib/orcamentos/fotos";
import { FRASE_ARQUIVO_MUITO_GRANDE, FRASE_ARQUIVO_NAO_E_IMAGEM } from "@/lib/orcamentos/textos";

// tests/fixtures/orcamentos-foto-com-gps.jpg — 427 bytes, GERADO UMA VEZ por um script
// descartável (não versionado), nunca uma foto real (o repositório é público). `sharp` NÃO
// escreve um GPS IFD de verdade via `withMetadata({ exif: { GPS: {...} } })` — confirmado nesta
// sessão: a chamada não lança erro, mas o GPS informado é silenciosamente ignorado (o IFD0 do
// resultado nunca ganha o ponteiro de tag 0x8825 para uma IFD de GPS). Por isso este fixture
// tem os bytes do EXIF/TIFF montados à mão: cabeçalho TIFF, IFD0 com Orientation=6 e um
// ponteiro de GPS IFD válido, e uma GPS IFD com GPSLatitudeRef/GPSLatitude/GPSLongitudeRef/
// GPSLongitude codificados como RATIONAL de verdade (15°45'30"S, 47°33'12"W — coordenada
// inventada, não é um lugar real) — inserido como segmento APP1 logo após o SOI de um JPEG
// 40×30 gerado pelo próprio sharp. `possuiPonteiroDeIfdGps` abaixo prova que o ponteiro existe
// na ENTRADA, para que o teste de remoção não seja vácuo.
const CAMINHO_FIXTURE_COM_GPS = path.join(
  process.cwd(),
  "tests/fixtures/orcamentos-foto-com-gps.jpg",
);

function possuiPonteiroDeIfdGps(exif: Buffer): boolean {
  const inicioDoTiff = 6; // logo depois de "Exif\0\0"
  const ordemDosBytes = exif.toString("ascii", inicioDoTiff, inicioDoTiff + 2);
  const leituraPequena = ordemDosBytes === "II";
  const u16 = (deslocamento: number) =>
    leituraPequena ? exif.readUInt16LE(deslocamento) : exif.readUInt16BE(deslocamento);
  const u32 = (deslocamento: number) =>
    leituraPequena ? exif.readUInt32LE(deslocamento) : exif.readUInt32BE(deslocamento);

  const deslocamentoDoIfd0 = inicioDoTiff + u32(inicioDoTiff + 4);
  const quantidadeDeEntradas = u16(deslocamentoDoIfd0);
  for (let indice = 0; indice < quantidadeDeEntradas; indice += 1) {
    const deslocamentoDaEntrada = deslocamentoDoIfd0 + 2 + indice * 12;
    const etiqueta = u16(deslocamentoDaEntrada);
    if (etiqueta === 0x8825) {
      return true; // GPSInfoIFDPointer
    }
  }
  return false;
}

async function construirJpeg(largura: number, altura: number): Promise<Buffer> {
  return sharp({
    create: { width: largura, height: altura, channels: 3, background: { r: 180, g: 90, b: 40 } },
  })
    .jpeg()
    .toBuffer();
}

describe("TIPOS_ACEITOS", () => {
  it("sempre contém JPEG, PNG e WEBP, não importa o que a instalação do sharp suporte de HEIC", () => {
    expect(TIPOS_ACEITOS.has("image/jpeg")).toBe(true);
    expect(TIPOS_ACEITOS.has("image/png")).toBe(true);
    expect(TIPOS_ACEITOS.has("image/webp")).toBe(true);
  });

  it("registra no console o veredito de suporte a HEIC/HEIF desta instalação (Assumption A1 da pesquisa)", () => {
    const suportaHeic = TIPOS_ACEITOS.has("image/heic");
    // Veredito desta execução, para o SUMMARY do plano — não é uma asserção sobre qual dos dois
    // vale (a Assumption A1 explicitamente não sabia qual seria a resposta), só que a lista é
    // coerente com o que o próprio módulo decidiu.
    console.log(
      suportaHeic
        ? "[teste] Assumption A1 (RESEARCH.md): esta instalação do sharp SUPORTA HEIC/HEIF (image/heic e image/heif entram em TIPOS_ACEITOS)."
        : "[teste] Assumption A1 (RESEARCH.md): esta instalação do sharp NÃO suporta HEIC/HEIF — image/heic e image/heif ficam FORA de TIPOS_ACEITOS.",
    );
    expect(TIPOS_ACEITOS.has("image/heif")).toBe(suportaHeic);
  });
});

describe("validarTipoRealDaFoto", () => {
  it("aceita um JPEG construído no próprio teste", async () => {
    const jpeg = await construirJpeg(20, 20);
    await expect(validarTipoRealDaFoto(jpeg)).resolves.toEqual({ ok: true });
  });

  it("aceita um PNG construído no próprio teste", async () => {
    const png = await sharp({
      create: { width: 20, height: 20, channels: 3, background: { r: 10, g: 200, b: 10 } },
    })
      .png()
      .toBuffer();
    await expect(validarTipoRealDaFoto(png)).resolves.toEqual({ ok: true });
  });

  it("aceita um WEBP construído no próprio teste", async () => {
    const webp = await sharp({
      create: { width: 20, height: 20, channels: 3, background: { r: 10, g: 10, b: 200 } },
    })
      .webp()
      .toBuffer();
    await expect(validarTipoRealDaFoto(webp)).resolves.toEqual({ ok: true });
  });

  it('recusa um Buffer de texto renomeado, com "Esse arquivo não é uma imagem. Escolha uma foto."', async () => {
    const textoComoSeFosseFoto = Buffer.from(
      "isto é um arquivo de texto qualquer, sem nenhuma assinatura de imagem",
      "utf8",
    );
    await expect(validarTipoRealDaFoto(textoComoSeFosseFoto)).resolves.toEqual({
      ok: false,
      erro: FRASE_ARQUIVO_NAO_E_IMAGEM,
    });
  });

  it('recusa um PDF, com "Esse arquivo não é uma imagem. Escolha uma foto."', async () => {
    const pdfMinimo = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n", "latin1");
    await expect(validarTipoRealDaFoto(pdfMinimo)).resolves.toEqual({
      ok: false,
      erro: FRASE_ARQUIVO_NAO_E_IMAGEM,
    });
  });

  it('recusa um buffer vazio, com "Esse arquivo não é uma imagem. Escolha uma foto."', async () => {
    await expect(validarTipoRealDaFoto(Buffer.alloc(0))).resolves.toEqual({
      ok: false,
      erro: FRASE_ARQUIVO_NAO_E_IMAGEM,
    });
  });

  it("recusa um buffer acima de 15 MB com a frase de tamanho, antes de examinar o conteúdo", async () => {
    const maiorQueOTeto = Buffer.alloc(TAMANHO_MAXIMO_BYTES + 1);
    await expect(validarTipoRealDaFoto(maiorQueOTeto)).resolves.toEqual({
      ok: false,
      erro: FRASE_ARQUIVO_MUITO_GRANDE,
    });
  });

  it("o caminho de recusa nunca chama a biblioteca de imagem (sharp)", async () => {
    chamadasAoSharp = 0;

    await validarTipoRealDaFoto(Buffer.from("nem imagem, nem PDF, só texto", "utf8"));
    await validarTipoRealDaFoto(Buffer.alloc(0));
    await validarTipoRealDaFoto(Buffer.alloc(TAMANHO_MAXIMO_BYTES + 1));

    expect(chamadasAoSharp).toBe(0);
  });
});

describe("tratarFotoDeOrcamento", () => {
  it("reduz uma imagem de 3000×2000 para no máximo 1600px no lado maior, mantendo a proporção", async () => {
    const grande = await construirJpeg(3000, 2000);

    const resultado = await tratarFotoDeOrcamento(grande);

    expect(Math.max(resultado.larguraPx, resultado.alturaPx)).toBeLessThanOrEqual(1600);
    expect(resultado.larguraPx).toBe(1600);
    expect(resultado.larguraPx / resultado.alturaPx).toBeCloseTo(3000 / 2000, 1);

    const metadados = await sharp(resultado.buffer).metadata();
    expect(metadados.format).toBe("jpeg");
    expect(resultado.bytes).toBe(resultado.buffer.length);
  });

  it("uma imagem de 800×600 sai com 800×600 (nunca ampliada)", async () => {
    const pequena = await construirJpeg(800, 600);

    const resultado = await tratarFotoDeOrcamento(pequena);

    expect(resultado.larguraPx).toBe(800);
    expect(resultado.alturaPx).toBe(600);
  });

  it("🔴 remove GPS e orientação de uma imagem que genuinamente carrega os dois, aplicando a rotação aos pixels antes de descartar a etiqueta", async () => {
    const entrada = await fs.readFile(CAMINHO_FIXTURE_COM_GPS);

    // Prova que a ENTRADA genuinamente carrega GPS e orientação — sem isto, a asserção de
    // ausência abaixo não provaria nada (o teste "passaria" mesmo com uma entrada sem GPS).
    const metadadosDeEntrada = await sharp(entrada).metadata();
    expect(metadadosDeEntrada.orientation).toBe(6);
    expect(metadadosDeEntrada.exif).toBeDefined();
    expect(possuiPonteiroDeIfdGps(metadadosDeEntrada.exif as Buffer)).toBe(true);
    expect(metadadosDeEntrada.width).toBe(40);
    expect(metadadosDeEntrada.height).toBe(30);

    const resultado = await tratarFotoDeOrcamento(entrada);

    // A rotação foi aplicada aos PIXELS antes de a etiqueta sumir: largura e altura trocam
    // (orientação 6 = "rotacionar 90° no sentido horário").
    expect(resultado.larguraPx).toBe(30);
    expect(resultado.alturaPx).toBe(40);

    // O teste lê os METADADOS DO RESULTADO e afirma a ausência — não só que o arquivo ficou
    // menor (o must_have da Tarefa 2 exige exatamente isto).
    const metadadosDeSaida = await sharp(resultado.buffer).metadata();
    expect(metadadosDeSaida.exif).toBeUndefined();
    expect(metadadosDeSaida.orientation).toBeUndefined();
  });
});
