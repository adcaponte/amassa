"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type RouterAbertura = ReturnType<typeof useRouter>;

// Um contexto SEPARADO por fatia de estado (nunca um único objeto `{router, searchParams}`) —
// é isto, e não "ter um contexto compartilhado" em si, que resolve o achado quantitativo de
// .planning/debug/abertura-navegacao-trava.md: um Provider que devolve um OBJETO NOVO a cada
// render (`{router, searchParams}`) força TODO consumidor a re-renderizar em TODA navegação,
// porque o React só deixa de re-renderizar um consumidor de contexto quando o VALOR do Provider é
// `Object.is`-igual ao anterior — o que nunca acontece com um objeto recriado a cada chamada.
// Falores primitivos (`boolean`/`string | null`) SÃO comparáveis por `Object.is`, então um
// componente que só lê `ContextoTarefaAberta`, por exemplo, não re-renderiza quando alguém abre
// `?item=novo` (o valor de `tarefaAberta` continua `false` antes e depois). Medido: com contextos
// separados, só o componente cuja fatia realmente mudou faz trabalho de render na transição —
// mesmo efeito de reduzir o número de Client Components montados (0/24 travamentos medido com 1
// montado) mas SEM remover nenhuma função da tela.
const ContextoRouter = createContext<RouterAbertura | null>(null);
const ContextoItemAberto = createContext<boolean>(false);
const ContextoTarefaAberta = createContext<boolean>(false);
const ContextoAba = createContext<string | null>(null);
const ContextoRemoverItemId = createContext<string | null>(null);
const ContextoRemoverTarefaId = createContext<string | null>(null);

export function ProvedorNavegacaoAbertura({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <ContextoRouter.Provider value={router}>
      <ContextoItemAberto.Provider value={searchParams.get("item") !== null}>
        <ContextoTarefaAberta.Provider value={searchParams.get("tarefa") !== null}>
          <ContextoAba.Provider value={searchParams.get("aba")}>
            <ContextoRemoverItemId.Provider value={searchParams.get("removerItem")}>
              <ContextoRemoverTarefaId.Provider value={searchParams.get("removerTarefa")}>
                {children}
              </ContextoRemoverTarefaId.Provider>
            </ContextoRemoverItemId.Provider>
          </ContextoAba.Provider>
        </ContextoTarefaAberta.Provider>
      </ContextoItemAberto.Provider>
    </ContextoRouter.Provider>
  );
}

function exigirRouterAbertura(router: RouterAbertura | null): RouterAbertura {
  if (!router) {
    throw new Error(
      "useRouterAbertura precisa ser chamado dentro de <ProvedorNavegacaoAbertura>.",
    );
  }
  return router;
}

// `router` (o objeto devolvido por `next/navigation`'s `useRouter()`) é a MESMA referência em
// toda a vida da página — nunca muda quando a URL muda. Um componente que só lê este contexto
// (DataInauguracao, CaixaMarcacao) nunca precisa re-renderizar por causa de navegação nenhuma.
export function useRouterAbertura(): RouterAbertura {
  return exigirRouterAbertura(useContext(ContextoRouter));
}

// `?item=<qualquer valor>` abre o diálogo — o MODO (criar/editar) depende de `itemParaEditar`
// (prop vinda do servidor), nunca deste booleano.
export function useItemAberto(): boolean {
  return useContext(ContextoItemAberto);
}

export function useTarefaAberta(): boolean {
  return useContext(ContextoTarefaAberta);
}

export function useAbaAtual(): string | null {
  return useContext(ContextoAba);
}

export function useRemoverItemId(): string | null {
  return useContext(ContextoRemoverItemId);
}

export function useRemoverTarefaId(): string | null {
  return useContext(ContextoRemoverTarefaId);
}
