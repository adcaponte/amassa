// A ÚNICA porta de SAÍDA do byte de um anexo de fornecedor (Fase 06.2, D-A01, FRN-09) — nunca uma
// pasta pública, nunca uma rota estática: o endereço é `/gestao/api/fornecedores/anexos/<id>` (não
// `/api/...`). Molde: `app/gestao/api/orcamentos/fotos/[id]/route.ts`. Esta rota continua DENTRO do
// `matcher` de `middleware.ts` (só o PUT exato de upload saiu — D-08), então o middleware já exige
// sessão; a checagem aqui é a defesa em profundidade.
//
// Três disciplinas de segurança, na ordem em que aparecem abaixo:
//   1. `exigirUsuario()` ANTES de qualquer consulta ao banco (T-06.2-16, T-06.2-21) — sem sessão, a
//      rota nem confirma se o identificador existe: a recusa é igual para id existente e inexistente.
//      Só a falta de sessão (`ehFaltaDeSessao`) é "sem sessão"; outra falha ao conferir (banco fora) é
//      um 500 (06.2-WR-01, quick 261005-2yu).
//   2. O caminho do arquivo em disco NUNCA é montado a partir de texto da requisição (T-06.2-17) — o
//      identificador da URL só acha a LINHA no banco; `caminhoDoAnexo()` decide o caminho real a partir
//      do NOME que o próprio servidor gravou, e recusa qualquer formato fora de `<uuid>.<ext>`.
//   3. Nenhuma mensagem de erro cita caminho, nome de diretório ou erro do sistema operacional
//      (T-06.2-24) — as frases são fixas, em português.
//
// Dois formatos de erro (06.2-WR-02, quick 261005-2yu, 05/10/2026): os links "Baixar"/"Abrir" da ficha
// NAVEGAM até aqui, e uma navegação nunca pode terminar no JSON cru na aba. Em NAVEGAÇÃO
// (`ehNavegacao`), todo erro vira 303 com `Location` RELATIVO — de volta à ficha do fornecedor com um
// aviso de erro (`destinoDoAvisoDeAnexo`), ou ao login sem sessão. Fora de navegação (`fetch`, `<img>`,
// `request` dos testes), exatamente o JSON e o status de antes. Nunca `NextResponse.redirect` com URL
// montada de `request.url` (atrás do Caddy ela pode sair `0.0.0.0:3000`).
//
// E duas diferenças do molde da foto: o arquivo sai em STREAM (um PDF de 20 MB não passa inteiro pela
// memória — nunca o arquivo inteiro num buffer), e os cabeçalhos protegem contra arquivo disfarçado (T-06.2-18): o
// `Content-Type` é o que o SERVIDOR decidiu no envio (do banco), `nosniff`, e planilha/CSV sempre
// `attachment`.
import { createReadStream, promises as fs } from "node:fs";
import { Readable } from "node:stream";

import { NextResponse, type NextRequest } from "next/server";

import { ehFaltaDeSessao, exigirUsuario } from "@/lib/auth/exigir-usuario";
import {
  destinoDoAvisoDeAnexo,
  disposicao,
  ehAbertoNaAba,
  type AvisoDeAnexo,
} from "@/lib/fornecedores/cabecalhos";
import { caminhoDoAnexo } from "@/lib/fornecedores/caminho-anexos";
import { obterAnexoParaLeitura, type AnexoParaLeitura } from "@/lib/fornecedores/consultas";
import {
  FRASE_ANEXO_NAO_ENCONTRADO,
  FRASE_ARQUIVO_SUMIU,
  FRASE_NAO_AUTORIZADO,
  FRASE_NAO_DEU_PARA_LER_ANEXO,
} from "@/lib/fornecedores/textos";
import { ehNavegacao } from "@/lib/rotas/gestao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Um identificador bem formado (uuid), conferido ANTES de qualquer consulta — o `id` da LINHA em
// `fornecedor_anexos`, sem extensão (nunca a regra de `caminhoDoAnexo()`, que valida o nome do ARQUIVO).
const IDENTIFICADOR_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DESTINO_SEM_SESSAO = "/gestao/login?sessao=encerrada";

function ehArquivoAusente(erro: unknown): boolean {
  return typeof erro === "object" && erro !== null && "code" in erro && erro.code === "ENOENT";
}

// 303 com `Location` relativo e fixo (T-2yu-02): o destino nunca carrega texto da requisição além de um
// uuid validado.
function redirecionar(destino: string): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: destino, "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Ler cabeçalho não é ler o banco: `exigirUsuario()` continua antes de qualquer consulta.
  const navegacao = ehNavegacao(request.headers);
  const referer = request.headers.get("referer");

  // Um erro desta rota: em navegação, de volta à ficha com o aviso; fora dela, o JSON de sempre.
  function erroDoAnexo(
    aviso: AvisoDeAnexo,
    fornecedorId: string | null,
    status: number,
    frase: string,
  ): NextResponse {
    if (navegacao) {
      return redirecionar(destinoDoAvisoDeAnexo({ aviso, fornecedorId, referer }));
    }
    return NextResponse.json({ erro: frase }, { status });
  }

  // 1. Sessão exigida ANTES de qualquer consulta. `exigirUsuario()` chama `redirect()` sem sessão —
  // capturado aqui para virar 401 JSON com o MESMO corpo que o middleware devolve (ou, em navegação, o
  // login). Outra falha ao conferir é do servidor, não "não autorizado" (06.2-WR-01).
  try {
    await exigirUsuario();
  } catch (erro) {
    if (ehFaltaDeSessao(erro)) {
      return navegacao
        ? redirecionar(DESTINO_SEM_SESSAO)
        : NextResponse.json({ erro: FRASE_NAO_AUTORIZADO }, { status: 401 });
    }
    console.error("Falha ao conferir a sessão na leitura de um anexo de fornecedor:", erro);
    return erroDoAnexo("anexo-nao-abriu", null, 500, FRASE_NAO_DEU_PARA_LER_ANEXO);
  }

  const { id } = await params;
  if (!IDENTIFICADOR_VALIDO.test(id)) {
    return erroDoAnexo("anexo-nao-encontrado", null, 404, FRASE_ANEXO_NAO_ENCONTRADO);
  }

  let anexo: AnexoParaLeitura | null;
  try {
    anexo = await obterAnexoParaLeitura(id);
  } catch (erro) {
    console.error("Falha ao ler a linha de um anexo de fornecedor:", erro);
    return erroDoAnexo("anexo-nao-abriu", null, 500, FRASE_NAO_DEU_PARA_LER_ANEXO);
  }
  if (!anexo) {
    return erroDoAnexo("anexo-nao-encontrado", null, 404, FRASE_ANEXO_NAO_ENCONTRADO);
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
      return erroDoAnexo("anexo-sumiu", anexo.fornecedorId, 404, FRASE_ARQUIVO_SUMIU);
    }
    // 3. Nunca o caminho, nunca a mensagem do sistema operacional, nunca o `stack`.
    console.error("Falha ao abrir arquivo de anexo de fornecedor:", erro);
    return erroDoAnexo("anexo-nao-abriu", anexo.fornecedorId, 500, FRASE_NAO_DEU_PARA_LER_ANEXO);
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
