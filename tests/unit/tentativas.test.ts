import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  avaliarPedido,
  BLOQUEIO_EM_MINUTOS,
  ESTADO_VAZIO,
  registrarAcerto,
  registrarErro,
  type EstadoTentativas,
} from "../../lib/auth/tentativas";

// Todo instante é passado como argumento — nenhum teste aqui chama Date.now(), setTimeout ou
// dorme. É o que torna as janelas de 15 minutos verificáveis em milissegundos.
const MINUTO = 60_000;
const AGORA_0 = 1_700_000_000_000; // qualquer epoch fixo serve; só precisa ser determinístico.
const EMAIL = "alguem@exemplo.test";

function registrarVariosErros(
  estado: EstadoTentativas,
  email: string,
  instantes: number[],
): EstadoTentativas {
  return instantes.reduce((acumulado, instante) => registrarErro(acumulado, email, instante), estado);
}

describe("lib/auth/tentativas.ts é um módulo puro sem import", () => {
  it("não importa nada", () => {
    const codigo = readFileSync(resolve(process.cwd(), "lib/auth/tentativas.ts"), "utf-8");
    const linhasDeImport = codigo
      .split("\n")
      .filter((linha) => /^\s*import\s/.test(linha));

    expect(linhasDeImport).toHaveLength(0);
  });
});

