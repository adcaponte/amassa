// Módulo puro — nem sequer um `import type` (o grep de aceite do plano proíbe até isso: nenhuma
// linha alcançando o módulo do banco neste arquivo). Os literais abaixo espelham à mão os enums
// `grupo_categoria`/`area_financeira` do schema do banco — a mesma disciplina de
// `lib/financeiro/textos.ts` (cada módulo redeclara, nunca importa de outro), levada um passo
// adiante aqui porque nem o `import type` é permitido.
export type GrupoDeCategoria = "receita" | "custo" | "geral" | "fora";
export type AreaFinanceira = "cafeteria" | "espaco" | "pecas" | "loja" | "geral";

// A ordem fixa de exibição dos grupos nas listas de Cadastros (UI-SPEC "Categorias — agrupada
// pela ordemDosGrupos").
export const ordemDosGrupos: readonly GrupoDeCategoria[] = ["receita", "custo", "geral", "fora"];

// Grupo `geral`/`fora` SEMPRE anda com área `geral` — a mesma equivalência que o `check`
// `categorias_grupo_area_coerente` (migração 0014) prova no banco. Para `receita`/`custo` não há
// área fixa (é escolhida entre as quatro de verdade); `null` sinaliza isso a quem chama.
export function areaFixaDoGrupo(grupo: GrupoDeCategoria): AreaFinanceira | null {
  if (grupo === "geral" || grupo === "fora") {
    return "geral";
  }
  return null;
}

export type UsoDaCategoria = {
  lancamentos: number;
  itens: number;
  contasFixas: number;
  // Chave de sistema (ex.: "diferenca", D-02) — não nulo trava grupo/área mesmo com uso zero.
  chaveDoSistema: string | null;
};

// Grupo e área só mudam quando a categoria não tem NENHUM uso (nenhum lançamento, nenhum item de
// catálogo como categoria de venda/compra, nenhuma conta fixa) E não é uma categoria do sistema
// (FNC-12, D-02). Esta é a MESMA regra que o gatilho `travar_grupo_e_area_da_categoria`
// (migração 0015) aplica no banco — verificada aqui do lado da aplicação, ANTES de a ação
// sequer tentar escrever, para a tela travar os campos e a mensagem de recusa não depender de
// esperar o banco reclamar.
export function podeMudarGrupoEArea(uso: UsoDaCategoria): boolean {
  if (uso.chaveDoSistema !== null) {
    return false;
  }
  return uso.lancamentos === 0 && uso.itens === 0 && uso.contasFixas === 0;
}
