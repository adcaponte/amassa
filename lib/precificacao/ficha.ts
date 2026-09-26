// Módulo puro (D-14): SÓ `import type` é permitido aqui — nenhuma leitura do relógio, nenhum
// React, nenhum cliente de banco, e nenhuma CHAMADA às funções de `./calculo`/`./forno` (só os
// TIPOS que elas produzem). Mesmo desenho que `lib/precificacao/calculo.ts` já usa com
// `CabemNoForno` — cada módulo puro desta cadeia recebe o resultado do módulo "de baixo" como
// dado pronto, nunca chama a função sozinho. Quem WIRE-A a cadeia inteira (chama `quantasCabem`,
// depois `calcularPeca` duas vezes — canal direto e galeria — depois `farolDoPreco`, e só então
// `resultadoDaFicha` para montar o que a tela mostra) é o Diálogo (Client Component) e, no
// servidor, ninguém: `criarFicha`/`editarFicha` (lib/precificacao/acoes.ts) só precisam de
// `validarFicha`, nunca do preço calculado.
//
// `validarFicha` espelha, um a um, os `check`s de `fichas_precificacao` gravados em `db/schema.ts`
// (migração 0017, plano 01) — o banco é a última camada, a frase humana vem daqui. Mesmo molde de
// `lib/cadastros/catalogo.ts::validarItem`: resultado discriminado, frase local (nunca importada
// de `textos.ts` — este módulo não pode importar valor nenhum).
import type {
  FarolDoPreco,
  FichaParaCalculo,
  MotivoDeCalculoInvalido,
  ResultadoDoCalculo,
} from "./calculo";
import type { CabemNoForno, ContagemInformada, MedidasDaPeca } from "./forno";

// A ficha em edição, já nas unidades INTEIRAS do banco (argila/esmalte em miligramas, horas em
// milésimos, medidas em milímetros, dinheiro em centavos) — a conversão de texto digitado
// ("0,6", "12 cm", "R$ 3,50") para estes inteiros é feita em `lib/precificacao/esquemas.ts`
// (Tarefa 2), nunca aqui.
export type FichaEmEdicao = {
  nome: string;
  argilaMiligramas: number;
  esmalteMiligramas: number;
  horasMilesimos: number;
  larguraMm: number;
  profundidadeMm: number;
  alturaMm: number;
  embalagemCentavos: number;
  // "Já contei" (D-12): `null` = "não contei, calcule pelas medidas". Zero e `null` são a MESMA
  // coisa aqui — a normalização "0 vira null" é feita por `paraContagemInformada`, abaixo, não
  // pela conversão de texto (que só sabe transformar dígito em inteiro, não decidir semântica).
  cabemBiscoitoInformado: number | null;
  cabemEsmalteInformado: number | null;
  precoMercadoCentavos: number | null;
  // Preço praticado DIGITADO no formulário — para uma ficha de linha, este é o preço que
  // `criarFicha`/`editarFicha` move para `itens_catalogo.preco_venda_centavos` (D-18); a ficha
  // gravada no banco NUNCA guarda este valor quando `exclusiva` é falso.
  precoPraticadoCentavos: number | null;
  exclusiva: boolean;
  // Ignorado quando `exclusiva` é verdadeiro (o campo some no diálogo) — `validarFicha` não
  // recusa uma categoria presente numa ficha exclusiva, só não a usa.
  categoriaVendaId: string | null;
};

export type ResultadoDeValidacaoDaFicha = { ok: true } | { ok: false; erro: string };

export const FRASE_NOME_OBRIGATORIO = "Dê um nome à peça.";
export const FRASE_NOME_MUITO_LONGO = "O nome da peça passa de 120 letras — encurte.";
export const FRASE_SEM_CATEGORIA_DE_VENDA =
  "Escolha a categoria de venda — é nela que o item do Catálogo nasce.";

// 3 m — bem mais que qualquer peça de cerâmica de verdade (o forno cadastrado tem 30-40 cm por
// dentro), mas o bastante para nunca incomodar uma peça grande de propósito. Pega erro de
// digitação ("peça de 10 metros") sem inventar um limite que dependa do forno de hoje.
const TETO_DA_MEDIDA_MM = 3000;
// Mesmo teto genérico dos `check`s de argila/esmalte/horas/embalagem em `db/schema.ts`
// (`between 0 and 10000000`) — este módulo espelha o MESMO número, nunca um mais apertado para
// estes campos (só as três medidas físicas ganham o teto de bom-senso acima).
const TETO_DO_RESTO = 10_000_000;

