"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { QUANTOS_POR_VEZ } from "@/lib/clientes/lista";
import type {
  LembreteDaTela,
  LembretesDoInicio,
  PessoaDaCasa,
} from "@/lib/lembretes/consultas";
import {
  LIMITE_DE_FEITOS_NO_INICIO,
  hrefDosLembretes,
  resumoDoInicio,
} from "@/lib/lembretes/lista";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import {
  FRASE_NADA_PARA_FAZER,
  TITULO_PARA_FAZER,
  textoEMaisN,
  textoEMaisNosFeitos,
  textoFeitos,
} from "@/lib/lembretes/textos";

import { marcarFeitoComAviso, reabrirComAviso, type MexerNaLista } from "./avisos";
import { LinhaDeCriar } from "./linha-de-criar";
import { LinhaLembrete } from "./linha-lembrete";

export type ListaDoInicioProps = {
  // O objeto inteiro de `lerLembretesDoInicio()` — os planos 03 e 04 acrescentam campos a ele sem
  // mexer na assinatura do bloco.
  inicio: LembretesDoInicio;
  // O dia civil de Brasília, da PÁGINA (`hojeEmBrasilia`, o mesmo instante da saudação). Nenhum
  // componente desta pasta lê o relógio para decidir vencido/hoje/amanhã.
  hoje: string;
  // As pessoas ATIVAS, na ordem de cadastro (`listarPessoasDaCasa`): as pílulas da linha de criar e
  // a cor dos chips (pela posição, UI-D2).
  pessoas: readonly PessoaDaCasa[];
};

// Para onde o foco vai depois de um toque que tira a linha do lugar: um controle de outra linha
// (pelo `data-id`) ou o campo de criar. Nunca o `<body>`.
type FocoPendente =
  | { alvo: "caixa" | "editar"; id: string }
  | { alvo: "campo" };

// A linha que sai: o foco vai para a caixa da linha seguinte, ou da anterior se era a última, ou
// para o campo de criar se a lista esvaziou.
function focoDepoisDeSair(ids: readonly string[], id: string): FocoPendente {
  const posicao = ids.indexOf(id);
  const vizinho = posicao === -1 ? undefined : (ids[posicao + 1] ?? ids[posicao - 1]);
  return vizinho === undefined ? { alvo: "campo" } : { alvo: "caixa", id: vizinho };
}

