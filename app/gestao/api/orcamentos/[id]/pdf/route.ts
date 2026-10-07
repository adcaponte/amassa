// GET /api/orcamentos/[id]/pdf — gera o PDF do orçamento NO SERVIDOR (D-29), atrás de sessão
// (T-04.5-54). Mesma disciplina de `app/api/orcamentos/fotos/[id]/route.ts`:
//   1. `exigirUsuario()` ANTES de qualquer consulta ao banco — sem sessão, a rota nem confirma
//      se o orçamento existe.
//   2. O caminho de cada foto em disco NUNCA é montado a partir de texto da requisição —
//      `caminhoDaFoto()` (plano 03) é quem decide, a partir do NOME que o próprio servidor
//      gravou.
//   3. Nenhuma mensagem de erro cita caminho de arquivo, nome de diretório, `stack` ou texto de
//      erro do sistema operacional — as frases de recusa são fixas, em português.
//
// `createElement` no lugar de JSX (arquivo `.ts`, não `.tsx`): uma rota de API não precisa de
// JSX para o próprio corpo da resposta, só para montar o elemento que `renderToBuffer` consome.
import { promises as fs } from "node:fs";
import { createElement } from "react";

import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse, type NextRequest } from "next/server";

import { ehFaltaDeSessao, exigirUsuario } from "@/lib/auth/exigir-usuario";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { caminhoDaFoto } from "@/lib/orcamentos/caminho-fotos";
import { listarFotosParaPdf, obterOrcamentoParaEdicao } from "@/lib/orcamentos/consultas";
import { montarDocumentoDoCliente } from "@/lib/orcamentos/documento-cliente";
import { numeroDeOrcamento } from "@/lib/orcamentos/formato";
import { DocumentoOrcamentoPdf } from "@/lib/orcamentos/pdf/documento";
import { registrarFontesDoPdf } from "@/lib/orcamentos/pdf/fontes";
import { logoDoDocumento } from "@/lib/orcamentos/pdf/logo";
import {
  FRASE_NAO_AUTORIZADO,
  FRASE_NAO_DEU_PARA_GERAR_PDF_NO_SERVIDOR,
  FRASE_ORCAMENTO_NAO_ENCONTRADO_PARA_PDF,
  FRASE_PDF_NAO_SAIU,
} from "@/lib/orcamentos/textos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// O mesmo formato de identificador que `app/api/orcamentos/fotos/[id]/route.ts` já usa — o
// parâmetro da rota é o `id` do ORÇAMENTO, sem extensão.
const IDENTIFICADOR_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Sessão exigida ANTES de qualquer consulta. `exigirUsuario()` chama `redirect()` do
  // Next.js quando não há sessão — capturado aqui de propósito para virar um 401 com corpo em
  // português, nunca um redirect (que o `fetch()` de `BaixarPdf` trataria como sucesso 200).
  // 06.5-19 (D-20): só a FALTA DE SESSÃO é 401. Outra falha ao conferir (o banco fora, `auth()`
  // lançando) é do servidor — 500 com frase, detalhe só no log; nunca "Não autorizado." (o mesmo
  // molde de `app/gestao/api/fornecedores/anexos/[id]/route.ts`, quick 261005-2yu).
  try {
    await exigirUsuario();
  } catch (erro) {
    if (ehFaltaDeSessao(erro)) {
      return NextResponse.json({ erro: FRASE_NAO_AUTORIZADO }, { status: 401 });
    }
    console.error("Falha ao conferir a sessão no PDF do orçamento:", erro);
    return NextResponse.json({ erro: FRASE_PDF_NAO_SAIU }, { status: 500 });
  }

  const { id } = await params;
  if (!IDENTIFICADOR_VALIDO.test(id)) {
    return NextResponse.json({ erro: FRASE_ORCAMENTO_NAO_ENCONTRADO_PARA_PDF }, { status: 404 });
  }

  const orcamento = await obterOrcamentoParaEdicao(id);
  if (!orcamento) {
    return NextResponse.json({ erro: FRASE_ORCAMENTO_NAO_ENCONTRADO_PARA_PDF }, { status: 404 });
  }

  try {
    const fotos = await listarFotosParaPdf(id);

    // A MESMA estrutura que a tela "Ver como o cliente vê" monta (ver
    // `components/amassa/orcamentos/editor-orcamento.tsx`) — os mesmos dados crus, a mesma
    // função, o mesmo resultado. Nenhuma segunda montagem.
    const documento = montarDocumentoDoCliente(
      {
        status: orcamento.status,
        ano: orcamento.ano,
        sequencial: orcamento.sequencial,
        revisao: orcamento.revisao,
        clienteNome: orcamento.clienteNome,
        titulo: orcamento.titulo,
        data: orcamento.data,
        validadeDias: orcamento.validadeDias,
        entregaPrevista: orcamento.entregaPrevista,
        observacoes: orcamento.observacoes,
        plano: orcamento.plano,
        sinalPercentual: orcamento.sinalPercentual,
        freteCentavos: orcamento.freteCentavos,
        snapshot: orcamento.snapshot,
      },
      orcamento.linhas.map((linha) => ({
        nomeDaFicha: linha.ficha.nome,
        cor: linha.cor,
        personalizacao: linha.personalizacao,
        quantidade: linha.quantidade,
        precoUnitarioCentavos: linha.precoUnitarioCentavos,
      })),
      orcamento.custosDeProjeto.map((custo) => ({
        descricao: custo.descricao,
        valorCentavos: custo.valorCentavos,
      })),
      fotos.map((foto) => ({ id: foto.id, legenda: foto.legenda })),
      hojeEmBrasilia(new Date()),
    );

    // Registra a fonte uma vez por processo (idempotente) — sem isto, os acentos saem errados
    // (ver o comentário de `lib/orcamentos/pdf/fontes.ts`).
    registrarFontesDoPdf();

    const [logo, fotosComBytes] = await Promise.all([
      logoDoDocumento(),
      Promise.all(
        fotos.map(async (foto) => ({
          id: foto.id,
          buffer: await fs.readFile(caminhoDaFoto(foto.arquivo)),
        })),
      ),
    ]);

    // `createElement` (não JSX — arquivo `.ts`) monta o elemento; o cast é só de TIPO —
    // `renderToBuffer` exige um `ReactElement<DocumentProps>` no seu tipo público, mas aceita
    // (e o próprio pacote recomenda) qualquer componente cuja raiz seja um `<Document>`, como
    // `DocumentoOrcamentoPdf`.
    const elementoDoDocumento = createElement(DocumentoOrcamentoPdf, {
      documento,
      logo,
      fotos: fotosComBytes,
    }) as Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(elementoDoDocumento);

    const numero = numeroDeOrcamento(orcamento.ano, orcamento.sequencial);
    const sufixoRevisao = orcamento.revisao > 1 ? `-rev${orcamento.revisao}` : "";
    const nomeDoArquivo = `${numero}${sufixoRevisao}.pdf`;

    // `new Uint8Array(buffer)`: o `Buffer` que `renderToBuffer` devolve tipa como
    // `Buffer<ArrayBufferLike>` (o Buffer genérico do @types/node recente), que o `BodyInit` do
    // DOM não reconhece estruturalmente por causa do parâmetro genérico — a CÓPIA de view
    // (nenhum byte realocado) resolve o tipo sem mudar o conteúdo.
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nomeDoArquivo}"`,
      },
    });
  } catch (erro) {
    // 3. Nunca o caminho do arquivo, nunca a mensagem do sistema operacional, nunca o `stack`.
    console.error("Falha ao gerar PDF de orçamento:", erro);
    return NextResponse.json({ erro: FRASE_NAO_DEU_PARA_GERAR_PDF_NO_SERVIDOR }, { status: 500 });
  }
}
