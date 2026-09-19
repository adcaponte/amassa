// Módulo puro (BRIEFING §6): "O que esta venda tira do estoque"/"O que esta compra põe no
// estoque" é CÁLCULO exibido na tela nesta fase, sem gravar movimentação nenhuma. O contrato
// aqui (mesma entrada, mesma saída) é o que a Fase 6 (Estoque) troca de "mostrar" para "gravar" —
// nenhum componente calcula efeito por conta própria.
//
// Toda multiplicação e soma acontece em MILÉSIMOS INTEIROS, nunca em ponto flutuante acumulado:
// `0,04 kg × 4` vira `40 milésimos × 4 = 160 milésimos = 0,16 kg` exatos, em vez de somar
// `0,04 + 0,04 + 0,04 + 0,04` em ponto flutuante (que na prática já erra na primeira soma).
import { formatarQuantidade } from "./formato";

export type SentidoDoEfeito = "venda" | "compra";

// Um componente da ficha técnica: `quantidade` é o texto decimal que vem do banco (`numeric`),
// consumido POR UNIDADE do item que a possui.
export type ComponenteDaFicha = { insumoId: string; quantidade: string };

export type ItemParaEfeito = {
  id: string;
  nome: string;
  // `null` quando o item não controla estoque e não é insumo de nenhuma ficha.
  unidade: string | null;
  controlaEstoque: boolean;
  // Um nível só (BRIEFING §4): o insumo de uma ficha nunca é, ele próprio, expandido por uma
  // segunda ficha.
  ficha: readonly ComponenteDaFicha[];
};

export type LinhaParaEfeito = {
  // `null` numa linha de valor livre — não tira nem põe nada no estoque.
  itemId: string | null;
  // Quantidade de itens VENDIDOS (sentido "venda") — inteiro, sempre presente.
  quantidade: number;
  // Só sentido "compra": quanto ENTROU no estoque, na unidade do item (texto decimal).
  quantidadeEstoque?: string | null;
  // Só sentido "compra": valor total da linha, para calcular o custo unitário.
  valorCentavos?: number;
};

export type EntradaDoEfeito = {
  itemId: string;
  nome: string;
  unidade: string;
  // Positivo (compra) ou negativo (venda), em MILÉSIMOS inteiros da unidade do item.
  variacaoMilesimos: number;
  // Só presente em entradas de compra: valor da linha ÷ quantidade, arredondado.
  custoUnitarioCentavos?: number;
};

export type EfeitoNoEstoque = EntradaDoEfeito[];

// Texto decimal → milésimos inteiros ("0,04" chega já convertido para "0.04" por
// `converterQuantidade`, mas este módulo aceita qualquer texto com ponto decimal, nunca vírgula).
function paraMilesimos(quantidadeTexto: string): number {
  return Math.round(Number(quantidadeTexto) * 1000);
}

// `efeitoNoEstoque(linhas, itens, sentido)` — o contrato do BRIEFING §6: item com ficha técnica
// baixa cada insumo (quantidade da ficha × quantidade da linha); sem ficha, item que controla
// estoque baixa ele mesmo; item sem nenhum dos dois não aparece. Compra: entra a
// `quantidadeEstoque` da linha, com custo unitário = valor da linha ÷ quantidade. A ordem das
// entradas é a ordem de PRIMEIRA aparição (a ordem de inserção de um `Map` do JavaScript).
export function efeitoNoEstoque(
  linhas: readonly LinhaParaEfeito[],
  itens: readonly ItemParaEfeito[],
  sentido: SentidoDoEfeito,
): EfeitoNoEstoque {
  const itemPorId = new Map(itens.map((item) => [item.id, item]));
  const sinal = sentido === "venda" ? -1 : 1;

  const milesimosPorId = new Map<string, number>();
  const custoUnitarioPorId = new Map<string, number>();

  for (const linha of linhas) {
    if (!linha.itemId) {
      continue;
    }
    const item = itemPorId.get(linha.itemId);
    if (!item) {
      continue;
    }

    if (sentido === "compra") {
      if (!linha.quantidadeEstoque) {
        continue;
      }
      const milesimos = paraMilesimos(linha.quantidadeEstoque);
      milesimosPorId.set(item.id, (milesimosPorId.get(item.id) ?? 0) + milesimos * sinal);
      if (linha.valorCentavos != null) {
        const quantidadeReal = Number(linha.quantidadeEstoque);
        custoUnitarioPorId.set(item.id, Math.round(linha.valorCentavos / quantidadeReal));
      }
      continue;
    }

    // Sentido "venda": ficha técnica vence sobre controle de estoque próprio (item com os dois
    // ao mesmo tempo usa a ficha — "o próprio não baixa").
    if (item.ficha.length > 0) {
      for (const componente of item.ficha) {
        const insumo = itemPorId.get(componente.insumoId);
        if (!insumo) {
          continue;
        }
        const milesimosPorUnidade = paraMilesimos(componente.quantidade);
        const total = milesimosPorUnidade * linha.quantidade * sinal;
        milesimosPorId.set(insumo.id, (milesimosPorId.get(insumo.id) ?? 0) + total);
      }
      continue;
    }

    if (item.controlaEstoque) {
      const total = linha.quantidade * 1000 * sinal;
      milesimosPorId.set(item.id, (milesimosPorId.get(item.id) ?? 0) + total);
    }
    // Nem ficha, nem controla estoque (ex.: "Hora de uso do espaço") → nenhuma entrada.
  }

  const entradas: EntradaDoEfeito[] = [];
  for (const [itemId, variacaoMilesimos] of milesimosPorId) {
    const item = itemPorId.get(itemId);
    if (!item) {
      continue;
    }
    const custoUnitarioCentavos = custoUnitarioPorId.get(itemId);
    entradas.push({
      itemId,
      nome: item.nome,
      unidade: item.unidade ?? "un",
      variacaoMilesimos,
      ...(custoUnitarioCentavos != null ? { custoUnitarioCentavos } : {}),
    });
  }

  return entradas;
}

function unidadeExibida(unidade: string): string {
  return unidade === "l" ? "L" : unidade;
}

// "−15 g · Grão de café", "+100 un · Esmalte (pote)", "−1,6 kg · Pão de queijo congelado" — o
// mesmo `formatarQuantidade` (pt-BR, até 3 casas) usado pelo resto do módulo.
export function formatarEfeito(entrada: EntradaDoEfeito): string {
  const quantidade = entrada.variacaoMilesimos / 1000;
  const sinal = quantidade < 0 ? "−" : "+";
  const quantidadeTexto = formatarQuantidade(String(Math.abs(quantidade)));
  return `${sinal}${quantidadeTexto} ${unidadeExibida(entrada.unidade)} · ${entrada.nome}`;
}
