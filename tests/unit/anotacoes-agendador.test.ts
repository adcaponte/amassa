import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  criarAgendadorDeGravacao,
  type Desfecho,
  type SituacaoDoAgendador,
} from "@/lib/anotacoes/agendador";

// CR-02 e CR-03 da revisão da Fase 04.6 — o agendador das gravações automáticas das Anotações.
// A regra saiu do componente para cá (CLAUDE.md: regra de negócio em módulo puro e testado) e é
// exercitada com o relógio falso do Vitest, sem React e sem banco.
//
// Os defeitos que estes testes fecham:
// - CR-02: desmontar o editor no meio da pausa CANCELAVA a gravação, com o indicador ainda em
//   "salvo" — perda silenciosa. Agora a pausa é DESCARREGADA, e o indicador sai de "salvo" na
//   primeira tecla.
// - CR-03: o temporizador levava a versão da tecla que o criou; se uma gravação anterior
//   terminasse no meio, a seguinte ia com a versão velha e a pessoa recebia um aviso de
//   conflito contra a própria gravação. Agora a versão é lida na hora de enviar, e nunca há duas
//   gravações no ar.

const PAUSA = 1200;
const V0 = "2026-09-29T10:00:00.000Z";
const V1 = "2026-09-29T10:00:05.000Z";
const V2 = "2026-09-29T10:00:09.000Z";
const V_DE_OUTRA_PESSOA = "2026-09-29T10:00:07.000Z";

type Chamada = {
  texto: string;
  vistoEm: string | null;
  responder: (desfecho: Desfecho) => Promise<void>;
  falhar: () => Promise<void>;
};

function montar(textoInicial = "", versaoInicial: string | null = V0) {
  const chamadas: Chamada[] = [];
  const situacoes: SituacaoDoAgendador[] = [];
  let noAr = 0;
  let maximoNoAr = 0;

  const agendador = criarAgendadorDeGravacao<Desfecho>({
    textoInicial,
    versaoInicial,
    pausaMs: PAUSA,
    enviar: (texto, vistoEm) => {
      noAr += 1;
      maximoNoAr = Math.max(maximoNoAr, noAr);
      return new Promise<Desfecho>((resolve, reject) => {
        chamadas.push({
          texto,
          vistoEm,
          responder: async (desfecho) => {
            noAr -= 1;
            resolve(desfecho);
            await vi.advanceTimersByTimeAsync(0);
          },
          falhar: async () => {
            noAr -= 1;
            reject(new Error("rede caiu"));
            await vi.advanceTimersByTimeAsync(0);
          },
        });
      });
    },
    desfechoDe: (resposta) => resposta,
    aoMudar: (situacao) => {
      situacoes.push(situacao);
    },
  });

  return {
    agendador,
    chamadas,
    situacoes,
    maximoNoAr: () => maximoNoAr,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("agendador das Anotações — pausa de digitação", () => {
  it("a primeira tecla já tira o indicador de 'salvo': a situação vira pendente na hora", () => {
    const { agendador } = montar();
    agendador.digitar("a");
    expect(agendador.situacao()).toBe("pendente");
    expect(agendador.temAlteracaoNaoSalva()).toBe(true);
  });

  it("várias teclas seguidas viram uma gravação só, com o último texto, depois da pausa", async () => {
    const { agendador, chamadas } = montar();
    agendador.digitar("a");
    await vi.advanceTimersByTimeAsync(PAUSA - 1);
    agendador.digitar("ab");
    await vi.advanceTimersByTimeAsync(PAUSA - 1);
    expect(chamadas).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].texto).toBe("ab");
    expect(chamadas[0].vistoEm).toBe(V0);
    expect(agendador.situacao()).toBe("salvando");
  });

  it("gravação bem-sucedida deixa a situação em salvo e nada pendente", async () => {
    const { agendador, chamadas } = montar();
    agendador.digitar("abc");
    await vi.advanceTimersByTimeAsync(PAUSA);
    await chamadas[0].responder({ tipo: "gravado", versao: V1 });
    expect(agendador.situacao()).toBe("salvo");
    expect(agendador.temAlteracaoNaoSalva()).toBe(false);
  });

  it("voltar ao texto já salvo não dispara gravação nenhuma", async () => {
    const { agendador, chamadas } = montar("recado");
    agendador.digitar("recado!");
    agendador.digitar("recado");
    await vi.advanceTimersByTimeAsync(PAUSA * 2);
    expect(chamadas).toHaveLength(0);
    expect(agendador.temAlteracaoNaoSalva()).toBe(false);
  });
});

