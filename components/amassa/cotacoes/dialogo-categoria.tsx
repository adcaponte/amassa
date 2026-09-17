"use client";

import { useEffect, useRef, useState } from "react";

import { criarCategoriaDeCotacao } from "@/lib/cotacoes/acoes";
import { esquemaCategoriaBase } from "@/lib/cotacoes/esquemas";
import {
  ROTULO_CANCELAR,
  ROTULO_CRIAR_CATEGORIA,
  TITULO_DIALOGO_NOVA_CATEGORIA,
} from "@/lib/cotacoes/textos";
import { useCategoriaDialogoAberta } from "@/components/amassa/cotacoes/contexto-cotacoes";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// Diálogo pequeno de D-14 (<10s): um único campo, um botão. Aberto por `?categoriaDialogo=nova`
// via `history.pushState` (D-23) — montado SEMPRE (mesmo com a lista de categorias vazia), para
// o botão do estado vazio "+ Nova categoria" abrir este mesmo diálogo (achado do 03-06,
// replicado em toda esta base).
export function DialogoCategoria() {
  const categoriaDialogoAberta = useCategoriaDialogoAberta();
  const aberto = categoriaDialogoAberta !== null;

  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) {
      setNome("");
      setErro(null);
      // Foco automático (D-14) — depois de o diálogo montar de verdade.
      const idDoTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(idDoTimer);
    }
  }, [aberto]);

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

  async function criar() {
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
    const resposta = await criarCategoriaDeCotacao(validado.data);
    setEnviando(false);

    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }

    // Navegação COMPLETA (D-23): abrir/fechar é `history.pushState`, mas GRAVAR termina em
    // `window.location.assign` — só o servidor sabe o identificador que nasceu, e é para ele que
    // a tela precisa ir.
    window.location.assign(`/abertura?aba=cotacoes&categoria=${resposta.dados.id}`);
  }

  return (
    <Dialog open={aberto} onOpenChange={(novoValor) => !novoValor && fechar()}>
      <DialogContent aria-label={TITULO_DIALOGO_NOVA_CATEGORIA} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-titulo">{TITULO_DIALOGO_NOVA_CATEGORIA}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            void criar();
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
              não filho dela; neste diálogo pequeno os dois cabem sem rolagem própria. */}
          <div className="flex justify-end gap-3">
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
              {enviando ? "Criando…" : ROTULO_CRIAR_CATEGORIA}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
