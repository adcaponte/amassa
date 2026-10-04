// As frases fixas da interface de Fornos e as funções que traduzem tipo/nível em rótulo — só
// import de TIPO é permitido aqui (`import type`, nunca `import` de valor), no molde de
// `lib/encomendas/textos.ts`: o módulo não lê React nem o cliente do banco, e não importa
// nenhuma função de `lib/queimas/formato.ts` (a formatação de data usada em `fraseDoRodape`
// chega já pronta de quem chama — mesma disciplina de `gantt.ts`/`textos.ts` de Encomendas, que
// duplicam a aritmética de calendário em vez de importar `formato.ts`).
//
// Exceção deliberada (Fase 06.4, plano 02): as funções de `lib/queimas/contagem.ts` entram como
// VALOR — aquele módulo é puro e não importa nada (nem tipo), então trazê-lo não traz React, banco
// nem relógio; e a régua em cm (`cmDaRegua`) e o resumo "P · M · G" (`resumoPmg`) têm de ser a MESMA
// conta na folha, nas frases e nos chips, nunca duas cópias.
//
// Segunda exceção (plano 04): `formatarReais` de `lib/financeiro/formato.ts` — também puro e sem
// import nenhum; o valor das externas nas frases ("a cobrar · R$ 11,00", "Externas a cobrar: R$ 22,00")
// tem de sair com a MESMA formatação do Caixa.
import type { tipoQueima } from "@/db/schema";
import { formatarReais } from "@/lib/financeiro/formato";
import {
  POUCAS_FORNADAS_CHEIAS,
  cmDaRegua,
  formatarAteUmaCasa,
  formatarUmaCasa,
  resumoPmg,
  totalDasQuantidades,
  type Quantidades,
  type Regua,
  type Tamanho,
  type VendaLigada,
} from "@/lib/queimas/contagem";
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

