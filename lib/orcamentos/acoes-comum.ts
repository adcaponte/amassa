// Tipos, classes de recusa e auxiliares PUROS das ações dos Orçamentos (D-24/P10, plano 06.5-27 —
// saíram de `acoes.ts`). SEM diretiva e SEM import que alcance o banco: é o único arquivo sem
// "use server" cujos valores o índice `acoes.ts` poderia reexportar, porque o índice entra no pacote
// do cliente. As classes moram aqui, num lugar só, porque `primeiroErroConhecido` as reconhece por
// `instanceof` para todos os arquivos de ações.

import {
  FRASE_CUSTO_DE_PROJETO_NAO_EXISTE_MAIS,
  FRASE_FALTA_CLIENTE_E_PECA,
  FRASE_FICHA_NAO_ENCONTRADA_PARA_LINHA,
  FRASE_FOTO_NAO_EXISTE_MAIS,
  FRASE_LIMITE_DE_FOTOS,
  FRASE_LINHA_NAO_EXISTE_MAIS,
  FRASE_LISTA_DE_PRECOS_DIVERGENTE,
  FRASE_ORCAMENTO_EXPIRADO_ATUALIZE_PRECOS,
  FRASE_ORCAMENTO_NAO_E_RASCUNHO,
  FRASE_ORCAMENTO_NAO_EXISTE_MAIS,
  FRASE_PARAMETROS_INDISPONIVEIS_PARA_CONGELAR,
} from "./textos";

// Mesma forma de `lib/financeiro/acoes.ts` — cada módulo redeclara, não há tipo compartilhado
// entre módulos (D-15 do projeto).
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

export function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

// ---------------------------------------------------------------------------------------------
// Editar o orçamento (04.5-06-PLAN.md, Tarefa 2) — a guarda de rascunho
// ---------------------------------------------------------------------------------------------

export class OrcamentoNaoEncontrado extends Error {}

export class OrcamentoNaoEhRascunho extends Error {}

export class LinhaNaoEncontrada extends Error {}

export class FichaNaoEncontradaParaLinha extends Error {}

export class CustoDeProjetoNaoEncontrado extends Error {}

// Fotos de referência (04.5-10-PLAN.md, Tarefa 3).
export class FotoNaoEncontrada extends Error {}

export class LimiteDeFotosAtingido extends Error {}

// As quatro transições do ciclo de vida (04.5-08-PLAN.md, Tarefa 2) — erros próprios, para nunca
// confundir "não é rascunho" (as ações de EDIÇÃO acima) com "esta transição específica não é
// permitida a partir do status atual" (mensagens diferentes por transição, ver `textos.ts`).
export class TransicaoDeStatusInvalida extends Error {
  constructor(public mensagem: string) {
    super(mensagem);
  }
}

export class FaltaClienteOuPeca extends Error {}

export class ParametrosIndisponiveis extends Error {}

// "Atualizar preços" (04.5-09-PLAN.md, Tarefa 2): a lista de preços enviada não cobre exatamente
// as linhas do orçamento — sinal de tela desatualizada, nunca uma trava de negócio.
export class ListaDePrecosDivergente extends Error {}

// "Cliente aprovou" (04.5-12-PLAN.md, D-25) — erros próprios da aprovação. `OrcamentoExpirado` é
// distinto de `TransicaoDeStatusInvalida`: o STATUS continua "enviado" (D-22, expirado nunca é
// gravado), só a validade já passou — a transição em si seria válida, mas a tela manda atualizar
// preços antes. Os dois últimos (`CategoriaEncomendasIndisponivel`/`ConferenciaDeParcelasFalhou`)
// NUNCA viram uma mensagem própria: caem no catch genérico, porque são exatamente o tipo de falha
// que D-25 pede para responder sempre com a MESMA frase — "nada foi criado", nunca um detalhe que
// sugeriria uma venda pela metade.
export class OrcamentoExpirado extends Error {}

export class CategoriaEncomendasIndisponivel extends Error {}

export class ConferenciaDeParcelasFalhou extends Error {}

export function primeiroErroConhecido(erro: unknown): string | null {
  if (erro instanceof OrcamentoNaoEncontrado) return FRASE_ORCAMENTO_NAO_EXISTE_MAIS;
  if (erro instanceof OrcamentoNaoEhRascunho) return FRASE_ORCAMENTO_NAO_E_RASCUNHO;
  if (erro instanceof LinhaNaoEncontrada) return FRASE_LINHA_NAO_EXISTE_MAIS;
  if (erro instanceof FichaNaoEncontradaParaLinha) return FRASE_FICHA_NAO_ENCONTRADA_PARA_LINHA;
  if (erro instanceof CustoDeProjetoNaoEncontrado) return FRASE_CUSTO_DE_PROJETO_NAO_EXISTE_MAIS;
  if (erro instanceof TransicaoDeStatusInvalida) return erro.mensagem;
  if (erro instanceof FaltaClienteOuPeca) return FRASE_FALTA_CLIENTE_E_PECA;
  if (erro instanceof ParametrosIndisponiveis) return FRASE_PARAMETROS_INDISPONIVEIS_PARA_CONGELAR;
  if (erro instanceof OrcamentoExpirado) return FRASE_ORCAMENTO_EXPIRADO_ATUALIZE_PRECOS;
  // `CategoriaEncomendasIndisponivel`/`ConferenciaDeParcelasFalhou` NÃO entram aqui de propósito
  // (comentário na própria classe, acima): caem no catch genérico de `aprovarOrcamento`, que
  // devolve `FRASE_FALHA_AO_APROVAR` — a MESMA frase de qualquer outra falha da transação (D-25).
  if (erro instanceof ListaDePrecosDivergente) return FRASE_LISTA_DE_PRECOS_DIVERGENTE;
  if (erro instanceof FotoNaoEncontrada) return FRASE_FOTO_NAO_EXISTE_MAIS;
  if (erro instanceof LimiteDeFotosAtingido) return FRASE_LIMITE_DE_FOTOS;
  return null;
}
