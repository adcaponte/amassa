"use client";

import { useEffect, useRef, useState } from "react";

import { criarCategoriaDeCotacao, renomearCategoriaDeCotacao } from "@/lib/cotacoes/acoes";
import type { CategoriaDeCotacao } from "@/lib/cotacoes/consultas";
import { esquemaCategoriaBase } from "@/lib/cotacoes/esquemas";
import {
  ROTULO_CANCELAR,
  ROTULO_CRIAR_CATEGORIA,
  ROTULO_EXCLUIR_CATEGORIA,
  ROTULO_SALVAR_CATEGORIA,
  TITULO_DIALOGO_EDITAR_CATEGORIA,
  TITULO_DIALOGO_NOVA_CATEGORIA,
} from "@/lib/cotacoes/textos";
import {
  useCategoriaDialogoAberta,
  useCategoriaParaEditarLocal,
} from "@/components/amassa/cotacoes/contexto-cotacoes";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type DialogoCategoriaProps = {
  // A linha da categoria em edição, buscada pela PÁGINA (`obterCategoriaDeCotacao`) — vale
  // quando a navegação já É uma navegação completa com `?categoriaDialogo=<id>` desde o início
  // (ex.: link compartilhado, recarregar a página). `null` no modo de criação
  // (`?categoriaDialogo=nova`) OU quando o identificador não corresponde a nenhuma categoria
  // (removida por outra pessoa; o campo simplesmente abre vazio, em vez de quebrar a página).
  categoriaParaEditar: CategoriaDeCotacao | null;
};

// Diálogo pequeno de D-14 (<10s): um único campo, um botão — e, em modo de renomear (D-15), o
// MESMO componente com o título e o rótulo do botão trocados e o campo pré-preenchido (nunca uma
// segunda cópia do formulário). Aberto por `?categoriaDialogo=<sentinela "nova" ou identificador>`
// via `history.pushState` (D-23) — montado SEMPRE (mesmo com a lista de categorias vazia), para
// o botão do estado vazio "+ Nova categoria" abrir este mesmo diálogo (achado do 03-06,
// replicado em toda esta base).
export function DialogoCategoria({ categoriaParaEditar: categoriaDoServidor }: DialogoCategoriaProps) {
  const categoriaDialogoAberta = useCategoriaDialogoAberta();
  const aberto = categoriaDialogoAberta !== null;
  const modoEdicao = categoriaDialogoAberta !== null && categoriaDialogoAberta !== "nova";

  // O local vence enquanto existir — abrir por `history.pushState` (D-23) não busca dado novo do
  // servidor, então sem ele o campo abriria vazio no primeiro toque (mesma disciplina de
  // `formulario-cotacao.tsx`/`useCotacaoParaEditarLocal`).
  const categoriaLocal = useCategoriaParaEditarLocal();
  const categoriaParaEditar = categoriaLocal ?? categoriaDoServidor;

  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) {
      setNome(modoEdicao ? (categoriaParaEditar?.nome ?? "") : "");
      setErro(null);
      // Foco automático (D-14) — depois de o diálogo montar de verdade.
      const idDoTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(idDoTimer);
    }
  }, [aberto, modoEdicao, categoriaParaEditar]);

  function fechar() {
    setErro(null);
    // Devolve a URL de onde o diálogo foi aberto, só removendo o próprio parâmetro do diálogo —
    // nunca uma URL fixa, que perderia a categoria já selecionada antes de abrir "+ Nova
    // categoria".
    const parametros = new URLSearchParams(window.location.search);
    parametros.delete("categoriaDialogo");
    const query = parametros.toString();
    irParaSemNavegar(`/abertura${query ? `?${query}` : ""}`);
  }

  // O botão de perigo só ABRE a confirmação (`ConfirmarRemoverCategoria`, Tarefa 2) — quem
  // remove é ela, nunca este diálogo. Troca `categoriaDialogo` por `categoriaRemover` na URL: os
  // dois diálogos (`Dialog` e `AlertDialog`) nunca ficam abertos ao mesmo tempo — o mesmo
  // cuidado de "nunca `Dialog` + `Sheet` simultâneos" (UI-SPEC), aplicado aqui a `Dialog` +
  // `AlertDialog`, sequencial em vez de aninhado.
  function abrirConfirmarRemocao() {
    if (!modoEdicao || !categoriaDialogoAberta) {
      return;
    }
    const parametros = new URLSearchParams(window.location.search);
    parametros.delete("categoriaDialogo");
    parametros.set("categoriaRemover", categoriaDialogoAberta);
    irParaSemNavegar(`/abertura?${parametros.toString()}`);
  }

  async function salvar() {
    if (enviando) {
      return;
    }
    setErro(null);

    const validado = esquemaCategoriaBase.safeParse({ nome });
    if (!validado.success) {
      setErro(validado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.");
      return;
    }

    setEnviando(true);
    const resposta =
      modoEdicao && categoriaDialogoAberta
        ? await renomearCategoriaDeCotacao({ id: categoriaDialogoAberta, ...validado.data })
        : await criarCategoriaDeCotacao(validado.data);
    setEnviando(false);

    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }

    // Navegação COMPLETA (D-23): abrir/fechar é `history.pushState`, mas GRAVAR termina em
    // `window.location.assign` — só o servidor sabe o identificador (criação) ou o nome
    // atualizado (renomeio) que valem a partir de agora.
    window.location.assign(`/abertura?aba=cotacoes&categoria=${resposta.dados.id}`);
  }

  const titulo = modoEdicao ? TITULO_DIALOGO_EDITAR_CATEGORIA : TITULO_DIALOGO_NOVA_CATEGORIA;

  return (
    <Dialog open={aberto} onOpenChange={(novoValor) => !novoValor && fechar()}>
      <DialogContent aria-label={titulo} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-titulo">{titulo}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            void salvar();
          }}
          className="flex flex-col gap-4"
        >
          {erro && (
            <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
              {erro}
            </p>
          )}

          <Field data-invalid={!!erro}>
            <FieldLabel htmlFor="nome-categoria">Nome</FieldLabel>
            <Input
              id="nome-categoria"
              ref={inputRef}
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              placeholder="Fornos"
              className="text-corpo md:text-corpo min-h-[44px]"
            />
          </Field>

          {/* Rodapé preso por FLEX, nunca `position: sticky` (D-24) — irmão da área de campos,
              não filho dela; neste diálogo pequeno os dois cabem sem rolagem própria. O botão de
              perigo fica SEPARADO de Cancelar/Salvar (UI-SPEC §"Sub-abas de categoria"), só no
              modo de renomear. */}
          <div className={modoEdicao ? "flex items-center justify-between gap-3" : "flex justify-end gap-3"}>
            {modoEdicao && (
              <button
                type="button"
                onClick={abrirConfirmarRemocao}
                className="text-corpo text-destructive hover:bg-destructive/10 flex min-h-[44px] items-center rounded-md px-3 font-medium"
              >
                {ROTULO_EXCLUIR_CATEGORIA}
              </button>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={fechar}
                className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4"
              >
                {ROTULO_CANCELAR}
              </button>
              <button
                type="submit"
                disabled={enviando}
                aria-busy={enviando}
                className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviando
                  ? "Salvando…"
                  : modoEdicao
                    ? ROTULO_SALVAR_CATEGORIA
                    : ROTULO_CRIAR_CATEGORIA}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
