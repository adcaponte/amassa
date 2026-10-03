"use client";

import { useEffect } from "react";
import { ChevronUp } from "lucide-react";

import { ROTULO_VOLTAR_A_LISTA } from "@/lib/fornecedores/textos";
import { Button } from "@/components/ui/button";

// A navegação entre a lista e a ficha no celular (06.2-UI-SPEC.md, "Seleção e foco" e UI-D16).
//
// O mecanismo que liga o TOQUE na linha ao foco na ficha: a linha grava o id escolhido em
// `sessionStorage` (`marcarFichaEscolhida`) antes de navegar; a ficha nova chega num `Suspense` com
// `key` = id, então este componente MONTA de novo a cada troca — e, ao montar, se o id gravado é o
// dele, apaga a marca, põe o foco no `h2` do nome e, abaixo de 1024 px, rola a ficha para a vista.
// Carregar a página direto (link, recarregar, voltar do navegador) não tem marca: o foco fica onde o
// navegador o deixou. Tocar de novo na linha que já está aberta não troca de ficha (a URL é a mesma),
// e por isso a linha chama `focarFicha` direto.

const CHAVE_DA_FICHA_ESCOLHIDA = "amassa:fornecedores:ficha-escolhida";
const ID_DA_FICHA = "ficha-fornecedor";
const ID_DO_NOME = "ficha-fornecedor-nome";
const ID_DA_LISTA = "lista-fornecedores";
const DUAS_COLUNAS = "(min-width: 1024px)";

function semMovimento(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function emUmaColuna(): boolean {
  return !window.matchMedia(DUAS_COLUNAS).matches;
}

export function marcarFichaEscolhida(id: string): void {
  try {
    window.sessionStorage.setItem(CHAVE_DA_FICHA_ESCOLHIDA, id);
  } catch {
    // Sem `sessionStorage` (aba privada antiga, cota): a ficha abre do mesmo jeito, só sem o foco.
  }
}

// Foco no nome; abaixo de 1024 px, a ficha rola até o topo da vista (suave só sem
// `prefers-reduced-motion`). A partir de 1024 px a ficha já está ao lado: nada rola.
export function focarFicha(): void {
  const ficha = document.getElementById(ID_DA_FICHA);
  const nome = document.getElementById(ID_DO_NOME);
  if (ficha === null || nome === null) {
    return;
  }
  if (emUmaColuna()) {
    ficha.scrollIntoView({ block: "start", behavior: semMovimento() ? "auto" : "smooth" });
  }
  nome.focus({ preventScroll: true });
}

// "Voltar à lista": rola de volta e devolve o foco à linha aberta. Se a busca/o filtro esconde a
// linha, o foco vai ao campo de busca — o primeiro lugar útil da lista.
function voltarALista(id: string): void {
  const linha = document.querySelector<HTMLElement>(
    `[data-testid="fornecedor-linha"][data-fornecedor-id="${CSS.escape(id)}"]`,
  );
  const destino = linha ?? document.querySelector<HTMLElement>('[data-testid="fornecedores-busca"]');
  const comportamento: ScrollBehavior = semMovimento() ? "auto" : "smooth";
  if (destino !== null) {
    destino.scrollIntoView({ block: "center", behavior: comportamento });
    destino.focus({ preventScroll: true });
    return;
  }
  document.getElementById(ID_DA_LISTA)?.scrollIntoView({ block: "start", behavior: comportamento });
}

export function NavegacaoDaFicha({ id }: { id: string }) {
  useEffect(() => {
    let escolhida: string | null = null;
    try {
      escolhida = window.sessionStorage.getItem(CHAVE_DA_FICHA_ESCOLHIDA);
      window.sessionStorage.removeItem(CHAVE_DA_FICHA_ESCOLHIDA);
    } catch {
      return;
    }
    if (escolhida === id) {
      focarFicha();
    }
  }, [id]);

  return (
    <Button
      type="button"
      variant="outline"
      data-testid="fornecedor-voltar-a-lista"
      onClick={() => voltarALista(id)}
      className="text-corpo min-h-[44px] gap-2 self-start px-4 font-semibold lg:hidden"
    >
      <ChevronUp aria-hidden="true" />
      {ROTULO_VOLTAR_A_LISTA}
    </Button>
  );
}