// Fase 06.4 (QMC-11, plano 02): com contagem, a confirmação diz que ela vai junto (o cascade da 0030).
// Sem o segundo argumento — ou com `null`, a queima sem contagem — a frase herdada, SEM mudança.
// Plano 04 (D-07, UI-D25): o terceiro argumento, os números das vendas ATIVAS ligadas — elas continuam
// no Caixa (`queima_vendas.documento_id` sem cascade); as canceladas não valem mais dinheiro e não
// entram na frase.
export function corpoExcluirQueima(
  nomeDoForno: string,
  pecasContadas?: number | null,
  numerosDasVendasAtivas: readonly number[] = [],
): string {
  const herdada = `Ela some do histórico do Forno «${nomeDoForno}» e o contador é recalculado.`;
  const contagem =
    pecasContadas === undefined || pecasContadas === null
      ? herdada
      : `${herdada} A contagem desta fornada (${pecas(pecasContadas)}) vai junto.`;
  if (numerosDasVendasAtivas.length === 0) {
    return contagem;
  }
  const vendas =
    numerosDasVendasAtivas.length === 1
      ? `A ${nomeDasVendas(numerosDasVendasAtivas)} continua no Caixa`
      : `As ${nomeDasVendas(numerosDasVendasAtivas)} continuam no Caixa`;
  return `${contagem} ${vendas} — se for o caso, cancele por lá.`;
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

// Estado de erro da rota de relatórios (E9/error, plano 04-06) — mesmo título `FRASE_ERRO_TITULO`
// acima (reuso literal, projeto inteiro), corpo próprio desta tela, no mesmo molde de
// `FRASE_ERRO_CORPO_FORNO` (detalhe do forno).
export const FRASE_ERRO_CORPO_RELATORIOS =
  "Não deu para carregar os relatórios. Verifique a internet e tente de novo.";

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

// ---------------------------------------------------------------------------------------------
// Fase 06.4 — a folha "O que queimou?" (QMC-01/QMC-03), verbatim da UI-SPEC §Copywriting. O
// "Salvar" da folha reaproveita `ROTULO_SALVAR`, acima.
export const TITULO_FOLHA_CONTAGEM = "O que queimou?";
export const FRASE_FOLHA_OPCIONAL = "opcional — a queima já está registrada.";
export const ROTULO_INTERNAS = "Internas";
export const DICA_INTERNAS = "encomenda, produção da casa, aula, uso livre, pintura — queima já inclusa";
export const ROTULO_EXTERNAS = "Externas";
export const DICA_EXTERNAS = "peça feita fora do espaço — cobrada por tamanho";
export const ROTULO_SAIU_CHEIO = "O forno saiu cheio";
export const DICA_SAIU_CHEIO = "(só as cheias entram na média)";
export const ROTULO_PULAR = "Pular";
export const ROTULO_SALVANDO = "Salvando…";
export const FRASE_QUEIMA_DESFEITA_NADA_CONTADO = "Essa queima foi desfeita — nada foi contado.";
export const FRASE_FALHA_AO_SALVAR_CONTAGEM =
  "Não deu para salvar a contagem. Verifique a internet e tente de novo.";
export const FRASE_TETO_DO_CONTADOR = "Confira o número: cada contador vai até 10.000.";
export const FRASE_CONTAGEM_VAZIA = "Nenhuma peça contada — nada foi salvo.";

// "Biscoito de 18/12 · opcional — a queima já está registrada." e, com mais de um forno na casa
// (UI-D15), "Biscoito de 18/12 · Forno grande · opcional — …". `diaMes` chega pronto ("18/12",
// `lib/queimas/contagem.ts`).
export function subtituloDaFolha(
  tipo: TipoDeQueima,
  diaMes: string,
  nomeDoForno: string | null,
): string {
  const forno = nomeDoForno === null ? "" : ` · ${nomeDoForno}`;
  return `${rotuloDoTipo(tipo)} de ${diaMes}${forno} · ${FRASE_FOLHA_OPCIONAL}`;
}

// A régua vigente na folha (verbatim do protótipo, com os números de `parametros_precificacao`):
// "Contar, não medir: P até 10 cm · M de 10 a 25 cm · G maior que 25 cm, no olho."
export function fraseDaReguaNaFolha(regua: Regua): string {
  const p = cmDaRegua(regua.pAte);
  const m = cmDaRegua(regua.mAte);
  return `Contar, não medir: P até ${p} cm · M de ${p} a ${m} cm · G maior que ${m} cm, no olho.`;
}

// A faixa de cada tamanho, embaixo do P/M/G de cada contador.
export function faixasDaRegua(regua: Regua): Record<Tamanho, string> {
  const p = cmDaRegua(regua.pAte);
  const m = cmDaRegua(regua.mAte);
  return { P: `até ${p} cm`, M: `${p} a ${m} cm`, G: `maior que ${m} cm` };
}

// O botão da esquerda ao corrigir uma contagem existente (UI-D23) — "Pular" diria que nada foi
// contado.
export const ROTULO_FECHAR_SEM_SALVAR = "Fechar sem salvar";

// "Desfazer" do aviso DEPOIS de salvar a contagem: o cascade leva a contagem junto (UI-D12 item 4).
export const TOAST_QUEIMA_DESFEITA_COM_CONTAGEM = "Queima desfeita — a contagem foi junto.";

// Plural de verdade, nunca "(s)".
function pecas(total: number): string {
  return total === 1 ? "1 peça" : `${total} peças`;
}

export function resumoDaContagem(total: number): string {
  return total === 0 ? "nenhuma peça" : pecas(total);
}

// Plano 04 (UI-SPEC §Toasts, as três frases): sem o segundo argumento, a frase do plano 01, intacta;
// com o valor das externas contadas, "… Externas a cobrar: R$ 22,00." (verbatim do protótipo); com o
// preço faltando (`valorCentavos: null`), "… Externas a cobrar — falta o preço no Catálogo.".
export function toastContagemSalva(
  total: number,
  externas?: { valorCentavos: number | null },
): string {
  const base = `Contagem salva: ${pecas(total)}.`;
  if (externas === undefined) {
    return base;
  }
  return externas.valorCentavos === null
    ? `${base} Externas a cobrar — falta o preço no Catálogo.`
    : `${base} Externas a cobrar: ${formatarReais(externas.valorCentavos)}.`;
}

export type GrupoDoContador = "internas" | "externas";

// "Uma interna P a mais" / "Uma externa G a menos".
export function ariaPassoDoContador(
  grupo: GrupoDoContador,
  tamanho: Tamanho,
  sentido: "mais" | "menos",
): string {
  const nome = grupo === "internas" ? "interna" : "externa";
  return `Uma ${nome} ${tamanho} a ${sentido}`;
}

// "Internas P, quantidade".
export function ariaCampoDoContador(grupo: GrupoDoContador, tamanho: Tamanho): string {
  const nome = grupo === "internas" ? ROTULO_INTERNAS : ROTULO_EXTERNAS;
  return `${nome} ${tamanho}, quantidade`;
}

// D-07 — "venda nº 12" / "vendas nº 12 e 15" / "vendas nº 12, 15 e 19".
export function nomeDasVendas(numeros: readonly number[]): string {
  if (numeros.length === 0) {
    return "venda";
  }
  if (numeros.length === 1) {
    return `venda nº ${numeros[0]}`;
  }
  const iniciais = numeros.slice(0, -1).join(", ");
  return `vendas nº ${iniciais} e ${numeros[numeros.length - 1]}`;
}

// D-07 — o piso: baixar as externas de um tamanho abaixo do já lançado em vendas ATIVAS é recusado.
// `numerosDasVendas` são os das vendas ativas que têm aquele tamanho.
export function fraseAbaixoDoLancado(
  tamanho: Tamanho,
  lancado: number,
  numerosDasVendas: readonly number[],
): string {
  const inicio =
    lancado === 1
      ? `Já foi lançada 1 externa ${tamanho}`
      : `Já foram lançadas ${lancado} externas ${tamanho}`;
  if (numerosDasVendas.length <= 1) {
    return `${inicio}; para baixar daí, cancele a ${nomeDasVendas(numerosDasVendas)} no Caixa.`;
  }
  return `${inicio}, nas ${nomeDasVendas(numerosDasVendas)}; para baixar daí, cancele uma delas no Caixa.`;
}

// ---------------------------------------------------------------------------------------------
// Fase 06.4, plano 02 — a lista "Sem contagem" do índice (QMC-02, UI-D4), verbatim da UI-SPEC.
export const TITULO_SEM_CONTAGEM = "Sem contagem";
export const SUB_SEM_CONTAGEM = "ficou só o registro da queima";
export const ROTULO_CONTAR_AGORA = "Contar agora";

// "Biscoito de 18/12" ou, com mais de um forno na casa (UI-D15), "Biscoito de 18/12 · Forno grande".
export function tituloDaQueima(
  tipo: TipoDeQueima,
  diaMes: string,
  nomeDoForno: string | null,
): string {
  const base = `${rotuloDoTipo(tipo)} de ${diaMes}`;
  return nomeDoForno === null ? base : `${base} · ${nomeDoForno}`;
}

// Várias linhas com o mesmo rótulo visível: o `aria-label` nomeia a queima.
export function ariaContarAgora(titulo: string): string {
  return `${ROTULO_CONTAR_AGORA}: ${titulo}`;
}

// O fim da lista quando há mais (além das 20 ou de antes da janela). A frase termina aqui e NÃO
// manda a pessoa ao detalhe do forno: o Histórico só mostra as 25 últimas de cada forno, e a queima
// pulada há mais tempo ficaria sem caminho. O caminho é o link "Ver todas" (plano 03).
export function fraseMaisSemContagem(quantidade: number): string {
  return quantidade === 1
    ? "e mais 1 sem contagem, mais antiga."
    : `e mais ${quantidade} sem contagem, mais antigas.`;
}

// As duas listas do índice ("a cobrar", plano 04, e "Sem contagem") carregam e falham juntas, num
// bloco só — os cartões e o "Queimar" continuam funcionando.
export const FRASE_ERRO_DAS_LISTAS =
  "Não deu para carregar as queimas a cobrar e as sem contagem. Verifique a internet e tente de novo.";

// ---------------------------------------------------------------------------------------------
// Fase 06.4, plano 02 — o Histórico com a contagem (UI-D20), corrigir (UI-D23) e apagar (UI-D6).
export const ROTULO_CORRIGIR_CONTAGEM = "Corrigir contagem";
export const FRASE_SEM_CONTAGEM_HISTORICO = "sem contagem";
// Neutra; nunca em ouro (ouro não tem a caixa — D-02).
export const TAG_NAO_SAIU_CHEIO = "não saiu cheio";

// "internas: 12 P · 9 M · 2 G" / "externas: 1 G" — só os tamanhos com quantidade; grupo zerado → `null`
// (o chip não aparece).
export function chipDaContagem(grupo: GrupoDoContador, pmg: Quantidades): string | null {
  const resumo = resumoPmg(pmg.p, pmg.m, pmg.g);
  return resumo === "" ? null : `${grupo}: ${resumo}`;
}

export function toastContagemCorrigida(total: number): string {
  return `Contagem corrigida: ${pecas(total)}.`;
}

export const TOAST_CONTAGEM_APAGADA = "Contagem apagada. A queima voltou para “Sem contagem”.";

// "Salvar" com tudo zero numa contagem EXISTENTE pergunta antes de apagar (UI-D6).
export const TITULO_APAGAR_CONTAGEM = "Apagar a contagem desta queima?";
export const ROTULO_APAGAR_CONTAGEM = "Apagar a contagem";
export const ROTULO_APAGANDO = "Apagando…";
export const FRASE_FALHA_AO_APAGAR_CONTAGEM =
  "Não deu para apagar a contagem. Verifique a internet e tente de novo.";

// `tituloDaQueima` = "Biscoito de 18/12". Singular de verdade: "A peça contada de … some …".
export function corpoApagarContagem(total: number, tituloDaQueima: string): string {
  const inicio =
    total === 1
      ? `A peça contada de ${tituloDaQueima} some`
      : `As ${total} peças contadas de ${tituloDaQueima} somem`;
  return `${inicio} e a queima volta para “Sem contagem”. A queima continua registrada no forno.`;
}

// D-07 — apagar a contagem com peça lançada em venda ATIVA é recusado (o cascade levaria os vínculos
// e as vendas ficariam no Caixa sem dizer de onde vieram). `numeros` = os das vendas ativas.
export function fraseApagarComVendas(numeros: readonly number[]): string {
  const cancele = numeros.length > 1 ? "cancele as vendas no Caixa" : "cancele a venda no Caixa";
  const onde = numeros.length > 1 ? "nas" : "na";
  return `As externas desta queima já foram lançadas ${onde} ${nomeDasVendas(numeros)}. Para apagar a contagem, ${cancele}.`;
}

// ---------------------------------------------------------------------------------------------
// Fase 06.4, plano 03 — os chips da Produção na folha (QMC-06, D-06), verbatim da UI-SPEC.
export const ROTULO_CHIPS = "Esperando esta queima na Produção — toque para somar:";

// "+16 · {nome da ordem}" (verbatim do protótipo); somado, a folha acrescenta `SUFIXO_SOMADO`.
export function textoDoChip(pendentes: number, nome: string): string {
  return `+${pendentes} · ${nome}`;
}

export const SUFIXO_SOMADO = " · somado";

// "Somar 12 peças de {nome} às internas" — 1: "Somar 1 peça de …".
export function ariaDoChip(pendentes: number, nome: string): string {
  return `Somar ${pecas(pendentes)} de ${nome} às internas`;
}

// ---------------------------------------------------------------------------------------------
// Fase 06.4, plano 03 — a pergunta de tamanho do chip com peça sem medida (D-06, UI-D17).
// "“{ordem}”: 3 peças sem medida na ficha. Em que tamanho elas entram?" (1: "1 peça … ela entra?").
export function perguntaDoTamanho(nomeDaOrdem: string, semMedida: number): string {
  const final = semMedida === 1 ? "Em que tamanho ela entra?" : "Em que tamanho elas entram?";
  return `“${nomeDaOrdem}”: ${pecas(semMedida)} sem medida na ficha. ${final}`;
}

// "Somar 3 como G".
export function ariaDoTamanhoDaPergunta(semMedida: number, tamanho: Tamanho): string {
  return `Somar ${semMedida} como ${tamanho}`;
}

export const ROTULO_NAO_SOMAR_AGORA = "Não somar agora";

// "Repetir a última" (QMC-05, UI-D10) e a dica embaixo dele.
export const ROTULO_REPETIR_A_ULTIMA = "Repetir a última";

// "copia Biscoito de 09/12: 29 peças".
export function dicaDoRepetir(tipo: TipoDeQueima, diaMes: string, total: number): string {
  return `copia ${rotuloDoTipo(tipo)} de ${diaMes}: ${pecas(total)}`;
}

// "Ainda não há outra fornada de esmalte contada neste forno." — o botão fica desabilitado.
export function dicaSemAnterior(tipo: TipoDeQueima): string {
  return `Ainda não há outra fornada de ${rotuloDoTipo(tipo).toLowerCase()} contada neste forno.`;
}

// O "Ver todas" de "Sem contagem" (QMC-02, o item travado "Pular não perde nada"; UI-D4 revisto em
// 03/10/2026) e a volta à visão padrão.
export const ROTULO_VER_TODAS_SEM_CONTAGEM = "Ver todas";
export const ROTULO_VER_SO_AS_RECENTES = "Ver só as recentes";

// A linha de cima da visão de todas.
export function fraseTodasSemContagem(total: number): string {
  return total === 1
    ? "A única queima sem contagem."
    : `Todas as ${total} sem contagem, a mais recente primeiro.`;
}

// A dica do grupo "Queimas" em Cadastros → Parâmetros (UI-D11): a régua de hoje por extenso.
export function dicaDaReguaNosParametros(regua: Regua): string {
  const p = cmDaRegua(regua.pAte);
  const m = cmDaRegua(regua.mAte);
  return `Régua de hoje: P até ${p} cm · M de ${p} a ${m} cm · G maior que ${m} cm. Vale para internas e externas; a contagem é no olho, pela maior medida da peça. Mudar a régua não muda as contagens já feitas.`;
}

// ---------------------------------------------------------------------------------------------
// Fase 06.4, plano 04 — "Queimas externas a cobrar" e o "Recebi agora" (QMC-07, QMC-08; D-07),
// verbatim da UI-SPEC §Copywriting. Os rótulos herdados da Agenda ("Recebi agora", "Dinheiro · Pix ·
// Cartão", "Registrando…", "Voltar", o aviso "Venda nº N lançada e paga em …", a frase de rede e a tag
// "venda nº N cancelada") são IMPORTADOS de `lib/agenda/textos.ts` por quem usa — uma frase, um lugar.
export const TITULO_A_COBRAR = "Queimas externas a cobrar";
export const FRASE_FALTA_PRECO = "falta preço";

// "falta: 1 P · 2 M" — `resumo` = `resumoPmg` do que falta.
export function linhaDaFalta(resumo: string): string {
  return `falta: ${resumo}`;
}

// Uma linha de apoio por venda ATIVA ligada: "já lançado: venda nº 12 (2 P)".
export function linhaJaLancado(numero: number, resumo: string): string {
  return `já lançado: venda nº ${numero} (${resumo})`;
}

// O passo de quantidade do "Recebi agora" (D-07): começa com tudo o que falta.
export const ROTULO_PASSO_DE_QUANTIDADE = "Quantas peças entram nesta venda?";
export const DICA_PASSO_DE_QUANTIDADE =
  "Começa com o que falta. O que você tirar continua em “a cobrar”.";

// A faixa de cada tamanho no passo: "faltam 2" / "falta 1".
export function faltamNoTamanho(quantidade: number): string {
  return quantidade === 1 ? "falta 1" : `faltam ${quantidade}`;
}

export const FRASE_NENHUMA_PECA_PARA_COBRAR = "Escolha ao menos uma peça para cobrar.";

// Recusas decididas SOB A TRAVA que já atualizaram a tela (a folha fecha com o aviso).
// `numeros` = os das vendas ATIVAS que levaram tudo.
export function fraseTudoJaLancado(numeros: readonly number[]): string {
  return `As externas desta queima já foram todas lançadas — ${nomeDasVendas(numeros)}. A tela foi atualizada.`;
}

// `resumo` = `resumoPmg` do que falta AGORA: "Desta queima só faltam 1 P — outra venda levou o resto. …".
export function fraseSoFaltam(resumo: string): string {
  return `Desta queima só faltam ${resumo} — outra venda levou o resto. A tela foi atualizada.`;
}

export const FRASE_SAIU_DE_A_COBRAR =
  "Esta queima não está mais em “a cobrar” — a tela foi atualizada.";

// "P", "M e G", "P, M e G".
function listaComE(partes: readonly string[]): string {
  if (partes.length <= 1) {
    return partes.join("");
  }
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

// O preço que falta (AGE-17, UI-D5) — com o nome ATUAL de cada item, lido pela chave.
export function fraseSemPrecoDaQueima(
  tamanhos: readonly Tamanho[],
  nomes: Record<Tamanho, string>,
): string {
  const caminho = listaComE(tamanhos.map((tamanho) => `“${nomes[tamanho]}”`));
  if (tamanhos.length === 1) {
    return `O preço da queima externa ${tamanhos[0]} ainda não foi cadastrado. Cadastre em Cadastros → Catálogo → ${caminho} para poder cobrar.`;
  }
  return `Os preços da queima externa ${listaComE(tamanhos)} ainda não foram cadastrados. Cadastre em Cadastros → Catálogo → ${caminho} para poder cobrar.`;
}

// O topo do "Recebi agora", com as quantidades ESCOLHIDAS no passo e o valor delas:
// "Queima externa · Biscoito de 18/12 · 1 P · 1 G · R$ 48,00". `titulo` = `tituloDaQueima`.
export function topoRecebiQueima(titulo: string, resumo: string, valor: string): string {
  return ["Queima externa", titulo, resumo, valor].filter((parte) => parte !== "").join(" · ");
}

// Várias linhas com o mesmo rótulo visível: o `aria-label` nomeia a queima.
export function ariaRecebiAgora(titulo: string): string {
  return `Recebi agora: ${titulo}`;
}

// A pessoa OPCIONAL do "Recebi agora" (decisão do dono, 04/10/2026 — UI-D13 revista): o seletor de
// pessoas da casa, entre o passo de quantidade e as formas. Vazio = venda sem pessoa.
export const DICA_PESSOA_RECEBI_QUEIMA =
  "Para saber depois quem levou estas peças. Sem ninguém escolhido, a venda fica sem pessoa.";
// Nome digitado e não escolhido na lista: a venda NÃO sai sem pessoa por engano.
export const FRASE_ESCOLHA_A_PESSOA_NA_LISTA =
  "Escolha a pessoa na lista, ou apague o nome para lançar sem pessoa.";
// A pessoa escolhida saiu do cadastro entre abrir a folha e tocar a forma (servidor).
export const FRASE_PESSOA_SUMIU =
  "Essa pessoa não está mais no cadastro. Escolha de novo, ou apague o nome para lançar sem pessoa.";

// ---------------------------------------------------------------------------------------------
// Fase 06.4, plano 04, Tarefa 2 — as várias vendas (D-07): o piso na folha e as tags do Histórico.

// A caixa "Já lançado" acima das Externas ao corrigir (UI-D7 revisto em 04/10/2026): uma parte por
// venda ATIVA ligada, com o resumo dela.
export function fraseExternasLancadas(
  vendasAtivas: readonly { numero: number; quantidades: Quantidades }[],
): string {
  const partes = vendasAtivas
    .map(
      ({ numero, quantidades }) =>
        `venda nº ${numero} (${resumoPmg(quantidades.p, quantidades.m, quantidades.g)})`,
    )
    .join(" · ");
  return `Já lançado: ${partes}. As externas não descem abaixo disso — para baixar, cancele a venda no Caixa.`;
}

// Enquanto faltar algo: "a cobrar · R$ 11,00" (o valor do que FALTA) ou "a cobrar · falta preço";
// nada falta → `null` (a tag não aparece).
export function tagSituacaoDaQueima(falta: Quantidades, valorCentavos: number | null): string | null {
  if (totalDasQuantidades(falta) === 0) {
    return null;
  }
  return valorCentavos === null
    ? `a cobrar · ${FRASE_FALTA_PRECO}`
    : `a cobrar · ${formatarReais(valorCentavos)}`;
}

// Uma tag por venda ligada: "venda nº 12 · 2 P · em aberto" / "· paga" / "· cancelada".
export function tagDaVendaDaQueima(venda: VendaLigada): string {
  const resumo = resumoPmg(venda.quantidades.p, venda.quantidades.m, venda.quantidades.g);
  const situacao = venda.cancelada ? "cancelada" : venda.paga ? "paga" : "em aberto";
  return `venda nº ${venda.numero} · ${resumo} · ${situacao}`;
}

// ---------------------------------------------------------------------------------------------
// Fase 06.4, plano 04, Tarefa 3 — o preço que falta (D-05, UI-D5; AGE-17 da Agenda).

// No cabeçalho de Externas da folha, no lugar do valor: "falta o preço de G" / "… de M e G".
export function faltaOPrecoDe(tamanhos: readonly Tamanho[]): string {
  return `falta o preço de ${listaComE(tamanhos)}`;
}

// O link do aviso de preço → Cadastros → Catálogo.
export const ROTULO_ABRIR_O_CATALOGO = "abrir o Catálogo";

// ---------------------------------------------------------------------------------------------
// Fase 06.4, plano 05 — “Lançar na Venda” (QMC-08; D-07, decisão do dono de 04/10/2026: várias vendas
// por queima, uma por pessoa), verbatim da UI-SPEC §Copywriting. O rótulo do botão (“Lançar na Venda”),
// o aviso da volta com parcela em aberto (`toastLancadoNaVenda`), a linha da venda em montagem e o “ver
// no Caixa” são IMPORTADOS de `lib/agenda/textos.ts` por quem usa — uma frase, um lugar.

// A faixa no topo da Venda aberta pelas Queimas: “Das Queimas · Biscoito de 18/12 · Forno grande” — o
// forno SEMPRE (a Venda não sabe quantos fornos a casa tem, e a faixa precisa dizer de qual queima é).
export function tituloDaFaixaDasQueimas(tipo: TipoDeQueima, diaMes: string, nomeDoForno: string): string {
  return `Das Queimas · ${rotuloDoTipo(tipo)} de ${diaMes} · ${nomeDoForno}`;
}

// A 2ª linha da faixa (D-07): as quantidades da própria Venda são o passo de “quantas de cada tamanho”.
export const LINHA2_FAIXA_DAS_QUEIMAS = "O que você tirar desta venda continua em “a cobrar”.";

export const ROTULO_VOLTAR_AS_QUEIMAS = "Voltar às Queimas";

// A origem não achada: a queima apagada, sem contagem, sem externas, ou um id que não existe.
export const FRASE_ORIGEM_QUEIMA_NAO_ACHADA =
  "Não achei esta queima. Volte às Queimas e toque em “Lançar na Venda” de novo.";

// Nada mais a cobrar (no lugar do carrinho, e a recusa do servidor ao lançar): `numeros` = os das vendas
// ATIVAS que levaram tudo — “… — venda nº 7.” / “… — vendas nº 12 e 15.”.
export function fraseOrigemQueimaTudoLancado(numeros: readonly number[]): string {
  return `As externas desta queima já foram todas lançadas — ${nomeDasVendas(numeros)}.`;
}

// Subir a quantidade de uma linha de queima acima do que falta (recusado pelo servidor ao lançar; nada
// é gravado). `resumo` = `resumoPmg` do que falta agora: “Desta queima só faltam 1 M para cobrar — …”.
export function fraseAcimaDoQueFaltaNaVenda(resumo: string): string {
  return `Desta queima só faltam ${resumo} para cobrar — diminua as linhas de queima externa e lance de novo.`;
}

// Tiraram todas as linhas de queima externa da venda (cliente e servidor).
export const FRASE_LINHA_DA_QUEIMA_FALTANDO = "Pelo menos uma linha de queima externa precisa continuar na venda.";

// A volta do “Lançar na Venda” quando a venda saiu PAGA na própria Venda (UI-D24) — a frase da Agenda
// (“A parcela está em “o que vence””) mentiria nesse caso.
export function toastLancadoNaVendaPago(numero: number): string {
  return `Lançado na venda nº ${numero}. Já está no Caixa de hoje.`;
}

// Várias linhas com o mesmo rótulo visível: o `aria-label` nomeia a queima.
export function ariaLancarNaVenda(titulo: string): string {
  return `Lançar na Venda: ${titulo}`;
}

// A dica do fim de “a cobrar” (Apoio, `tinta-fraca`) — a do protótipo, letra por letra (D-07, 04/10/2026;
// UI-SPEC item 4). *Até 04/10/2026, na versão (A), a frase final era outra.*
export const DICA_FIM_A_COBRAR =
  "“Lançar na Venda” abre o Financeiro com as linhas Queima externa P / M / G já preenchidas. Se as peças são de pessoas diferentes, você divide lá.";

// ---------------------------------------------------------------------------------------------
// Plano 06 — os Números do forno (QMC-09, QMC-10; 06.4-UI-SPEC.md §Copywriting, Blocos 1-3). As contas
// vêm prontas de `lib/queimas/contagem.ts` (`queimasPorTipo`, `capacidadeMedida`, `oQueOFornoQueimou`);
// aqui só a frase. Médias e percentuais com uma casa, vírgula (`formatarUmaCasa`).

export const TITULO_NUMEROS = "Números";

// Bloco 1 — quadros.
export const TITULO_POR_TIPO = "Quantas queimas de cada tipo";
export const ROTULO_QUADRO_TODAS = "Todas";

export function subNesteMes(quantidade: number): string {
  if (quantidade === 0) {
    return "nenhuma neste mês";
  }
  return `${quantidade} neste mês`;
}

// `nomeDoMes` chega pronto, em minúsculas (`nomeDoMes` de `lib/agenda/semana.ts`, chamado pelo
// componente): “… “Neste mês” conta outubro inteiro, …”.
export function dicaPorTipo(nomeDoMes: string): string {
  return `Desde a última manutenção do forno — a soma é o contador. “Neste mês” conta ${nomeDoMes} inteiro, com ou sem manutenção no meio.`;
}

// Bloco 2 — capacidade (só biscoito e esmalte, só “saiu cheio”).
export const TITULO_CAPACIDADE = "Quantas peças cabem, de verdade";

export function rotuloFornadaCheia(tipo: "biscoito" | "esmalte"): string {
  return `Fornada cheia de ${tipo}`;
}

export function mediaDePecas(media: number): string {
  return `${formatarUmaCasa(media)} peças`;
}

// O mix médio por tamanho, os três sempre presentes (um tamanho que nunca apareceu é “0 G”), uma casa
// sem o “,0” de inteiro: “em média: 12 P · 7,5 M · 1,5 G”.
export function mixMedio(mix: Record<Tamanho, number>): string {
  return `em média: ${formatarAteUmaCasa(mix.P)} P · ${formatarAteUmaCasa(mix.M)} M · ${formatarAteUmaCasa(mix.G)} G`;
}

export const ROTULO_FATOR = "No biscoito cabem";

// O fator chega SEM arredondar (média ÷ média) e só aqui ganha a casa: “1,6× o esmalte”.
export function fraseFator(fator: number): string {
  return `${formatarUmaCasa(fator)}× o esmalte`;
}

export const VALOR_SEM_NUMERO = "—";
export const FRASE_SEM_CHEIA = "nenhuma fornada cheia contada ainda";
export const FRASE_FATOR_SEM_DOIS_LADOS = "precisa de ao menos uma fornada cheia de biscoito e uma de esmalte";

// A dica do bloco 2 (verbatim do protótipo, com o fator VIGENTE de `forno_fator_biscoito` e o selo
// dele, e a última frase acrescentada — §5: levar o número aos Parâmetros é à mão). O fator vem em
// milésimos (1800 = 1,8×, a escala de `parametros_precificacao`); `cmDaRegua` é a mesma conta de
// escala 1000 (até três casas, sem zero à direita). Sem fator vigente cadastrado, o parêntese sai.
export function dicaCapacidade(fatorVigente: { milesimos: number; medido: boolean } | null): string {
  const hoje =
    fatorVigente === null
      ? ""
      : ` (hoje ${cmDaRegua(fatorVigente.milesimos)}×, ${fatorVigente.medido ? "medido" : "estimado"})`;
  return `Só entram as fornadas marcadas como “saiu cheio”. A precificação estima quantas peças cabem pelas medidas, com um “fator do biscoito”${hoje}. Com o tempo, a contagem por tamanho mostra quanto espaço uma G ocupa perto de uma P — serve para conferir a estimativa e o preço da queima externa. Levar o número para lá é à mão.`;
}

export const ROTULO_ABRIR_PARAMETROS = "abrir Parâmetros";

// O aviso de poucas (UI-D9): menos de `POUCAS_FORNADAS_CHEIAS` (8) cheias, somando biscoito e esmalte;
// com 8 ou mais, `null` (o aviso some).
export function frasePoucasCheias(cheias: number): string | null {
  if (cheias >= POUCAS_FORNADAS_CHEIAS) {
    return null;
  }
  if (cheias === 0) {
    return "Ainda não há fornada cheia contada.";
  }
  if (cheias === 1) {
    return "Ainda é pouco: 1 fornada cheia contada.";
  }
  return `Ainda é pouco: ${cheias} fornadas cheias contadas.`;
}

// Bloco 3 — o que o forno queimou (todas as contagens, desde a primeira).
export const TITULO_O_QUE_QUEIMOU = "O que o forno queimou";

export function subOQueQueimou(fornadas: number): string {
  return fornadas === 1
    ? "desde a primeira contagem · 1 fornada contada"
    : `desde a primeira contagem · ${fornadas} fornadas contadas`;
}

// “212 · 78,5%” — o percentual de cada grupo arredondado SOZINHO (a soma pode não fechar em 100,0).
export function valorDoGrupo(total: number, pct: number | null): string {
  return pct === null ? String(total) : `${total} · ${formatarUmaCasa(pct)}%`;
}

// “150 P · 54 M · 8 G” — os três sempre.
export function subDoGrupo(p: number, m: number, g: number): string {
  return `${p} P · ${m} M · ${g} G`;
}

export const DICA_O_QUE_QUEIMOU =
  "De quem é cada peça interna (encomenda, casa, aula) a Produção e a Agenda já sabem; aqui o que importa é o tamanho, que é o que ocupa o forno.";

// Vazio (blocos 2 e 3, nenhuma contagem no forno) e erro (a leitura dos números falhou).
export const VAZIO_NUMEROS_TITULO = "Nenhuma fornada contada ainda.";
export const VAZIO_NUMEROS_CORPO = "Conte pela folha que abre depois de “Queimar”, ou por “Contar agora” no Histórico.";
export const FRASE_ERRO_NUMEROS =
  "Não deu para carregar os números deste forno. Verifique a internet e tente de novo.";

// A linha do cartão e do detalhe (QMC-09, UI-D1), entre o medidor e o rodapé: N = limite − contador (o
// que FALTA); no limite e acima, as formas próprias — nunca “−3 queimas”. Sem cor de nível: o selo do
// cartão já fala.
export function fraseDaContagemAteManutencao(contador: number, limite: number): string {
  if (contador === limite) {
    return "Contagem: chegou ao limite da manutenção.";
  }
  if (contador > limite) {
    const alem = contador - limite;
    return alem === 1
      ? "Contagem: 1 queima além do limite da manutenção."
      : `Contagem: ${alem} queimas além do limite da manutenção.`;
  }
  const faltam = limite - contador;
  return faltam === 1 ? "Contagem: 1 queima até a manutenção." : `Contagem: ${faltam} queimas até a manutenção.`;
}

// O link do detalhe, sob a linha “Contagem: …”, que salta para a seção Números (UI-D3).
export const ROTULO_VER_OS_NUMEROS = "ver os números";
