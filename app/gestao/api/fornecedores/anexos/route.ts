// A ÚNICA porta de ENTRADA do byte de um anexo de fornecedor (Fase 06.2, D-01, FRN-06/07) — nunca
// Server Action (que seguraria o corpo inteiro na memória e exigiria subir o `bodySizeLimit` de todas
// as ações do sistema), nunca `multipart` (nenhum parser, nenhum pacote novo). O cliente faz
// `fetch(PUT)` com o arquivo CRU no corpo e os metadados na QUERY; esta rota grava o corpo em stream.
//
// Esta rota está FORA do `matcher` de `middleware.ts` (D-08, pesquisa Achado 1): sob o middleware o
// Next clona e TRUNCA o corpo em 10 MB, sem erro. Por isso ela mesma faz o que o middleware faria — e
// é verificável em revisão, na ordem em que aparece abaixo:
//   1. `exigirUsuario()` ANTES de ler um byte do corpo ou do banco (T-06.2-16) — sem sessão, 401 JSON
//      (nunca o redirect que `exigirUsuario()` lança: o `fetch` o seguiria até a página de login).
//   2. `Origin` de outro endereço → 403 (Pitfall 8, T-06.2-20): Route Handler não confere a origem
//      sozinho, como a Server Action.
//   3. Metadados validados com Zod no servidor (`esquemaEnvioDeAnexo`).
//   4. Limite de 20 MiB pelo `Content-Length` declarado, ANTES de ler o corpo; e de novo pela contagem
//      dos bytes que chegam, cortando no limite (T-06.2-19) — o corpo nunca fica inteiro na memória.
//   5. O tipo vem da ASSINATURA (`file-type` sobre o temporário gravado), nunca do nome (T-06.2-18).
//   6. O arquivo final (`<uuid>.<ext>`, nome sorteado pelo servidor) só existe ANTES da linha dentro
//      da transação, e é apagado se a linha não se gravar; o temporário (`.envio-<uuid>`, na MESMA
//      pasta — Pitfall 5) sai sempre, no `finally` (FRN-07, FRN-08).
//   7. Nenhuma resposta cita caminho, nome de pasta ou mensagem do sistema operacional (T-06.2-24) —
//      as frases são fixas, de `lib/fornecedores/textos.ts`; o detalhe vai só para o `console.error`.
import { createWriteStream, promises as fs } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as ReadableStreamDoNode } from "node:stream/web";

import { eq } from "drizzle-orm";
import * as tipoDeArquivo from "file-type";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { fornecedorAnexos, fornecedores } from "@/db/schema";
import { exigirUsuario, type UsuarioAutorizado } from "@/lib/auth/exigir-usuario";
import { classificarArquivo, LIMITE_DOCUMENTO_BYTES, textoDoTamanho } from "@/lib/fornecedores/arquivo";
import { mesmaOrigem } from "@/lib/fornecedores/cabecalhos";
import {
  caminhoDoAnexo,
  caminhoTemporario,
  diretorioDeAnexos,
  nomeDeArquivoNovo,
} from "@/lib/fornecedores/caminho-anexos";
import { situacaoParaEnvio } from "@/lib/fornecedores/consultas";
import { esquemaEnvioDeAnexo } from "@/lib/fornecedores/esquemas";
import {
  FRASE_ARQUIVO_VAZIO,
  FRASE_FALHA_AO_ENVIAR,
  FRASE_FICHA_NAO_EXISTE,
  FRASE_FORNECEDOR_DESATIVADO_NO_ENVIO,
  FRASE_ORIGEM_RECUSADA,
  FRASE_SESSAO_TERMINOU,
  FRASE_TIPO_PELA_ASSINATURA,
  fraseTamanhoDeDocumento,
} from "@/lib/fornecedores/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Quantos bytes do começo do arquivo a regra do CSV olha (A-04: "sem byte nulo nos primeiros KB").
const TAMANHO_DA_AMOSTRA = 8192;

class LimiteExcedido extends Error {}
class FornecedorSumiu extends Error {}
class FornecedorDesativado extends Error {}

function recusar(status: number, erro: string) {
  return NextResponse.json({ ok: false, erro }, { status });
}

