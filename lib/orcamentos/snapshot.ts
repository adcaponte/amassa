// Módulo puro (D-14): SÓ `import type` é permitido aqui — nenhuma leitura do relógio, nenhum
// React, nenhum cliente de banco. "hoje"/"congeladoEm" sempre entram por argumento, nunca lidos
// de dentro (mesma disciplina de toda regra de negócio deste projeto).
//
// 🔴 O snapshot é um CONTRATO DE PERSISTÊNCIA (D-21): o que `montarSnapshot` grava em
// `orcamentos.snapshot` hoje vai ser lido por `lerDoSnapshot` daqui a meses, possivelmente depois
// de este próprio arquivo ter ganhado campos novos. Por isso `lerDoSnapshot` NUNCA assume que um
// campo existe — um campo ausente vira zero (ou texto vazio) e entra na lista `camposFaltantes`,
// para a tela poder avisar em vez de mostrar um número errado como se fosse verdadeiro.
//
// Por linha, o snapshot guarda exatamente os seis campos que o briefing lista (§5) — nem mais nem
// menos: nome, custo, mínimo, zero, horas e quantas cabem (as duas contagens de forno, biscoito e
// esmalte, contam como UM campo aqui — a mesma dupla que `lib/precificacao/forno.ts::CabemNoForno`
// já trata como uma unidade). A composição por insumo ("De onde vem o custo") NUNCA é congelada:
// isso pertence à ficha em edição, nunca a uma linha de orçamento.

export type LinhaCongelada = {
  nome: string;
  custoCentavos: number;
  minimoCentavos: number;
  zeroCentavos: number;
  horasMilesimos: number;
  quantasCabem: { biscoito: number; esmalte: number };
};

export type SnapshotDoOrcamento = {
  linhas: LinhaCongelada[];
  // Imposto + taxa do cartão, somados em pontos-base (10000 = 100%) — o MESMO agregado que
  // `lib/orcamentos/contas.ts::ExtrasDoOrcamentoParaContas.impostoETaxaPontosBase` espera, para a
  // leitura congelada alimentar `contasDoOrcamento` sem nenhuma tradução extra.
  impostoETaxaPontosBase: number;
  parametrosEstimados: number;
  // Instante do congelamento (ISO 8601, UTC) — um MOMENTO, não uma data civil (D-21, regra de
  // fuso do projeto). Guardado aqui além da coluna `orcamentos.congelado_em` porque o snapshot
  // precisa ser autocontido: um dia ele pode ser lido fora do contexto da própria linha do banco
  // (auditoria, exportação) e não deve depender de outra coluna para se explicar sozinho.
  congeladoEm: string;
};

export type LinhaParaMontarSnapshot = {
  nome: string;
  custoCentavos: number;
  minimoCentavos: number;
  zeroCentavos: number;
  horasMilesimos: number;
  quantasCabemBiscoito: number;
  quantasCabemEsmalte: number;
};

export type EntradaParaMontarSnapshot = {
  linhas: LinhaParaMontarSnapshot[];
  impostoETaxaPontosBase: number;
  parametrosEstimados: number;
  congeladoEm: string;
};

// Chamada num lugar só (key_link do plano): dentro da transação de `marcarComoEnviado`
// (lib/orcamentos/acoes.ts), com os parâmetros JÁ resolvidos (vigentes de hoje) e cada linha JÁ
// calculada (`calcularPeca`/`quantasCabem`, canal "direto") — este módulo nunca chama aquela
// cadeia sozinho (D-14: só `import type`).
export function montarSnapshot(entrada: EntradaParaMontarSnapshot): SnapshotDoOrcamento {
  return {
    linhas: entrada.linhas.map((linha) => ({
      nome: linha.nome,
      custoCentavos: linha.custoCentavos,
      minimoCentavos: linha.minimoCentavos,
      zeroCentavos: linha.zeroCentavos,
      horasMilesimos: linha.horasMilesimos,
      quantasCabem: { biscoito: linha.quantasCabemBiscoito, esmalte: linha.quantasCabemEsmalte },
    })),
    impostoETaxaPontosBase: entrada.impostoETaxaPontosBase,
    parametrosEstimados: entrada.parametrosEstimados,
    congeladoEm: entrada.congeladoEm,
  };
}

export type LeituraDoSnapshot = {
  linhas: LinhaCongelada[];
  impostoETaxaPontosBase: number;
  parametrosEstimados: number;
  congeladoEm: string;
  // Um item por campo ausente ou de tipo errado, na forma "linha N · campo" ou "campo" (para os
  // campos do topo) — vazio quando o snapshot está completo. A tela usa isto para avisar em vez
  // de confiar num zero que pode não ser verdadeiro.
  camposFaltantes: string[];
};

function comoObjeto(valor: unknown): Record<string, unknown> {
  return typeof valor === "object" && valor !== null ? (valor as Record<string, unknown>) : {};
}

function numeroOuFaltante(valor: unknown, caminho: string, faltantes: string[]): number {
  if (typeof valor === "number" && Number.isFinite(valor)) {
    return valor;
  }
  faltantes.push(caminho);
  return 0;
}

function textoOuFaltante(valor: unknown, caminho: string, faltantes: string[]): string {
  if (typeof valor === "string") {
    return valor;
  }
  faltantes.push(caminho);
  return "";
}

// A ÚNICA porta de leitura dos números congelados (key_link do plano) — a tela nunca escolhe
// entre "calcular" e "ler"; quem decide isso é `EditorOrcamento`, que só chama esta função quando
// o orçamento não é mais rascunho. Aceita `unknown` de propósito: o valor vem de uma coluna
// `jsonb`, e este módulo não confia na forma de nada que não construiu ele mesmo.
export function lerDoSnapshot(bruto: unknown): LeituraDoSnapshot {
  const faltantes: string[] = [];
  const objeto = comoObjeto(bruto);

  const linhasBrutas = Array.isArray(objeto.linhas) ? objeto.linhas : [];
  if (!Array.isArray(objeto.linhas)) {
    faltantes.push("linhas");
  }

  const linhas: LinhaCongelada[] = linhasBrutas.map((linhaBruta, indice) => {
    const linha = comoObjeto(linhaBruta);
    const prefixo = `linha ${indice + 1}`;
    const quantasCabemBruto = comoObjeto(linha.quantasCabem);

    return {
      nome: textoOuFaltante(linha.nome, `${prefixo} · nome`, faltantes),
      custoCentavos: numeroOuFaltante(linha.custoCentavos, `${prefixo} · custo`, faltantes),
      minimoCentavos: numeroOuFaltante(linha.minimoCentavos, `${prefixo} · mínimo`, faltantes),
      zeroCentavos: numeroOuFaltante(linha.zeroCentavos, `${prefixo} · zero`, faltantes),
      horasMilesimos: numeroOuFaltante(linha.horasMilesimos, `${prefixo} · horas`, faltantes),
      quantasCabem: {
        biscoito: numeroOuFaltante(quantasCabemBruto.biscoito, `${prefixo} · cabem no biscoito`, faltantes),
        esmalte: numeroOuFaltante(quantasCabemBruto.esmalte, `${prefixo} · cabem no esmalte`, faltantes),
      },
    };
  });

  return {
    linhas,
    impostoETaxaPontosBase: numeroOuFaltante(objeto.impostoETaxaPontosBase, "imposto + taxa", faltantes),
    parametrosEstimados: numeroOuFaltante(objeto.parametrosEstimados, "parâmetros estimados", faltantes),
    congeladoEm: textoOuFaltante(objeto.congeladoEm, "congelado em", faltantes),
    camposFaltantes: faltantes,
  };
}
