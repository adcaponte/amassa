"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { ItemDaAbertura, TarefaParaEditar } from "@/lib/abertura/consultas";

type RouterAbertura = ReturnType<typeof useRouter>;

// Um contexto SEPARADO por fatia de estado (nunca um único objeto `{router, searchParams}`) —
// é isto, e não "ter um contexto compartilhado" em si, que resolve o achado quantitativo de
// .planning/debug/abertura-navegacao-trava.md: um Provider que devolve um OBJETO NOVO a cada
// render força TODO consumidor a re-renderizar em TODA navegação, porque o React só deixa de
// re-renderizar um consumidor de contexto quando o VALOR do Provider é `Object.is`-igual ao
// anterior — o que nunca acontece com um objeto recriado a cada chamada. Valores primitivos
// (`boolean`/`string | null`) SÃO comparáveis por `Object.is`, então um componente que só lê
// `ContextoTarefaAberta` não re-renderiza quando alguém abre `?item=novo`.
const ContextoRouter = createContext<RouterAbertura | null>(null);
const ContextoItemAberto = createContext<string | null>(null);
const ContextoTarefaAberta = createContext<string | null>(null);
const ContextoAba = createContext<string | null>(null);
const ContextoRemoverItemId = createContext<string | null>(null);
const ContextoRemoverTarefaId = createContext<string | null>(null);

// POR QUE EXISTE UM ABRIDOR, e não só a URL (medido, não suposto).
//
// Todo diálogo desta tela abre por query string (`?item=<id>`, `?removerItem=<id>`), o que
// mantém a URL compartilhável — e isso continua valendo. O problema é que abrir passou a
// DEPENDER de o React confirmar uma transição de navegação, e essa confirmação falha em
// silêncio numa fração dos toques (mesma raiz de .planning/debug/abertura-navegacao-trava.md).
// Quando falhava, a pessoa tocava em "Editar" e não acontecia nada.
//
// A correção é a MESMA da marcação (ver linha-item.tsx): não esperar o servidor para uma
// informação que o cliente já tem no instante do toque. O botão navega (a URL continua sendo a
// fonte compartilhável) E abre localmente ao mesmo tempo. Se a navegação confirmar, a URL passa
// a mandar e o local é zerado; se travar, o diálogo já está aberto e a pessoa segue trabalhando.
//
// O motivo técnico que antes obrigava a abrir só por URL — "seria preciso promover
// lista-itens.tsx a Client Component inteiro" — deixou de existir: a LINHA já é Client Component
// desde a correção da marcação.
type Abridor = {
  // O segundo argumento e a LINHA INTEIRA, opcional. Abrir localmente faz o dialogo aparecer,
  // mas o MODO (criar/editar) e os valores do formulario vinham so do servidor, resolvidos a
  // partir da URL -- entao, quando a navegacao nao confirmava, o dialogo abria em modo de
  // CRIACAO no lugar de edicao. A linha ja tem o dado em maos no instante do toque; passa-lo
  // aqui e o que fecha o caminho.
  abrirItem: (id: string | null, dados?: ItemDaAbertura | null) => void;
  abrirTarefa: (id: string | null, dados?: TarefaParaEditar | null) => void;
  abrirRemoverItem: (id: string | null) => void;
  abrirRemoverTarefa: (id: string | null) => void;
};
const ContextoAbridor = createContext<Abridor | null>(null);
const ContextoItemParaEditar = createContext<ItemDaAbertura | null>(null);
const ContextoTarefaParaEditar = createContext<TarefaParaEditar | null>(null);

