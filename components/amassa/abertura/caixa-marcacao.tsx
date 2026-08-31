"use client";

import { memo, useEffect, useState } from "react";
import { toast } from "sonner";

import { marcarItemResolvido, marcarTarefaConcluida } from "@/lib/abertura/acoes";
import { FRASE_FALHA_AO_SALVAR, rotuloCaixaItem, rotuloCaixaTarefa } from "@/lib/abertura/textos";
import { cn } from "@/lib/utils";

export type CaixaMarcacaoProps = {
  // Uma caixa só serve às duas listas (D-07: uma marcação por item, significando "resolvido" —
  // sem um segundo estado separado para "pago" e "recebido"). `nome` é o nome do item ou a
  // descrição da tarefa, usado só para compor o `aria-label`.
  tipo: "item" | "tarefa";
  id: string;
  nome: string;
  // `resolvido` (item) ou `concluida` (tarefa) — o estado gravado no banco no último
  // carregamento do servidor.
  marcado: boolean;
  // Avisa a LINHA no mesmo instante do toque, para ela refletir a marcação sem esperar o
  // servidor redesenhar (ver o comentário de linha-item.tsx). Recebe o estado DESEJADO,
  // nunca "inverta" — mesma disciplina da chamada da Server Action. Em falha é chamada de
  // novo, com o valor antigo, junto da reversão local.
  aoMudar?: (novoEstado: boolean) => void;
};

// Botão de ALTERNAR (`aria-pressed`), nunca `role="checkbox"` (UI-SPEC §"Acessibilidade").
// Otimista (UI-SPEC §"Salvamento otimista", os toques mais frequentes do módulo): o estado
// visual muda ANTES da resposta do servidor; a ação é chamada com o ESTADO DESEJADO (nunca
// "inverter" — T-04.2-13), o que faz duas chamadas com o mesmo valor convergirem sempre para o
// mesmo resultado, mesmo com a resposta fora de ordem. Em falha, o estado volta ao anterior e
// `toast.error` explica. Alvo de toque: o `<button>` mede 44px por 44px; a caixa DESENHADA (a
// que o protótipo mostra) mede 24px dentro dele — a folga em volta é o que mantém a área
// alcançável (CLAUDE.md §Acessibilidade).
//
// `memo()` (props todas primitivas — comparação rasa padrão basta): ver data-inauguracao.tsx e
// .planning/debug/abertura-navegacao-trava.md. Uma instância por linha existente — sem `memo`,
// clicar em QUALQUER link de /abertura re-renderizaria TODAS as instâncias já montadas.
function CaixaMarcacaoBase({ tipo, id, nome, marcado, aoMudar }: CaixaMarcacaoProps) {
  const [estadoVisual, setEstadoVisual] = useState(marcado);
  const [enviando, setEnviando] = useState(false);

  // `marcado` muda quando `marcarItemResolvido`/`marcarTarefaConcluida` revalida `/abertura` no
  // servidor (`revalidatePath` dentro da própria Server Action — nunca um `router.refresh()`
  // manual depois, ver comentário em `alternar()`) — o estado visual local precisa acompanhar,
  // nunca ficar preso ao valor do primeiro carregamento (mesmo cuidado de
  // `formulario-item.tsx`/`formulario-tarefa.tsx` com `aberto`).
  useEffect(() => {
    setEstadoVisual(marcado);
  }, [marcado]);

  async function alternar() {
    if (enviando) {
      return;
    }

    const novoEstado = !estadoVisual;
    setEstadoVisual(novoEstado);
    aoMudar?.(novoEstado);
    setEnviando(true);

    const resposta =
      tipo === "item"
        ? await marcarItemResolvido({ id, resolvido: novoEstado })
        : await marcarTarefaConcluida({ id, concluida: novoEstado });

    setEnviando(false);

    if (!resposta.ok) {
      // Reverte ao estado anterior — nunca uma marcação otimista órfã, divergindo do banco.
      setEstadoVisual(!novoEstado);
      aoMudar?.(!novoEstado);
      toast.error(FRASE_FALHA_AO_SALVAR);
      return;
    }

    // Os números derivados (contagem "não chegou"/"atrasada" do cabeçalho de grupo, etiqueta de
    // tarefas abertas do item) precisam acompanhar — nunca uma tela onde a caixa muda mas o
    // cabeçalho continua com o número antigo. `marcarItemResolvido`/`marcarTarefaConcluida`
    // (lib/abertura/acoes.ts) já chamam `revalidatePath("/abertura")` DENTRO da própria Server
    // Action — o Next.js já inclui a árvore revalidada na resposta da própria ação, sem precisar
    // de um `router.refresh()` explícito depois (confirmado lendo `serverActionReducer` no
    // runtime do Next e medindo: os números derivados atualizam igual sem ele).
    //
    // Por que este comentário existe (achado de .planning/debug/abertura-navegacao-trava.md,
    // sessão de 2026-08-30): um `router.refresh()` aqui despachava uma SEGUNDA transição
    // (ACTION_REFRESH) logo depois da transição da própria Server Action (ACTION_SERVER_ACTION)
    // — e as duas passam pelo MESMO mecanismo de commit do React/Next que às vezes falha em
    // silêncio (a mesma raiz da trava de navegação já corrigida em /abertura). Com as duas
    // transições em sequência, a taxa medida de "o resto da linha não atualiza" chegava a
    // ~63-70%; SÓ com a Server Action (sem o refresh redundante), ~54%. Continua alto — é a
    // MESMA falha de commit do React/Next, agora confirmada em cima de ACTION_SERVER_ACTION, não
    // só ACTION_NAVIGATE, e não respondeu a reduzir o número de Client Components montados em
    // page.tsx (testado). Remover o refresh redundante é a única melhoria proporcional
    // encontrada; o resto do defeito não tem correção local proporcional identificada.
  }

  const rotulo =
    tipo === "item"
      ? rotuloCaixaItem(nome, estadoVisual)
      : rotuloCaixaTarefa(nome, estadoVisual);

  return (
    <button
      type="button"
      aria-pressed={estadoVisual}
      aria-label={rotulo}
      disabled={enviando}
      onClick={() => {
        void alternar();
      }}
      data-testid={tipo === "item" ? "abertura-caixa-item" : "abertura-caixa-tarefa"}
      className="flex h-11 w-11 flex-none items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-6 items-center justify-center rounded-[7px] border-2 transition-colors motion-reduce:transition-none",
          estadoVisual ? "border-sucesso bg-sucesso" : "border-border",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          className={cn(
            "size-3.5 stroke-white transition-opacity motion-reduce:transition-none",
            estadoVisual ? "opacity-100" : "opacity-0",
          )}
          strokeWidth={3.2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    </button>
  );
}

// Comparador PRÓPRIO explícito (nunca o padrão do `memo` — ver formulario-item.tsx e
// .planning/debug/abertura-navegacao-trava.md).
function propsIguais(anterior: CaixaMarcacaoProps, atual: CaixaMarcacaoProps): boolean {
  return (
    anterior.tipo === atual.tipo &&
    anterior.id === atual.id &&
    anterior.nome === atual.nome &&
    anterior.marcado === atual.marcado &&
    // Identidade estável: é o `setState` da linha, que o React garante constante.
    anterior.aoMudar === atual.aoMudar
  );
}

export const CaixaMarcacao = memo(CaixaMarcacaoBase, propsIguais);