describe("agendador das Anotações — versão mais recente e uma gravação por vez (CR-03)", () => {
  it("digitar durante uma gravação no ar: a próxima vai com a versão que a primeira devolveu", async () => {
    const { agendador, chamadas } = montar();
    agendador.digitar("abc");
    await vi.advanceTimersByTimeAsync(PAUSA);
    expect(chamadas).toHaveLength(1);

    // 4G lento: "d" chega enquanto "abc" ainda está no ar.
    agendador.digitar("abcd");
    expect(agendador.situacao()).toBe("pendente");
    await chamadas[0].responder({ tipo: "gravado", versao: V1 });
    expect(agendador.situacao()).toBe("pendente");

    await vi.advanceTimersByTimeAsync(PAUSA);
    expect(chamadas).toHaveLength(2);
    expect(chamadas[1].texto).toBe("abcd");
    expect(chamadas[1].vistoEm).toBe(V1);
  });

  it("se a pausa acaba com uma gravação no ar, espera ela terminar e só então envia — nunca duas no ar", async () => {
    const { agendador, chamadas, maximoNoAr } = montar();
    agendador.digitar("abc");
    await vi.advanceTimersByTimeAsync(PAUSA);
    agendador.digitar("abcd");
    await vi.advanceTimersByTimeAsync(PAUSA);

    // A pausa do "d" acabou, mas "abc" ainda está no ar: nada novo sai.
    expect(chamadas).toHaveLength(1);

    await chamadas[0].responder({ tipo: "gravado", versao: V1 });
    expect(chamadas).toHaveLength(2);
    expect(chamadas[1]).toMatchObject({ texto: "abcd", vistoEm: V1 });
    expect(maximoNoAr()).toBe(1);

    await chamadas[1].responder({ tipo: "gravado", versao: V2 });
    expect(agendador.situacao()).toBe("salvo");
    expect(agendador.temAlteracaoNaoSalva()).toBe(false);
  });

  it("uma pessoa sozinha, digitando durante as próprias gravações, nunca recebe conflito contra si mesma", async () => {
    // Um servidor de mentira que aplica a MESMA regra de `decidirGravacao`: grava se a versão
    // vista é a atual, avisa se não é.
    let versaoNoServidor = V0;
    let contador = 0;
    const pendentes: Array<() => void> = [];
    const desfechos: Desfecho[] = [];
    const agendador = criarAgendadorDeGravacao<Desfecho>({
      textoInicial: "",
      versaoInicial: V0,
      pausaMs: PAUSA,
      enviar: (_texto, vistoEm) =>
        new Promise<Desfecho>((resolve) => {
          pendentes.push(() => {
            if (vistoEm !== versaoNoServidor) {
              resolve({ tipo: "conflito" });
              return;
            }
            contador += 1;
            versaoNoServidor = `2026-09-29T10:01:${String(contador).padStart(2, "0")}.000Z`;
            resolve({ tipo: "gravado", versao: versaoNoServidor });
          });
        }),
      desfechoDe: (resposta) => {
        desfechos.push(resposta);
        return resposta;
      },
      aoMudar: () => {},
    });

    let texto = "";
    for (let rodada = 0; rodada < 6; rodada += 1) {
      texto += "x";
      agendador.digitar(texto);
      await vi.advanceTimersByTimeAsync(PAUSA);
      texto += "y";
      agendador.digitar(texto);
      // A rede responde no meio da pausa seguinte.
      await vi.advanceTimersByTimeAsync(PAUSA / 2);
      pendentes.shift()?.();
      await vi.advanceTimersByTimeAsync(0);
    }
    await vi.advanceTimersByTimeAsync(PAUSA);
    while (pendentes.length > 0) {
      pendentes.shift()?.();
      await vi.advanceTimersByTimeAsync(0);
    }

    expect(desfechos.some((d) => d.tipo === "conflito")).toBe(false);
    expect(agendador.temAlteracaoNaoSalva()).toBe(false);
  });
});

