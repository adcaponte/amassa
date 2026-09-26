// A ÚNICA porta que serve o BYTE de uma foto de orçamento (D-27, ORC-15) — nunca uma pasta
// pública, nunca uma rota estática. `/api/orcamentos` NÃO está em `lib/auth/rotas-publicas.ts`,
// então o middleware já exigiria sessão de qualquer forma; a checagem aqui é a defesa em
// profundidade (a rota nunca confia só no middleware) e é o que devolve um corpo em português
// em vez de um redirect, que quebraria uma tag `<img>`.
//
// Três disciplinas de segurança, na ordem em que aparecem abaixo (mesmo espírito de
// `app/api/health/backup/route.ts`):
//   1. `exigirUsuario()` ANTES de qualquer consulta ao banco (T-04.5-48) — sem sessão, a rota
//      nem confirma se o identificador existe: 401 é indistinguível de "não existe" para quem
//      não está logado.
//   2. O caminho do arquivo em disco NUNCA é montado a partir de texto da requisição
//      (T-04.5-47) — o identificador da URL só serve para achar a LINHA no banco;
//      `caminhoDaFoto()` (plano 03) é quem decide o caminho real, a partir do NOME que o
//      próprio servidor gravou, e recusa qualquer formato diferente de um UUID + ".jpg".
//   3. Nenhuma mensagem de erro cita caminho de arquivo, nome de diretório ou texto de erro do
//      sistema operacional (T-04.5-50) — as três frases de recusa são fixas, em português.
import { promises as fs } from "node:fs";

import { NextResponse, type NextRequest } from "next/server";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { caminhoDaFoto } from "@/lib/orcamentos/caminho-fotos";
import { obterFotoParaLeitura } from "@/lib/orcamentos/consultas";
import {
  FRASE_FOTO_NAO_ENCONTRADA,
  FRASE_NAO_AUTORIZADO,
  FRASE_NAO_DEU_PARA_LER_FOTO,
} from "@/lib/orcamentos/textos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Um identificador bem formado (uuid), conferido ANTES de qualquer consulta — nunca a mesma
// regra de `caminhoDaFoto()` (que valida o NOME do ARQUIVO, "<uuid>.jpg"): aqui o parâmetro da
// rota é o `id` da LINHA em `orcamento_fotos`, sem extensão.
const IDENTIFICADOR_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Sessão exigida ANTES de qualquer consulta. `exigirUsuario()` chama `redirect()` do
  // Next.js quando não há sessão — capturado aqui de propósito para virar um 401 com corpo em
  // português, nunca um redirect (que uma tag `<img>` não consegue seguir de forma útil).
  try {
    await exigirUsuario();
  } catch {
    return NextResponse.json({ erro: FRASE_NAO_AUTORIZADO }, { status: 401 });
  }

  const { id } = await params;
  if (!IDENTIFICADOR_VALIDO.test(id)) {
    return NextResponse.json({ erro: FRASE_FOTO_NAO_ENCONTRADA }, { status: 404 });
  }

  const foto = await obterFotoParaLeitura(id);
  if (!foto) {
    return NextResponse.json({ erro: FRASE_FOTO_NAO_ENCONTRADA }, { status: 404 });
  }

  try {
    // 2. `caminhoDaFoto()` é a ÚNICA porta de montagem de caminho — recebe o NOME gravado pelo
    // servidor (nunca texto da requisição) e recusa qualquer formato fora do esperado.
    const buffer = await fs.readFile(caminhoDaFoto(foto.arquivo));

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        // "private": foto de cliente, atrás de sessão — nunca cacheável por um proxy
        // compartilhado. Só o navegador de quem está logado guarda cópia.
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (erro) {
    // 3. Nunca o caminho do arquivo, nunca a mensagem do sistema operacional, nunca o `stack`.
    console.error("Falha ao ler arquivo de foto de orçamento:", erro);
    return NextResponse.json({ erro: FRASE_NAO_DEU_PARA_LER_FOTO }, { status: 500 });
  }
}
