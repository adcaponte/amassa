"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

import type { Cotacao } from "@/lib/cotacoes/consultas";

// Provedor PRÓPRIO da aba Cotações, montado SÓ nesse ramo (nunca no layout) — sem tocar
// `components/amassa/abertura/contexto-navegacao.tsx`, que já é frágil e serve às outras três
// abas. Mesma disciplina que o achado de `.planning/debug/abertura-navegacao-trava.md` exige: UM
// contexto por fatia primitiva de estado, nunca um objeto agregado (um objeto novo a cada render
// forçaria todo consumidor a re-renderizar em toda navegação).
const ContextoCotacaoAberta = createContext<string | null>(null);
const ContextoCategoriaDialogoAberta = createContext<string | null>(null);
const ContextoCotacaoParaEditarLocal = createContext<Cotacao | null>(null);

// POR QUE EXISTE UM ABRIDOR — mesmo motivo de `contexto-navegacao.tsx`: abrir um diálogo depende
// de o React confirmar uma transição, e essa confirmação falha em silêncio numa fração dos
// toques. O botão navega (a URL continua compartilhável, via `history.pushState`) E abre
// localmente no mesmo toque; se a navegação travar, o diálogo já está aberto.
type AbridorDeCotacoes = {
  abrirCotacao: (dados?: Cotacao | null) => void;
};
const ContextoAbridorDeCotacoes = createContext<AbridorDeCotacoes | null>(null);

export function ProvedorNavegacaoCotacoes({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const cotacaoDaUrl = searchParams.get("cotacao");
  const categoriaDialogoDaUrl = searchParams.get("categoriaDialogo");

  // Só o DADO da cotação em edição vive aqui — o estado de ABERTO vem da URL (escrita por
  // `irParaSemNavegar`, D-23), nunca depende da transição que pode falhar.
  const [cotacaoDados, setCotacaoDados] = useState<Cotacao | null>(null);

  // Descarta o dado local só quando a URL deixa de apontar para aquela linha (fechou, ou foi
  // para outra) — nunca só porque a URL mudou (mesmo cuidado de `contexto-navegacao.tsx`).
  useEffect(() => {
    setCotacaoDados((atual) => (atual && cotacaoDaUrl === atual.id ? atual : null));
  }, [cotacaoDaUrl]);

  // Identidade estável (dependências vazias) — sem isto, um objeto novo a cada render anularia o
  // ganho de contextos separados.
  const abridor = useMemo<AbridorDeCotacoes>(
    () => ({ abrirCotacao: (dados = null) => setCotacaoDados(dados) }),
    [],
  );

  return (
    <ContextoAbridorDeCotacoes.Provider value={abridor}>
      <ContextoCotacaoParaEditarLocal.Provider value={cotacaoDados}>
        <ContextoCotacaoAberta.Provider value={cotacaoDaUrl}>
          <ContextoCategoriaDialogoAberta.Provider value={categoriaDialogoDaUrl}>
            {children}
          </ContextoCategoriaDialogoAberta.Provider>
        </ContextoCotacaoAberta.Provider>
      </ContextoCotacaoParaEditarLocal.Provider>
    </ContextoAbridorDeCotacoes.Provider>
  );
}

// `?cotacao=<qualquer valor>` abre o diálogo — o MODO (criar vs. editar) depende só de
// `useCotacaoParaEditarLocal()`/da linha resolvida no servidor, nunca deste valor.
export function useCotacaoAberta(): string | null {
  return useContext(ContextoCotacaoAberta);
}

export function useCategoriaDialogoAberta(): string | null {
  return useContext(ContextoCategoriaDialogoAberta);
}

// A cotação em edição fornecida LOCALMENTE pela própria linha, no instante do toque. `null` =
// diálogo não aberto localmente (ou a navegação já confirmou), e então vale o que o servidor
// resolveu a partir da URL.
export function useCotacaoParaEditarLocal(): Cotacao | null {
  return useContext(ContextoCotacaoParaEditarLocal);
}

export function useAbridorDeCotacoes(): AbridorDeCotacoes {
  const abridor = useContext(ContextoAbridorDeCotacoes);
  if (!abridor) {
    throw new Error(
      "useAbridorDeCotacoes precisa ser chamado dentro de <ProvedorNavegacaoCotacoes>.",
    );
  }
  return abridor;
}
