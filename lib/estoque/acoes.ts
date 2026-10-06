"use server";

import { revalidatePath } from "next/cache";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { categorias, itensCatalogo } from "@/db/schema";
import {
  FRASE_ESTOQUE_SEM_CATEGORIA_COMPRA,
  categoriaDeCompraValida,
  type Unidade,
} from "@/lib/cadastros/catalogo";
import { esquemaItem } from "@/lib/cadastros/esquemas";
import { FRASE_CATEGORIA_DE_COMPRA_INVALIDA } from "@/lib/cadastros/textos";
import type { AreaFinanceira } from "@/lib/cadastros/categorias";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { codigoDoErroPostgres } from "@/lib/erro/postgres";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import {
  gastoPor,
  historicoDoMaterial,
  resumoDoMaterial,
  type LinhaDoHistorico,
  type ResumoDoMaterial,
} from "./consultas";
import {
  campoDoMaterial,
  entradaDeItemDoMaterial,
  esquemaConfirmarContagem,
  esquemaLerMaterial,
  esquemaNovoMaterial,
  esquemaRegistrarMovimentacao,
  esquemaSalvarMaterial,
  type CampoDoMaterial,
  type RegistrarMovimentacaoValidado,
} from "./esquemas";
import {
  encomendaEmAndamento,
  gravarAjuste,
  gravarContagem,
  gravarMovimentacoes,
  itemTemFichaDePrecificacao,
  travarItens,
  type TransacaoDoBanco,
} from "./gravacao";
import type { ModoDaContagem } from "./contagem";
import type { ProdutoQueGasta } from "./historico";
import { areaDoItemNoEstoque } from "./saldo";
import { pedidoDeEntradaManual, pedidoDeSaidaManual, type PedidoDeMovimentacao } from "./pedidos";
import {
  FRASE_CUSTO_OBRIGATORIO,
  FRASE_ORDEM_FORA_DE_ANDAMENTO,
  FRASE_ERRO_CARREGAR_MATERIAL,
  FRASE_FALHA_AO_CADASTRAR,
  FRASE_FALHA_AO_GRAVAR_CONTAGEM,
  FRASE_FALHA_AO_REGISTRAR,
  FRASE_FALHA_AO_SALVAR_MATERIAL,
  FRASE_MATERIAL_NAO_EXISTE_MAIS,
  LIMITE_DO_VINCULO,
  fraseMaterialDesativado,
} from "./textos";

// Mesma forma de `lib/financeiro/acoes.ts` — cada módulo redeclara, não há tipo compartilhado.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

export type MovimentacaoRegistrada = {
  tipo: "entrada" | "saida" | "ajuste";
  nome: string;
  unidade: Unidade;
  // `false` só no ajuste cuja diferença, no servidor, deu zero: nada foi gravado (EST-08).
  gravou: boolean;
  // `true` = "Conferido. O saldo já estava correto." — o ajuste sem diferença (EST-08).
  conferido: boolean;
  // Com sinal, como gravado (0 quando nada foi gravado).
  quantidadeMilesimos: number;
  saldoAntesMilesimos: number;
  saldoDepoisMilesimos: number;
};

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

class MaterialNaoEncontrado extends Error {}
class MaterialDesativado extends Error {
  constructor(readonly nome: string) {
    super(`Material desativado: ${nome}`);
  }
}
class OrdemForaDeAndamento extends Error {}
class CustoDaPecaProntaZerado extends Error {}
// A contagem recusada SOB A TRAVA, com a frase de `gravarContagem`: a primeira contagem ficou
// positiva com um custo que não é centavo inteiro (`planejarContagem` — desde a 06.5 o vazio vale
// R$ 0, UI-D14), ou o custo foi digitado contra um saldo que já mudou (`conferirSaldoDoCusto`,
// revisão WR-03). As duas moram no "Custou ao todo".
class RecusaDaContagem extends Error {
  constructor(
    mensagem: string,
    readonly saldoMilesimos: number,
  ) {
    super(mensagem);
  }
}

// O nome da ordem de produção, CONGELADO em `nota` (Pitfall 10): o histórico lê o nome dali, mesmo
// que a ordem mude de nome depois. O nome tem até 120 caracteres (check de `ordens_producao`),
// abaixo dos 160 da `nota` — o corte por pontos de código é só defesa.
function notaDaEncomenda(nome: string): string {
  return [...nome.normalize("NFC").trim()].slice(0, LIMITE_DO_VINCULO).join("");
}

