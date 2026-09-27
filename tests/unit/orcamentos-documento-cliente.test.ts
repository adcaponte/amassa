import { describe, expect, it } from "vitest";

import { formatarReais } from "@/lib/financeiro/formato";
import {
  montarDocumentoDoCliente,
  textosDoDocumento,
  type FotoParaDocumento,
  type ItemDeProjetoParaDocumento,
  type LinhaParaDocumento,
  type OrcamentoParaDocumento,
} from "@/lib/orcamentos/documento-cliente";
import { montarSnapshot } from "@/lib/orcamentos/snapshot";

// `formatarReais` produz "R$" seguido de espaço FIXO (U+00A0, não U+0020) — as expectativas
// abaixo usam a própria função para montar o texto esperado, nunca um literal digitado à mão,
// para não depender de acertar o caractere de espaço certo.

// 04.5-11-PLAN.md, Tarefa 3 — a estrutura única que a tela "Ver como o cliente vê" e o PDF do
// servidor leem. Nenhum dado real de cliente ou preço do ateliê entra aqui — só números
// ilustrativos, nomes marcados "[teste]".

const ORCAMENTO_RASCUNHO: OrcamentoParaDocumento = {
  status: "rascunho",
  ano: 2026,
  sequencial: 7,
  revisao: 1,
  clienteNome: "[teste] José Conceição",
  titulo: "[teste] jogo de jantar",
  data: "2026-09-26",
  validadeDias: 10,
  entregaPrevista: "2026-12-02",
  observacoes: "[teste] embrulhar para presente",
  plano: "sinal",
  sinalPercentual: 50,
  freteCentavos: 0,
  snapshot: null,
};

const LINHA_A: LinhaParaDocumento = {
  nomeDaFicha: "[teste] Caneca lisa",
  cor: "verde-musgo fosco",
  personalizacao: "gravação: Zeca",
  quantidade: 2,
  precoUnitarioCentavos: 10000,
};

const LINHA_B: LinhaParaDocumento = {
  nomeDaFicha: "[teste] Prato raso",
  cor: null,
  personalizacao: null,
  quantidade: 4,
  precoUnitarioCentavos: 5000,
};

const PROJETO: ItemDeProjetoParaDocumento[] = [{ descricao: "[teste] Molde especial", valorCentavos: 4000 }];

const FOTOS: FotoParaDocumento[] = [{ id: "foto-1", legenda: "[teste] referência de cor" }];

