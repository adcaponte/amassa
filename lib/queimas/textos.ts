// As frases fixas da interface de Fornos e as funções que traduzem tipo/nível em rótulo — só
// import de TIPO é permitido aqui (`import type`, nunca `import` de valor), no molde de
// `lib/encomendas/textos.ts`: o módulo não lê React nem o cliente do banco, e não importa
// nenhuma função de `lib/queimas/formato.ts` (a formatação de data usada em `fraseDoRodape`
// chega já pronta de quem chama — mesma disciplina de `gantt.ts`/`textos.ts` de Encomendas, que
// duplicam a aritmética de calendário em vez de importar `formato.ts`).
import type { tipoQueima } from "@/db/schema";
import type { NivelDeForno } from "@/lib/queimas/contador";

export type TipoDeQueima = (typeof tipoQueima.enumValues)[number];

// Estado vazio do índice (`/queimas`, D-01/D-02) — já vivia como placeholder na 2b
// (`app/(app)/queimas/page.tsx`); reaproveitado verbatim aqui, com `hrefBotao` ligado nesta fase.
export const FRASE_VAZIO_TITULO = "Nenhum forno cadastrado ainda.";
export const FRASE_VAZIO_CORPO =
  "Cadastre o primeiro forno para começar a contar as queimas em dois toques.";

export const ROTULO_NOVO_FORNO = "Novo forno";
export const ROTULO_QUEIMAR = "Queimar";

export const FRASE_FALHA_AO_SALVAR = "Não deu para salvar. Verifique a internet e tente de novo.";

// Estado de erro do índice (`/queimas`, E1/error) — mesmo par de `app/(app)/encomendas/error.tsx`.
export const FRASE_ERRO_TITULO = "Algo não funcionou.";
export const FRASE_ERRO_CORPO =
  "Não deu para carregar os fornos. Verifique a internet e tente de novo.";

// Estado de erro do detalhe do forno (`/queimas/[id]`, E6/error, plano 04-03) — mesmo título
// `FRASE_ERRO_TITULO` acima (reuso literal, projeto inteiro), corpo próprio desta tela.
export const FRASE_ERRO_CORPO_FORNO =
  "Não deu para carregar este forno. Verifique a internet e tente de novo.";

// Cabeçalhos das duas seções de histórico da página do forno (E6, plano 04-03) — manutenções
// primeiro (é o histórico de vida útil, o propósito do módulo), queimas depois.
export const ROTULO_HISTORICO_MANUTENCOES = "Manutenções";
export const ROTULO_HISTORICO_QUEIMAS = "Queimas";

// Fluxo de dois toques (D-04, Tarefa 3 do plano 04-01) — o toast de 7 segundos e as duas frases
// de falha que ele pode mostrar.
export const TOAST_QUEIMA_REGISTRADA = "Queima registrada.";
export const ROTULO_DESFAZER = "Desfazer";
export const TOAST_QUEIMA_DESFEITA = "Queima desfeita.";
export const FRASE_FALHA_AO_REGISTRAR_QUEIMA =
  "Não deu para registrar a queima. Verifique a internet e tente de novo.";
export const FRASE_FALHA_AO_DESFAZER = "Não deu para desfazer. Verifique a internet e tente de novo.";

// Vazios inline das duas sub-seções de histórico (E6/empty, plano 04-03) — NUNCA um `EstadoVazio`
// de página inteira: cada frase vive dentro da própria sub-seção que descreve. Distintas de
// `FRASE_SEM_MANUTENCAO` acima (fragmento sem ponto final, concatenado no rodapé do cartão do
// índice) — estas são frases completas, autônomas.
export const FRASE_SEM_QUEIMAS = "Nenhuma queima registrada ainda.";
export const FRASE_SEM_MANUTENCOES = "Sem manutenção registrada.";

// Autor de uma queima quando `registradoPor` é nulo (usuário removido no futuro, T-04-02) —
// nunca um espaço em branco onde o nome deveria estar.
export const ROTULO_AUTOR_DESCONHECIDO = "Usuário removido";

// `switch` exaustivo sobre os três valores de `tipo_queima` — o `_exaustivo: never` no `default`
// é o que faz o compilador reclamar se um quarto tipo aparecer sem tratamento, no molde de
// `textoDaSituacao` (`lib/encomendas/textos.ts`).
export function rotuloDoTipo(tipo: TipoDeQueima): string {
  switch (tipo) {
    case "biscoito":
      return "Biscoito";
    case "esmalte":
      return "Esmalte";
    case "ouro":
      return "Ouro";
    default: {
      const _exaustivo: never = tipo;
      throw new Error(`rotuloDoTipo: tipo de queima não tratado: ${JSON.stringify(_exaustivo)}`);
    }
  }
}

