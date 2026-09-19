import { describe, expect, it } from "vitest";

import {
  FRASE_DESFAZER_SEM_PREVISTO,
  planejarDesfazer,
  planejarPagamento,
  type FormaDePagamentoParaPagamento,
} from "@/lib/financeiro/pagamento";

const FORMAS: readonly FormaDePagamentoParaPagamento[] = ["dinheiro", "pix", "cartao"];

describe("planejarPagamento — uma linha e uma parcela ajusta a linha (D-01, briefing §5)", () => {
  it("ajusta a linha quando o documento tem uma linha e uma parcela só (conta fixa)", () => {
    const plano = planejarPagamento({
      tipoDocumento: "despesa",
      quantidadeDeLinhas: 1,
      quantidadeDeParcelas: 1,
      previstoCentavos: 148000,
      pagoCentavos: 150000,
      formaAnterior: "pix",
      formaNova: "pix",
      taxaPontosBaseAtual: 0,
    });

    expect(plano.acaoNaLinha).toBe("ajustar");
    expect(plano.diferencaCentavos).toBe(2000);
    expect(plano.taxaPontosBase).toBeNull();
  });

  it("não muda nada quando o pago é igual ao previsto, mas o previsto/forma sempre existem para o chamador guardar", () => {
    const plano = planejarPagamento({
      tipoDocumento: "despesa",
      quantidadeDeLinhas: 1,
      quantidadeDeParcelas: 1,
      previstoCentavos: 148000,
      pagoCentavos: 148000,
      formaAnterior: "dinheiro",
      formaNova: "dinheiro",
      taxaPontosBaseAtual: 0,
    });

    expect(plano.acaoNaLinha).toBe("nenhuma");
    expect(plano.diferencaCentavos).toBe(0);
  });
});

describe("planejarPagamento — mais de uma linha ou mais de uma parcela cria diferença (D-01/D-02, CONTEXT)", () => {
  it("uma linha e três parcelas (esmaltes): parcela de 80000 paga com 81200 → diferença +1200", () => {
    const plano = planejarPagamento({
      tipoDocumento: "despesa",
      quantidadeDeLinhas: 1,
      quantidadeDeParcelas: 3,
      previstoCentavos: 80000,
      pagoCentavos: 81200,
      formaAnterior: "dinheiro",
      formaNova: "dinheiro",
      taxaPontosBaseAtual: 0,
    });

    expect(plano.acaoNaLinha).toBe("diferenca");
    expect(plano.diferencaCentavos).toBe(1200);
  });

  it("a mesma conta paga com 79000 → diferença −1000", () => {
    const plano = planejarPagamento({
      tipoDocumento: "despesa",
      quantidadeDeLinhas: 1,
      quantidadeDeParcelas: 3,
      previstoCentavos: 80000,
      pagoCentavos: 79000,
      formaAnterior: "dinheiro",
      formaNova: "dinheiro",
      taxaPontosBaseAtual: 0,
    });

    expect(plano.acaoNaLinha).toBe("diferenca");
    expect(plano.diferencaCentavos).toBe(-1000);
  });

  it("duas linhas e uma parcela → diferença (não ajusta nenhuma das duas linhas)", () => {
    const plano = planejarPagamento({
      tipoDocumento: "venda",
      quantidadeDeLinhas: 2,
      quantidadeDeParcelas: 1,
      previstoCentavos: 15000,
      pagoCentavos: 15500,
      formaAnterior: "dinheiro",
      formaNova: "dinheiro",
      taxaPontosBaseAtual: 0,
    });

    expect(plano.acaoNaLinha).toBe("diferenca");
    expect(plano.diferencaCentavos).toBe(500);
  });
});

