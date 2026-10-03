"use client";

import { useSyncExternalStore } from "react";

// O armazém das exclusões pendentes dos Lembretes (Fase 06.3, D-03). Sem análogo no repositório —
// é o único "apagar" da plataforma, e o único adiado: o toque em "excluir" esconde a linha NA HORA,
// e só o fim do toast de 6 s manda a exclusão ao servidor (`avisos.ts`). Nesses 6 s o servidor
// ainda devolve a linha, então ela precisa ficar escondida POR CIMA do que chega nas props.
//
// Por que no nível do MÓDULO, e não no estado de um componente: o `<Toaster>` mora no layout de
// `/gestao` e sobrevive à navegação interna. Quem exclui no Início e abre "ver todos" dentro dos
// 6 s não pode ver a linha lá (o servidor ainda a devolve), e o `onAutoClose` do toast ainda
// efetiva — um estado de componente teria morrido com o Início. Qualquer outra ação que revalide
// `/gestao` no meio dos 6 s também devolve a linha nas props; o filtro a mantém escondida
// (Pitfall 2 da pesquisa).
//
// Depois de uma exclusão bem-sucedida o id FICA escondido: uuid não se repete e o servidor deixa de
// devolvê-lo — e uma revalidação velha que chegue depois não faz a linha piscar de volta. Recarregar
// a página zera o armazém (e, antes de expirar, nada foi apagado: D-03, falha segura).
//
// O conjunto é TROCADO por um novo a cada mudança (nunca mutado): `useSyncExternalStore` compara o
// retrato por identidade.

let ocultos: ReadonlySet<string> = new Set();
const ouvintes = new Set<() => void>();
// O retrato do servidor: nada escondido (o armazém só existe no navegador). Constante, para o
// `useSyncExternalStore` não ver um conjunto novo a cada chamada.
const NENHUM_OCULTO: ReadonlySet<string> = new Set();

function trocar(novos: ReadonlySet<string>): void {
  ocultos = novos;
  for (const ouvinte of ouvintes) {
    ouvinte();
  }
}

// Esconde a linha em toda lista que usa `useLembretesOcultos` (Início e "ver todos").
export function esconderLembrete(id: string): void {
  if (ocultos.has(id)) {
    return;
  }
  const novos = new Set(ocultos);
  novos.add(id);
  trocar(novos);
}

// Devolve a linha ("Desfazer", ou a exclusão falhou no servidor).
export function mostrarLembrete(id: string): void {
  if (!ocultos.has(id)) {
    return;
  }
  const novos = new Set(ocultos);
  novos.delete(id);
  trocar(novos);
}

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function useLembretesOcultos(): ReadonlySet<string> {
  return useSyncExternalStore(
    assinar,
    () => ocultos,
    () => NENHUM_OCULTO,
  );
}
