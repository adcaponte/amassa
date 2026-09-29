// Módulo puro: o agendador das gravações automáticas das Anotações da casa (D-08/GES-10). Nenhum
// React, nenhum banco, nenhum `window` — só `setTimeout`/`clearTimeout`, que existem igual no
// navegador e no Node, e que o relógio falso do Vitest substitui
// (`tests/unit/anotacoes-agendador.test.ts`). O editor (`editor-de-anotacoes.tsx`) só liga isto
// aos eventos da tela; a regra de QUANDO e COM QUE VERSÃO gravar mora aqui (CLAUDE.md: regra de
// negócio em módulo puro e testado, nunca dentro de componente).
//
// Nasceu de dois bloqueadores da revisão da Fase 04.6, os dois de perda de dados numa função que
// já estava em produção:
//
// - CR-02: a limpeza do componente CANCELAVA a gravação pendente ao desmontar (tocar em outro
//   item do menu 1s depois de digitar), e o indicador continuava em "salvo" desde a gravação
//   anterior — o texto sumia sem aviso nenhum. Aqui, encerrar DESCARREGA: o que está pendente sai
//   na hora. Numa navegação dentro do app o JavaScript continua vivo, então a gravação termina. E
//   a situação vira "pendente" já na primeira tecla, nunca "salvo" com texto por salvar.
// - CR-03: o temporizador levava a versão (`vistoEm`) da tecla que o criou. Se uma gravação
//   anterior terminasse no meio da pausa, a seguinte saía com a versão VELHA e a pessoa recebia
//   o aviso de conflito contra a própria gravação. Aqui, a versão é lida na hora de enviar, e
//   nunca há duas gravações no ar: se uma está no ar, o texto mais recente espera ela terminar e
//   sai depois, com a versão que ela devolveu.
//
// O que este módulo NÃO resolve sozinho: fechar a aba ou recarregar pode abortar a requisição no
// meio. Para isso o editor usa `temAlteracaoNaoSalva()` num `beforeunload` — o navegador pergunta
// antes de sair.

export type SituacaoDoAgendador =
  // Nada digitado desde que a tela abriu.
  | "parado"
  // Há texto que ainda não foi salvo e nenhuma gravação dele está no ar (esperando a pausa, ou
  // esperando a gravação anterior terminar).
  | "pendente"
  // Uma gravação está no ar.
  | "salvando"
  // O servidor tem exatamente o texto da caixa.
  | "salvo"
  // O servidor recusou porque outra pessoa salvou antes — espera a escolha ("manter o meu" ou
  // "ver o dela"); digitar nesse meio-tempo NÃO grava por cima sozinho.
  | "conflito"
  // A última gravação falhou; o texto continua pendente, e a próxima tecla tenta de novo.
  | "erro";

// Como o agendador lê a resposta do servidor — o editor traduz o `ResultadoDeSalvarAnotacoes`
// para isto, e o agendador não precisa conhecer o formato da ação.
export type Desfecho =
  { tipo: "gravado"; versao: string } | { tipo: "conflito" } | { tipo: "erro" };

export type OpcoesDoAgendador<R> = {
  // O texto que o servidor tem quando a tela abre — a base para saber se há algo por salvar.
  textoInicial: string;
  // A versão (`atualizado_em`) que veio com a leitura — o primeiro `vistoEm`.
  versaoInicial: string | null;
  pausaMs: number;
  enviar: (texto: string, vistoEm: string | null) => Promise<R>;
  desfechoDe: (resposta: R) => Desfecho;
  // Chamado a cada mudança de situação, com a resposta do servidor quando a mudança veio de uma.
  // `null` quando não veio (ou quando a requisição falhou sem resposta). Nunca chamado depois de
  // `encerrar()` — o componente já desmontou.
  aoMudar: (situacao: SituacaoDoAgendador, resposta: R | null) => void;
};

export type AgendadorDeGravacao = {
  // Uma tecla: guarda o texto e (re)começa a pausa.
  digitar: (texto: string) => void;
  // Envia já o que está pendente, sem esperar a pausa (página escondida, saída da tela). Se uma
  // gravação estiver no ar, o pendente sai assim que ela terminar.
  descarregar: () => void;
  // "manter o meu": regrava o texto MAIS RECENTE da caixa com a versão que o servidor devolveu
  // no aviso.
  manterOMeu: (versaoDoServidor: string) => void;
  // "ver o dela": o texto e a versão do servidor passam a ser os desta tela; nada fica pendente.
  aceitarODoServidor: (texto: string, versaoDoServidor: string) => void;
  temAlteracaoNaoSalva: () => boolean;
  situacao: () => SituacaoDoAgendador;
  // O componente vai desmontar: descarrega o pendente e para de notificar. As gravações já em
  // curso — e a que estiver esperando por elas — continuam até o fim.
  encerrar: () => void;
};