// A coluna "Para fazer" do Início (Fase 06.3). Plano 01 (o traçador): a linha de criar e a lista
// dos abertos. Plano 03: o título com a contagem ao lado (desenhado AQUI, no cliente, porque a
// contagem muda com os toques), a linha de criar completa (`LinhaDeCriar`, com data e pessoa), no
// máximo 6 abertos na ordem do briefing, "e mais N — ver todos" e a frase do vazio — tudo de
// `resumoDoInicio` (puro, `lib/lembretes/lista.ts`) sobre o estado local. Plano 04: a caixa de
// feito (com "Desfazer"), a sanfona "Feitos (N)" com os 5 mais recentes (D-02) e a edição na
// própria linha.
//
// O resultado de um toque NUNCA espera o redesenho do servidor: a re-renderização depois de uma
// Server Action às vezes não chega à tela (debug da Abertura, ~54% medido). A lista mora num estado
// local, semeado das props e re-semeado quando o servidor manda props novas (o padrão do React de
// guardar a prop anterior no estado e comparar durante a renderização — sem efeito). Nenhum
// refresh do roteador depois da ação (molde `caixa-marcacao.tsx`): as ações já revalidam.
export function ListaDoInicio({ inicio, hoje, pessoas }: ListaDoInicioProps) {
  const [inicioAnterior, setInicioAnterior] = useState(inicio);
  const [abertos, setAbertos] = useState<LembreteDaTela[]>(inicio.abertos);
  // Os feitos carregados (os mais recentes primeiro) e quantos feitos o servidor contou ALÉM deles:
  // o "Feitos (N)" é a soma, e mover uma linha para dentro ou para fora de `feitos` já o atualiza.
  const [feitos, setFeitos] = useState<LembreteDaTela[]>(inicio.feitosRecentes);
  const [feitosForaDaLista, setFeitosForaDaLista] = useState(
    inicio.totalDeFeitos - inicio.feitosRecentes.length,
  );
  if (inicio !== inicioAnterior) {
    setInicioAnterior(inicio);
    setAbertos(inicio.abertos);
    setFeitos(inicio.feitosRecentes);
    setFeitosForaDaLista(inicio.totalDeFeitos - inicio.feitosRecentes.length);
  }

  // A linha em edição — só uma por vez (UI-D12): abrir outra troca o id, e a edição anterior some
  // sem perguntar (nada foi gravado; o texto original está na linha).
  const [emEdicao, setEmEdicao] = useState<string | null>(null);

  // O foco é aplicado DEPOIS da renderização que tirou a linha (quando o alvo já está no lugar).
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

  // Uma criação entra no estado local na hora; a posição sai de `resumoDoInicio` (que ordena por
  // `compararAbertos`, a mesma ordem do SQL) — sem esperar o servidor.
  function aoCriar(novo: LembreteDaTela) {
    setAbertos((atuais) => [
      ...atuais.filter((lembrete) => lembrete.id !== novo.id),
      novo,
    ]);
  }

  const lista: MexerNaLista = {
    colocar(linha, feito) {
      if (feito) {
        setAbertos((atuais) => atuais.filter((lembrete) => lembrete.id !== linha.id));
        setFeitos((atuais) =>
          atuais.some((lembrete) => lembrete.id === linha.id)
            ? atuais.map((lembrete) => (lembrete.id === linha.id ? linha : lembrete))
            : [linha, ...atuais],
        );
      } else {
        setFeitos((atuais) => atuais.filter((lembrete) => lembrete.id !== linha.id));
        setAbertos((atuais) => [
          ...atuais.filter((lembrete) => lembrete.id !== linha.id),
          linha,
        ]);
      }
    },
    remover(id) {
      setAbertos((atuais) => atuais.filter((lembrete) => lembrete.id !== id));
      setFeitos((atuais) => atuais.filter((lembrete) => lembrete.id !== id));
    },
  };

  const { visiveis, restantes, contagem } = resumoDoInicio(abertos, hoje);
  const feitosVisiveis = feitos.slice(0, LIMITE_DE_FEITOS_NO_INICIO);
  const totalDeFeitos = feitos.length + feitosForaDaLista;
  const feitosAlemDosVisiveis = totalDeFeitos - feitosVisiveis.length;
  const idsVisiveis = visiveis.map((lembrete) => lembrete.id);
  const idsDosFeitos = feitosVisiveis.map((lembrete) => lembrete.id);

  function marcar(lembrete: LembreteDaTela) {
    focoPendente.current = focoDepoisDeSair(idsVisiveis, lembrete.id);
    void marcarFeitoComAviso(lembrete, lista);
  }

  function reabrir(lembrete: LembreteDaTela) {
    focoPendente.current = focoDepoisDeSair(idsDosFeitos, lembrete.id);
    void reabrirComAviso(lembrete, lista);
  }

  // Salvar ou cancelar a edição: o foco volta ao "editar" da mesma linha.
  function fecharEdicao(id: string) {
    focoPendente.current = { alvo: "editar", id };
    setEmEdicao(null);
  }

  // A edição salva: a linha do servidor troca a antiga (a ordem se refaz por `resumoDoInicio`).
  function aoSalvarEdicao(linha: LembreteDaTela) {
    setAbertos((atuais) =>
      atuais.map((lembrete) => (lembrete.id === linha.id ? linha : lembrete)),
    );
    fecharEdicao(linha.id);
  }

  // O lembrete sumiu do banco no meio da edição.
  function aoSumir(id: string) {
    focoPendente.current = focoDepoisDeSair(idsVisiveis, id);
    setEmEdicao(null);
    lista.remover(id);
  }

  return (
    <div ref={raizRef} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-apoio text-muted-foreground font-semibold tracking-[0.05em] uppercase">
          {TITULO_PARA_FAZER}
        </h3>
        <span
          data-testid="lembretes-contagem"
          aria-live="polite"
          className="text-apoio text-tinta-fraca font-normal tabular-nums"
        >
          {contagem}
        </span>
      </div>

      <LinhaDeCriar pessoas={pessoas} aoCriar={aoCriar} />

      {visiveis.length > 0 ? (
        <ul data-testid="lembretes-lista" className="flex flex-col gap-1">
          {visiveis.map((lembrete) => (
            <LinhaLembrete
              key={lembrete.id}
              lembrete={lembrete}
              hoje={hoje}
              pessoas={pessoas}
              feito={false}
              aoAlternarFeito={() => marcar(lembrete)}
              emEdicao={emEdicao === lembrete.id}
              aoAbrirEdicao={() => setEmEdicao(lembrete.id)}
              aoCancelarEdicao={() => fecharEdicao(lembrete.id)}
              aoSalvarEdicao={aoSalvarEdicao}
              aoSumir={aoSumir}
            />
          ))}
        </ul>
      ) : (
        <p
          data-testid="lembretes-vazio"
          className="text-apoio text-tinta-fraca border-borda rounded-md border border-dashed p-4"
        >
          {FRASE_NADA_PARA_FAZER}
        </p>
      )}

      {restantes > 0 && (
        <Link
          href={rotaDeGestao("/lembretes")}
          data-testid="lembretes-mais"
          className="text-apoio text-acento focus-visible:ring-ring inline-flex min-h-[44px] items-center self-start rounded-md font-normal underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          {textoEMaisN(restantes)}
        </Link>
      )}

      {/* A sanfona "Feitos" (D-02): FECHADA — marcar um feito não a abre (UI-D18; o toast já
          confirma) —, só com pelo menos um feito, os 5 mais recentes primeiro, sem prazo de sumir. */}
      {totalDeFeitos >= 1 && (
        <details data-testid="lembretes-feitos">
          <summary className="text-apoio text-tinta-fraca focus-visible:ring-ring min-h-[44px] cursor-pointer rounded-md py-3 font-semibold focus-visible:ring-2 focus-visible:outline-none">
            {textoFeitos(totalDeFeitos)}
          </summary>
          {feitosVisiveis.length > 0 && (
            <ul data-testid="lembretes-lista-feitos" className="flex flex-col gap-1">
              {feitosVisiveis.map((lembrete) => (
                <LinhaLembrete
                  key={lembrete.id}
                  lembrete={lembrete}
                  hoje={hoje}
                  pessoas={pessoas}
                  feito
                  aoAlternarFeito={() => reabrir(lembrete)}
                />
              ))}
            </ul>
          )}
          {feitosAlemDosVisiveis > 0 && (
            <Link
              href={hrefDosLembretes({
                situacao: "feitos",
                quem: "todos",
                quantos: QUANTOS_POR_VEZ,
              })}
              data-testid="lembretes-feitos-mais"
              className="text-apoio text-acento focus-visible:ring-ring inline-flex min-h-[44px] items-center self-start rounded-md font-normal underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {textoEMaisNosFeitos(feitosAlemDosVisiveis)}
            </Link>
          )}
        </details>
      )}
    </div>
  );
}