describe("avaliarPedido", () => {
  it("estado vazio, primeiro pedido: liberado", () => {
    expect(avaliarPedido(ESTADO_VAZIO, EMAIL, AGORA_0)).toEqual({ liberado: true });
  });

  it("o quinto pedido passa e o sexto é recusado (prova os dois lados do limite)", () => {
    let estado = registrarVariosErros(ESTADO_VAZIO, EMAIL, [
      AGORA_0,
      AGORA_0 + 1 * MINUTO,
      AGORA_0 + 2 * MINUTO,
      AGORA_0 + 3 * MINUTO,
    ]);

    // Quatro erros registrados, quinto pedido: ainda liberado. O limite são cinco erros, e o
    // bloqueio começa depois deles.
    const quintoPedido = avaliarPedido(estado, EMAIL, AGORA_0 + 4 * MINUTO);
    expect(quintoPedido).toEqual({ liberado: true });

    // A senha do quinto pedido também estava errada — registra o quinto erro.
    estado = registrarErro(estado, EMAIL, AGORA_0 + 4 * MINUTO);

    // Cinco erros registrados dentro de 15 minutos, sexto pedido: recusado.
    const sextoPedido = avaliarPedido(estado, EMAIL, AGORA_0 + 5 * MINUTO);
    expect(sextoPedido.liberado).toBe(false);
  });

  it("cinco erros dentro da janela recusam o sexto pedido e informam os segundos restantes", () => {
    const estado = registrarVariosErros(ESTADO_VAZIO, EMAIL, [
      AGORA_0,
      AGORA_0 + 1 * MINUTO,
      AGORA_0 + 2 * MINUTO,
      AGORA_0 + 3 * MINUTO,
      AGORA_0 + 4 * MINUTO,
    ]);

    // Um minuto depois do quinto erro (que aconteceu em AGORA_0 + 4min). O bloqueio dura 15
    // minutos a partir do quinto erro, então faltam 14 minutos = 840 segundos.
    const decisao = avaliarPedido(estado, EMAIL, AGORA_0 + 5 * MINUTO);

    expect(decisao.liberado).toBe(false);
    if (!decisao.liberado) {
      expect(decisao.segundosParaLiberar).toBe(14 * 60);
    }
  });

  it("o bloqueio expira sozinho 15 minutos e um segundo depois do quinto erro", () => {
    const estado = registrarVariosErros(ESTADO_VAZIO, EMAIL, [
      AGORA_0,
      AGORA_0 + 1 * MINUTO,
      AGORA_0 + 2 * MINUTO,
      AGORA_0 + 3 * MINUTO,
      AGORA_0 + 4 * MINUTO,
    ]);

    const quintoErro = AGORA_0 + 4 * MINUTO;
    const agoraLiberado = quintoErro + BLOQUEIO_EM_MINUTOS * MINUTO + 1000;

    expect(avaliarPedido(estado, EMAIL, agoraLiberado)).toEqual({ liberado: true });
  });

  it("erros fora da janela não contam — a janela desliza, não é um balde", () => {
    // Quatro erros no mesmo instante inicial.
    let estado = registrarVariosErros(ESTADO_VAZIO, EMAIL, [AGORA_0, AGORA_0, AGORA_0, AGORA_0]);

    // O quinto, 16 minutos depois do primeiro: os quatro anteriores já saíram da janela de 15
    // minutos, então mesmo com "cinco erros" nominalmente registrados o e-mail continua
    // liberado — só um erro está de fato dentro da janela.
    const agoraQuinto = AGORA_0 + 16 * MINUTO;
    estado = registrarErro(estado, EMAIL, agoraQuinto);

    expect(avaliarPedido(estado, EMAIL, agoraQuinto)).toEqual({ liberado: true });
  });

  it("o limite é por e-mail — erros em um não afetam o outro", () => {
    const estado = registrarVariosErros(ESTADO_VAZIO, EMAIL, [
      AGORA_0,
      AGORA_0 + 1 * MINUTO,
      AGORA_0 + 2 * MINUTO,
      AGORA_0 + 3 * MINUTO,
      AGORA_0 + 4 * MINUTO,
    ]);

    expect(avaliarPedido(estado, "outra@exemplo.test", AGORA_0 + 5 * MINUTO)).toEqual({
      liberado: true,
    });
    expect(avaliarPedido(estado, EMAIL, AGORA_0 + 5 * MINUTO).liberado).toBe(false);
  });

  it("e-mails que diferem só na caixa compartilham o mesmo contador", () => {
    const estado = registrarVariosErros(ESTADO_VAZIO, "Alguem@Exemplo.test", [
      AGORA_0,
      AGORA_0 + 1 * MINUTO,
      AGORA_0 + 2 * MINUTO,
      AGORA_0 + 3 * MINUTO,
      AGORA_0 + 4 * MINUTO,
    ]);

    expect(avaliarPedido(estado, "alguem@exemplo.test", AGORA_0 + 5 * MINUTO).liberado).toBe(false);
  });

  it("funciona igual para um e-mail que não existe no banco — o módulo não consulta nada", () => {
    const emailInventado = "ninguem-tem-essa-conta@exemplo.test";
    const estado = registrarVariosErros(ESTADO_VAZIO, emailInventado, [
      AGORA_0,
      AGORA_0 + 1 * MINUTO,
      AGORA_0 + 2 * MINUTO,
      AGORA_0 + 3 * MINUTO,
      AGORA_0 + 4 * MINUTO,
    ]);

    expect(avaliarPedido(estado, emailInventado, AGORA_0 + 5 * MINUTO).liberado).toBe(false);
  });
});

describe("registrarAcerto", () => {
  it("zera o contador daquele e-mail imediatamente", () => {
    const estadoComErros = registrarVariosErros(ESTADO_VAZIO, EMAIL, [
      AGORA_0,
      AGORA_0 + 1 * MINUTO,
      AGORA_0 + 2 * MINUTO,
      AGORA_0 + 3 * MINUTO,
    ]);

    const estadoZerado = registrarAcerto(estadoComErros, EMAIL);

    expect(estadoZerado[EMAIL.toLowerCase()]).toBeUndefined();
    expect(avaliarPedido(estadoZerado, EMAIL, AGORA_0 + 3 * MINUTO)).toEqual({ liberado: true });
  });

  it("não faz nada quando o e-mail não tem registro (idempotente)", () => {
    expect(registrarAcerto(ESTADO_VAZIO, EMAIL)).toEqual(ESTADO_VAZIO);
  });
});
