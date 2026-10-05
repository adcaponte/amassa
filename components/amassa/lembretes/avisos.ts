"use client";

// A orquestração dos toques que terminam num toast (Fase 06.3, plano 04): marcar feito (com
// "Desfazer"), reabrir em "Feitos" e excluir com a exclusão adiada (D-03). Cada
// função mexe no estado da lista por callbacks (a lista é de quem chama), chama a ação, reverte e
// avisa na falha. A `ListaDoInicio` e a lista de "ver todos" (plano 05) usam as MESMAS funções —
// por isso aqui, e não um gancho novo dentro de um componente.
//
// Todo `toast` recebe TEXTO PURO (T-06.3-19): o texto do lembrete entra por `trecho()`, nunca como
// HTML nem JSX. Nada aqui lê o relógio: o instante do feito é o `now()` do Postgres e o autor é a
// sessão — a linha otimista não tem nenhum dos dois até o servidor responder.
import { toast } from "sonner";

import { excluirLembrete, marcarFeito } from "@/lib/lembretes/acoes";
import type { LembreteDaTela } from "@/lib/lembretes/consultas";
import { DURACAO_DO_DESFAZER_MS, avisoDaMarcacao, trecho } from "@/lib/lembretes/lista";
import {
  FRASE_FALHA_AO_DESFAZER,
  FRASE_FALHA_AO_MARCAR,
  FRASE_FALHA_AO_REABRIR,
  FRASE_LEMBRETE_NAO_EXISTE,
  FRASE_REABERTO_POR_OUTRA_PESSOA,
  ROTULO_DESFAZER,
  TOAST_REABERTO,
  textoExcluido,
  textoExcluidos,
  textoFalhaAoExcluir,
  textoFeito,
  textoJaEstavaFeito,
} from "@/lib/lembretes/textos";

import { esconderLembrete, mostrarLembrete } from "./exclusoes-pendentes";

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
        lista.colocar(resposta.dados.lembrete, false);
      } else if (resposta.naoExiste) {
        lista.remover(feito.id);
        toast.error(FRASE_LEMBRETE_NAO_EXISTE);
        manterExclusaoNaFrente();
      } else {
        lista.colocar(feito, true);
        toast.error(FRASE_FALHA_AO_DESFAZER);
        manterExclusaoNaFrente();
      }
    } catch {
      lista.colocar(feito, true);
      toast.error(FRASE_FALHA_AO_DESFAZER);
      manterExclusaoNaFrente();
    }
  })();
}

