// A escrita da Produção que roda DENTRO de uma transação (Fase 06.1, plano 01).
//
// 🔴 SEM a diretiva de Server Action, de propósito (06.1-RESEARCH.md Pattern 2; 06-RESEARCH.md
// Pattern 4 / Pitfall 7): toda função exportada de um arquivo com a diretiva vira endpoint —
// chamável pelo navegador — e `npm run verificar-acoes` exigiria `exigirUsuario()` na primeira
// linha de cada uma. Estas funções recebem a TRANSAÇÃO de quem chama (a ação da Produção hoje; a
// aprovação do orçamento e o cancelamento de venda nos planos 03 e 06), por isso só são alcançáveis
// de dentro do servidor, depois que a ação que as chama já autorizou o usuário.
//
// Por que `for no key update` na ordem, e NUNCA a trava exclusiva de linha (Pitfall 5): a folha do
// Estoque trava o ITEM e depois lê a ordem do vínculo com `for key share` (a checagem da chave
// estrangeira do `insert` no livro pede a mesma trava). A trava exclusiva de linha conflita com
// `for key share` — a baixa (item → ordem) e a conclusão (ordem → itens) fechariam um impasse.
// `for no key update` não conflita com `for key share` e continua excluindo outra `for no key
// update` — é o que serializa duas decisões sobre a mesma ordem (dois celulares, toque duplo).
//
// Ordem de travas do sistema inteiro, para nunca haver ciclo (extensão do "DOCUMENTO → ITENS" de
// `lib/estoque/gravacao.ts`): DOCUMENTO → ORDEM → ITENS. O cancelamento de venda
// (`lib/financeiro/acoes.ts::cancelarDocumento`) trava o documento, depois a ordem ligada à venda
// (`cancelarOrdemDaVendaCancelada`, abaixo — plano 06, D-07) e só então os itens do estorno
// (`gravarMovimentacoes`); a conclusão e a baixa travam a ordem e depois os itens; nenhuma ação da
// Produção trava documento.
import { asc, eq, sql } from "drizzle-orm";

import { orcamentos, ordemEtapas, ordemPecas, ordensProducao } from "@/db/schema";
import type { TransacaoDoBanco } from "@/lib/estoque/gravacao";

import { etapasIniciais } from "./etapas";
import type { EtapaDaOrdem } from "./leitura";

export type { TransacaoDoBanco };

// Uma recusa decidida SOB A TRAVA, com a frase que a tela mostra. Lançada de dentro da transação —
// nada foi gravado — e traduzida pela ação em `{ ok: false, erro: frase }`.
export class RecusaDaProducao extends Error {
  constructor(readonly frase: string) {
    super(frase);
    this.name = "RecusaDaProducao";
  }
}

export type OrdemTravada = {
  id: string;
  tipo: "encomenda" | "casa";
  caminho: "completo" | "biscoito";
  status: "aguardando_sinal" | "ativa" | "concluida" | "cancelada";
  inicio: string | null;
  entregaPrometida: string | null;
};

// Trava a linha da ordem até o fim da transação e devolve o que as transições precisam — `null` se
// ela não existe. Chamada ANTES de ler as etapas: tudo o que se lê depois reflete a gravação de quem
// segurava a trava antes (READ COMMITTED, o padrão do Postgres).
export async function travarOrdem(
  tx: TransacaoDoBanco,
  ordemId: string,
): Promise<OrdemTravada | null> {
  const [linha] = await tx
    .select({
      id: ordensProducao.id,
      tipo: ordensProducao.tipo,
      caminho: ordensProducao.caminho,
      status: ordensProducao.status,
      inicio: ordensProducao.inicio,
      entregaPrometida: ordensProducao.entregaPrometida,
    })
    .from(ordensProducao)
    .where(eq(ordensProducao.id, ordemId))
    .for("no key update");
  return linha ?? null;
}

// As etapas da ordem, por posição — chamada depois de `travarOrdem`, na mesma transação.
export async function lerEtapasDaOrdem(
  tx: TransacaoDoBanco,
  ordemId: string,
): Promise<EtapaDaOrdem[]> {
  return tx
    .select({
      etapa: ordemEtapas.etapa,
      posicao: ordemEtapas.posicao,
      diasPrevistos: ordemEtapas.diasPrevistos,
      feitaEm: ordemEtapas.feitaEm,
      passaram: ordemEtapas.passaram,
    })
    .from(ordemEtapas)
    .where(eq(ordemEtapas.ordemId, ordemId))
    .orderBy(asc(ordemEtapas.posicao));
}

