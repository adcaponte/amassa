"use client";

import { useEffect, useRef, useState } from "react";

import { salvarAnotacoes, type ResultadoDeSalvarAnotacoes } from "@/lib/anotacoes/acoes";
import {
  criarAgendadorDeGravacao,
  type AgendadorDeGravacao,
  type Desfecho,
  type SituacaoDoAgendador,
} from "@/lib/anotacoes/agendador";
import { textoDaAutoria } from "@/lib/anotacoes/folha";
import {
  CONVITE_DA_CAIXA_VAZIA,
  FRASE_ALTERACOES_NAO_SALVAS,
  FRASE_AVISO_DE_CONFLITO,
  FRASE_DE_APOIO,
  FRASE_ERRO_AO_SALVAR,
  FRASE_VER_O_DELA_VAI_TROCAR,
  ROTULO_INDICADOR_PENDENTE,
  ROTULO_INDICADOR_SALVANDO,
  ROTULO_INDICADOR_SALVO,
  ROTULO_MANTER_O_MEU,
  ROTULO_VER_O_DELA,
} from "@/lib/anotacoes/textos";
import { Button } from "@/components/ui/button";

export type EditorDeAnotacoesProps = {
  textoInicial: string;
  salvoPorNomeInicial: string | null;
  // Instante ISO do `atualizado_em` que veio junto da leitura do servidor — a marca de versão
  // inicial (`vistoEm`). Só chega vazio (`""`) se `lerFolhaDaCasa()` falhou — mas nesse caso
  // `BlocoAnotacoes` nem chega a montar este componente (mostra `EstadoErro` no lugar).
  atualizadoEmInicial: string;
};

// A pausa de digitação que dispara o salvamento automático (D-08). O protótipo
// (`prototipo-gestao.html`) usa 600ms para gravar em armazenamento LOCAL (`localStorage`, sem
// ida à rede) — uma ida ao SERVIDOR merece mais folga: 1200ms dá espaço para uma pausa curta de
// raciocínio sem disparar uma requisição a cada poucas teclas. Não é esta pausa que protege o
// texto de quem sai da tela logo depois de digitar: é o agendador descarregar o pendente ao
// desmontar e quando a página fica escondida (celular trancado, troca de aba), e a pergunta do
// navegador ao fechar ou recarregar com texto por salvar (CR-02 da revisão da Fase 04.6).
const PAUSA_DE_DIGITACAO_MS = 1200;

type Conflito = {
  textoDoServidor: string;
  salvoPorNome: string | null;
  atualizadoEm: string;
};

// A tradução da resposta da ação para o que o agendador precisa saber — gravou (e com que
// versão), deu conflito, ou falhou.
function desfechoDe(resposta: ResultadoDeSalvarAnotacoes): Desfecho {
  if (resposta.ok) return { tipo: "gravado", versao: resposta.atualizadoEm };
  if (resposta.motivo === "mudou-no-servidor") return { tipo: "conflito" };
  return { tipo: "erro" };
}