// Caixa de um aberto (LMB-06). Otimista e sem indicador: a linha vai na hora para o topo de
// "Feitos" — com `feitoEm: null` e `feitoPorNome: null`, porque o cliente não inventa o instante
// com o relógio do aparelho; a meta ganha "feito por … · dd/mm hh:mm" quando a linha de verdade
// volta do servidor. Falha: a linha volta ao lugar e o toast explica.
//
// 06.3-WR-03 (quick 261005-2yu, 05/10/2026): o aviso depende de QUEM gravou (`avisoDaMarcacao`):
// - "feito": esta chamada gravou → "Feito: …" com "Desfazer";
// - "ja_feito": outra pessoa marcou antes → "Já estava feito por {nome}: …", SEM "Desfazer" (desfazer
//   apagaria o feito dela);
// - "voltou_aberto": a linha voltou aberta (reaberta entre o toque e a resposta) → a frase diz isso,
//   sem "Feito" e sem "Desfazer".
export async function marcarFeitoComAviso(
  lembrete: LembreteDaTela,
  lista: MexerNaLista,
): Promise<void> {
  const otimista: LembreteDaTela = { ...lembrete, feitoEm: null, feitoPorNome: null };
  lista.colocar(otimista, true);

  try {
    const resposta = await marcarFeito({ id: lembrete.id, feito: true });
    if (resposta.ok) {
      const { lembrete: feito, gravadoAgora } = resposta.dados;
      lista.colocar(feito, feito.feitoEm !== null);
      const aviso = avisoDaMarcacao({ feitoEm: feito.feitoEm, gravadoAgora });
      if (aviso === "feito") {
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
      } else if (aviso === "ja_feito") {
        toast.success(textoJaEstavaFeito(trecho(lembrete.texto), feito.feitoPorNome));
      } else {
        toast(FRASE_REABERTO_POR_OUTRA_PESSOA);
      }
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
  manterExclusaoNaFrente();
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
      lista.colocar(resposta.dados.lembrete, false);
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
  manterExclusaoNaFrente();
}

// 🔴 "excluir" (LMB-08, D-03): apaga DE VERDADE, mas só quando o aviso acaba. O toque esconde a
// linha na hora (armazém de módulo, `exclusoes-pendentes.ts`) e NADA vai ao servidor enquanto o aviso
// está na tela.
//
// 06.3-WR-01 (quick 261005-2yu, 05/10/2026; opção A da revisão, decisão do dono): UM aviso só para
// TODAS as exclusões pendentes, sempre o mais recente da pilha. Por quê: o sonner recolhido só mostra
// o conteúdo do aviso da FRENTE — um aviso que chega por cima esconde o "Desfazer" de baixo, e a
// exclusão seguia mesmo assim. Por isso:
// - o registro abaixo guarda as exclusões pendentes (id → trecho) e o id do aviso ATUAL;
// - excluir de novo dentro do prazo junta a nova às pendentes e REEMITE o aviso ("N lembretes
//   excluídos."), cujo "Desfazer" devolve todas;
// - TODO aviso dos Lembretes (feito, já feito, reaberto, falhas, guardado, atualizado) chama
//   `manterExclusaoNaFrente()` logo depois, devolvendo a exclusão pendente para a frente. O
//   "Desfazer" do "Feito" que fica atrás não perde nada: reabrir é a caixa em "Feitos". A exclusão é a
//   única coisa irreversível, e é ela que fica sempre visível;
// - cada reemissão começa um relógio NOVO de 6 s (o lado seguro: mais tempo para desfazer, nunca
//   menos);
// - resíduo aceito: um aviso de OUTRO módulo por cima nos 6 s só acontece depois de sair das telas dos
//   Lembretes — o Início não tem nenhum outro aviso (grep de 05/10/2026 em `components/amassa/inicio/`).
//
// As garantias da D-03 continuam:
// - o aviso expira (`onAutoClose`) ou é fechado/arrastado (`onDismiss` — UI-D13: dispensar o aviso
//   não é desfazer) → efetiva TODAS as pendentes; a que falhar volta à lista e o toast diz qual;
// - "Desfazer": as linhas voltam e nada vai ao servidor. O clique na ação do sonner 2.0.8 chama só o
//   `onClick` e fecha o toast — NÃO chama `onDismiss` nem `onAutoClose` (lido em
//   `node_modules/sonner/dist/index.mjs`); a conferência de "ainda é o atual" garante isso de qualquer
//   forma;
// - fechar ou recarregar a página antes de expirar NÃO apaga (falha segura, aceita pelo dono): de
//   propósito, nenhum ouvinte de saída da página;
// - o sonner pausa o relógio com o mouse sobre o aviso, um toque nele ou a aba escondida — a
//   exclusão espera junto.
const exclusoesPendentes = new Map<string, string>();
let avisoDeExclusaoAtual: string | null = null;
let sequenciaDosAvisos = 0;

function desfazerExclusoes(): void {
  const ids = [...exclusoesPendentes.keys()];
  exclusoesPendentes.clear();
  avisoDeExclusaoAtual = null;
  for (const id of ids) {
    mostrarLembrete(id);
  }
}

function efetivarExclusoes(): void {
  const lote = [...exclusoesPendentes.entries()];
  exclusoesPendentes.clear();
  avisoDeExclusaoAtual = null;
  for (const [id, trechoDoTexto] of lote) {
    void (async () => {
      try {
        const resposta = await excluirLembrete({ id });
        if (!resposta.ok) {
          mostrarLembrete(id);
          toast.error(textoFalhaAoExcluir(trechoDoTexto));
          manterExclusaoNaFrente();
        }
        // Sucesso: o id fica escondido (o servidor não o devolve mais; uuid não se repete).
      } catch {
        mostrarLembrete(id);
        toast.error(textoFalhaAoExcluir(trechoDoTexto));
        manterExclusaoNaFrente();
      }
    })();
  }
}

function emitirAvisoDeExclusao(): void {
  if (exclusoesPendentes.size === 0) {
    return;
  }
  sequenciaDosAvisos += 1;
  const id = `lembretes-exclusao-${sequenciaDosAvisos}`;
  const anterior = avisoDeExclusaoAtual;
  // O id novo vira o atual ANTES de dispensar o velho: o `onDismiss` do velho vê que não é mais o
  // atual e não efetiva nada.
  avisoDeExclusaoAtual = id;
  if (anterior !== null) {
    toast.dismiss(anterior);
  }
  const ehOAtual = () => avisoDeExclusaoAtual === id;

  const trechos = [...exclusoesPendentes.values()];
  const texto = trechos.length === 1 ? textoExcluido(trechos[0]) : textoExcluidos(trechos.length);
  toast(texto, {
    id,
    duration: DURACAO_DO_DESFAZER_MS,
    action: {
      label: ROTULO_DESFAZER,
      onClick: () => {
        if (ehOAtual()) {
          desfazerExclusoes();
        }
      },
    },
    onAutoClose: () => {
      if (ehOAtual()) {
        efetivarExclusoes();
      }
    },
    onDismiss: () => {
      if (ehOAtual()) {
        efetivarExclusoes();
      }
    },
  });
}

// Devolve o aviso da exclusão pendente para a FRENTE da pilha (06.3-WR-01). Chamado logo depois de
// todo aviso dos Lembretes; sem exclusão pendente, não faz nada.
export function manterExclusaoNaFrente(): void {
  if (exclusoesPendentes.size > 0) {
    emitirAvisoDeExclusao();
  }
}

export function excluirComAviso(lembrete: LembreteDaTela): void {
  esconderLembrete(lembrete.id);
  exclusoesPendentes.set(lembrete.id, trecho(lembrete.texto));
  emitirAvisoDeExclusao();
}