export function criarAgendadorDeGravacao<R>(
  opcoes: OpcoesDoAgendador<R>,
): AgendadorDeGravacao {
  // O texto mais recente da caixa.
  let ultimoTexto = opcoes.textoInicial;
  // O texto que o servidor sabidamente tem, gravado por esta tela ou lido dele.
  let textoConfirmado = opcoes.textoInicial;
  // A versão que esta tela viu por último — lida SEMPRE na hora de enviar (CR-03).
  let versao = opcoes.versaoInicial;

  let situacaoAtual: SituacaoDoAgendador = "parado";
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let noAr = false;
  // A pausa acabou (ou alguém pediu para descarregar) enquanto uma gravação estava no ar: assim
  // que ela terminar, o pendente sai.
  let enviarQuandoTerminar = false;
  let emConflito = false;
  let encerrado = false;

  const haTextoPorSalvar = () => ultimoTexto !== textoConfirmado;

  function mudar(situacao: SituacaoDoAgendador, resposta: R | null = null) {
    situacaoAtual = situacao;
    if (!encerrado) {
      opcoes.aoMudar(situacao, resposta);
    }
  }

  function pararTemporizador() {
    if (temporizador !== null) {
      clearTimeout(temporizador);
      temporizador = null;
    }
  }

  function enviar(texto: string) {
    noAr = true;
    mudar("salvando");
    // Uma promessa que rejeita (rede caiu, requisição abortada) vira "erro", nunca uma exceção
    // solta no navegador.
    opcoes.enviar(texto, versao).then(
      (resposta) => concluir(texto, opcoes.desfechoDe(resposta), resposta),
      () => concluir(texto, { tipo: "erro" }, null),
    );
  }

  function concluir(textoEnviado: string, desfecho: Desfecho, resposta: R | null) {
    noAr = false;

    if (desfecho.tipo === "gravado") {
      versao = desfecho.versao;
      textoConfirmado = textoEnviado;
      if (!haTextoPorSalvar()) {
        enviarQuandoTerminar = false;
        mudar("salvo", resposta);
        return;
      }
      // A pessoa digitou enquanto esta gravação estava no ar.
      if (enviarQuandoTerminar || temporizador === null) {
        enviarQuandoTerminar = false;
        // Avisa a tela desta gravação (autoria, hora) antes de mandar a próxima.
        mudar("pendente", resposta);
        enviar(ultimoTexto);
        return;
      }
      mudar("pendente", resposta);
      return;
    }

    enviarQuandoTerminar = false;

    if (desfecho.tipo === "conflito") {
      emConflito = true;
      pararTemporizador();
      mudar("conflito", resposta);
      return;
    }

    // Erro: o texto continua pendente (`textoConfirmado` não mudou). Se a pessoa ainda está
    // digitando, a pausa em curso tenta de novo; senão, a próxima tecla tenta.
    mudar("erro", resposta);
  }

  function descarregar() {
    pararTemporizador();
    if (emConflito || !haTextoPorSalvar()) return;
    if (noAr) {
      enviarQuandoTerminar = true;
      return;
    }
    enviar(ultimoTexto);
  }

  return {
    digitar(texto) {
      ultimoTexto = texto;
      if (emConflito) {
        // O aviso continua na tela até a escolha; gravar agora só repetiria o mesmo conflito.
        return;
      }
      pararTemporizador();
      if (!haTextoPorSalvar() && !noAr) {
        // Voltou exatamente ao texto que o servidor já tem: nada a gravar.
        mudar(situacaoAtual === "parado" ? "parado" : "salvo");
        return;
      }
      temporizador = setTimeout(() => {
        temporizador = null;
        descarregar();
      }, opcoes.pausaMs);
      mudar("pendente");
    },

    descarregar,

    manterOMeu(versaoDoServidor) {
      if (!emConflito) return;
      emConflito = false;
      versao = versaoDoServidor;
      pararTemporizador();
      enviar(ultimoTexto);
    },

    aceitarODoServidor(texto, versaoDoServidor) {
      emConflito = false;
      pararTemporizador();
      enviarQuandoTerminar = false;
      ultimoTexto = texto;
      textoConfirmado = texto;
      versao = versaoDoServidor;
      mudar("salvo");
    },

    temAlteracaoNaoSalva() {
      return emConflito || haTextoPorSalvar() || noAr;
    },

    situacao() {
      return situacaoAtual;
    },

    encerrar() {
      descarregar();
      encerrado = true;
    },
  };
}