describe("planejarPagamento — taxa do cartão (BRIEFING §5)", () => {
  it("venda paga no cartão com 350 pontos-base → taxa 350 na parcela", () => {
    const plano = planejarPagamento({
      tipoDocumento: "venda",
      quantidadeDeLinhas: 1,
      quantidadeDeParcelas: 1,
      previstoCentavos: 15000,
      pagoCentavos: 15000,
      formaAnterior: "cartao",
      formaNova: "cartao",
      taxaPontosBaseAtual: 350,
    });

    expect(plano.taxaPontosBase).toBe(350);
  });

  it("despesa no cartão → taxa nula, mesmo pagando com o cartão", () => {
    const plano = planejarPagamento({
      tipoDocumento: "despesa",
      quantidadeDeLinhas: 1,
      quantidadeDeParcelas: 1,
      previstoCentavos: 15000,
      pagoCentavos: 15000,
      formaAnterior: "cartao",
      formaNova: "cartao",
      taxaPontosBaseAtual: 350,
    });

    expect(plano.taxaPontosBase).toBeNull();
  });

  it("venda paga no Pix → taxa nula", () => {
    const plano = planejarPagamento({
      tipoDocumento: "venda",
      quantidadeDeLinhas: 1,
      quantidadeDeParcelas: 1,
      previstoCentavos: 15000,
      pagoCentavos: 15000,
      formaAnterior: "pix",
      formaNova: "pix",
      taxaPontosBaseAtual: 350,
    });

    expect(plano.taxaPontosBase).toBeNull();
  });
});

describe("planejarDesfazer", () => {
  it("com linha de diferença → remove a linha, parcela volta ao previsto e à forma anterior", () => {
    const plano = planejarDesfazer({
      temLinhaDeDiferenca: true,
      quantidadeDeLinhas: 2,
      quantidadeDeParcelas: 3,
      previstoCentavos: 80000,
      pagoCentavos: 81200,
      formaPrevista: "dinheiro",
    });

    expect(plano).toEqual({
      ok: true,
      acaoNaLinha: "diferenca",
      valorParaRestaurarCentavos: 80000,
      formaParaRestaurar: "dinheiro",
    });
  });

  it("do caso de linha única ajustada → a linha volta ao previsto", () => {
    const plano = planejarDesfazer({
      temLinhaDeDiferenca: false,
      quantidadeDeLinhas: 1,
      quantidadeDeParcelas: 1,
      previstoCentavos: 148000,
      pagoCentavos: 150000,
      formaPrevista: "pix",
    });

    expect(plano).toEqual({
      ok: true,
      acaoNaLinha: "ajustar",
      valorParaRestaurarCentavos: 148000,
      formaParaRestaurar: "pix",
    });
  });

  it("sem previsto guardado (paga no próprio lançamento) → recusa com a frase de cancelar e lançar de novo", () => {
    const plano = planejarDesfazer({
      temLinhaDeDiferenca: false,
      quantidadeDeLinhas: 1,
      quantidadeDeParcelas: 1,
      previstoCentavos: null,
      pagoCentavos: 15000,
      formaPrevista: null,
    });

    expect(plano).toEqual({ ok: false, erro: FRASE_DESFAZER_SEM_PREVISTO });
  });

  it("pago igual ao previsto, sem diferença → nenhuma ação de linha, mas continua reversível", () => {
    const plano = planejarDesfazer({
      temLinhaDeDiferenca: false,
      quantidadeDeLinhas: 3,
      quantidadeDeParcelas: 2,
      previstoCentavos: 15000,
      pagoCentavos: 15000,
      formaPrevista: "dinheiro",
    });

    expect(plano).toEqual({
      ok: true,
      acaoNaLinha: "nenhuma",
      valorParaRestaurarCentavos: 15000,
      formaParaRestaurar: "dinheiro",
    });
  });
});

