// Módulo puro, sem nenhum import: a lista dos 13 endereços antigos da plataforma, de quando ela
// respondia na raiz, redirecionando para o mesmo caminho sob `/gestao` (D-01/D-21). Vive num
// módulo à parte — em vez de escrita direto em `next.config.ts` — para poder ser testada sem
// subir o Next (`tests/unit/redirecionamentos-antigos.test.ts`).
//
// remover após 2027-03-28 — seis meses depois da mudança (D-01). Até lá, estes 13 caminhos
// ficam RESERVADOS: o site público (a partir do plano 04 desta fase) não pode criar nenhuma
// página com um destes nomes antes da data, porque `redirects()` do Next roda ANTES do sistema
// de arquivos e venceria a página do site — quem revisar uma seção nova do site precisa
// conferir esta lista primeiro.
//
// A lista é EXPLÍCITA, um caminho por vez — nunca um coringa. Um coringa de caminho (`/:tudo*`)
// engoliria qualquer rota futura do site que por acaso comece com o mesmo prefixo; a lista
// explícita é o que garante que só estes 13 endereços, e nenhum outro, redirecionam.
//
// `/encomendas/imprimir` vem ANTES de `/encomendas/:id`, e `/queimas/relatorios` vem ANTES de
// `/queimas/:id`: o segmento dinâmico `:id` casa com QUALQUER texto de um segmento só —
// `imprimir` e `relatorios` incluídos — então o caminho literal precisa vencer por ordem, ou o
// Next aplicaria o redirecionamento de `:id` primeiro e o destino sairia errado.
//
// Zero import de valor de propósito (mesma disciplina de `lib/auth/rotas-publicas.ts` e
// `lib/rotas/gestao.ts`): o prefixo abaixo é um literal PRÓPRIO deste módulo, não importado de
// `lib/rotas/gestao.ts` — as duas cópias existem porque este módulo precisa continuar testável
// sem depender de mais nada, e porque os dois nunca podem divergir sem que
// `tests/unit/redirecionamentos-antigos.test.ts` reclame (ele confere `destination` contra este
// mesmo literal).
const PREFIXO_GESTAO_LITERAL = "/gestao";

export const DATA_DE_REMOCAO_DOS_REDIRECIONAMENTOS = "2027-03-28";

export const CAMINHOS_ANTIGOS = [
  "/abertura",
  "/agenda",
  "/cadastros",
  "/conta/senha",
  "/encomendas",
  "/encomendas/imprimir",
  "/encomendas/:id",
  "/estoque",
  "/financeiro",
  "/login",
  "/queimas",
  "/queimas/relatorios",
  "/queimas/:id",
] as const;

export type RedirecionamentoAntigo = {
  source: string;
  destination: string;
  permanent: false;
};

// `permanent: false` em TODAS as entradas — nunca `true`: um 301 fica em cache do navegador além
// da própria data de remoção, e a lista sumir do código não desfaria o cache de quem já visitou.
// Um 307 (o padrão do Next para `permanent: false`) é sempre reconferido.
export const REDIRECIONAMENTOS_ANTIGOS: readonly RedirecionamentoAntigo[] = CAMINHOS_ANTIGOS.map(
  (source) => ({
    source,
    destination: `${PREFIXO_GESTAO_LITERAL}${source}`,
    permanent: false,
  }),
);