// O medidor (`components/amassa/queimas/medidor.tsx`, FOR-05) — rótulos fixos sob a barra,
// literais de `04-DESIGN-SYSTEM.md` §8: "0 / atenção N / limite N".
export const ROTULO_MEDIDOR_ATENCAO = "atenção";
export const ROTULO_MEDIDOR_LIMITE = "limite";

// Selo textual por nível (FOR-04): "null" para "ok" — nenhum selo aparece nesse caso, decisão do
// próprio `cartao-forno.tsx`, não uma frase vazia sendo renderizada. `switch` exaustivo com o
// mesmo `_exaustivo: never` de `rotuloDoTipo`/`textoDaSituacao` — um quarto nível futuro quebra a
// compilação em vez de cair em silêncio. A copy nomeia o FATO e o que fazer, nunca quem deixou o
// forno passar do limite (prohibition deste plano).
export function textoDoNivel(nivel: NivelDeForno): string | null {
  switch (nivel) {
    case "ok":
      return null;
    case "atencao":
      return "Manutenção próxima";
    case "critico":
      return "Manutenção vencida";
    default: {
      const _exaustivo: never = nivel;
      throw new Error(`textoDoNivel: nível de forno não tratado: ${JSON.stringify(_exaustivo)}`);
    }
  }
}

// Exclusão confirmada de uma queima do histórico (FOR-10, E8) — copy literal do UI-SPEC. Ao
// contrário do protótipo, onde a exclusão é imediata, esta pede confirmação nomeando o que se
// perde (`corpoExcluirQueima`, com o nome do forno interpolado — o schema já limita `nome` a 80
// caracteres, então o corpo nunca cresce indefinidamente).
export const TITULO_EXCLUIR_QUEIMA = "Excluir esta queima?";

export function corpoExcluirQueima(nomeDoForno: string): string {
  return `Ela some do histórico do Forno «${nomeDoForno}» e o contador é recalculado.`;
}

export const FRASE_FALHA_AO_EXCLUIR = "Não deu para excluir. Verifique a internet e tente de novo.";

// Rodapé do cartão (FOR-08, `04-DESIGN-SYSTEM.md` §8) — literal, não reescrever. `data` chega
// JÁ FORMATADA por quem chama (`formatarInstanteCurto`, `lib/queimas/formato.ts`): este módulo
// não importa valor nenhum de `formato.ts` (ver cabeçalho do arquivo), então a montagem da frase
// nunca formata data por conta própria.
export const FRASE_SEM_MANUTENCAO = "Sem manutenção registrada";

// Registrar manutenção (E7, FOR-07) — só existe na página do forno (D-03), nunca no cartão do
// índice. `fraseDoContadorZerando` é uma função (não uma constante `FRASE_*`) porque interpola o
// N do contador — mesma disciplina de `corpoExcluirQueima`/`fraseDoRodape` acima: nenhuma frase
// que carrega um valor vira uma constante solta com placeholder manual.
export const ROTULO_REGISTRAR_MANUTENCAO = "Registrar manutenção";
export const ROTULO_RESPONSAVEL = "Responsável";
export const ROTULO_OBSERVACOES = "Observações";

// Literal de `04-DESIGN-SYSTEM.md` §8 e do Copywriting Contract do UI-SPEC — "O contador vai de
// {N} para 0.", nunca reescrita.
export function fraseDoContadorZerando(contador: number): string {
  return `O contador vai de ${contador} para 0.`;
}

// Ciclo desativar/reativar (D-05, D-06, FOR-11) — os dois rótulos de botão, nunca os dois ao
// mesmo tempo no menu "Mais ações" (`acoes-forno.tsx` decide qual mostrar por `forno.ativo`).
// Reversível, não é exclusão: sem estilo destrutivo (04-UI-SPEC.md Copywriting Contract).
export const ROTULO_DESATIVAR_FORNO = "Desativar forno";
export const ROTULO_REATIVAR_FORNO = "Reativar forno";

// Corpo da confirmação leve de "Desativar forno" — nomeia o que muda (some da lista principal) e
// o que NÃO muda (histórico intacto, dá para reativar). Função (não constante), mesma disciplina
// de `fraseDoContadorZerando`/`corpoExcluirQueima`: interpola o nome do forno.
export function fraseDesativarForno(nomeDoForno: string): string {
  return `O Forno «${nomeDoForno}» some da lista principal, mas o histórico continua intacto. Reative quando quiser.`;
}

