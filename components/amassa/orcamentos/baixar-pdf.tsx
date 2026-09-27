"use client";

// "Baixar PDF" (04.5-UI-SPEC.md §"PDF do cliente — geração no servidor"): busca o arquivo por
// `fetch` + `blob` e dispara o download só no sucesso — NUNCA um `<a href>` direto. Um endereço
// de download direto faria um erro do servidor aparecer como página de erro do navegador; com
// `fetch`, o mesmo erro vira a frase em português desta tela, e a pré-visualização por baixo
// continua visível e utilizável durante a espera (ponto 1 do contrato de interação).
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  FRASE_ERRO_GERAR_PDF,
  ROTULO_BAIXAR_PDF,
  ROTULO_GERANDO_PDF,
} from "@/lib/orcamentos/textos";

export type BaixarPdfProps = {
  orcamentoId: string;
};

const PADRAO_NOME_DE_ARQUIVO = /filename="([^"]+)"/;

function nomeDoArquivoDoCabecalho(cabecalho: string | null): string | null {
  if (!cabecalho) return null;
  return PADRAO_NOME_DE_ARQUIVO.exec(cabecalho)?.[1] ?? null;
}

export function BaixarPdf({ orcamentoId }: BaixarPdfProps) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aoClicarBaixar() {
    setGerando(true);
    setErro(null);

    try {
      const resposta = await fetch(`/api/orcamentos/${orcamentoId}/pdf`);
      if (!resposta.ok) {
        setErro(FRASE_ERRO_GERAR_PDF);
        return;
      }

      const blob = await resposta.blob();
      const nomeDoArquivo = nomeDoArquivoDoCabecalho(resposta.headers.get("Content-Disposition")) ?? "orcamento.pdf";

      // Download programático — nunca navegação. O objeto URL é revogado logo em seguida; o
      // `<a>` nunca entra na árvore visível (criado, clicado e removido no mesmo instante).
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeDoArquivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErro(FRASE_ERRO_GERAR_PDF);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        data-testid="baixar-pdf"
        disabled={gerando}
        onClick={() => void aoClicarBaixar()}
        className="min-h-[44px]"
      >
        {gerando ? (
          <>
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            {ROTULO_GERANDO_PDF}
          </>
        ) : (
          ROTULO_BAIXAR_PDF
        )}
      </Button>
      {erro ? (
        <p data-testid="pdf-erro" role="alert" aria-live="assertive" className="text-apoio text-destructive">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