type DadosDeEntradaOuSaida = Exclude<RegistrarMovimentacaoValidado, { tipo: "ajuste" }>;

// A ordem do vínculo "Consumo em encomenda", TRAVADA e conferida em andamento — ou `null` quando a
// saída não tem vínculo. Chamada ANTES de `travarItens` (ordem de travas DOCUMENTO → ORDEM → ITENS,
// revisão 06.1, WR-04 — ver `encomendaEmAndamento`).
async function travarOrdemDoVinculo(
  tx: TransacaoDoBanco,
  dados: RegistrarMovimentacaoValidado,
): Promise<{ id: string; nome: string } | null> {
  if (dados.tipo !== "saida" || !dados.encomendaId) {
    return null;
  }
  const ordem = await encomendaEmAndamento(tx, dados.encomendaId);
  if (!ordem) {
    throw new OrdemForaDeAndamento();
  }
  return ordem;
}

// O pedido da entrada ou da saída, montado DENTRO da transação: a peça pronta e a ordem do vínculo
// são conferidas no banco, com a `tx`, nunca aceitas do cliente (T-06-23, T-06.1-09). A ordem do
// vínculo chega já travada (`travarOrdemDoVinculo`).
async function pedidoDaFolha(
  tx: TransacaoDoBanco,
  dados: DadosDeEntradaOuSaida,
  ordemDoVinculo: { id: string; nome: string } | null,
): Promise<PedidoDeMovimentacao> {
  if (dados.tipo === "entrada") {
    // D-09/D-29: peça pronta = item com ficha de precificação ligada. Até a Produção existir, ela
    // entra à mão com custo — e custo zero é recusado (EST-21): o custo da ficha nunca é zero, e
    // uma peça pronta de graça derrubaria o custo médio das outras da prateleira. A entrada manual
    // comum continua aceitando R$ 0,00 (doação, amostra — decisão do plano 06-01).
    const pecaPronta = await itemTemFichaDePrecificacao(tx, dados.itemId);
    if (pecaPronta && dados.custoTexto === 0) {
      throw new CustoDaPecaProntaZerado();
    }
    return pedidoDeEntradaManual({
      itemId: dados.itemId,
      milesimos: dados.quantidadeTexto,
      custoCentavos: dados.custoTexto,
      pecaPronta,
    });
  }

  let encomendaId: string | null = null;
  let nota: string | null = dados.turmaTexto ?? dados.oQueAconteceuTexto;
  if (ordemDoVinculo) {
    encomendaId = ordemDoVinculo.id;
    nota = notaDaEncomenda(ordemDoVinculo.nome);
  }
  return pedidoDeSaidaManual({
    itemId: dados.itemId,
    milesimos: dados.quantidadeTexto,
    destino: dados.destino,
    nota,
    encomendaId,
  });
}

