"use client";

import { memo, useState } from "react";

import { removerItemDeAbertura } from "@/lib/abertura/acoes";
import { formatarReais } from "@/lib/abertura/formato";
import { fraseConfirmarRemoverItem, fraseTarefasQueFicamSoltas } from "@/lib/abertura/textos";
import {
  useRemoverItemId,
  useRouterAbertura,
  useAbridorAbertura,
} from "@/components/amassa/abertura/contexto-navegacao";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ItemParaRemover = {
  id: string;
  nome: string;
  valorEmCentavos: number;
  // A contagem que a PÁGINA já carregou (D-14) — mostrada ANTES de confirmar. A resposta real de
  // `removerItemDeAbertura` (lida dentro da MESMA transação que remove) é a fonte de verdade
  // final; se as duas divergirem porque outra pessoa mexeu no meio, o `toast` de sucesso informa
  // a contagem real, não a que a tela mostrou antes de confirmar.
  tarefasLigadas: number;
};

export type ConfirmarRemoverItemProps = {
  // A lista INTEIRA de itens (id/nome/valor/tarefasLigadas), não um item só — ver o comentário
  // abaixo sobre por que esta é agora UMA instância para a lista toda, não uma por linha.
  itens: ItemParaRemover[];
};

// UMA instância para a lista TODA (não mais uma por linha) — acha o item certo por
// `?removerItem=<id>` (contexto de `contexto-navegacao.tsx`) dentro do array já carregado pela
// página, em vez de cada linha montar sua própria instância.
//
// Motivo (achado quantitativo de .planning/debug/abertura-navegacao-trava.md, sessão de
// 2026-08-30): com uma instância por linha, uma lista de N itens somava N referências de Client
// Component ao payload RSC de QUALQUER navegação em /abertura (abrir "Novo item", trocar de aba,
// etc.) — e a mesma classe do defeito da tela vazia (transição de clique que às vezes nunca
// comita, sem erro nenhum) reapareceu em `abertura-edicao.spec.ts` (rodando com a lista já
// povoada, N ~ 17-23 num run com 8 workers em paralelo) mesmo depois da correção da tela vazia.
// Uma instância só, não uma por linha, deixa esse custo CONSTANTE (1), não O(N).
function ConfirmarRemoverItemBase({ itens }: ConfirmarRemoverItemProps) {
  const router = useRouterAbertura();
  const abridor = useAbridorAbertura();
  const removerItemId = useRemoverItemId();
  const item = itens.find((candidato) => candidato.id === removerItemId) ?? null;
  const aberto = item !== null;

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Fecha pelos DOIS caminhos, sempre juntos (ver useFecharDialogo/o abridor em
  // contexto-navegacao.tsx): zera o valor local E devolve a URL. Só um dos dois deixaria o
  // diálogo preso aberto quando a navegação de abertura não tivesse confirmado.
  function fechar() {
    setErro(null);
    abridor.abrirRemoverItem(null);
    router.push("/abertura");
  }

  async function confirmar(evento: { preventDefault: () => void }) {
    evento.preventDefault();
    if (!item) {
      return;
    }
    setEnviando(true);
    setErro(null);

    const resposta = await removerItemDeAbertura(item.id);

    setEnviando(false);

    if (!resposta.ok) {
      // Erro mostrado DENTRO do diálogo, sem fechá-lo.
      setErro(resposta.erro);
      return;
    }

    // O numero real de tarefas que ficaram soltas vinha num `toast` aqui. Ele nao sobrevive a
    // navegacao completa abaixo -- e a perda e aceitavel: o proprio dialogo ja informa esse
    // numero ANTES de confirmar (D-14), que e o momento em que ele muda uma decisao.
    // Navegacao COMPLETA de proposito, nunca `router.push` + `router.refresh()`.
    // Depois de gravar, a lista precisa refletir o que SO o servidor sabe (um item renomeado,
    // uma linha que sumiu) -- e e exatamente essa confirmacao de transicao que falha em
    // silencio no React/Next (.planning/debug/abertura-navegacao-trava.md). Marcar, abrir e
    // editar ja nao dependem dela, porque o cliente tem o dado; isto aqui depende, e nao ha
    // como deduzir localmente. Um carregamento inteiro custa uns 200ms numa acao POUCO
    // frequente (salvar/remover) e sempre mostra a verdade -- ao contrario do caminho rapido,
    // que as vezes mostrava o valor velho.
    // Sem `toast` de sucesso: ele nao sobrevive ao carregamento. A propria lista ja atualizada
    // e a confirmacao -- mais forte que um aviso que some em tres segundos.
    window.location.assign("/abertura");
  }

  return (
    <AlertDialog
      open={aberto}
      onOpenChange={(novoValor) => {
        if (!enviando && !novoValor) {
          fechar();
        }
      }}
    >
      <AlertDialogContent className="max-h-[85svh] overflow-y-auto">
        {item && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="[overflow-wrap:anywhere]">
                {fraseConfirmarRemoverItem(item.nome, formatarReais(item.valorEmCentavos))}
              </AlertDialogTitle>
              <AlertDialogDescription data-testid="abertura-aviso-tarefas-ligadas">
                {item.tarefasLigadas > 0 ? fraseTarefasQueFicamSoltas(item.tarefasLigadas) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {erro && (
              <p role="alert" className="text-apoio text-erro">
                {erro}
              </p>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={enviando}>Voltar</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={enviando} onClick={confirmar}>
                {enviando ? "Removendo…" : "Remover"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Comparador PRÓPRIO explícito (nunca o padrão do `memo` — ver formulario-tarefa.tsx e
// .planning/debug/abertura-navegacao-trava.md): compara pelo CONTEÚDO da lista, não pela
// referência do array (a página recria esse array a cada navegação).
function propsIguais(anterior: ConfirmarRemoverItemProps, atual: ConfirmarRemoverItemProps): boolean {
  return (
    anterior.itens.length === atual.itens.length &&
    anterior.itens.every(
      (item, indice) =>
        item.id === atual.itens[indice]?.id &&
        item.nome === atual.itens[indice]?.nome &&
        item.valorEmCentavos === atual.itens[indice]?.valorEmCentavos &&
        item.tarefasLigadas === atual.itens[indice]?.tarefasLigadas,
    )
  );
}

export const ConfirmarRemoverItem = memo(ConfirmarRemoverItemBase, propsIguais);
