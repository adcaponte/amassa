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
import {
  DURACAO_DO_DESFAZER_MS,
  POSICAO_DOS_AVISOS_DOS_LEMBRETES,
  avisoDaMarcacao,
  trecho,
} from "@/lib/lembretes/lista";
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
        toast.error(FRASE_LEMBRETE_NAO_EXISTE, { position: POSICAO_DOS_AVISOS_DOS_LEMBRETES });
        manterExclusaoNaFrente();
      } else {
        lista.colocar(feito, true);
        toast.error(FRASE_FALHA_AO_DESFAZER, { position: POSICAO_DOS_AVISOS_DOS_LEMBRETES });
        manterExclusaoNaFrente();
      }
    } catch {
      lista.colocar(feito, true);
      toast.error(FRASE_FALHA_AO_DESFAZER, { position: POSICAO_DOS_AVISOS_DOS_LEMBRETES });
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
          position: POSICAO_DOS_AVISOS_DOS_LEMBRETES,
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
        toast.success(textoJaEstavaFeito(trecho(lembrete.texto), feito.feitoPorNome), {
          position: POSICAO_DOS_AVISOS_DOS_LEMBRETES,
        });
      } else {
        toast(FRASE_REABERTO_POR_OUTRA_PESSOA, { position: POSICAO_DOS_AVISOS_DOS_LEMBRETES });
      }
    } else if (resposta.naoExiste) {
      lista.remover(lembrete.id);
      toast.error(FRASE_LEMBRETE_NAO_EXISTE, { position: POSICAO_DOS_AVISOS_DOS_LEMBRETES });
    } else {
      lista.colocar(lembrete, false);
      toast.error(FRASE_FALHA_AO_MARCAR, { position: POSICAO_DOS_AVISOS_DOS_LEMBRETES });
    }
  } catch {
    lista.colocar(lembrete, false);
    toast.error(FRASE_FALHA_AO_MARCAR, { position: POSICAO_DOS_AVISOS_DOS_LEMBRETES });
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
      toast.success(TOAST_REABERTO, { position: POSICAO_DOS_AVISOS_DOS_LEMBRETES });
    } else if (resposta.naoExiste) {
      lista.remover(lembrete.id);
      toast.error(FRASE_LEMBRETE_NAO_EXISTE, { position: POSICAO_DOS_AVISOS_DOS_LEMBRETES });
    } else {
      lista.colocar(lembrete, true);
      toast.error(FRASE_FALHA_AO_REABRIR, { position: POSICAO_DOS_AVISOS_DOS_LEMBRETES });
    }
  } catch {
    lista.colocar(lembrete, true);
    toast.error(FRASE_FALHA_AO_REABRIR, { position: POSICAO_DOS_AVISOS_DOS_LEMBRETES });
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
// - cada reemissão começa um relógio NOVO de `DURACAO_DO_DESFAZER_MS` (10 s desde a 06.5; o lado
//   seguro: mais tempo para desfazer, nunca menos);
// - desde a 06.5 (UI-D6) todo aviso dos Lembretes mora numa pilha própria, no topo
//   (`POSICAO_DOS_AVISOS_DOS_LEMBRETES`); os avisos dos outros módulos ficam embaixo à direita e não
//   cobrem mais o "Desfazer" — o resíduo aceito pelo quick 261005-2yu deixou de existir.
//
// 06.5-05 — conserto de defeito em produção (261005-2yu): a reemissão criava o aviso NOVO no mesmo
// instante em que pedia ao sonner para dispensar o VELHO. O sonner 2.0.8 cria por `setTimeout` e
// dispensa por dois `requestAnimationFrame` — por dois quadros, os DOIS "Lembrete excluído: …" ficavam
// na tela sem `data-removed` (o e2e (r) de `lembretes-acoes` caía no modo estrito no celular). Agora a
// troca é em DOIS TEMPOS: `manterExclusaoNaFrente()` só dispensa o velho e marca `trocaPedida`; o
// NOVO nasce no `onDismiss` do velho — que o sonner chama logo depois de pôr o velho para sair
// (`deleteToast` → `data-removed="true"`). Nunca há dois avisos de exclusão de pé ao mesmo tempo.
// Excluir de novo durante a troca só junta a exclusão às pendentes: o aviso que nasce já conta todas.
// Rede de segurança: se o `onDismiss` do velho não vier em `PRAZO_DA_TROCA_MS` (aba escondida segura os
// quadros), o novo nasce assim mesmo — nunca fica exclusão pendente sem aviso.
//
// As garantias da D-03 continuam:
// - o aviso expira (`onAutoClose`) ou é fechado/arrastado (`onDismiss` — UI-D13: dispensar o aviso
//   não é desfazer) → efetiva TODAS as pendentes; a que falhar volta à lista e o toast diz qual. O
//   `onDismiss` de um aviso que SAIU PARA DAR LUGAR a outro (troca pedida) não efetiva nada: só faz
//   nascer o novo;
// - "Desfazer": as linhas voltam e nada vai ao servidor. O clique na ação do sonner 2.0.8 chama só o
//   `onClick` e fecha o toast — NÃO chama `onDismiss` nem `onAutoClose` (lido em
//   `node_modules/sonner/dist/index.mjs`); a conferência de "ainda é o atual" garante isso de qualquer
//   forma. Um "Desfazer" tocado no aviso que está saindo durante a troca vale (devolve todas e cancela
//   a troca);
// - fechar ou recarregar a página antes de expirar NÃO apaga (falha segura, aceita pelo dono): de
//   propósito, nenhum ouvinte de saída da página;
// - o sonner pausa o relógio com o mouse sobre o aviso, um toque nele ou a aba escondida — a
//   exclusão espera junto.
const PRAZO_DA_TROCA_MS = 1000;

const exclusoesPendentes = new Map<string, string>();
// O aviso de exclusão que está de pé (o único que pode desfazer ou efetivar), ou `null`.
let avisoDeExclusaoAtual: string | null = null;
// O atual já foi dispensado para dar lugar a um novo, que nasce quando ele sair.
let trocaPedida = false;
let reservaDaTroca: ReturnType<typeof setTimeout> | null = null;
let sequenciaDosAvisos = 0;

function encerrarTroca(): void {
  trocaPedida = false;
  if (reservaDaTroca !== null) {
    clearTimeout(reservaDaTroca);
    reservaDaTroca = null;
  }
}

function desfazerExclusoes(): void {
  const ids = [...exclusoesPendentes.keys()];
  exclusoesPendentes.clear();
  avisoDeExclusaoAtual = null;
  encerrarTroca();
  for (const id of ids) {
    mostrarLembrete(id);
  }
}

function efetivarExclusoes(): void {
  const lote = [...exclusoesPendentes.entries()];
  exclusoesPendentes.clear();
  avisoDeExclusaoAtual = null;
  encerrarTroca();
  for (const [id, trechoDoTexto] of lote) {
    void (async () => {
      try {
        const resposta = await excluirLembrete({ id });
        if (!resposta.ok) {
          mostrarLembrete(id);
          toast.error(textoFalhaAoExcluir(trechoDoTexto), {
            position: POSICAO_DOS_AVISOS_DOS_LEMBRETES,
          });
          manterExclusaoNaFrente();
        }
        // Sucesso: o id fica escondido (o servidor não o devolve mais; uuid não se repete).
      } catch {
        mostrarLembrete(id);
        toast.error(textoFalhaAoExcluir(trechoDoTexto), {
          position: POSICAO_DOS_AVISOS_DOS_LEMBRETES,
        });
        manterExclusaoNaFrente();
      }
    })();
  }
}

// O aviso `id` acabou — expirou, foi arrastado, ou saiu porque a troca o dispensou.
function aoSumirOAviso(id: string): void {
  if (avisoDeExclusaoAtual !== id) {
    // Já desfeito, já efetivado, ou já trocado pela rede de segurança: nada a fazer.
    return;
  }
  if (trocaPedida) {
    encerrarTroca();
    avisoDeExclusaoAtual = null;
    criarAvisoDeExclusao();
    return;
  }
  efetivarExclusoes();
}

function criarAvisoDeExclusao(): void {
  if (exclusoesPendentes.size === 0) {
    return;
  }
  sequenciaDosAvisos += 1;
  const id = `lembretes-exclusao-${sequenciaDosAvisos}`;
  avisoDeExclusaoAtual = id;

  const trechos = [...exclusoesPendentes.values()];
  const texto = trechos.length === 1 ? textoExcluido(trechos[0]) : textoExcluidos(trechos.length);
  toast(texto, {
    id,
    position: POSICAO_DOS_AVISOS_DOS_LEMBRETES,
    duration: DURACAO_DO_DESFAZER_MS,
    action: {
      label: ROTULO_DESFAZER,
      onClick: () => {
        if (avisoDeExclusaoAtual === id) {
          desfazerExclusoes();
        }
      },
    },
    onAutoClose: () => aoSumirOAviso(id),
    onDismiss: () => aoSumirOAviso(id),
  });
}

// Põe o aviso das exclusões pendentes na FRENTE da pilha: sem aviso de pé, cria; com um de pé,
// dispensa-o e o novo nasce quando ele sair (`aoSumirOAviso`). Uma troca já pedida não pede outra.
function pedirAvisoNaFrente(): void {
  if (exclusoesPendentes.size === 0) {
    return;
  }
  const anterior = avisoDeExclusaoAtual;
  if (anterior === null) {
    criarAvisoDeExclusao();
    return;
  }
  if (trocaPedida) {
    return;
  }
  trocaPedida = true;
  toast.dismiss(anterior);
  reservaDaTroca = setTimeout(() => {
    reservaDaTroca = null;
    aoSumirOAviso(anterior);
  }, PRAZO_DA_TROCA_MS);
}

// Devolve o aviso da exclusão pendente para a FRENTE da pilha (06.3-WR-01). Chamado logo depois de
// todo aviso dos Lembretes; sem exclusão pendente, não faz nada.
export function manterExclusaoNaFrente(): void {
  pedirAvisoNaFrente();
}

export function excluirComAviso(lembrete: LembreteDaTela): void {
  esconderLembrete(lembrete.id);
  exclusoesPendentes.set(lembrete.id, trecho(lembrete.texto));
  pedirAvisoNaFrente();
}