function fraseCampoNegativo(rotulo: string): string {
  return `O valor de ${rotulo} não pode ser negativo.`;
}

function fraseCampoAcimaDoTeto(rotulo: string): string {
  return `O valor de ${rotulo} parece errado — confira o que foi digitado.`;
}

type CampoNumericoDaFicha = { rotulo: string; valor: number; teto: number };

// A regra única da ficha — chamada IDÊNTICA no diálogo (mostrar, ao vivo) e na Server Action
// (gravar), nunca uma segunda cópia (key_links do plano).
export function validarFicha(ficha: FichaEmEdicao): ResultadoDeValidacaoDaFicha {
  const nomeNormalizado = ficha.nome.trim();
  if (nomeNormalizado.length === 0) {
    return { ok: false, erro: FRASE_NOME_OBRIGATORIO };
  }
  // Pontos de código (`[...texto].length`), não unidades UTF-16 — mesma disciplina de
  // `fichas_precificacao_nome_comprimento` (`length(trim(nome))` no Postgres conta assim).
  if ([...nomeNormalizado].length > 120) {
    return { ok: false, erro: FRASE_NOME_MUITO_LONGO };
  }

  // Ficha de linha precisa saber em que categoria o item do Catálogo nasce (D-18); ficha
  // exclusiva ignora o campo, mesmo que ele venha preenchido (o diálogo o esconde, mas nada aqui
  // recusa por causa disso).
  if (!ficha.exclusiva && !ficha.categoriaVendaId) {
    return { ok: false, erro: FRASE_SEM_CATEGORIA_DE_VENDA };
  }

  const camposDeMedida: CampoNumericoDaFicha[] = [
    { rotulo: "a largura", valor: ficha.larguraMm, teto: TETO_DA_MEDIDA_MM },
    { rotulo: "a profundidade", valor: ficha.profundidadeMm, teto: TETO_DA_MEDIDA_MM },
    { rotulo: "a altura", valor: ficha.alturaMm, teto: TETO_DA_MEDIDA_MM },
  ];
  const outrosCampos: CampoNumericoDaFicha[] = [
    { rotulo: "a argila", valor: ficha.argilaMiligramas, teto: TETO_DO_RESTO },
    { rotulo: "o esmalte", valor: ficha.esmalteMiligramas, teto: TETO_DO_RESTO },
    { rotulo: "as horas de trabalho", valor: ficha.horasMilesimos, teto: TETO_DO_RESTO },
    { rotulo: "a embalagem e acessório", valor: ficha.embalagemCentavos, teto: TETO_DO_RESTO },
  ];

  for (const campo of [...camposDeMedida, ...outrosCampos]) {
    if (campo.valor < 0) {
      return { ok: false, erro: fraseCampoNegativo(campo.rotulo) };
    }
    if (campo.valor > campo.teto) {
      return { ok: false, erro: fraseCampoAcimaDoTeto(campo.rotulo) };
    }
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// A ponte para `calcularPeca`/`quantasCabem` — CONVERTE a ficha gravada no formato que aquelas
// funções esperam. Quem CHAMA `calcularPeca`/`quantasCabem` de verdade é sempre o caller (o
// diálogo, no cliente) — nunca este módulo (só `import type` é permitido aqui).
// ---------------------------------------------------------------------------------------------

export function paraFichaDeCalculo(ficha: FichaEmEdicao): FichaParaCalculo {
  return {
    argilaMiligramas: ficha.argilaMiligramas,
    esmalteMiligramas: ficha.esmalteMiligramas,
    horasMilesimos: ficha.horasMilesimos,
    embalagemCentavos: ficha.embalagemCentavos,
  };
}

export function paraMedidasDaPeca(ficha: FichaEmEdicao): MedidasDaPeca {
  return {
    larguraMm: ficha.larguraMm,
    profundidadeMm: ficha.profundidadeMm,
    alturaMm: ficha.alturaMm,
  };
}

// Zero e vazio significam "não contei" (D-12) — só aqui, na fronteira com `quantasCabem`, o zero
// vira `null`; a ficha gravada no banco guarda o zero literal (o `check` de
// `fichas_precificacao` só exige "não negativo", nunca "maior que zero").
export function paraContagemInformada(ficha: FichaEmEdicao): ContagemInformada {
  return {
    biscoito: ficha.cabemBiscoitoInformado === 0 ? null : ficha.cabemBiscoitoInformado,
    esmalte: ficha.cabemEsmalteInformado === 0 ? null : ficha.cabemEsmalteInformado,
  };
}

// ---------------------------------------------------------------------------------------------
// A montagem do que a tela mostra — as cinco fatias da barra, os três preços, o selo e de onde
// vem cada contagem do forno. Recebe os resultados JÁ CALCULADOS pelo caller (nunca chama
// `calcularPeca`/`quantasCabem`/`farolDoPreco` sozinho).
// ---------------------------------------------------------------------------------------------

export type ChaveDaFatiaDeCusto = "material" | "trabalho" | "queima" | "embalagem" | "perda";

export type FatiaDoCusto = {
  chave: ChaveDaFatiaDeCusto;
  centavos: number;
};

export type OrigemDaContagem = "calculado" | "informado";

export type ResultadoDaFicha =
  | {
      ok: true;
      // As cinco fatias somam EXATAMENTE `custoCentavos` — as quatro primeiras vêm direto de
      // `calcularPeca`, a quinta (perda) É `perdaCentavos` (já derivada por subtração dentro de
      // `calcularPeca`: `custo - direto`), nunca uma sexta conta própria. Isso é o que fecha a
      // soma sem resíduo de arredondamento, por construção.
      fatias: FatiaDoCusto[];
      custoCentavos: number;
      minimoCentavos: number;
      // `null` só no caso raro em que o divisor do canal galeria (que soma a comissão) não fecha
      // mesmo o divisor do canal direto fechando — a tela mostra "—" no lugar do número, nunca
      // trava o restante do resultado por causa disso (ver "Decidido sem o dono" do SUMMARY).
      minimoGaleriaCentavos: number | null;
      zeroCentavos: number;
      farol: FarolDoPreco;
      forno: {
        esmalte: number;
        biscoito: number;
        porPrateleira: number;
        niveis: number;
        origemEsmalte: OrigemDaContagem;
        origemBiscoito: OrigemDaContagem;
      };
    }
  | { ok: false; motivo: MotivoDeCalculoInvalido };

export function resultadoDaFicha(entrada: {
  cabem: CabemNoForno;
  resultadoDireto: ResultadoDoCalculo;
  resultadoGaleria: ResultadoDoCalculo;
  // Computado pelo caller via `farolDoPreco` (lib/precificacao/calculo.ts) — este módulo nunca
  // reimplementa a comparação de fronteiras do farol, só carrega o valor já decidido.
  farol: FarolDoPreco;
}): ResultadoDaFicha {
  const { cabem, resultadoDireto, resultadoGaleria, farol } = entrada;

  if (!resultadoDireto.ok) {
    return { ok: false, motivo: resultadoDireto.motivo };
  }

  const fatias: FatiaDoCusto[] = [
    { chave: "material", centavos: resultadoDireto.materialCentavos },
    { chave: "trabalho", centavos: resultadoDireto.trabalhoCentavos },
    { chave: "queima", centavos: resultadoDireto.queimaCentavos },
    { chave: "embalagem", centavos: resultadoDireto.embalagemCentavos },
    { chave: "perda", centavos: resultadoDireto.perdaCentavos },
  ];

  return {
    ok: true,
    fatias,
    custoCentavos: resultadoDireto.custoCentavos,
    minimoCentavos: resultadoDireto.minimoCentavos,
    minimoGaleriaCentavos: resultadoGaleria.ok ? resultadoGaleria.minimoCentavos : null,
    zeroCentavos: resultadoDireto.zeroCentavos,
    farol,
    forno: {
      esmalte: cabem.esmalte,
      biscoito: cabem.biscoito,
      porPrateleira: cabem.porPrateleira,
      niveis: cabem.niveis,
      origemEsmalte: cabem.esmalteAutomatico ? "calculado" : "informado",
      origemBiscoito: cabem.biscoitoAutomatico ? "calculado" : "informado",
    },
  };
}
