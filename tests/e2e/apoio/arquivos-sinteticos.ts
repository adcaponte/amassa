// Arquivos SINTÉTICOS para os testes dos anexos de fornecedor (Fase 06.2, plano 05): gerados em
// memória, a cada execução — nenhum binário novo versionado, nenhum dado real (o repositório é
// público), nenhum arquivo semeado em disco (no CI o app roda num contêiner; o arquivo sobe pela rota).
//
// Módulo Node puro, sem `@playwright/test`: o e2e (`fornecedores-rota-anexos.spec.ts`) e o unitário
// (`fornecedores-arquivo.test.ts`) usam os MESMOS buffers. As assinaturas foram sondadas na pesquisa
// (06.2-RESEARCH.md, Achado 4) contra o `file-type` 22.1.1.
import { crc32 } from "node:zlib";

const CABECALHO_PDF = Buffer.from("%PDF-1.4\n", "latin1");
const RODAPE_PDF = Buffer.from("\n%%EOF\n", "latin1");

// Um PDF que o `file-type` reconhece (`%PDF`), com EXATAMENTE `bytes` bytes — o miolo é enchimento de
// espaços. Serve do de 50 KB do traçador ao de ~12 MB da regressão do truncamento (Achado 1).
export function pdfSintetico(bytes: number): Buffer {
  const miolo = bytes - CABECALHO_PDF.length - RODAPE_PDF.length;
  if (miolo < 0) {
    throw new Error(`pdfSintetico: ${bytes} bytes não cabem o cabeçalho e o rodapé de um PDF.`);
  }
  return Buffer.concat([CABECALHO_PDF, Buffer.alloc(miolo, 0x20), RODAPE_PDF]);
}

type EntradaDoZip = { nome: string; conteudo: string };

// Um zip "stored" (sem compressão) montado à mão: cabeçalho local de cada entrada (0x04034b50), o
// diretório central (0x02014b50) e o fim do diretório (0x06054b50). CRC pelo `zlib.crc32` (Node ≥ 22).
function zipArmazenado(entradas: readonly EntradaDoZip[]): Buffer {
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let deslocamento = 0;

  for (const entrada of entradas) {
    const nome = Buffer.from(entrada.nome, "utf8");
    const dados = Buffer.from(entrada.conteudo, "utf8");
    const crc = crc32(dados);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versão necessária
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(0, 10); // hora
    local.writeUInt16LE(0x21, 12); // data (01/01/1980)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dados.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nome.length, 26);
    local.writeUInt16LE(0, 28);
    locais.push(local, nome, dados);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // feito por
    central.writeUInt16LE(20, 6); // versão necessária
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(dados.length, 20);
    central.writeUInt32LE(dados.length, 24);
    central.writeUInt16LE(nome.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comentário
    central.writeUInt16LE(0, 34); // disco
    central.writeUInt16LE(0, 36); // atributos internos
    central.writeUInt32LE(0, 38); // atributos externos
    central.writeUInt32LE(deslocamento, 42);
    centrais.push(central, nome);

    deslocamento += local.length + nome.length + dados.length;
  }

  const diretorio = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(0, 4);
  fim.writeUInt16LE(0, 6);
  fim.writeUInt16LE(entradas.length, 8);
  fim.writeUInt16LE(entradas.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  fim.writeUInt16LE(0, 20);

  return Buffer.concat([...locais, diretorio, fim]);
}

// Um XLSX mínimo: o `[Content_Types].xml` com o tipo da pasta de trabalho e o `xl/workbook.xml`. O
// `file-type` só devolve `xlsx` (e não `zip`) porque confere o `[Content_Types].xml`.
export function xlsxSintetico(): Buffer {
  return zipArmazenado([
    {
      nome: "[Content_Types].xml",
      conteudo:
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
    },
    {
      nome: "xl/workbook.xml",
      conteudo:
        '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>',
    },
  ]);
}

// Um zip qualquer, sem nada de planilha — o `file-type` diz `zip`, e a regra recusa.
export function zipQualquer(): Buffer {
  return zipArmazenado([{ nome: "leia-me.txt", conteudo: "[e2e] um zip que não é planilha\n" }]);
}

// O cabeçalho OLE (Compound File Binary) de um XLS antigo — e também de um DOC. O `file-type` diz
// `cfb`; só a extensão `.xls` do nome desempata.
export function xlsCfbSintetico(): Buffer {
  const cabecalho = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  return Buffer.concat([cabecalho, Buffer.alloc(1024 - cabecalho.length, 0)]);
}

// Um CSV de verdade (texto UTF-8 com acento, separado por ponto e vírgula) — sem assinatura nenhuma.
export function csvSintetico(): Buffer {
  return Buffer.from("material;preço;unidade\n[e2e] argila;12,50;kg\n[e2e] esmalte;48,00;kg\n", "utf8");
}

// HTML com script — o que um arquivo "disfarçado" (nome `.pdf`, `.csv`…) carregaria. Sem assinatura.
export function htmlDisfarcado(): Buffer {
  return Buffer.from(
    "<!doctype html><html><body><script>alert('[e2e]')</script></body></html>\n",
    "utf8",
  );
}