describe("agendador das Anotações — sair da tela descarrega, nunca descarta (CR-02)", () => {
  it("encerrar no meio da pausa envia o texto pendente na hora", async () => {
    const { agendador, chamadas } = montar();
    agendador.digitar("comprar argila");
    await vi.advanceTimersByTimeAsync(PAUSA / 3);
    agendador.encerrar();
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]).toMatchObject({ texto: "comprar argila", vistoEm: V0 });
  });

  it("encerrar com uma gravação no ar e texto novo: o texto novo sai quando a primeira termina", async () => {
    const { agendador, chamadas } = montar();
    agendador.digitar("abc");
    await vi.advanceTimersByTimeAsync(PAUSA);
    agendador.digitar("abc comprar argila");
    agendador.encerrar();
    expect(chamadas).toHaveLength(1);

    await chamadas[0].responder({ tipo: "gravado", versao: V1 });
    expect(chamadas).toHaveLength(2);
    expect(chamadas[1]).toMatchObject({ texto: "abc comprar argila", vistoEm: V1 });
  });

  it("depois de encerrado, nenhuma notificação chega à tela (nada de setState depois de desmontar)", async () => {
    const { agendador, chamadas, situacoes } = montar();
    agendador.digitar("abc");
    agendador.encerrar();
    const quantasAntes = situacoes.length;
    await chamadas[0].responder({ tipo: "gravado", versao: V1 });
    expect(situacoes.length).toBe(quantasAntes);
  });

  it("encerrar sem nada pendente não envia nada", async () => {
    const { agendador, chamadas } = montar("recado");
    agendador.encerrar();
    await vi.advanceTimersByTimeAsync(PAUSA * 2);
    expect(chamadas).toHaveLength(0);
  });

  it("descarregar (página escondida) envia já, sem esperar a pausa", async () => {
    const { agendador, chamadas } = montar();
    agendador.digitar("abc");
    agendador.descarregar();
    expect(chamadas).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(PAUSA * 2);
    expect(chamadas).toHaveLength(1);
  });

  it("há alteração não salva enquanto a gravação está no ar — sair agora poderia abortá-la", async () => {
    const { agendador, chamadas } = montar();
    agendador.digitar("abc");
    await vi.advanceTimersByTimeAsync(PAUSA);
    expect(agendador.temAlteracaoNaoSalva()).toBe(true);
    await chamadas[0].responder({ tipo: "gravado", versao: V1 });
    expect(agendador.temAlteracaoNaoSalva()).toBe(false);
  });
});

describe("agendador das Anotações — erro e conflito", () => {
  it("erro de servidor: situação erro, o texto continua pendente, a próxima tecla tenta de novo", async () => {
    const { agendador, chamadas } = montar();
    agendador.digitar("abc");
    await vi.advanceTimersByTimeAsync(PAUSA);
    await chamadas[0].responder({ tipo: "erro" });
    expect(agendador.situacao()).toBe("erro");
    expect(agendador.temAlteracaoNaoSalva()).toBe(true);

    agendador.digitar("abcd");
    await vi.advanceTimersByTimeAsync(PAUSA);
    expect(chamadas).toHaveLength(2);
    expect(chamadas[1]).toMatchObject({ texto: "abcd", vistoEm: V0 });
  });

  it("falha de rede (a promessa rejeita) vira erro, nunca exceção solta", async () => {
    const { agendador, chamadas } = montar();
    agendador.digitar("abc");
    await vi.advanceTimersByTimeAsync(PAUSA);
    await chamadas[0].falhar();
    expect(agendador.situacao()).toBe("erro");
    expect(agendador.temAlteracaoNaoSalva()).toBe(true);
  });

  it("em conflito, digitar não grava por cima sozinho — o aviso espera a escolha", async () => {
    const { agendador, chamadas } = montar();
    agendador.digitar("meu texto");
    await vi.advanceTimersByTimeAsync(PAUSA);
    await chamadas[0].responder({ tipo: "conflito" });
    expect(agendador.situacao()).toBe("conflito");

    agendador.digitar("meu texto, e mais");
    await vi.advanceTimersByTimeAsync(PAUSA * 2);
    expect(chamadas).toHaveLength(1);
    expect(agendador.situacao()).toBe("conflito");
    expect(agendador.temAlteracaoNaoSalva()).toBe(true);
  });

  it("'manter o meu' envia o texto MAIS RECENTE com a versão que o servidor devolveu no aviso", async () => {
    const { agendador, chamadas } = montar();
    agendador.digitar("meu texto");
    await vi.advanceTimersByTimeAsync(PAUSA);
    await chamadas[0].responder({ tipo: "conflito" });
    agendador.digitar("meu texto, e mais");

    agendador.manterOMeu(V_DE_OUTRA_PESSOA);
    expect(chamadas).toHaveLength(2);
    expect(chamadas[1]).toMatchObject({ texto: "meu texto, e mais", vistoEm: V_DE_OUTRA_PESSOA });

    await chamadas[1].responder({ tipo: "gravado", versao: V2 });
    expect(agendador.situacao()).toBe("salvo");
    expect(agendador.temAlteracaoNaoSalva()).toBe(false);
  });

  it("'ver o dela' adota o texto e a versão do servidor: nada pendente, e a próxima gravação vai com essa versão", async () => {
    const { agendador, chamadas } = montar();
    agendador.digitar("meu texto");
    await vi.advanceTimersByTimeAsync(PAUSA);
    await chamadas[0].responder({ tipo: "conflito" });

    agendador.aceitarODoServidor("texto dela", V_DE_OUTRA_PESSOA);
    expect(agendador.situacao()).toBe("salvo");
    expect(agendador.temAlteracaoNaoSalva()).toBe(false);

    agendador.digitar("texto dela, com o meu recado");
    await vi.advanceTimersByTimeAsync(PAUSA);
    expect(chamadas[1]).toMatchObject({
      texto: "texto dela, com o meu recado",
      vistoEm: V_DE_OUTRA_PESSOA,
    });
  });
});
