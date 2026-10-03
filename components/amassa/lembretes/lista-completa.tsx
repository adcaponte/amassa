"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { QUANTOS_POR_VEZ, TETO_DE_QUANTOS } from "@/lib/clientes/lista";
import type { LembreteDaTela, PessoaDaCasa } from "@/lib/lembretes/consultas";
import {
  compararAbertos,
  hrefDosLembretes,
  primeiroNome,
  type FiltrosDosLembretes,
} from "@/lib/lembretes/lista";
import {
  DICA_DE_VER_TODOS,
  FRASE_NENHUM_LEMBRETE_AQUI,
  ROTULO_ABERTOS,
  ROTULO_DE_QUEM_FILTRO,
  ROTULO_FEITOS,
  ROTULO_GERAL_FILTRO,
  ROTULO_MOSTRAR_MAIS,
  ROTULO_SITUACAO,
  ROTULO_TODOS,
} from "@/lib/lembretes/textos";
import { cn } from "@/lib/utils";

import {
  excluirComAviso,
  marcarFeitoComAviso,
  reabrirComAviso,
  type MexerNaLista,
} from "./avisos";
import { useLembretesOcultos } from "./exclusoes-pendentes";
import { LinhaDeCriar } from "./linha-de-criar";
import { LinhaLembrete } from "./linha-lembrete";

export type ListaCompletaProps = {
  // Os filtros JÁ validados (`filtrosDaUrl`, na página) — a lista que chegou nas props é a deles.
  filtros: FiltrosDosLembretes;
  // O dia civil de Brasília, da PÁGINA (`hojeEmBrasilia`). Nada aqui lê o relógio.
  hoje: string;
  // As pessoas ATIVAS na ordem de cadastro: as pílulas de criar, as do filtro "De quem" e a cor
  // dos chips (pela posição, UI-D2). Pessoa desativada não ganha pílula de filtro.
  pessoas: readonly PessoaDaCasa[];
  linhas: readonly LembreteDaTela[];
  // Há mais lembretes além dos `filtros.quantos` (`limit(quantos + 1)` em `listarLembretes`).
  haMais: boolean;
};

// Pílula de filtro da casa (06.3-UI-SPEC.md §Color, item 3): marcada = fundo `acento-fundo`, borda
// e texto `acento`, peso 600; desmarcada, peso 400 — o estado nunca depende só de cor. 44 px. Cópia
// de `classeDaPilula` (`components/amassa/estoque/barra-ferramentas-saldos.tsx`), como as outras
// cópias do projeto.
function classeDaPilula(marcada: boolean): string {
  return cn(
    "text-apoio focus-visible:ring-ring inline-flex min-h-[44px] items-center gap-1 rounded-full border px-4 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none",
    marcada
      ? "border-acento bg-acento-fundo text-acento font-semibold"
      : "border-borda bg-superficie text-tinta hover:bg-superficie-2 font-normal",
  );
}

// O filtro que a pessoa acabou de tocar, antes de a página nova chegar (E7·loading).
type FiltroPendente = { situacao: FiltrosDosLembretes["situacao"]; quem: string };

// Para onde o foco vai depois de um toque que tira a linha do lugar (molde `lista-do-inicio.tsx`):
// a caixa da linha seguinte, ou da anterior, ou o campo de criar. Nunca o `<body>`.
type FocoPendente = { alvo: "caixa" | "editar"; id: string } | { alvo: "campo" };

function focoDepoisDeSair(ids: readonly string[], id: string): FocoPendente {
  const posicao = ids.indexOf(id);
  const vizinho = posicao === -1 ? undefined : (ids[posicao + 1] ?? ids[posicao - 1]);
  return vizinho === undefined ? { alvo: "campo" } : { alvo: "caixa", id: vizinho };
}

// Um lembrete cabe na lista dos filtros atuais? (a criação e a edição na rota)
function casaComOFiltro(lembrete: LembreteDaTela, filtros: FiltrosDosLembretes): boolean {
  const feito = lembrete.feitoEm !== null;
  if (feito !== (filtros.situacao === "feitos")) {
    return false;
  }
  if (filtros.quem === "todos") {
    return true;
  }
  if (filtros.quem === "geral") {
    return lembrete.quem === null;
  }
  return lembrete.quem === filtros.quem;
}

// Clique comum (sem Ctrl/⌘/Shift/Alt, botão principal): só ele navega NESTA aba — os outros abrem
// outra aba ou janela, e a pílula daqui não deve parecer marcada.
function cliqueComum(evento: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    evento.button === 0 &&
    !evento.metaKey &&
    !evento.ctrlKey &&
    !evento.shiftKey &&
    !evento.altKey
  );
}