// Client Component — a única forma de ter debounce de digitação, indicador que muda sozinho e o
// aviso de conflito sem recarregar a página. Nada de edição colaborativa em tempo real (D-08):
// nenhum canal aberto, nenhum sinal de digitação de outra pessoa, nenhuma fusão de texto — o que
// existe aqui é só o par salvar/avisar por cima de `salvarAnotacoes`.
//
// QUANDO gravar e COM QUE VERSÃO não é decidido aqui: é `lib/anotacoes/agendador.ts` (puro,
// testado com relógio falso). Este componente só liga o agendador às teclas, aos botões do aviso
// e aos eventos da página, e mostra o que ele diz.
export function EditorDeAnotacoes({
  textoInicial,
  salvoPorNomeInicial,
  atualizadoEmInicial,
}: EditorDeAnotacoesProps) {
  const [texto, setTexto] = useState(textoInicial);
  const [salvoPorNome, setSalvoPorNome] = useState<string | null>(salvoPorNomeInicial);
  const [atualizadoEm, setAtualizadoEm] = useState<string>(atualizadoEmInicial);
  const [indicador, setIndicador] = useState<SituacaoDoAgendador>("parado");
  const [mensagemDeErro, setMensagemDeErro] = useState<string | null>(null);
  const [conflito, setConflito] = useState<Conflito | null>(null);

  const agendadorRef = useRef<AgendadorDeGravacao | null>(null);

  // Um agendador por montagem. As props iniciais entram só aqui, de propósito: depois de montado,
  // a caixa é de quem está digitando — uma nova renderização do servidor (a revalidação do
  // Início depois de salvar) nunca troca o texto debaixo dos dedos da pessoa.
  useEffect(() => {
    const agendador = criarAgendadorDeGravacao<ResultadoDeSalvarAnotacoes>({
      textoInicial,
      versaoInicial: atualizadoEmInicial || null,
      pausaMs: PAUSA_DE_DIGITACAO_MS,
      enviar: (textoParaSalvar, vistoEm) =>
        salvarAnotacoes({ texto: textoParaSalvar, vistoEm }),
      desfechoDe,
      aoMudar: (situacao, resposta) => {
        if (resposta?.ok) {
          setAtualizadoEm(resposta.atualizadoEm);
          setSalvoPorNome(resposta.salvoPorNome);
        }
        if (situacao === "conflito") {
          if (resposta && !resposta.ok && resposta.motivo === "mudou-no-servidor") {
            // O texto digitado NUNCA é descartado por causa de um conflito — a caixa continua
            // com o que a pessoa escreveu; só o aviso aparece, na mesma linha do cabeçalho.
            setConflito({
              textoDoServidor: resposta.textoDoServidor,
              salvoPorNome: resposta.salvoPorNome,
              atualizadoEm: resposta.atualizadoEm,
            });
          }
        } else {
          setConflito(null);
        }
        // Erro de servidor (T-04.6-39) ou da rede: o texto digitado também nunca é descartado.
        setMensagemDeErro(
          situacao !== "erro"
            ? null
            : resposta && !resposta.ok && resposta.motivo === "erro"
              ? resposta.erro
              : FRASE_ERRO_AO_SALVAR,
        );
        setIndicador(situacao);
      },
    });
    agendadorRef.current = agendador;

    // Celular trancado, troca de aba ou de aplicativo: grava já, sem esperar a pausa.
    function aoMudarVisibilidade() {
      if (document.visibilityState === "hidden") {
        agendador.descarregar();
      }
    }
    function aoEsconderPagina() {
      agendador.descarregar();
    }
    // Fechar ou recarregar a aba pode abortar a requisição no meio — então, havendo texto por
    // salvar, o navegador pergunta antes de sair.
    function aoSairDaPagina(evento: BeforeUnloadEvent) {
      agendador.descarregar();
      if (agendador.temAlteracaoNaoSalva()) {
        evento.preventDefault();
        evento.returnValue = FRASE_ALTERACOES_NAO_SALVAS;
      }
    }

    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    window.addEventListener("pagehide", aoEsconderPagina);
    window.addEventListener("beforeunload", aoSairDaPagina);

    return () => {
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      window.removeEventListener("pagehide", aoEsconderPagina);
      window.removeEventListener("beforeunload", aoSairDaPagina);
      // Desmontar (ir para outro módulo pelo menu) DESCARREGA o pendente, nunca o descarta: numa
      // navegação dentro do app o JavaScript continua vivo e a gravação termina. Depois disso o
      // agendador não chama mais `aoMudar` — nenhum setState em componente desmontado.
      agendador.encerrar();
      agendadorRef.current = null;
    };
    // Só na montagem — ver o comentário acima do efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aoDigitar(valor: string) {
    setTexto(valor);
    // Com um aviso de conflito na tela, a tecla não o esconde nem grava por cima sozinha: o aviso
    // espera a escolha entre "manter o meu" (que grava o texto mais recente) e "ver o dela".
    agendadorRef.current?.digitar(valor);
  }

  // "manter o meu": a MESMA porta (`salvarAnotacoes`), chamada de novo com o `vistoEm` que o
  // servidor acabou de devolver no aviso — nunca uma segunda ação (key_link do plano).
  function manterOMeu() {
    if (!conflito) return;
    agendadorRef.current?.manterOMeu(conflito.atualizadoEm);
  }

  // "ver o dela": troca o texto da caixa pelo do servidor — já dito ANTES, na frase do próprio
  // aviso (`FRASE_VER_O_DELA_VAI_TROCAR`), o que será perdido (CLAUDE.md §Exclusão: nenhuma
  // remoção silenciosa). O texto do servidor já está salvo — não precisa de uma nova gravação.
  function verODela() {
    if (!conflito) return;
    setTexto(conflito.textoDoServidor);
    setAtualizadoEm(conflito.atualizadoEm);
    setSalvoPorNome(conflito.salvoPorNome);
    agendadorRef.current?.aceitarODoServidor(conflito.textoDoServidor, conflito.atualizadoEm);
  }

  const autoria = textoDaAutoria({ nome: salvoPorNome, atualizadoEm });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-[24px] flex-wrap items-center justify-end gap-2">
        {conflito ? (
          <div
            data-testid="anotacoes-aviso-conflito"
            role="status"
            className="bg-atencao-fundo text-atencao flex w-full flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-apoio"
          >
            <span className="flex-1">
              {FRASE_AVISO_DE_CONFLITO} {FRASE_VER_O_DELA_VAI_TROCAR}
            </span>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              data-testid="anotacoes-manter-o-meu"
              onClick={manterOMeu}
            >
              {ROTULO_MANTER_O_MEU}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              data-testid="anotacoes-ver-o-dela"
              onClick={verODela}
            >
              {ROTULO_VER_O_DELA}
            </Button>
          </div>
        ) : (
          <span
            data-testid="anotacoes-indicador"
            role={indicador === "erro" ? "alert" : undefined}
            className={
              indicador === "erro"
                ? "text-apoio text-destructive"
                : "text-apoio text-muted-foreground"
            }
          >
            {indicador === "pendente"
              ? ROTULO_INDICADOR_PENDENTE
              : indicador === "salvando"
                ? ROTULO_INDICADOR_SALVANDO
                : indicador === "salvo"
                  ? ROTULO_INDICADOR_SALVO
                  : indicador === "erro"
                    ? mensagemDeErro
                    : ""}
          </span>
        )}
      </div>

      {/* `text-corpo` já é 16px (globals.css) — nunca menor, senão o iOS dá zoom ao focar
          (CLAUDE.md §Acessibilidade). `min-h-[120px]`: altura confortável para um recado curto
          sem rolagem imediata. */}
      <textarea
        data-testid="anotacoes-caixa"
        aria-label="Anotações da casa"
        placeholder={CONVITE_DA_CAIXA_VAZIA}
        value={texto}
        onChange={(evento) => aoDigitar(evento.target.value)}
        rows={5}
        className="border-border text-corpo min-h-[120px] w-full rounded-md border px-3 py-2"
      />

      <p className="text-apoio text-muted-foreground">{FRASE_DE_APOIO}</p>

      {autoria && (
        <p data-testid="anotacoes-autoria" className="text-apoio text-muted-foreground">
          {autoria}
        </p>
      )}
    </div>
  );
}
