import { promises as fs } from "node:fs";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { LADO_MAXIMO_PX } from "@/lib/fornecedores/arquivo";
import { FotoQueNaoAbre, tratarFotoDeAnexo } from "@/lib/fornecedores/foto";

import { heicSintetico, pngTransparente } from "../e2e/apoio/arquivos-sinteticos";

// A foto de um anexo de fornecedor (06.2-07-PLAN.md, Tarefa 2; D-07, D-A03; T-06.2-25/27): a regra de
// privacidade provada sem rede nem navegador — o `sharp` de verdade, sobre imagens geradas aqui e sobre
// a ÚNICA foto "real" do repositório, `tests/fixtures/orcamentos-foto-com-gps.jpg` (sintética, 04.5: um
// JPEG 40×30 com EXIF montado à mão — Orientation 6 e um GPS de coordenada inventada).

const CAMINHO_FOTO_COM_GPS = path.join(process.cwd(), "tests/fixtures/orcamentos-foto-com-gps.jpg");

async function jpegLiso(largura: number, altura: number): Promise<Buffer> {
  return sharp({
    create: { width: largura, height: altura, channels: 3, background: { r: 180, g: 90, b: 40 } },
  })
    .jpeg()
    .toBuffer();
}

async function pngLiso(largura: number, altura: number): Promise<Buffer> {
  return sharp({
    create: { width: largura, height: altura, channels: 3, background: { r: 40, g: 90, b: 180 } },
  })
    .png()
    .toBuffer();
}

describe("FRN-07 · precision — lado maior ≤ 2000 px, proporção mantida, nunca ampliada", () => {
  it("a constante do módulo é 2000 (D-A03; os orçamentos continuam com 1600)", () => {
    expect(LADO_MAXIMO_PX).toBe(2000);
  });

  it("PNG 3000 × 1000 → JPEG 2000 × 667", async () => {
    const { buffer, bytes } = await tratarFotoDeAnexo(await pngLiso(3000, 1000));
    const meta = await sharp(buffer).metadata();
    expect(meta.format).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([2000, 667]);
    expect(bytes).toBe(buffer.length);
  });

  it("retrato 1000 × 3000 → 667 × 2000 (o lado maior é a altura)", async () => {
    const { buffer } = await tratarFotoDeAnexo(await pngLiso(1000, 3000));
    const meta = await sharp(buffer).metadata();
    expect([meta.width, meta.height]).toEqual([667, 2000]);
  });

  it("exatamente 2000 × 2000 fica 2000 × 2000", async () => {
    const { buffer } = await tratarFotoDeAnexo(await jpegLiso(2000, 2000));
    const meta = await sharp(buffer).metadata();
    expect([meta.width, meta.height]).toEqual([2000, 2000]);
  });

  it("JPEG 100 × 50 → 100 × 50 (foto menor nunca é ampliada)", async () => {
    const { buffer } = await tratarFotoDeAnexo(await jpegLiso(100, 50));
    const meta = await sharp(buffer).metadata();
    expect([meta.width, meta.height]).toEqual([100, 50]);
  });
});

describe("FRN-07 · precision — sem EXIF/GPS (a foto nunca sai com a localização)", () => {
  it("orcamentos-foto-com-gps.jpg: a ENTRADA tem EXIF; a SAÍDA não tem metadado nenhum", async () => {
    const entrada = await fs.readFile(CAMINHO_FOTO_COM_GPS);
    // Sem isto, "sem EXIF na saída" seria vácuo.
    expect((await sharp(entrada).metadata()).exif).toBeDefined();

    const { buffer } = await tratarFotoDeAnexo(entrada);
    const meta = await sharp(buffer).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(buffer.includes(Buffer.from("Exif"))).toBe(false);
  });

  it("a orientação vai para os PIXELS (Orientation 6 → 40 × 30 vira 30 × 40), não para uma tag", async () => {
    const { buffer } = await tratarFotoDeAnexo(await fs.readFile(CAMINHO_FOTO_COM_GPS));
    const meta = await sharp(buffer).metadata();
    expect([meta.width, meta.height]).toEqual([30, 40]);
    expect(meta.orientation).toBeUndefined();
  });
});

describe("FRN-07 · precision — transparência vira branco, não preto (Achado 5)", () => {
  it("pngTransparente → primeiro pixel [255, 255, 255]", async () => {
    const { buffer } = await tratarFotoDeAnexo(await pngTransparente(64, 32));
    const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(3);
    expect([data[0], data[1], data[2]]).toEqual([255, 255, 255]);
  });
});

describe("D-07 — HEIC que o sharp não abre é recusado, nunca guardado como veio", () => {
  it("heicSintetico → lança FotoQueNaoAbre (com a causa do sharp)", async () => {
    const tentativa = tratarFotoDeAnexo(heicSintetico());
    await expect(tentativa).rejects.toBeInstanceOf(FotoQueNaoAbre);
    await expect(tentativa).rejects.toHaveProperty("cause");
  });

  it("bytes que não são imagem nenhuma → FotoQueNaoAbre", async () => {
    await expect(tratarFotoDeAnexo(Buffer.from("[teste] não sou uma foto"))).rejects.toBeInstanceOf(
      FotoQueNaoAbre,
    );
  });
});
