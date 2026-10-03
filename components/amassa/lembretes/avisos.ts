"use client";

// A orquestração dos toques que terminam num toast (Fase 06.3, plano 04): marcar feito (com
// "Desfazer"), reabrir em "Feitos" e — desde a Tarefa 3 — excluir com a exclusão adiada. Cada
// função mexe no estado da lista por callbacks (a lista é de quem chama), chama a ação, reverte e
// avisa na falha. A `ListaDoInicio` e a lista de "ver todos" (plano 05) usam as MESMAS funções —
// por isso aqui, e não um gancho novo dentro de um componente.
//
// Todo `toast` recebe TEXTO PURO (T-06.3-19): o texto do lembrete entra por `trecho()`, nunca como
// HTML nem JSX. Nada aqui lê o relógio: o instante do feito é o `now()` do Postgres e o autor é a
// sessão — a linha otimista não tem nenhum dos dois até o servidor responder.
import { toast } from "sonner";

import { marcarFeito } from "@/lib/lembretes/acoes";
import type { LembreteDaTela } from "@/lib/lembretes/consultas";
import { DURACAO_DO_DESFAZER_MS, trecho } from "@/lib/lembretes/lista";
import {
  FRASE_FALHA_AO_DESFAZER,
  FRASE_FALHA_AO_MARCAR,
  FRASE_FALHA_AO_REABRIR,
  FRASE_LEMBRETE_NAO_EXISTE,
  ROTULO_DESFAZER,
  TOAST_REABERTO,
  textoFeito,
} from "@/lib/lembretes/textos";

// O que a lista oferece para os toques mexerem nela.
export type MexerNaLista = {
  // Põe a linha em "Feitos" (no topo, ou no lugar dela se já estiver lá) e a tira dos abertos —
  // ou, com `feito: false`, o contrário (a ordem dos abertos é refeita por quem desenha).
  colocar: (linha: LembreteDaTela, feito: boolean) => void;
  // Tira a linha das duas listas (o lembrete não existe mais no banco).
  remover: (id: string) => void;
};

// A linha como aberta, sem os dados do feito.
function comoAberto(lembrete: LembreteDaTela): LembreteDaTela {
  return { ...lembrete, feitoEm: null, feitoPorNome: null };
}

// O "Desfazer" do toast "Feito: …" (molde `avisarDispensada`, `confirmar-dispensar.tsx`): manda o
// estado desejado `feito: false` e só vale o PRIMEIRO toque (a bandeira barra o segundo antes de o
// sonner fechar o toast). Nenhum toast novo no sucesso — a linha voltar é a confirmação.
function desfazerFeito(feito: LembreteDaTela, lista: MexerNaLista): void {
  lista.colocar(comoAberto(feito), false);
  void (async () => {
    try {
      const resposta = await marcarFeito({ id: feito.id, feito: false });
      if (resposta.ok) {
        lista.colocar(resposta.dados, false);
      } else if (resposta.naoExiste) {
        lista.remover(feito.id);
        toast.error(FRASE_LEMBRETE_NAO_EXISTE);
      } else {
        lista.colocar(feito, true);
        toast.error(FRASE_FALHA_AO_DESFAZER);
      }
    } catch {
      lista.colocar(feito, true);
      toast.error(FRASE_FALHA_AO_DESFAZER);
    }
  })();
}

// Caixa de um aberto (LMB-06). Otimista e sem indicador: a linha vai na hora para o topo de
// "Feitos" — com `feitoEm: null` e `feitoPorNome: null`, porque o cliente não inventa o instante
// com o relógio do aparelho; a meta ganha "feito por … · dd/mm hh:mm" quando a linha de verdade
// volta do servidor. Falha: a linha volta ao lugar e o toast explica.
export async function marcarFeitoComAviso(
  lembrete: LembreteDaTela,
  lista: MexerNaLista,
): Promise<void> {
  const otimista: LembreteDaTela = { ...lembrete, feitoEm: null, feitoPorNome: null };
  lista.colocar(otimista, true);

  try {
    const resposta = await marcarFeito({ id: lembrete.id, feito: true });
    if (resposta.ok) {
      const feito = resposta.dados;
      // Vale o primeiro: se outra pessoa marcou antes, `feito` traz o feito dela.
      lista.colocar(feito, feito.feitoEm !== null);
      let desfeito = false;
      toast.success(textoFeito(trecho(lembrete.texto)), {
        duration: DURACAO_DO_DESFAZER_MS,
        action: {
          label: ROTULO_DESFAZER,
          onClick: () => {
            if (desfeito) {
              return;
            }
            desfeito = true;
            desfazerFeito(feito, lista);
          },
        },
      });
    } else if (resposta.naoExiste) {
      lista.remover(lembrete.id);
      toast.error(FRASE_LEMBRETE_NAO_EXISTE);
    } else {
      lista.colocar(lembrete, false);
      toast.error(FRASE_FALHA_AO_MARCAR);
    }
  } catch {
    lista.colocar(lembrete, false);
    toast.error(FRASE_FALHA_AO_MARCAR);
  }
}

// Caixa de um feito, em "Feitos": reabre (estado desejado `feito: false`). Otimista; toast
// "Lembrete reaberto." (5 s, sem "Desfazer" — a caixa está ali para marcar de novo).
export async function reabrirComAviso(
  lembrete: LembreteDaTela,
  lista: MexerNaLista,
): Promise<void> {
  lista.colocar(comoAberto(lembrete), false);

  try {
    const resposta = await marcarFeito({ id: lembrete.id, feito: false });
    if (resposta.ok) {
      lista.colocar(resposta.dados, false);
      toast.success(TOAST_REABERTO);
    } else if (resposta.naoExiste) {
      lista.remover(lembrete.id);
      toast.error(FRASE_LEMBRETE_NAO_EXISTE);
    } else {
      lista.colocar(lembrete, true);
      toast.error(FRASE_FALHA_AO_REABRIR);
    }
  } catch {
    lista.colocar(lembrete, true);
    toast.error(FRASE_FALHA_AO_REABRIR);
  }
}