// "Ver todos" — `/gestao/lembretes` (Fase 06.3, plano 05; LMB-09, D-01). No topo, a MESMA linha de
// criar do Início (UI-D8); os filtros em dois grupos de pílulas-link ("Situação" e "De quem"), que
// escrevem a URL por `hrefDosLembretes` — voltar e recarregar funcionam; a lista com a autoria de
// cada linha ("por …" nos abertos, "feito por …" nos feitos); "Mostrar mais 50" quando há mais; a
// dica no fim.
//
// As MESMAS ações do Início, pelas MESMAS funções de `avisos.ts`: a caixa (com "Desfazer"), editar
// na linha e excluir adiado até o toast expirar. Com o filtro "Abertos", marcar feito TIRA a linha
// (ela não é mais desta lista); com "Feitos", reabrir também. Como no Início, a lista mora num
// estado local semeado das props e re-semeado quando o servidor manda props novas, MENOS as
// exclusões pendentes (`useLembretesOcultos` — o armazém é de módulo, então uma exclusão feita no
// Início continua escondida aqui dentro dos 6 s).
export function ListaCompleta({ filtros, hoje, pessoas, linhas, haMais }: ListaCompletaProps) {
  const [linhasAnteriores, setLinhasAnteriores] = useState(linhas);
  const [itens, setItens] = useState<LembreteDaTela[]>([...linhas]);
  // E7·loading: a pílula tocada aparece marcada NA HORA; a lista anterior continua na tela até a
  // nova chegar (a navegação do Next é uma transição). Props novas desfazem o pendente.
  const [pendente, setPendente] = useState<FiltroPendente | null>(null);
  if (linhas !== linhasAnteriores) {
    setLinhasAnteriores(linhas);
    setItens([...linhas]);
    setPendente(null);
  }

  // Só uma linha em edição por vez (UI-D12).
  const [emEdicao, setEmEdicao] = useState<string | null>(null);

  const raizRef = useRef<HTMLDivElement>(null);
  const focoPendente = useRef<FocoPendente | null>(null);
  useEffect(() => {
    const foco = focoPendente.current;
    const raiz = raizRef.current;
    if (foco === null || raiz === null) {
      return;
    }
    focoPendente.current = null;
    const alvo =
      foco.alvo === "campo"
        ? raiz.querySelector<HTMLElement>('[data-testid="lembretes-novo-texto"]')
        : raiz.querySelector<HTMLElement>(
            `[data-testid="lembrete-linha"][data-id="${foco.id}"] [data-testid="lembrete-${foco.alvo}"]`,
          );
    alvo?.focus();
  });

  const listaDeFeitos = filtros.situacao === "feitos";

  // Põe uma linha na lista (no lugar dela, ou no topo se é nova) ou a tira — o que decide é se ela
  // ainda cabe nos filtros.
  function colocarOuTirar(linha: LembreteDaTela, cabe: boolean) {
    setItens((atuais) => {
      if (!cabe) {
        return atuais.filter((lembrete) => lembrete.id !== linha.id);
      }
      return atuais.some((lembrete) => lembrete.id === linha.id)
        ? atuais.map((lembrete) => (lembrete.id === linha.id ? linha : lembrete))
        : [linha, ...atuais];
    });
  }

  // O `MexerNaLista` desta tela: a lista é de UMA situação só, então "colocar em Feitos" com o
  // filtro "Abertos" tira a linha, e o "Desfazer" a devolve (e vice-versa).
  const lista: MexerNaLista = {
    colocar(linha, feito) {
      colocarOuTirar(linha, feito === listaDeFeitos);
    },
    remover(id) {
      setItens((atuais) => atuais.filter((lembrete) => lembrete.id !== id));
    },
  };

  // A criação pela linha do topo: entra na lista só se casa com os filtros atuais (um aberto
  // "geral" não aparece com o filtro "Feitos" nem com o de uma pessoa); senão, fica só o toast
  // "Lembrete guardado." da `LinhaDeCriar`.
  function aoCriar(novo: LembreteDaTela) {
    if (casaComOFiltro(novo, filtros)) {
      colocarOuTirar(novo, true);
    }
  }

  const ocultos = useLembretesOcultos();
  const naTela = itens.filter((lembrete) => !ocultos.has(lembrete.id));
  // Abertos na ordem do briefing (a mesma regra pura do SQL, `compararAbertos`); feitos na ordem em
  // que chegaram (`feito_em desc`, do servidor).
  const visiveis = listaDeFeitos ? naTela : [...naTela].sort(compararAbertos);
  const ids = visiveis.map((lembrete) => lembrete.id);

  function alternar(lembrete: LembreteDaTela) {
    focoPendente.current = focoDepoisDeSair(ids, lembrete.id);
    if (listaDeFeitos) {
      void reabrirComAviso(lembrete, lista);
    } else {
      void marcarFeitoComAviso(lembrete, lista);
    }
  }

  function excluir(lembrete: LembreteDaTela) {
    focoPendente.current = focoDepoisDeSair(ids, lembrete.id);
    if (emEdicao === lembrete.id) {
      setEmEdicao(null);
    }
    excluirComAviso(lembrete);
  }

  function fecharEdicao(id: string) {
    focoPendente.current = { alvo: "editar", id };
    setEmEdicao(null);
  }

  // A edição salva: a linha do servidor troca a antiga — ou sai, se mudou de pessoa e não cabe
  // mais no filtro "De quem".
  function aoSalvarEdicao(linha: LembreteDaTela) {
    if (casaComOFiltro(linha, filtros)) {
      colocarOuTirar(linha, true);
      fecharEdicao(linha.id);
    } else {
      focoPendente.current = focoDepoisDeSair(ids, linha.id);
      setEmEdicao(null);
      colocarOuTirar(linha, false);
    }
  }

  function aoSumir(id: string) {
    focoPendente.current = focoDepoisDeSair(ids, id);
    setEmEdicao(null);
    lista.remover(id);
  }

  // O que aparece marcado: o pendente (tocado agora) ou o da URL.
  const situacaoMarcada = pendente?.situacao ?? filtros.situacao;
  const quemMarcado = pendente?.quem ?? filtros.quem;

  // Um filtro novo é uma lista nova: `quantos` volta a 50. Trocar a situação mantém o "quem", e
  // trocar o "quem" mantém a situação — pelos valores MARCADOS, para dois toques seguidos somarem.
  const pilulasDeSituacao: { valor: FiltrosDosLembretes["situacao"]; rotulo: string }[] = [
    { valor: "abertos", rotulo: ROTULO_ABERTOS },
    { valor: "feitos", rotulo: ROTULO_FEITOS },
  ];
  const pilulasDeQuem: { valor: string; rotulo: string }[] = [
    { valor: "todos", rotulo: ROTULO_TODOS },
    { valor: "geral", rotulo: ROTULO_GERAL_FILTRO },
    ...pessoas.map((pessoa) => ({
      valor: pessoa.id,
      rotulo: primeiroNome(pessoa.nome) ?? pessoa.nome,
    })),
  ];

  function pilula(proximo: FiltroPendente, valor: string, rotulo: string, marcada: boolean) {
    return (
      <Link
        key={valor}
        href={hrefDosLembretes({ ...proximo, quantos: QUANTOS_POR_VEZ })}
        scroll={false}
        aria-current={marcada ? "true" : undefined}
        data-testid="lembretes-filtro"
        data-filtro={valor}
        onClick={(evento) => {
          if (cliqueComum(evento)) {
            setPendente(proximo);
          }
        }}
        className={classeDaPilula(marcada)}
      >
        {rotulo}
      </Link>
    );
  }

  return (
    <div ref={raizRef} data-testid="lembretes-pagina" className="flex flex-col gap-4">
      <LinhaDeCriar pessoas={pessoas} aoCriar={aoCriar} />

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <div role="group" aria-label={ROTULO_SITUACAO} className="flex flex-wrap gap-2">
          {pilulasDeSituacao.map(({ valor, rotulo }) =>
            pilula(
              { situacao: valor, quem: quemMarcado },
              valor,
              rotulo,
              situacaoMarcada === valor,
            ),
          )}
        </div>
        <div role="group" aria-label={ROTULO_DE_QUEM_FILTRO} className="flex flex-wrap gap-2">
          {pilulasDeQuem.map(({ valor, rotulo }) =>
            pilula(
              { situacao: situacaoMarcada, quem: valor },
              valor,
              rotulo,
              quemMarcado === valor,
            ),
          )}
        </div>
      </div>

      <div className="@container flex min-w-0 flex-col gap-2">
        {visiveis.length > 0 ? (
          <ul data-testid="lembretes-lista" className="flex flex-col gap-1">
            {visiveis.map((lembrete) => (
              <LinhaLembrete
                key={lembrete.id}
                lembrete={lembrete}
                hoje={hoje}
                pessoas={pessoas}
                feito={listaDeFeitos}
                mostrarAutoria
                aoAlternarFeito={() => alternar(lembrete)}
                emEdicao={!listaDeFeitos && emEdicao === lembrete.id}
                aoAbrirEdicao={listaDeFeitos ? undefined : () => setEmEdicao(lembrete.id)}
                aoCancelarEdicao={() => fecharEdicao(lembrete.id)}
                aoSalvarEdicao={aoSalvarEdicao}
                aoSumir={aoSumir}
                aoExcluir={() => excluir(lembrete)}
              />
            ))}
          </ul>
        ) : (
          <p
            data-testid="lembretes-vazio"
            className="text-apoio text-tinta-fraca border-borda rounded-md border border-dashed p-4"
          >
            {FRASE_NENHUM_LEMBRETE_AQUI}
          </p>
        )}
      </div>

      {/* No teto de 500 (`filtrosDaUrl`) o botão some: "mais 50" voltaria à mesma página. */}
      {haMais && filtros.quantos < TETO_DE_QUANTOS ? (
        <Button asChild variant="outline" className="min-h-[44px] self-center px-4 font-semibold">
          <Link
            href={hrefDosLembretes({ ...filtros, quantos: filtros.quantos + QUANTOS_POR_VEZ })}
            scroll={false}
            data-testid="lembretes-mostrar-mais"
          >
            {ROTULO_MOSTRAR_MAIS}
          </Link>
        </Button>
      ) : null}

      <p className="text-apoio text-tinta-fraca font-normal">{DICA_DE_VER_TODOS}</p>
    </div>
  );
}
