"use client";

import { useRef, useState } from "react";
import Link from "next/link";

import { criarOrcamento } from "@/lib/orcamentos/acoes";
import {
  FRASE_NADA_SALVO_ATE_PREENCHER,
  PLACEHOLDER_TITULO_DO_PEDIDO,
  ROTULO_CLIENTE,
  ROTULO_TITULO_DO_PEDIDO,
  ROTULO_TODOS,
  TITULO_ORCAMENTO_NOVO,
} from "@/lib/orcamentos/textos";
import { hrefDoOrcamento } from "@/lib/financeiro/navegacao";

type Campo = "cliente" | "titulo";

const CLASSE_DO_CAMPO =
  "border-border text-corpo md:text-corpo min-h-[44px] rounded-md border px-2";

// O orçamento novo, ainda sem registro (06.5-14, D-15; 06.5-UI-SPEC.md §Estados). Só Cliente e
// Título: as peças, as fotos e o resto precisam de um orçamento que exista. Ao sair do primeiro
// campo com valor, `criarOrcamento` grava o rascunho JÁ com esse campo (e com o outro, se também
// tiver valor) e o número; a tela vai para o editor de hoje. Sair sem preencher nada não cria
// nada nem diz nada.
//
// A ida para o editor é navegação COMPLETA (`window.location.replace`), não `router.replace`: é a
// disciplina do módulo depois de uma Server Action (o defeito de agendamento do React/Next de
// `.planning/PROXIMA-SESSAO.md`, "Fase 4.2 ensinou"). `replace`, e não `assign`, para o "voltar"
// do navegador cair na lista, não de novo no orçamento vazio.
export function OrcamentoNovo() {
  const [clienteTexto, setClienteTexto] = useState("");
  const [tituloTexto, setTituloTexto] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<{ campo: Campo; mensagem: string } | null>(null);
  // Trava de reentrada (T-06.5-38): dois `onBlur` seguidos nunca criam dois rascunhos.
  const travado = useRef(false);

  async function criarSeTiverValor(campo: Campo) {
    if (travado.current) {
      return;
    }
    if (clienteTexto.trim() === "" && tituloTexto.trim() === "") {
      return;
    }
    travado.current = true;
    setCriando(true);
    setErro(null);

    const resposta = await criarOrcamento({ clienteTexto, tituloTexto });

    if (!resposta.ok) {
      travado.current = false;
      setCriando(false);
      setErro({ campo, mensagem: resposta.erro });
      return;
    }

    window.location.replace(hrefDoOrcamento(resposta.dados.id));
  }

  function alertaDo(campo: Campo) {
    if (erro?.campo !== campo) {
      return null;
    }
    return (
      <p
        id={`orcamento-novo-erro-${campo}`}
        role="alert"
        className="text-apoio text-destructive"
      >
        {erro.mensagem}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/gestao/financeiro?aba=orcamentos"
          className="text-corpo hover:bg-muted flex min-h-[44px] items-center rounded-md px-3"
        >
          {ROTULO_TODOS}
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-titulo text-foreground">{TITULO_ORCAMENTO_NOVO}</h2>
        <p data-testid="orcamento-nao-salvo" className="text-apoio text-muted-foreground">
          {FRASE_NADA_SALVO_ATE_PREENCHER}
        </p>
      </div>

      {/* A mesma coluna da esquerda do editor (breakpoint único em 980px), para o campo não pular de
        lugar quando o editor de hoje carregar. */}
      <div className="grid grid-cols-1 items-start gap-4 min-[980px]:grid-cols-[1.15fr_1fr]">
        <section className="border-border flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-1 flex-col gap-1" style={{ minWidth: 140 }}>
              <label className="text-apoio text-muted-foreground flex flex-col gap-1">
                {ROTULO_CLIENTE}
                <input
                  data-testid="orcamento-campo-cliente"
                  value={clienteTexto}
                  disabled={criando}
                  aria-invalid={erro?.campo === "cliente" ? true : undefined}
                  aria-describedby={
                    erro?.campo === "cliente" ? "orcamento-novo-erro-cliente" : undefined
                  }
                  onChange={(evento) => setClienteTexto(evento.target.value)}
                  onBlur={() => void criarSeTiverValor("cliente")}
                  className={CLASSE_DO_CAMPO}
                />
              </label>
              {alertaDo("cliente")}
            </div>
            <div className="flex flex-1 flex-col gap-1" style={{ minWidth: 140 }}>
              <label className="text-apoio text-muted-foreground flex flex-col gap-1">
                {ROTULO_TITULO_DO_PEDIDO}
                <input
                  data-testid="orcamento-campo-titulo"
                  placeholder={PLACEHOLDER_TITULO_DO_PEDIDO}
                  value={tituloTexto}
                  disabled={criando}
                  aria-invalid={erro?.campo === "titulo" ? true : undefined}
                  aria-describedby={
                    erro?.campo === "titulo" ? "orcamento-novo-erro-titulo" : undefined
                  }
                  onChange={(evento) => setTituloTexto(evento.target.value)}
                  onBlur={() => void criarSeTiverValor("titulo")}
                  className={CLASSE_DO_CAMPO}
                />
              </label>
              {alertaDo("titulo")}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