export type PecaDaOrdemDoOrcamento = {
  fichaId: string;
  descricao: string;
  quantidade: number;
  cor: string | null;
  personalizacao: string | null;
};

export type OrdemDoOrcamento = {
  nome: string;
  clienteNome: string | null;
  entregaPrometida: string | null;
  pecas: readonly PecaDaOrdemDoOrcamento[];
  criadoPor: string;
};

// A ordem que nasce de "Cliente aprovou" (PRD-10/PRD-11), gravada com a TRANSAÇÃO de
// `lib/orcamentos/acoes.ts::aprovarOrcamento` — a mesma que trava o orçamento, grava a venda e, na
// mesma instrução do `status = 'aprovado'`, o vínculo `orcamentos.encomenda_id` com o id devolvido
// aqui. Nasce SEMPRE encomenda, caminho completo, aguardando o sinal e sem início (T-06.1-11): o
// prazo só começa a contar quando o dono libera na Produção (`liberarOrdem`). As seis etapas vêm de
// `etapasIniciais("completo")` (os previstos do D-10); as peças, uma por linha do orçamento, com
// `posicao` = índice na ordem das linhas. Devolve o id da ordem.
export async function criarOrdemDoOrcamento(
  tx: TransacaoDoBanco,
  dados: OrdemDoOrcamento,
): Promise<string> {
  const [ordem] = await tx
    .insert(ordensProducao)
    .values({
      tipo: "encomenda",
      caminho: "completo",
      status: "aguardando_sinal",
      inicio: null,
      nome: dados.nome,
      clienteNome: dados.clienteNome,
      entregaPrometida: dados.entregaPrometida,
      criadoPor: dados.criadoPor,
    })
    .returning({ id: ordensProducao.id });

  await tx.insert(ordemEtapas).values(
    etapasIniciais("completo").map((etapa) => ({
      ordemId: ordem.id,
      etapa: etapa.etapa,
      posicao: etapa.posicao,
      diasPrevistos: etapa.diasPrevistos,
    })),
  );

  if (dados.pecas.length > 0) {
    await tx.insert(ordemPecas).values(
      dados.pecas.map((peca, posicao) => ({
        ordemId: ordem.id,
        posicao,
        fichaId: peca.fichaId,
        descricao: peca.descricao,
        quantidade: peca.quantidade,
        cor: peca.cor,
        personalizacao: peca.personalizacao,
      })),
    );
  }

  return ordem.id;
}

// D-07 — a venda cancelada no Caixa chega à Produção. Chamada com a TRANSAÇÃO de
// `lib/financeiro/acoes.ts::cancelarDocumento`, depois da trava do documento e da checagem de "já
// cancelado", e ANTES do estorno do Estoque (ordem de travas DOCUMENTO → ORDEM → ITENS, no topo
// deste arquivo). Acha a ordem ligada à venda pelo orçamento (o vínculo mora só em `orcamentos`:
// `documento_id` → `encomenda_id`) e trava SÓ a ordem, com `for no key update` (Pitfall 5). Se ela
// ainda aguarda o sinal, cai junto com a venda: `cancelada`, com `cancelada_pela_venda = true`. Em
// qualquer outro status NADA é gravado (T-06.1-22): a ordem liberada segue, e o aviso "venda
// cancelada" é derivado na leitura (`documentos.cancelado_em`) — o dono decide. Venda sem ordem
// (orçamento aprovado com a caixa desmarcada, venda direta, ordem de boca ou da casa): a consulta
// não acha nada e o cancelamento da venda segue igual ao de sempre. Devolve o que fez, para quem
// chama poder registrar.
export async function cancelarOrdemDaVendaCancelada(
  tx: TransacaoDoBanco,
  documentoId: string,
  usuarioId: string,
): Promise<"cancelada-junto" | "so-aviso" | "sem-ordem"> {
  const [ordem] = await tx
    .select({ id: ordensProducao.id, status: ordensProducao.status })
    .from(ordensProducao)
    .innerJoin(orcamentos, eq(orcamentos.encomendaId, ordensProducao.id))
    .where(eq(orcamentos.documentoId, documentoId))
    .for("no key update", { of: ordensProducao });
  if (!ordem) {
    return "sem-ordem";
  }
  if (ordem.status !== "aguardando_sinal") {
    return "so-aviso";
  }
  await tx
    .update(ordensProducao)
    .set({
      status: "cancelada",
      canceladaEm: sql`now()`,
      canceladaPor: usuarioId,
      canceladaPelaVenda: true,
    })
    .where(eq(ordensProducao.id, ordem.id));
  return "cancelada-junto";
}