describe("montarDocumentoDoCliente", () => {
  it("o conjunto de chaves do objeto é exatamente o declarado no tipo", () => {
    const documento = montarDocumentoDoCliente(ORCAMENTO_RASCUNHO, [LINHA_A], PROJETO, FOTOS, "2026-09-26");

    expect(Object.keys(documento).sort()).toEqual(
      [
        "numeroCompleto",
        "dataFormatada",
        "validoAteTexto",
        "paraTexto",
        "linhas",
        "projeto",
        "freteFormatado",
        "totalFormatado",
        "referencias",
        "pagamento",
        "prazoTexto",
        "observacoes",
        "fraseConfirmacao",
        "notaFeitoAMao",
      ].sort(),
    );
  });

  it("nenhuma chave, em nenhum nível de profundidade, tem nome relacionado a custo, mínimo, margem, sobra, hora ou fornada", () => {
    const documento = montarDocumentoDoCliente(
      ORCAMENTO_RASCUNHO,
      [LINHA_A, LINHA_B],
      PROJETO,
      FOTOS,
      "2026-09-26",
    );

    const PADRAO_PROIBIDO = /custo|minimo|mínimo|margem|sobra|hora|fornada/i;

    function varrer(valor: unknown, caminho: string): void {
      if (Array.isArray(valor)) {
        valor.forEach((item, indice) => varrer(item, `${caminho}[${indice}]`));
        return;
      }
      if (valor !== null && typeof valor === "object") {
        for (const [chave, filho] of Object.entries(valor)) {
          expect(PADRAO_PROIBIDO.test(chave), `chave proibida encontrada: ${caminho}.${chave}`).toBe(false);
          varrer(filho, `${caminho}.${chave}`);
        }
      }
    }

    varrer(documento, "documento");
  });

  it("linhas trazem nome, cor, personalização, quantidade, valor unitário e total, já formatados em texto", () => {
    const documento = montarDocumentoDoCliente(
      ORCAMENTO_RASCUNHO,
      [LINHA_A, LINHA_B],
      [],
      [],
      "2026-09-26",
    );

    expect(documento.linhas).toEqual([
      {
        nome: "[teste] Caneca lisa",
        cor: "Cor: verde-musgo fosco",
        personalizacao: "gravação: Zeca",
        quantidadeTexto: "2",
        precoUnitarioFormatado: formatarReais(10000),
        totalFormatado: formatarReais(20000),
      },
      {
        nome: "[teste] Prato raso",
        cor: null,
        personalizacao: null,
        quantidadeTexto: "4",
        precoUnitarioFormatado: formatarReais(5000),
        totalFormatado: formatarReais(20000),
      },
    ]);
  });

  it("um orçamento congelado usa o nome do snapshot; o rascunho usa o nome da ficha viva — as chaves são as mesmas nos dois casos", () => {
    const snapshot = montarSnapshot({
      linhas: [
        {
          nome: "[teste] Caneca lisa (nome de quando foi enviado)",
          custoCentavos: 1200,
          minimoCentavos: 2500,
          zeroCentavos: 1800,
          horasMilesimos: 600,
          quantasCabemBiscoito: 20,
          quantasCabemEsmalte: 15,
        },
      ],
      impostoETaxaPontosBase: 850,
      parametrosEstimados: 1,
      congeladoEm: "2026-09-26T18:00:00.000Z",
    });

    const orcamentoEnviado: OrcamentoParaDocumento = { ...ORCAMENTO_RASCUNHO, status: "enviado", snapshot };

    const documentoRascunho = montarDocumentoDoCliente(
      ORCAMENTO_RASCUNHO,
      [LINHA_A],
      [],
      [],
      "2026-09-26",
    );
    const documentoCongelado = montarDocumentoDoCliente(
      orcamentoEnviado,
      [LINHA_A],
      [],
      [],
      "2026-09-26",
    );

    expect(documentoRascunho.linhas[0].nome).toBe("[teste] Caneca lisa");
    expect(documentoCongelado.linhas[0].nome).toBe("[teste] Caneca lisa (nome de quando foi enviado)");
    expect(Object.keys(documentoRascunho.linhas[0]).sort()).toEqual(
      Object.keys(documentoCongelado.linhas[0]).sort(),
    );
  });

  it("o bloco de pagamento vem de parcelasDoPlano — mesmos rótulos que a tela de edição mostra", () => {
    const documento = montarDocumentoDoCliente(ORCAMENTO_RASCUNHO, [LINHA_A], [], [], "2026-09-26");

    expect(documento.pagamento).toEqual([
      { rotulo: "Sinal de 50%, na aprovação", valorFormatado: formatarReais(10000) },
      { rotulo: "Saldo, na entrega", valorFormatado: formatarReais(10000) },
    ]);
  });

  it("blocos vazios não aparecem: sem fotos, referências fica vazio; sem observações, observações é null; sem custos de projeto, projeto fica vazio; sem frete, freteFormatado é null", () => {
    const orcamentoSemObs: OrcamentoParaDocumento = { ...ORCAMENTO_RASCUNHO, observacoes: null };
    const documento = montarDocumentoDoCliente(orcamentoSemObs, [LINHA_A], [], [], "2026-09-26");

    expect(documento.referencias).toEqual([]);
    expect(documento.observacoes).toBeNull();
    expect(documento.projeto).toEqual([]);
    expect(documento.freteFormatado).toBeNull();
  });

  it("com frete, freteFormatado traz o valor — nunca uma linha de frete zerada mostrando R$ 0,00", () => {
    const orcamentoComFrete: OrcamentoParaDocumento = { ...ORCAMENTO_RASCUNHO, freteCentavos: 3000 };
    const documento = montarDocumentoDoCliente(orcamentoComFrete, [LINHA_A], [], [], "2026-09-26");

    expect(documento.freteFormatado).toBe(formatarReais(3000));
  });
});

describe("textosDoDocumento", () => {
  it("devolve, em ordem, cada texto visível do documento", () => {
    const documento = montarDocumentoDoCliente(
      ORCAMENTO_RASCUNHO,
      [LINHA_A, LINHA_B],
      PROJETO,
      FOTOS,
      "2026-09-26",
    );

    const textos = textosDoDocumento(documento);

    expect(textos[0]).toBe(documento.numeroCompleto);
    expect(textos).toContain("[teste] Caneca lisa");
    expect(textos).toContain("Cor: verde-musgo fosco");
    expect(textos).toContain("gravação: Zeca");
    expect(textos).toContain("[teste] Prato raso");
    expect(textos).toContain("[teste] Molde especial");
    expect(textos).toContain("[teste] referência de cor");
    expect(textos).toContain("Sinal de 50%, na aprovação");
    expect(textos).toContain(documento.prazoTexto);
    expect(textos).toContain("[teste] embrulhar para presente");
    expect(textos[textos.length - 2]).toBe(documento.fraseConfirmacao);
    expect(textos[textos.length - 1]).toBe(documento.notaFeitoAMao);
  });

  it("acentuação sai íntegra: um cliente 'José Conceição' e a palavra 'Orçamento' aparecem sem quebra", () => {
    const documento = montarDocumentoDoCliente(ORCAMENTO_RASCUNHO, [LINHA_A], [], [], "2026-09-26");

    expect(documento.paraTexto).toContain("José Conceição");
    expect(documento.numeroCompleto).toContain("Orçamento");
  });
});
