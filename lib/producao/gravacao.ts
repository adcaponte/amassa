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
// `lib/estoque/gravacao.ts`): DOCUMENTO → ORDEM → ITENS. O cancelamento de venda trava o documento e
// depois a ordem; a conclusão e a baixa travam a ordem e depois os itens; nenhuma ação da Produção
// trava documento.
import { asc, eq } from "drizzle-orm";

import { ordemEtapas, ordensProducao } from "@/db/schema";
import type { TransacaoDoBanco } from "@/lib/estoque/gravacao";

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