export function ProvedorNavegacaoAbertura({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const itemDaUrl = searchParams.get("item");
  const tarefaDaUrl = searchParams.get("tarefa");
  const removerItemDaUrl = searchParams.get("removerItem");
  const removerTarefaDaUrl = searchParams.get("removerTarefa");

  const [itemLocal, setItemLocal] = useState<string | null>(null);
  const [tarefaLocal, setTarefaLocal] = useState<string | null>(null);
  const [itemDados, setItemDados] = useState<ItemDaAbertura | null>(null);
  const [tarefaDados, setTarefaDados] = useState<TarefaParaEditar | null>(null);
  const [removerItemLocal, setRemoverItemLocal] = useState<string | null>(null);
  const [removerTarefaLocal, setRemoverTarefaLocal] = useState<string | null>(null);

  // Quando a URL enfim muda (a navegação confirmou, ou a pessoa colou um link, ou voltou pelo
  // histórico), ela volta a ser a única fonte — o valor local sai da frente. Se a navegação
  // nunca confirmar, o local permanece e o diálogo continua aberto, que é o objetivo.
  useEffect(() => {
    setItemLocal(null);
    setItemDados(null);
  }, [itemDaUrl]);
  useEffect(() => {
    setTarefaLocal(null);
    setTarefaDados(null);
  }, [tarefaDaUrl]);
  useEffect(() => setRemoverItemLocal(null), [removerItemDaUrl]);
  useEffect(() => setRemoverTarefaLocal(null), [removerTarefaDaUrl]);

  // Identidade estável (dependências vazias: todo `setState` do React já é estável) — sem isto,
  // o objeto novo a cada render anularia o ganho de contextos separados descrito acima.
  const abridor = useMemo<Abridor>(
    () => ({
      abrirItem: (id, dados = null) => {
        setItemDados(dados);
        setItemLocal(id);
      },
      abrirTarefa: (id, dados = null) => {
        setTarefaDados(dados);
        setTarefaLocal(id);
      },
      abrirRemoverItem: setRemoverItemLocal,
      abrirRemoverTarefa: setRemoverTarefaLocal,
    }),
    [],
  );

  return (
    <ContextoRouter.Provider value={router}>
      <ContextoAbridor.Provider value={abridor}>
        <ContextoItemParaEditar.Provider value={itemDados}>
        <ContextoTarefaParaEditar.Provider value={tarefaDados}>
        <ContextoItemAberto.Provider value={itemLocal ?? itemDaUrl}>
          <ContextoTarefaAberta.Provider value={tarefaLocal ?? tarefaDaUrl}>
            <ContextoAba.Provider value={searchParams.get("aba")}>
              <ContextoRemoverItemId.Provider value={removerItemLocal ?? removerItemDaUrl}>
                <ContextoRemoverTarefaId.Provider
                  value={removerTarefaLocal ?? removerTarefaDaUrl}
                >
                  {children}
                </ContextoRemoverTarefaId.Provider>
              </ContextoRemoverItemId.Provider>
            </ContextoAba.Provider>
          </ContextoTarefaAberta.Provider>
        </ContextoItemAberto.Provider>
        </ContextoTarefaParaEditar.Provider>
        </ContextoItemParaEditar.Provider>
      </ContextoAbridor.Provider>
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

// `router` é a MESMA referência em toda a vida da página — nunca muda quando a URL muda. Um
// componente que só lê este contexto nunca re-renderiza por causa de navegação nenhuma.
export function useRouterAbertura(): RouterAbertura {
  return exigirRouterAbertura(useContext(ContextoRouter));
}

export function useAbridorAbertura(): Abridor {
  const abridor = useContext(ContextoAbridor);
  if (!abridor) {
    throw new Error(
      "useAbridorAbertura precisa ser chamado dentro de <ProvedorNavegacaoAbertura>.",
    );
  }
  return abridor;
}

// Fecha um diálogo pelos DOIS caminhos, sempre juntos: zera o valor local E devolve a URL. Se
// só zerasse o local, um `?item=<id>` que tivesse chegado na URL reabriria o diálogo no render
// seguinte; se só navegasse, um diálogo aberto localmente (navegação que travou) nunca fecharia.
export function useFecharDialogo(urlDeVolta: string, limpar: (id: null) => void): () => void {
  const router = useRouterAbertura();
  return useCallback(() => {
    limpar(null);
    router.push(urlDeVolta);
  }, [router, urlDeVolta, limpar]);
}

// `?item=<qualquer valor>` abre o diálogo — o MODO (criar/editar) depende de `itemParaEditar`
// (prop vinda do servidor), nunca deste valor.
export function useItemAberto(): string | null {
  return useContext(ContextoItemAberto);
}

export function useTarefaAberta(): string | null {
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

// A linha em edicao fornecida LOCALMENTE pela propria linha, no instante do toque. `null` = o
// dialogo nao foi aberto localmente (ou a navegacao ja confirmou), e entao vale o que o servidor
// resolveu a partir da URL. Ver o comentario do Abridor acima.
export function useItemParaEditarLocal(): ItemDaAbertura | null {
  return useContext(ContextoItemParaEditar);
}

export function useTarefaParaEditarLocal(): TarefaParaEditar | null {
  return useContext(ContextoTarefaParaEditar);
}