// Apaga sem deixar a resposta depender disso: um temporário que não sai (Windows segurando o arquivo
// por um instante, por exemplo) vai para o log — nunca vira um 500 de um envio que já deu certo ou já
// foi recusado com a frase certa.
async function apagarSemFalhar(caminho: string): Promise<void> {
  try {
    await fs.rm(caminho, { force: true });
  } catch (erro) {
    console.error("Falha ao apagar arquivo de envio de anexo:", erro);
  }
}

async function lerAmostra(caminho: string): Promise<Uint8Array> {
  const arquivo = await fs.open(caminho, "r");
  try {
    const amostra = new Uint8Array(TAMANHO_DA_AMOSTRA);
    const { bytesRead } = await arquivo.read(amostra, 0, TAMANHO_DA_AMOSTRA, 0);
    return amostra.subarray(0, bytesRead);
  } finally {
    await arquivo.close();
  }
}

// O nome com que a frase de tamanho do servidor chama o arquivo: o nome do anexo + a extensão do nome
// original (o servidor não recebe o nome do arquivo; a folha já mostrou a frase com ele antes da rede).
function nomeParaFrase(nome: string, extensao: string): string {
  return extensao === "" ? nome : `${nome}.${extensao}`;
}

export async function PUT(request: NextRequest) {
  // 1. Sessão ANTES de qualquer outra coisa. `exigirUsuario()` confere `ativo` no banco a cada chamada
  // (usuário desativado recebe 401 na requisição seguinte) e chama `redirect()` sem sessão — capturado
  // aqui para virar 401 JSON.
  let usuario: UsuarioAutorizado;
  try {
    usuario = await exigirUsuario();
  } catch {
    return recusar(401, FRASE_SESSAO_TERMINOU);
  }

  // 2. CSRF (Pitfall 8).
  if (
    !mesmaOrigem({
      origin: request.headers.get("origin"),
      host: request.headers.get("host"),
      forwardedHost: request.headers.get("x-forwarded-host"),
    })
  ) {
    return recusar(403, FRASE_ORIGEM_RECUSADA);
  }

  // 3. Metadados pela query, validados no servidor.
  const validacao = esquemaEnvioDeAnexo.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!validacao.success) {
    return recusar(400, validacao.error.issues[0]?.message ?? FRASE_FALHA_AO_ENVIAR);
  }
  const meta = validacao.data;

  // 4. Tamanho declarado: acima do limite → 413 sem ler um byte; zero ou sem corpo → arquivo vazio.
  const declarado = request.headers.get("content-length");
  if (declarado !== null) {
    const bytesDeclarados = Number(declarado);
    if (Number.isFinite(bytesDeclarados) && bytesDeclarados > LIMITE_DOCUMENTO_BYTES) {
      return recusar(
        413,
        fraseTamanhoDeDocumento(nomeParaFrase(meta.nome, meta.extensao), textoDoTamanho(bytesDeclarados)),
      );
    }
    if (bytesDeclarados === 0) {
      return recusar(400, FRASE_ARQUIVO_VAZIO);
    }
  }
  if (!request.body) {
    return recusar(400, FRASE_ARQUIVO_VAZIO);
  }

  // 5. O fornecedor existe e está ATIVO? Conferência barata, antes de gravar no disco.
  const situacao = await situacaoParaEnvio(meta.fornecedorId);
  if (situacao === "inexistente") {
    return recusar(404, FRASE_FICHA_NAO_EXISTE);
  }
  if (situacao === "desativado") {
    return recusar(409, FRASE_FORNECEDOR_DESATIVADO_NO_ENVIO);
  }

  // 6. O corpo em stream para um temporário NA MESMA PASTA dos anexos, contando os bytes.
  const diretorio = diretorioDeAnexos();
  const temporario = caminhoTemporario();
  let bytes = 0;
  const contador = new Transform({
    transform(pedaco: Buffer, _codificacao, feito) {
      bytes += pedaco.length;
      if (bytes > LIMITE_DOCUMENTO_BYTES) {
        feito(new LimiteExcedido());
        return;
      }
      feito(null, pedaco);
    },
  });

  try {
    try {
      await fs.mkdir(diretorio, { recursive: true });
      await pipeline(
        Readable.fromWeb(request.body as unknown as ReadableStreamDoNode<Uint8Array>),
        contador,
        createWriteStream(temporario, { flags: "wx" }),
      );
    } catch (erro) {
      if (erro instanceof LimiteExcedido) {
        return recusar(
          413,
          fraseTamanhoDeDocumento(
            nomeParaFrase(meta.nome, meta.extensao),
            `mais de ${textoDoTamanho(LIMITE_DOCUMENTO_BYTES)}`,
          ),
        );
      }
      console.error("Falha ao receber o arquivo de um anexo de fornecedor:", erro);
      return recusar(500, FRASE_FALHA_AO_ENVIAR);
    }

    if (bytes === 0) {
      return recusar(400, FRASE_ARQUIVO_VAZIO);
    }

    // 7. O tipo pela ASSINATURA, lendo do disco (um XLSX pode ter o `[Content_Types].xml` depois de
    // outras entradas do zip — o `file-type` lê o quanto precisar).
    const detectado = await tipoDeArquivo.fileTypeFromFile(temporario);
    const amostra = await lerAmostra(temporario);
    const classe = classificarArquivo({ detectado, extensaoDoNome: meta.extensao, amostra });
    if (!classe.ok) {
      return recusar(415, FRASE_TIPO_PELA_ASSINATURA);
    }

    // 8. Foto: o ramo dela (`tratarFotoDeAnexo` — reduzir a 2000 px, tirar o EXIF, HEIC; teto de 10 MiB)
    // é do plano 07, que SUBSTITUI este passo. Até lá, uma foto é recusada sem gravar nada — em momento
    // nenhum uma foto é guardada como veio.
    if (classe.tipo.familia === "foto") {
      return recusar(415, FRASE_TIPO_PELA_ASSINATURA);
    }
    const tipo = classe.tipo;

    // 9. Transação: trava o fornecedor (`for share` — um "desativar" concorrente espera) e confere que
    // continua ativo; cria o arquivo final (rename na mesma pasta — atômico, sem `EXDEV`); só ENTÃO
    // insere a linha. Qualquer falha depois de o final existir o apaga.
    const arquivoFinal = nomeDeArquivoNovo(tipo.extensao);
    const caminhoFinal = caminhoDoAnexo(arquivoFinal);
    let finalCriado = false;
    let idDoAnexo: string;
    try {
      idDoAnexo = await db.transaction(async (tx) => {
        const [fornecedor] = await tx
          .select({ ativo: fornecedores.ativo })
          .from(fornecedores)
          .where(eq(fornecedores.id, meta.fornecedorId))
          .for("share");
        if (!fornecedor) {
          throw new FornecedorSumiu();
        }
        if (!fornecedor.ativo) {
          throw new FornecedorDesativado();
        }

        await fs.rename(temporario, caminhoFinal);
        finalCriado = true;

        const [linha] = await tx
          .insert(fornecedorAnexos)
          .values({
            fornecedorId: meta.fornecedorId,
            nome: meta.nome,
            tipo: meta.tipo,
            valeDesde: meta.valeDesde,
            nota: meta.nota,
            arquivoCaminho: arquivoFinal,
            arquivoTipo: tipo.mime,
            arquivoBytes: bytes,
            extensao: tipo.extensao,
            criadoPor: usuario.id,
          })
          .returning({ id: fornecedorAnexos.id });
        return linha.id;
      });
    } catch (erro) {
      if (finalCriado) {
        await apagarSemFalhar(caminhoFinal);
      }
      if (erro instanceof FornecedorSumiu) {
        return recusar(404, FRASE_FICHA_NAO_EXISTE);
      }
      if (erro instanceof FornecedorDesativado) {
        return recusar(409, FRASE_FORNECEDOR_DESATIVADO_NO_ENVIO);
      }
      console.error("Falha ao gravar um anexo de fornecedor:", erro);
      return recusar(500, FRASE_FALHA_AO_ENVIAR);
    }

    // 10. A ficha mostra o anexo novo na próxima leitura.
    revalidatePath(rotaDeGestao("/cadastros"));
    return NextResponse.json({ ok: true, dados: { id: idDoAnexo } });
  } catch (erro) {
    console.error("Falha ao conferir um anexo de fornecedor:", erro);
    return recusar(500, FRASE_FALHA_AO_ENVIAR);
  } finally {
    // O temporário nunca fica para trás (depois do rename ele já não existe; `force` não reclama).
    await apagarSemFalhar(temporario);
  }
}