// `aria-label` do menu "⋮ Mais ações" (04-UI-SPEC.md §"Icon-only controls" — literal exato,
// interpola o nome do forno). Função pela mesma razão das duas acima.
export function rotuloMaisAcoes(nomeDoForno: string): string {
  return `Mais ações do forno ${nomeDoForno}`;
}

export const ROTULO_SALVAR = "Salvar";

// Banner agregado (E5, FOR-06) e o cartão "Fornos em atenção" do painel inicial (E11, Tarefa 3
// do plano 04-05) — o MESMO par de funções serve os dois lugares, nunca uma segunda redação da
// mesma frase. `prefixoDoBanner` fica separado do resto porque só o prefixo é negrito na tela; o
// componente sabe onde ele termina e boldar só essa parte.
export function prefixoDoBanner(quantidade: number): string {
  return quantidade === 1
    ? "1 forno precisa de atenção:"
    : `${quantidade} fornos precisam de atenção:`;
}

// Literal de `04-DESIGN-SYSTEM.md` §8: prefixo (negrito) + até os 3 primeiros fornos no formato
// "{nome} ({contador}/{limite})", separados por " · ", com o sufixo "· e mais {N}" quando sobra
// mais de três. `fornosEmAtencao` já chega ORDENADO (críticos primeiro, contador decrescente —
// `lib/queimas/filtros.ts#ordenarParaBanner`); esta função só formata, nunca reordena.
export function fraseDoBanner(
  fornosEmAtencao: readonly { nome: string; contador: number; limite: number }[],
): string {
  const quantidade = fornosEmAtencao.length;
  const primeiros = fornosEmAtencao.slice(0, 3);
  const listaDosPrimeiros = primeiros
    .map((forno) => `${forno.nome} (${forno.contador}/${forno.limite})`)
    .join(" · ");
  const excedente = quantidade - primeiros.length;
  const sufixo = excedente > 0 ? ` · e mais ${excedente}` : "";

  return `${prefixoDoBanner(quantidade)} ${listaDosPrimeiros}${sufixo}`;
}

// Filtro Ativos/Desativados/Todos do índice (D-05, FOR-11, plano 04-05) — os três rótulos do
// seletor discreto e o vazio filtrado, DISTINTO de `FRASE_VAZIO_*` acima ("nenhum forno existe"):
// este é "o filtro não achou nada", mesma forma de `FRASE_FILTRO_VAZIO_*` de Encomendas.
export const ROTULO_FILTRO_ATIVOS = "Ativos";
export const ROTULO_FILTRO_DESATIVADOS = "Desativados";
export const ROTULO_FILTRO_TODOS = "Todos";

export const FRASE_FILTRO_VAZIO_TITULO = "Nada por aqui com esse filtro.";
export const FRASE_FILTRO_VAZIO_CORPO = "Troque para 'Ativos' ou cadastre um forno novo.";

// Seletor de topo (D-01) e relatórios (E9, FOR-12, plano 04-06) — os dois rótulos das abas que
// parecem aba mas navegam, o alternador Semana/Mês, os rótulos das quatro estatísticas, o vazio
// de D-08 (quando não há NENHUMA queima registrada, distinto de `FRASE_VAZIO_*` acima, que é "não
// há forno nenhum") e o rótulo do botão de volta.
export const ROTULO_FORNOS = "Fornos";
export const ROTULO_RELATORIOS = "Relatórios";
export const ROTULO_SEMANA = "Semana";
export const ROTULO_MES = "Mês";
export const ROTULO_ESTATISTICA_TOTAL = "Total";
export const ROTULO_ESTATISTICA_30_DIAS = "Últimos 30 dias";
export const FRASE_RELATORIOS_VAZIO_TITULO = "Nenhuma queima registrada ainda.";
export const FRASE_RELATORIOS_VAZIO_CORPO = "Registre a primeira queima para ver os relatórios aqui.";
export const ROTULO_VER_FORNOS = "Ver fornos";

export function fraseDoRodape({
  data,
  responsavel,
  total,
}: {
  data: string | null;
  responsavel: string | null;
  total: number;
}): string {
  const totalTexto = `${total} no total`;

  if (data === null) {
    return `${FRASE_SEM_MANUTENCAO} · ${totalTexto}`;
  }

  const base = responsavel
    ? `Última manutenção em ${data} · ${responsavel}`
    : `Última manutenção em ${data}`;

  return `${base} · ${totalTexto}`;
}