// Entrada, saída ou ajuste manual (planos 06-01 e 06-05). `exigirUsuario()` é a PRIMEIRA instrução
// do corpo (T-06-01, T-06-27 — cobrado por árvore sintática em `npm run verificar-acoes`). Do cliente
// chegam só o id do item, o tipo, os textos (quantidade, custo, contado, vínculos), o destino e o id
// da encomenda (T-06-03); a ÁREA sai do destino, o VALOR sai de `lib/estoque/custo.ts` sob a trava,
// a DIFERENÇA do ajuste sai do saldo lido sob a trava (`gravarAjuste`, T-06-22) e o motivo
// `peca_pronta` sai da ficha de precificação (T-06-23) — nunca do cliente.
//
// O Estoque NUNCA lança nada no Caixa (T-06-26): esta ação não cria documento, parcela nem linha
// do Financeiro. Compra de verdade se lança em Financeiro → Despesa → Compra de material, que já dá
// entrada aqui sozinha — senão o dinheiro some do Caixa ou o material entra em dobro.
export async function registrarMovimentacao(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<MovimentacaoRegistrada>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaRegistrarMovimentacao.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const dados = resultado.data;

  let registrada: MovimentacaoRegistrada;
  try {
    registrada = await db.transaction(async (tx): Promise<MovimentacaoRegistrada> => {
      // A ORDEM do vínculo primeiro, e só depois o ITEM (DOCUMENTO → ORDEM → ITENS, revisão 06.1,
      // WR-04): com a mesma trava da Produção, a baixa espera quem cancela ou conclui a ordem e
      // relê o status — nunca grava consumo ligado a uma ordem que acabou de ser encerrada.
      const ordemDoVinculo = await travarOrdemDoVinculo(tx, dados);

      // Decide sob a trava: o item pode ter sido desativado (ou perdido o estoque próprio) entre
      // abrir a folha e tocar em "Registrar".
      const travados = await travarItens(tx, [dados.itemId]);
      const item = travados.get(dados.itemId);
      if (!item || !item.controlaEstoque || item.unidade === null) {
        throw new MaterialNaoEncontrado();
      }
      if (!item.ativo) {
        throw new MaterialDesativado(item.nome);
      }

      if (dados.tipo === "ajuste") {
        // EST-07/EST-08 contra o saldo do INSTANTE (D-18): a prévia da folha era só prévia.
        const ajuste = await gravarAjuste(
          tx,
          { itemId: dados.itemId, contadoMilesimos: dados.contadoTexto, nota: dados.motivoTexto },
          { registradoPor: usuario.id },
        );
        if (!ajuste.gravou) {
          return {
            tipo: "ajuste",
            nome: item.nome,
            unidade: item.unidade,
            gravou: false,
            conferido: true,
            quantidadeMilesimos: 0,
            saldoAntesMilesimos: ajuste.saldoMilesimos,
            saldoDepoisMilesimos: ajuste.saldoMilesimos,
          };
        }
        return {
          tipo: "ajuste",
          nome: item.nome,
          unidade: item.unidade,
          gravou: true,
          conferido: false,
          quantidadeMilesimos: ajuste.movimentacao.quantidadeMilesimos,
          saldoAntesMilesimos: ajuste.movimentacao.saldoAntesMilesimos,
          saldoDepoisMilesimos: ajuste.movimentacao.saldoDepoisMilesimos,
        };
      }

      const pedido = await pedidoDaFolha(tx, dados, ordemDoVinculo);
      const [gravada] = await gravarMovimentacoes(tx, [pedido], { registradoPor: usuario.id });

      return {
        tipo: dados.tipo,
        nome: item.nome,
        unidade: item.unidade,
        gravou: true,
        conferido: false,
        quantidadeMilesimos: gravada.quantidadeMilesimos,
        saldoAntesMilesimos: gravada.saldoAntesMilesimos,
        saldoDepoisMilesimos: gravada.saldoDepoisMilesimos,
      };
    });
  } catch (erro) {
    if (erro instanceof MaterialNaoEncontrado) {
      return { ok: false, erro: FRASE_MATERIAL_NAO_EXISTE_MAIS };
    }
    if (erro instanceof MaterialDesativado) {
      return { ok: false, erro: fraseMaterialDesativado(erro.nome) };
    }
    if (erro instanceof OrdemForaDeAndamento) {
      return { ok: false, erro: FRASE_ORDEM_FORA_DE_ANDAMENTO };
    }
    if (erro instanceof CustoDaPecaProntaZerado) {
      return { ok: false, erro: FRASE_CUSTO_OBRIGATORIO };
    }
    // T-06-08: o texto do banco nunca chega à tela. O SQLSTATE fica só no log — lido de
    // `erro.cause.code` por `codigoDoErroPostgres` (o Drizzle embrulha o erro do `pg`).
    console.error(
      `Falha ao registrar movimentação de estoque (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_REGISTRAR };
  }

  // Fora do `try`: a gravação já está confirmada — uma falha aqui nunca vira "não deu para
  // registrar" de algo que já está no livro (mesma disciplina de `salvarAnotacoes`). O ajuste
  // conferido não gravou nada: não há o que revalidar.
  if (registrada.gravou) {
    revalidatePath(rotaDeGestao("/estoque"));
    revalidatePath(rotaDeGestao("/"));
  }
  return { ok: true, dados: registrada };
}

// ---------------------------------------------------------------------------------------------
// A folha de um material (plano 06-09).
// ---------------------------------------------------------------------------------------------

export type FolhaDoMaterial = {
  resumo: ResumoDoMaterial;
  gastoPor: ProdutoQueGasta[];
  // As `limite` movimentações mais recentes DESTE material, pela ordem do livro (`numero` desc).
  linhas: LinhaDoHistorico[];
  // Há mais linhas além desta página: a nota "Somando de cima para baixo…" não aparece.
  temMais: boolean;
  // O "agora" do SERVIDOR — o "Hoje"/"Ontem" de cada linha é calculado contra ele, como na aba
  // Histórico (que lê o relógio no Server Component).
  agora: Date;
};

// A folha do material (plano 06-09): o resumo, as observações, o "Gasto por" e o livro dele. É uma
// LEITURA, mas é Server Action chamada do cliente — a regra vale igual: `exigirUsuario()` é a
// PRIMEIRA instrução (T-06-39). Do cliente chegam só o id e o tamanho da página, que o Zod limita a
// múltiplos de 50 até 1000 (T-06-42).
export async function lerFolhaDoMaterial(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<FolhaDoMaterial>> {
  await exigirUsuario();

  const resultado = esquemaLerMaterial.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: FRASE_MATERIAL_NAO_EXISTE_MAIS };
  }
  const { itemId, limite } = resultado.data;

  try {
    const resumo = await resumoDoMaterial(itemId);
    if (!resumo) {
      return { ok: false, erro: FRASE_MATERIAL_NAO_EXISTE_MAIS };
    }
    const [produtos, pagina] = await Promise.all([
      gastoPor(itemId, resumo.unidade),
      historicoDoMaterial(itemId, limite),
    ]);
    return {
      ok: true,
      dados: {
        resumo,
        gastoPor: produtos,
        linhas: pagina.linhas,
        temMais: pagina.haMais,
        agora: new Date(),
      },
    };
  } catch (erro) {
    console.error(
      `Falha ao carregar a folha do material (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_ERRO_CARREGAR_MATERIAL };
  }
}

// ---------------------------------------------------------------------------------------------
// "+ Novo material" e "Editar material" (plano 06-09). O Estoque NÃO tem cadastro próprio (D-01):
// cria um item do catálogo pela validação do Cadastros e, depois, só mexe no que é dele — o mínimo e
// as observações. Nenhuma das duas ações muda nome, unidade ou categoria de item existente, nenhuma
// apaga linha, e nenhuma grava `ativo` (desativar e reativar são de `definirItemAtivo`, a ação
// ÚNICA do Cadastros — D-20).
// ---------------------------------------------------------------------------------------------

// O erro volta com o campo, para aparecer embaixo dele (UI-D9).
export type ResultadoDoMaterial<T> =
  | { ok: true; dados: T }
  | { ok: false; erro: string; campo: CampoDoMaterial };

function falhaDeValidacao(resultado: {
  error: { issues: { message: string; path: readonly PropertyKey[] }[] };
}): { ok: false; erro: string; campo: CampoDoMaterial } {
  const problema = resultado.error.issues[0];
  const erro = problema?.message ?? "Não deu para validar os dados enviados.";
  return { ok: false, erro, campo: campoDoMaterial(problema?.path ?? [], erro) };
}

export type MaterialCadastrado = {
  id: string;
  nome: string;
  unidade: Unidade;
  estoqueMinimoMilesimos: number;
  // A área do material no Estoque (a da categoria de compra) e o nome da categoria — para a folha de
  // movimentação abrir em Entrada para ele antes de a lista da página chegar (UI-D12).
  area: AreaFinanceira;
  categoriaCompraNome: string;
};

// "+ Novo material" (EST-13): `exigirUsuario()` é a PRIMEIRA instrução (T-06-39). O nome, a
// unidade e a categoria passam pela FÁBRICA do Cadastros (`esquemaItem`), sobre a entrada montada
// no formato dela — as frases do Cadastros saem sozinhas, na ordem dos campos da folha; o mínimo e
// as observações, por `esquemaNovoMaterial`. A categoria é lida do banco e conferida por
// `categoriaDeCompraValida` (existe, é de custo ou geral, está ativa — T-06-40), a mesma regra do
// Cadastros. Nome repetido é permitido, como no Cadastros (o catálogo não tem nome único). O toque
// duplo é barrado na folha (botão desabilitado em voo).
export async function criarMaterial(
  entradaBruta: unknown,
): Promise<ResultadoDoMaterial<MaterialCadastrado>> {
  await exigirUsuario();

  const item = esquemaItem(new Map()).safeParse(entradaDeItemDoMaterial(entradaBruta));
  if (!item.success) {
    return falhaDeValidacao(item);
  }
  const doEstoque = esquemaNovoMaterial.safeParse(entradaBruta);
  if (!doEstoque.success) {
    return falhaDeValidacao(doEstoque);
  }
  const { nome, unidade, categoriaCompraId } = item.data;
  const { minimoTexto, observacoesTexto } = doEstoque.data;
  if (unidade === null || categoriaCompraId === null) {
    // `validarItem` já recusou os dois casos com a frase do Cadastros — isto só estreita o tipo.
    return { ok: false, erro: FRASE_ESTOQUE_SEM_CATEGORIA_COMPRA, campo: "categoria" };
  }

  let cadastrado: MaterialCadastrado;
  try {
    const [categoria] = await db
      .select({
        grupo: categorias.grupo,
        ativa: categorias.ativa,
        nome: categorias.nome,
        area: categorias.area,
      })
      .from(categorias)
      .where(eq(categorias.id, categoriaCompraId));
    if (!categoria || !categoriaDeCompraValida(categoria, categoriaCompraId, null)) {
      return { ok: false, erro: FRASE_CATEGORIA_DE_COMPRA_INVALIDA, campo: "categoria" };
    }

    const [linha] = await db
      .insert(itensCatalogo)
      .values({
        nome,
        categoriaVendaId: null,
        precoVendaCentavos: null,
        aparecenaVenda: false,
        atalhoVenda: false,
        controlaEstoque: true,
        atalhoCompra: false,
        unidade,
        categoriaCompraId,
        estoqueMinimoMilesimos: minimoTexto,
        observacoes: observacoesTexto,
      })
      .returning({ id: itensCatalogo.id });

    cadastrado = {
      id: linha.id,
      nome,
      unidade,
      estoqueMinimoMilesimos: minimoTexto,
      area: areaDoItemNoEstoque({ compra: categoria.area, venda: null }),
      categoriaCompraNome: categoria.nome,
    };
  } catch (erro) {
    console.error(
      `Falha ao cadastrar material (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_CADASTRAR, campo: "geral" };
  }

  // Fora do `try`: o item já está gravado. O mesmo item aparece no Estoque, no Catálogo e na Compra.
  revalidatePath(rotaDeGestao("/estoque"));
  revalidatePath(rotaDeGestao("/cadastros"));
  revalidatePath(rotaDeGestao("/financeiro"));
  revalidatePath(rotaDeGestao("/"));
  return { ok: true, dados: cadastrado };
}

// "Editar material" (EST-02, D-01): `exigirUsuario()` é a PRIMEIRA instrução (T-06-39). Atualiza
// SÓ o mínimo e as observações de um item que existe e tem estoque próprio — o `update` nunca
// escreve outra coluna (T-06-41; o gatilho P0001 da 0023 guarda a unidade de qualquer forma).
export async function salvarMaterial(entradaBruta: unknown): Promise<ResultadoDoMaterial<{ id: string }>> {
  await exigirUsuario();

  const resultado = esquemaSalvarMaterial.safeParse(entradaBruta);
  if (!resultado.success) {
    return falhaDeValidacao(resultado);
  }
  const { itemId, minimoTexto, observacoesTexto } = resultado.data;

  let atualizados: { id: string }[];
  try {
    atualizados = await db
      .update(itensCatalogo)
      .set({ estoqueMinimoMilesimos: minimoTexto, observacoes: observacoesTexto })
      .where(and(eq(itensCatalogo.id, itemId), eq(itensCatalogo.controlaEstoque, true)))
      .returning({ id: itensCatalogo.id });
  } catch (erro) {
    console.error(
      `Falha ao salvar material (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR_MATERIAL, campo: "geral" };
  }
  if (atualizados.length === 0) {
    return { ok: false, erro: FRASE_MATERIAL_NAO_EXISTE_MAIS, campo: "geral" };
  }

  revalidatePath(rotaDeGestao("/estoque"));
  revalidatePath(rotaDeGestao("/"));
  return { ok: true, dados: { id: itemId } };
}

// ---------------------------------------------------------------------------------------------
// A contagem (plano 06-10): uma ação por material confirmado — sem rascunho (D-18).
// ---------------------------------------------------------------------------------------------

export type ContagemConfirmada = {
  nome: string;
  unidade: Unidade;
  // `false` = diferença zero no servidor: "✓ Conferido — já estava certo", nada gravado.
  gravou: boolean;
  modo: ModoDaContagem;
  saldoAntesMilesimos: number;
  saldoDepoisMilesimos: number;
  diferencaMilesimos: number;
  // O instante da confirmação, em ISO — a linha compacta mostra "hoje {HH:MM}".
  confirmadaEm: string;
};

// A falha diz em que campo mora (a linha põe a frase embaixo dele) e, quando o servidor viu um
// saldo diferente do da página, qual — a linha refaz a prévia e mostra "Custou ao todo" se a
// diferença, agora, passou a ser positiva.
export type ResultadoDaContagemConfirmada =
  | { ok: true; dados: ContagemConfirmada }
  | { ok: false; erro: string; campo: "contado" | "custou" | null; saldoMilesimos: number | null };

export async function confirmarContagem(entradaBruta: unknown): Promise<ResultadoDaContagemConfirmada> {
  const usuario = await exigirUsuario();

  const resultado = esquemaConfirmarContagem.safeParse(entradaBruta);
  if (!resultado.success) {
    const problema = resultado.error.issues[0];
    const caminho = problema?.path[0];
    return {
      ok: false,
      erro: problema?.message ?? "Não deu para validar os dados enviados.",
      campo: caminho === "contadoTexto" ? "contado" : caminho === "custouTexto" ? "custou" : null,
      saldoMilesimos: null,
    };
  }
  const dados = resultado.data;

  let confirmada: ContagemConfirmada;
  try {
    confirmada = await db.transaction(async (tx): Promise<ContagemConfirmada> => {
      // O material pode ter sido desativado (ou perdido o estoque próprio) entre abrir a tela de
      // contagem e confirmar esta linha — decidido sob a trava.
      const travados = await travarItens(tx, [dados.itemId]);
      const item = travados.get(dados.itemId);
      if (!item || !item.controlaEstoque || item.unidade === null) {
        throw new MaterialNaoEncontrado();
      }
      if (!item.ativo) {
        throw new MaterialDesativado(item.nome);
      }

      const contagem = await gravarContagem(
        tx,
        { ...dados, unidade: item.unidade },
        { registradoPor: usuario.id },
      );
      if (contagem.recusa !== null) {
        throw new RecusaDaContagem(contagem.recusa, contagem.saldoAntesMilesimos);
      }
      return {
        nome: item.nome,
        unidade: item.unidade,
        gravou: contagem.gravou,
        modo: contagem.modo,
        saldoAntesMilesimos: contagem.saldoAntesMilesimos,
        saldoDepoisMilesimos: contagem.saldoDepoisMilesimos,
        diferencaMilesimos: contagem.diferencaMilesimos,
        confirmadaEm: new Date().toISOString(),
      };
    });
  } catch (erro) {
    if (erro instanceof MaterialNaoEncontrado) {
      return { ok: false, erro: FRASE_MATERIAL_NAO_EXISTE_MAIS, campo: null, saldoMilesimos: null };
    }
    if (erro instanceof MaterialDesativado) {
      return { ok: false, erro: fraseMaterialDesativado(erro.nome), campo: null, saldoMilesimos: null };
    }
    if (erro instanceof RecusaDaContagem) {
      return { ok: false, erro: erro.message, campo: "custou", saldoMilesimos: erro.saldoMilesimos };
    }
    // T-06-08: o texto do banco nunca chega à tela; o SQLSTATE fica só no log.
    console.error(
      `Falha ao gravar contagem de estoque (SQLSTATE: ${codigoDoErroPostgres(erro) ?? "desconhecido"}):`,
      erro,
    );
    return { ok: false, erro: FRASE_FALHA_AO_GRAVAR_CONTAGEM, campo: null, saldoMilesimos: null };
  }

  // Fora do `try`: a contagem já está no livro; revalidar nunca vira "não deu para gravar".
  if (confirmada.gravou) {
    revalidatePath(rotaDeGestao("/estoque"));
    revalidatePath(rotaDeGestao("/estoque/contagem"));
    revalidatePath(rotaDeGestao("/"));
  }
  return { ok: true, dados: confirmada };
}