// Gerador determinístico (mulberry32) — semente fixa, nunca `Math.random()`: a mesma semente
// reproduz exatamente os mesmos 200 documentos toda vez que o teste roda, em qualquer máquina.
function criarGerador(semente: number): () => number {
  let estado = semente >>> 0;
  return function proximo(): number {
    estado |= 0;
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inteiroEntre(aleatorio: () => number, minimo: number, maximo: number): number {
  return minimo + Math.floor(aleatorio() * (maximo - minimo + 1));
}

function escolher<T>(aleatorio: () => number, lista: readonly T[]): T {
  return lista[inteiroEntre(aleatorio, 0, lista.length - 1)];
}

// Reparte `total` em `partes` valores inteiros positivos que somam exatamente `total` — cada
// documento de teste precisa que soma(linhas) === soma(parcelas) === total, a mesma restrição que
// o banco adiado confere (migração 0015).
function repartirEmPartesPositivas(aleatorio: () => number, total: number, partes: number): number[] {
  if (partes === 1) {
    return [total];
  }
  const cortes = new Set<number>();
  while (cortes.size < partes - 1) {
    cortes.add(inteiroEntre(aleatorio, 1, total - 1));
  }
  const pontos = [0, ...[...cortes].sort((a, b) => a - b), total];
  const valores: number[] = [];
  for (let i = 1; i < pontos.length; i++) {
    valores.push(pontos[i] - pontos[i - 1]);
  }
  return valores;
}

type DocumentoDeTeste = {
  linhas: number[];
  parcelas: number[];
};

function gerarDocumento(aleatorio: () => number): DocumentoDeTeste {
  const quantidadeDeLinhas = inteiroEntre(aleatorio, 1, 5);
  const quantidadeDeParcelas = inteiroEntre(aleatorio, 1, 12);
  // Total grande o bastante para sempre conseguir repartir em até 12 partes positivas.
  const total = inteiroEntre(aleatorio, 100 * quantidadeDeParcelas, 500_000);

  return {
    linhas: repartirEmPartesPositivas(aleatorio, total, quantidadeDeLinhas),
    parcelas: repartirEmPartesPositivas(aleatorio, total, quantidadeDeParcelas),
  };
}

describe("planejarPagamento + planejarDesfazer — propriedade de ida e volta (D-03)", () => {
  it("para 200 documentos gerados deterministicamente, pagar e desfazer devolve linhas e parcelas idênticas, e a soma fecha depois de CADA passo", () => {
    const aleatorio = criarGerador(1);

    for (let iteracao = 0; iteracao < 200; iteracao++) {
      const documentoOriginal = gerarDocumento(aleatorio);
      const linhas = [...documentoOriginal.linhas];
      const parcelas = [...documentoOriginal.parcelas];

      const indiceDaParcela = inteiroEntre(aleatorio, 0, parcelas.length - 1);
      const previstoCentavos = parcelas[indiceDaParcela];

      // O pago tanto pode ser igual ao previsto (nenhuma mudança) quanto diferir para mais ou
      // para menos — inclusive levando a linha a zero, caso limite que o servidor real recusaria
      // por outra via (a restrição de `documento_linhas.valor_centavos >= 0`), mas que esta
      // função pura não precisa saber disso: ela só decide a AÇÃO, não valida o resultado.
      const deltaMaximo = Math.max(1, Math.floor(previstoCentavos / 2));
      const pagoCentavos = Math.max(
        1,
        previstoCentavos + inteiroEntre(aleatorio, -deltaMaximo, deltaMaximo),
      );

      const formaAnterior = escolher(aleatorio, FORMAS);
      const formaNova = escolher(aleatorio, FORMAS);
      const tipoDocumento = escolher(aleatorio, ["venda", "despesa"] as const);
      const taxaPontosBaseAtual = inteiroEntre(aleatorio, 0, 1000);

      const plano = planejarPagamento({
        tipoDocumento,
        quantidadeDeLinhas: linhas.length,
        quantidadeDeParcelas: parcelas.length,
        previstoCentavos,
        pagoCentavos,
        formaAnterior,
        formaNova,
        taxaPontosBaseAtual,
      });

      // Aplica o plano ao modelo em memória — o mesmo desenho de `registrarPagamento`.
      let temLinhaDeDiferenca = false;
      if (plano.acaoNaLinha === "ajustar") {
        linhas[0] = pagoCentavos;
      } else if (plano.acaoNaLinha === "diferenca") {
        linhas.push(plano.diferencaCentavos);
        temLinhaDeDiferenca = true;
      }
      parcelas[indiceDaParcela] = pagoCentavos;

      const somaLinhasDepoisDoPagamento = linhas.reduce((soma, valor) => soma + valor, 0);
      const somaParcelasDepoisDoPagamento = parcelas.reduce((soma, valor) => soma + valor, 0);
      expect(somaLinhasDepoisDoPagamento).toBe(somaParcelasDepoisDoPagamento);

      const planoDeDesfazer = planejarDesfazer({
        temLinhaDeDiferenca,
        quantidadeDeLinhas: linhas.length,
        quantidadeDeParcelas: parcelas.length,
        previstoCentavos,
        pagoCentavos,
        formaPrevista: formaAnterior,
      });

      expect(planoDeDesfazer.ok).toBe(true);
      if (!planoDeDesfazer.ok) {
        continue;
      }

      if (planoDeDesfazer.acaoNaLinha === "ajustar") {
        linhas[0] = planoDeDesfazer.valorParaRestaurarCentavos;
      } else if (planoDeDesfazer.acaoNaLinha === "diferenca") {
        linhas.pop();
      }
      parcelas[indiceDaParcela] = planoDeDesfazer.valorParaRestaurarCentavos;

      expect(linhas).toEqual(documentoOriginal.linhas);
      expect(parcelas).toEqual(documentoOriginal.parcelas);

      const somaLinhasFinal = linhas.reduce((soma, valor) => soma + valor, 0);
      const somaParcelasFinal = parcelas.reduce((soma, valor) => soma + valor, 0);
      expect(somaLinhasFinal).toBe(somaParcelasFinal);
    }
  });

  it("pagar a segunda parcela depois da primeira (com duas diferenças) e desfazer só a primeira mantém a diferença da segunda", () => {
    // Documento de 2 linhas e 2 parcelas — cada parcela paga com um valor diferente do previsto
    // cria a PRÓPRIA linha de diferença (marcada por `parcela_diferenca_id` no banco; aqui, pela
    // posição em que foi inserida no modelo).
    const linhas = [10000, 20000];
    const parcelas = [10000, 20000];

    const planoParcela0 = planejarPagamento({
      tipoDocumento: "despesa",
      quantidadeDeLinhas: linhas.length,
      quantidadeDeParcelas: parcelas.length,
      previstoCentavos: parcelas[0],
      pagoCentavos: 10500,
      formaAnterior: "dinheiro",
      formaNova: "dinheiro",
      taxaPontosBaseAtual: 0,
    });
    expect(planoParcela0.acaoNaLinha).toBe("diferenca");
    linhas.push(planoParcela0.diferencaCentavos); // índice 2 — diferença da parcela 0
    parcelas[0] = 10500;

    const planoParcela1 = planejarPagamento({
      tipoDocumento: "despesa",
      quantidadeDeLinhas: linhas.length,
      quantidadeDeParcelas: parcelas.length,
      previstoCentavos: parcelas[1],
      pagoCentavos: 20300,
      formaAnterior: "dinheiro",
      formaNova: "dinheiro",
      taxaPontosBaseAtual: 0,
    });
    expect(planoParcela1.acaoNaLinha).toBe("diferenca");
    linhas.push(planoParcela1.diferencaCentavos); // índice 3 — diferença da parcela 1
    parcelas[1] = 20300;

    expect(linhas.reduce((s, v) => s + v, 0)).toBe(parcelas.reduce((s, v) => s + v, 0));

    // Desfaz só a parcela 0 — remove a linha de índice 2 (a diferença DELA), preservando a de
    // índice 3 (a diferença da parcela 1) intacta.
    const desfazerParcela0 = planejarDesfazer({
      temLinhaDeDiferenca: true,
      quantidadeDeLinhas: linhas.length,
      quantidadeDeParcelas: parcelas.length,
      previstoCentavos: 10000,
      pagoCentavos: 10500,
      formaPrevista: "dinheiro",
    });
    expect(desfazerParcela0.ok).toBe(true);
    if (desfazerParcela0.ok) {
      linhas.splice(2, 1); // remove a linha de diferença da parcela 0, e SÓ ELA.
      parcelas[0] = desfazerParcela0.valorParaRestaurarCentavos;
    }

    expect(linhas).toEqual([10000, 20000, planoParcela1.diferencaCentavos]);
    expect(parcelas).toEqual([10000, 20300]);
    expect(linhas.reduce((s, v) => s + v, 0)).toBe(parcelas.reduce((s, v) => s + v, 0));
  });

  it("não muta a entrada", () => {
    const entradaPagamento = Object.freeze({
      tipoDocumento: "venda" as const,
      quantidadeDeLinhas: 2,
      quantidadeDeParcelas: 1,
      previstoCentavos: 15000,
      pagoCentavos: 15500,
      formaAnterior: "dinheiro" as const,
      formaNova: "cartao" as const,
      taxaPontosBaseAtual: 350,
    });
    expect(() => planejarPagamento(entradaPagamento)).not.toThrow();

    const entradaDesfazer = Object.freeze({
      temLinhaDeDiferenca: true,
      quantidadeDeLinhas: 2,
      quantidadeDeParcelas: 1,
      previstoCentavos: 15000,
      pagoCentavos: 15500,
      formaPrevista: "dinheiro" as const,
    });
    expect(() => planejarDesfazer(entradaDesfazer)).not.toThrow();
  });
});
