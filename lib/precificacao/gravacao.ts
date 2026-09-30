// A promoção de uma ficha de precificação a PEÇA DE LINHA (D-18/D-19 da 04.5; D-12 da 06.1) — UMA
// implementação só, usada por `editarFicha` (desmarcar "exclusiva" na Precificação) e por
// `concluirOrdem` (a extra boa de peça exclusiva que vai para o Estoque vira peça de linha). Nunca
// uma segunda cópia (D-12).
//
// 🔴 SEM a diretiva `use server`, de propósito (o molde é `lib/estoque/gravacao.ts`, Pitfall 7 da
// Fase 06): toda função exportada de um arquivo com a diretiva vira Server Action — chamável pelo
// navegador — e `npm run verificar-acoes` exigiria `exigirUsuario()` na primeira linha de cada uma.
// Estas funções recebem a TRANSAÇÃO de quem chama, por isso só são alcançáveis de dentro do
// servidor, depois que a ação que as chama já autorizou o usuário (T-06.1-45).
import { eq } from "drizzle-orm";

import { categorias, fichasPrecificacao, itensCatalogo } from "@/db/schema";
import type { TransacaoDoBanco } from "@/lib/estoque/gravacao";

// A categoria de venda não existe, está desativada ou não é do grupo Receitas.
export class CategoriaDeVendaInvalida extends Error {
  constructor() {
    super("categoria de venda inválida");
    this.name = "CategoriaDeVendaInvalida";
  }
}

// A ficha não existe mais (apagada noutro celular).
export class FichaNaoEncontrada extends Error {
  constructor() {
    super("ficha não encontrada");
    this.name = "FichaNaoEncontrada";
  }
}

// Categoria de venda: existir, estar ATIVA, e ser do grupo `receita` — a MESMA regra de
// `lib/cadastros/acoes.ts::categoriaDeVendaValida`, redeclarada aqui (cada módulo tem sua própria
// cópia, D-15 do projeto). Pura: recebe o retrato JÁ carregado do banco, nunca confia no que o
// cliente diz sobre a categoria (T-04.5-19, T-06.1-46).
export function categoriaDeVendaEhValida(
  categoria: { grupo: string; ativa: boolean } | undefined,
): boolean {
  return !!categoria && categoria.ativa && categoria.grupo === "receita";
}

// Lê a categoria DENTRO da transação e recusa a inválida com `CategoriaDeVendaInvalida`.
export async function conferirCategoriaDeVenda(
  tx: TransacaoDoBanco,
  categoriaVendaId: string,
): Promise<void> {
  const [categoria] = await tx
    .select({ ativa: categorias.ativa, grupo: categorias.grupo })
    .from(categorias)
    .where(eq(categorias.id, categoriaVendaId))
    .limit(1);
  if (!categoriaDeVendaEhValida(categoria)) {
    throw new CategoriaDeVendaInvalida();
  }
}

// Faz da ficha uma peça de LINHA: confere a categoria de venda, trava a ficha, cria o item do
// catálogo (ou reaproveita o que ela já tem, atualizando nome, categoria e preço) e grava na ficha
// `exclusiva = false`, `item_catalogo_id` e o preço praticado NULO — na ficha de linha o preço
// praticado É o do item, nunca um segundo valor a sincronizar (D-18). O nome do item é o da ficha
// no momento da chamada (quem edita a ficha grava o nome novo ANTES de chamar).
//
// O item nasce como `editarFicha` sempre o criou: aparece na Venda, SEM estoque próprio (Pitfall 6)
// — quem quer guardar peças nele (a conclusão da ordem, D-13) liga o estoque em seguida, na mesma
// transação. Devolve o id do item.
//
// Trava a ficha com `for no key update` (a mesma trava que o `update` da ficha tomaria): serializa
// com `editarFicha`/`apagarFicha` sem bloquear quem só aponta para a ficha por chave estrangeira
// (uma linha de orçamento, uma peça de ordem nova).
export async function promoverFichaParaLinha(
  tx: TransacaoDoBanco,
  {
    fichaId,
    categoriaVendaId,
    precoCentavos,
  }: { fichaId: string; categoriaVendaId: string; precoCentavos: number | null },
): Promise<string> {
  await conferirCategoriaDeVenda(tx, categoriaVendaId);

  const [ficha] = await tx
    .select({ nome: fichasPrecificacao.nome, itemCatalogoId: fichasPrecificacao.itemCatalogoId })
    .from(fichasPrecificacao)
    .where(eq(fichasPrecificacao.id, fichaId))
    .for("no key update");
  if (!ficha) {
    throw new FichaNaoEncontrada();
  }

  let itemCatalogoId = ficha.itemCatalogoId;
  if (itemCatalogoId) {
    // Já era de linha: atualiza o item existente — nome e preço mudam nele, NUNCA na ficha.
    await tx
      .update(itensCatalogo)
      .set({ nome: ficha.nome, categoriaVendaId, precoVendaCentavos: precoCentavos })
      .where(eq(itensCatalogo.id, itemCatalogoId));
  } else {
    // Promoção de exclusiva → de linha: o item nasce agora, com o preço dado.
    const [item] = await tx
      .insert(itensCatalogo)
      .values({
        nome: ficha.nome,
        categoriaVendaId,
        precoVendaCentavos: precoCentavos,
        aparecenaVenda: true,
      })
      .returning({ id: itensCatalogo.id });
    itemCatalogoId = item.id;
  }

  await tx
    .update(fichasPrecificacao)
    .set({ precoPraticadoCentavos: null, exclusiva: false, itemCatalogoId })
    .where(eq(fichasPrecificacao.id, fichaId));

  return itemCatalogoId;
}
