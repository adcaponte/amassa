// A ÚNICA porta de SAÍDA do byte de um anexo de fornecedor (Fase 06.2, D-A01, FRN-09) — nunca uma
// pasta pública, nunca uma rota estática: o endereço é `/gestao/api/fornecedores/anexos/<id>` (não
// `/api/...`). Molde: `app/gestao/api/orcamentos/fotos/[id]/route.ts`. Esta rota continua DENTRO do
// `matcher` de `middleware.ts` (só o PUT exato de upload saiu — D-08), então o middleware já exige
// sessão; a checagem aqui é a defesa em profundidade.
//
// Três disciplinas de segurança, na ordem em que aparecem abaixo:
//   1. `exigirUsuario()` ANTES de qualquer consulta ao banco (T-06.2-16, T-06.2-21) — sem sessão, a
//      rota nem confirma se o identificador existe: o 401 é igual para id existente e inexistente.
//   2. O caminho do arquivo em disco NUNCA é montado a partir de texto da requisição (T-06.2-17) — o
//      identificador da URL só acha a LINHA no banco; `caminhoDoAnexo()` decide o caminho real a partir
//      do NOME que o próprio servidor gravou, e recusa qualquer formato fora de `<uuid>.<ext>`.
//   3. Nenhuma mensagem de erro cita caminho, nome de diretório ou erro do sistema operacional
//      (T-06.2-24) — as frases são fixas, em português.
//
// E duas diferenças do molde da foto: o arquivo sai em STREAM (um PDF de 20 MB não passa inteiro pela
// memória — nunca o arquivo inteiro num buffer), e os cabeçalhos protegem contra arquivo disfarçado (T-06.2-18): o
// `Content-Type` é o que o SERVIDOR decidiu no envio (do banco), `nosniff`, e planilha/CSV sempre
// `attachment`.
import { createReadStream, promises as fs } from "node:fs";
import { Readable } from "node:stream";

import { NextResponse, type NextRequest } from "next/server";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { disposicao, ehAbertoNaAba } from "@/lib/fornecedores/cabecalhos";
import { caminhoDoAnexo } from "@/lib/fornecedores/caminho-anexos";
import { obterAnexoParaLeitura } from "@/lib/fornecedores/consultas";
import {
  FRASE_ANEXO_NAO_ENCONTRADO,
  FRASE_ARQUIVO_SUMIU,
  FRASE_NAO_AUTORIZADO,
  FRASE_NAO_DEU_PARA_LER_ANEXO,
} from "@/lib/fornecedores/textos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Um identificador bem formado (uuid), conferido ANTES de qualquer consulta — o `id` da LINHA em
// `fornecedor_anexos`, sem extensão (nunca a regra de `caminhoDoAnexo()`, que valida o nome do ARQUIVO).
const IDENTIFICADOR_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ehArquivoAusente(erro: unknown): boolean {
  return typeof erro === "object" && erro !== null && "code" in erro && erro.code === "ENOENT";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Sessão exigida ANTES de qualquer consulta. `exigirUsuario()` chama `redirect()` sem sessão —
  // capturado aqui para virar 401 JSON com o MESMO corpo que o middleware devolve.
  try {
    await exigirUsuario();
  } catch {
    return NextResponse.json({ erro: FRASE_NAO_AUTORIZADO }, { status: 401 });
  }

  const { id } = await params;
  if (!IDENTIFICADOR_VALIDO.test(id)) {
    return NextResponse.json({ erro: FRASE_ANEXO_NAO_ENCONTRADO }, { status: 404 });
  }

  const anexo = await obterAnexoParaLeitura(id);
  if (!anexo) {
    return NextResponse.json({ erro: FRASE_ANEXO_NAO_ENCONTRADO }, { status: 404 });
  }

  let caminho: string;
  let tamanho: number;
  try {
    // 2. `caminhoDoAnexo()` é a ÚNICA porta de montagem de caminho — recebe o nome gravado pelo
    // servidor e recusa qualquer formato fora do esperado.
    caminho = caminhoDoAnexo(anexo.arquivoCaminho);
    // O `stat` ANTES de abrir: o arquivo pode ter sumido (restauração parcial do backup) — isso é um
    // 404 com frase própria, não um 500. O tamanho do `Content-Length` é o do disco.
    tamanho = (await fs.stat(caminho)).size;
  } catch (erro) {
    if (ehArquivoAusente(erro)) {
      return NextResponse.json({ erro: FRASE_ARQUIVO_SUMIU }, { status: 404 });
    }
    // 3. Nunca o caminho, nunca a mensagem do sistema operacional, nunca o `stack`.
    console.error("Falha ao abrir arquivo de anexo de fornecedor:", erro);
    return NextResponse.json({ erro: FRASE_NAO_DEU_PARA_LER_ANEXO }, { status: 500 });
  }

  const corpo = Readable.toWeb(createReadStream(caminho)) as unknown as ReadableStream<Uint8Array>;
  return new NextResponse(corpo, {
    status: 200,
    headers: {
      "Content-Type": anexo.arquivoTipo,
      "Content-Length": String(tamanho),
      "Content-Disposition": disposicao({
        nome: anexo.nome,
        extensao: anexo.extensao,
        inline: ehAbertoNaAba(anexo.extensao),
      }),
      "X-Content-Type-Options": "nosniff",
      // Arquivo de fornecedor atrás de sessão: nenhum proxy guarda, nem o navegador.
      "Cache-Control": "private, no-store",
    },
  });
}
