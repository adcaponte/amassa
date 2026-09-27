// Módulo puro (D-14 do CONTEXT.md, mesma disciplina de `lib/orcamentos/contas.ts`/`plano.ts`/
// `situacao.ts`/`snapshot.ts`): só `import type` de módulos do banco, e duas exceções
// DELIBERADAS de import de VALOR — as duas de módulos que já são puros neste projeto:
// `parcelasDoPlano` (lib/orcamentos/plano.ts) e `lerDoSnapshot` (lib/orcamentos/snapshot.ts).
// Nenhuma leitura do relógio (`hoje` sempre entra por argumento), nenhum React, nenhum cliente
// de banco.
//
// 🔴 POR QUE ESTE ARQUIVO EXISTE (04.5-RESEARCH.md, "Open Questions" #1; 04.5-11-PLAN.md): os
// componentes do gerador de PDF (`@react-pdf/renderer`) não são elementos de página — `<View>`/
// `<Text>` não são `<div>`/`<span>`. A tela "Ver como o cliente vê"
// (components/amassa/orcamentos/ver-como-o-cliente-ve.tsx) e o PDF
// (lib/orcamentos/pdf/documento.tsx) NÃO PODEM compartilhar UMA LINHA de marcação — tentar
// reaproveitar um componente da tela dentro do `<Document>` falha em tempo de execução. O que
// os dois compartilham é ESTA estrutura de dados. Quem acrescentar um campo ao documento
// acrescenta AQUI, e os dois lados ganham juntos — é isso que mantém ORC-13 ("o mesmo conteúdo
// da tela") verdadeiro depois de qualquer mudança futura, sem ninguém precisar lembrar de
// atualizar dois lugares.
//
// 🔴 O tipo `DocumentoDoCliente` é FECHADO e não tem, em NENHUM nível, um campo de custo,
// mínimo, margem, sobra, hora ou fornada (D-24/D-29) — o painel "Só para você"
// (components/amassa/orcamentos/so-para-voce.tsx, plano 07) é a ÚNICA porta para esses números,
// e nunca é importado aqui. `tests/unit/orcamentos-documento-cliente.test.ts` varre esta
// estrutura por padrão de nome para provar isso, não só por leitura de código.
//
// Cada campo já sai FORMATADO em texto — este módulo formata (reaproveitando
// `formatarReais`/`formatarDataCurta` de `lib/financeiro/formato.ts`, já um exemplo estabelecido
// de reuso — ver 04.5-PATTERNS.md), os dois renderizadores (a tela e o PDF) só EXIBEM, nunca
// formatam. É o que evita a tela e o PDF divergirem por causa de duas implementações de
// formatação em dois lugares diferentes.
// Só o TIPO do enum de status — nunca uma consulta, nunca um valor.
import type { orcamentos } from "@/db/schema";
// Módulo puro, zero import (lib/financeiro/formato.ts) — reaproveitado, não redeclarado, porque
// é formatação pura (não aritmética de "hoje"): mesmo padrão já registrado em 04.5-PATTERNS.md.
import { formatarDataCurta, formatarReais } from "@/lib/financeiro/formato";
// Módulo puro, zero import (lib/orcamentos/formato.ts) — o mesmo formato de número em toda tela.
import { numeroDeOrcamento, rotuloDeRevisao } from "@/lib/orcamentos/formato";
// Módulo puro (D-14) — a MESMA função que desenha "Total e pagamento" na tela de edição
// (key_link do 04.5-11-PLAN.md): o documento nunca recalcula parcela.
import { parcelasDoPlano, type PlanoDePagamentoDoOrcamento } from "@/lib/orcamentos/plano";
// Módulo puro (D-14) — decide, aqui dentro, se cada linha lê o nome da ficha viva ou do
// snapshot congelado (D-21); nenhum chamador duplica essa escolha.
import { lerDoSnapshot } from "@/lib/orcamentos/snapshot";

type StatusOrcamento = (typeof orcamentos.status.enumValues)[number];

// D-15 do projeto: aritmética de calendário civil redeclarada localmente (Howard Hinnant,
// days_from_civil/civil_from_days) — mesma cópia (nunca importada) de `lib/orcamentos/plano.ts`
// e `lib/orcamentos/situacao.ts`. Cada módulo puro tem a própria.
function diasDesdeAEpoca(ano: number, mes: number, dia: number): number {
  const anoAjustado = mes <= 2 ? ano - 1 : ano;
  const era = Math.floor((anoAjustado >= 0 ? anoAjustado : anoAjustado - 399) / 400);
  const anoDoEra = anoAjustado - era * 400;
  const diaDoAno = Math.floor((153 * (mes + (mes > 2 ? -3 : 9)) + 2) / 5) + dia - 1;
  const diaDoEra =
    anoDoEra * 365 + Math.floor(anoDoEra / 4) - Math.floor(anoDoEra / 100) + diaDoAno;
  return era * 146097 + diaDoEra - 719468;
}

function civilDesdeDias(diasDesdeEpoca: number): { ano: number; mes: number; dia: number } {
  const z = diasDesdeEpoca + 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const diaDoEra = z - era * 146097;
  const anoDoEra = Math.floor(
    (diaDoEra -
      Math.floor(diaDoEra / 1460) +
      Math.floor(diaDoEra / 36524) -
      Math.floor(diaDoEra / 146096)) /
      365,
  );
  const anoAjustado = anoDoEra + era * 400;
  const diaDoAno = diaDoEra - (365 * anoDoEra + Math.floor(anoDoEra / 4) - Math.floor(anoDoEra / 100));
  const mesProvisorio = Math.floor((5 * diaDoAno + 2) / 153);
  const dia = diaDoAno - Math.floor((153 * mesProvisorio + 2) / 5) + 1;
  const mes = mesProvisorio + (mesProvisorio < 10 ? 3 : -9);
  const ano = mes <= 2 ? anoAjustado + 1 : anoAjustado;
  return { ano, mes, dia };
}

function formatarDataCivil(ano: number, mes: number, dia: number): string {
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function somarDias(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const { ano: anoSaida, mes: mesSaida, dia: diaSaida } = civilDesdeDias(
    diasDesdeAEpoca(ano, mes, dia) + dias,
  );
  return formatarDataCivil(anoSaida, mesSaida, diaSaida);
}

// O que a tela/rota precisam ter em mãos ANTES de chamar `montarDocumentoDoCliente` — os campos
// crus do cabeçalho do orçamento (`status`/`snapshot` decidem, AQUI DENTRO, se cada linha lê o
// nome da ficha viva ou do snapshot congelado — nenhum chamador duplica essa escolha).
export type OrcamentoParaDocumento = {
  status: StatusOrcamento;
  ano: number;
  sequencial: number;
  revisao: number;
  clienteNome: string | null;
  titulo: string | null;
  data: string;
  validadeDias: number;
  entregaPrevista: string;
  observacoes: string | null;
  plano: PlanoDePagamentoDoOrcamento;
  sinalPercentual: number;
  freteCentavos: number;
  // `unknown` de propósito (mesma disciplina de `lib/orcamentos/snapshot.ts::lerDoSnapshot`) —
  // só lido quando `status !== "rascunho"`.
  snapshot: unknown;
};

// Uma linha CRUA (nome vindo da ficha, ainda não resolvido entre viva/congelada — quem decide é
// esta função, não o chamador).
export type LinhaParaDocumento = {
  nomeDaFicha: string;
  cor: string | null;
  personalizacao: string | null;
  quantidade: number;
  precoUnitarioCentavos: number;
};

export type ItemDeProjetoParaDocumento = {
  descricao: string;
  valorCentavos: number;
};

// Só o que o documento precisa da foto — nunca o byte (a tela busca por
// `/api/orcamentos/fotos/<id>`; o PDF lê o byte à parte, em `app/api/orcamentos/[id]/pdf/route.ts`,
// pelo NOME de arquivo que só a consulta ao banco conhece — este módulo nunca toca disco).
export type FotoParaDocumento = {
  id: string;
  legenda: string | null;
};

type LinhaDoDocumento = {
  nome: string;
  cor: string | null;
  personalizacao: string | null;
  quantidadeTexto: string;
  precoUnitarioFormatado: string;
  totalFormatado: string;
};

// Fixas, sempre presentes, verbatim do protótipo aprovado (`prototipo.html`, função `papel`) —
// vivem aqui (não em `lib/orcamentos/textos.ts`) porque fazem parte do CONTEÚDO do documento, na
// mesma estrutura que a tela e o PDF leem — nenhum dos dois escreve este texto por conta própria.
const FRASE_CONFIRMACAO_DO_DOCUMENTO =
  "Ao aprovar, você confirma as peças, as cores e as referências mostradas acima.";
const NOTA_FEITO_A_MAO_DO_DOCUMENTO =
  "Cada peça é feita à mão e queimada em alta temperatura. Pequenas variações de cor, forma e medida fazem parte do processo e tornam cada peça única.";

// O tipo FECHADO do documento do cliente (D-24/D-29) — nenhum campo de custo, mínimo, margem,
// sobra, hora ou fornada, em nenhum nível. `tests/unit/orcamentos-documento-cliente.test.ts`
// afirma isto por varredura de nome de chave, não só por esta declaração.
export type DocumentoDoCliente = {
  numeroCompleto: string;
  dataFormatada: string;
  validoAteTexto: string;
  paraTexto: string;
  linhas: LinhaDoDocumento[];
  projeto: Array<{ descricao: string; valorFormatado: string }>;
  freteFormatado: string | null;
  totalFormatado: string;
  referencias: Array<{ id: string; legenda: string | null }>;
  pagamento: Array<{ rotulo: string; valorFormatado: string }>;
  prazoTexto: string;
  observacoes: string | null;
  fraseConfirmacao: string;
  notaFeitoAMao: string;
};

// A ÚNICA fonte de conteúdo do documento (key_link do 04.5-11-PLAN.md) — a tela
// (`VerComoOClienteVe`) e a rota do PDF (`GET /api/orcamentos/[id]/pdf`) chamam esta função com
// os MESMOS dados e recebem o MESMO objeto. Não existe segunda montagem em nenhum lugar.
export function montarDocumentoDoCliente(
  orcamento: OrcamentoParaDocumento,
  linhas: LinhaParaDocumento[],
  projeto: ItemDeProjetoParaDocumento[],
  fotos: FotoParaDocumento[],
  hoje: string,
): DocumentoDoCliente {
  const vivo = orcamento.status === "rascunho";
  const leitura = vivo ? null : lerDoSnapshot(orcamento.snapshot);

  const linhasDoDocumento: LinhaDoDocumento[] = linhas.map((linha, indice) => {
    const nomeCongelado = leitura?.linhas[indice]?.nome;
    const nome = vivo ? linha.nomeDaFicha : nomeCongelado || linha.nomeDaFicha;
    return {
      nome,
      cor: linha.cor ? `Cor: ${linha.cor}` : null,
      personalizacao: linha.personalizacao,
      quantidadeTexto: String(linha.quantidade),
      precoUnitarioFormatado: formatarReais(linha.precoUnitarioCentavos),
      totalFormatado: formatarReais(linha.quantidade * linha.precoUnitarioCentavos),
    };
  });

  // O total do documento nunca precisa da cadeia de precificação (custo/mínimo/farol) — é só
  // soma de quantidade × preço praticado, mais projeto e frete. Preço e quantidade são as MESMAS
  // colunas em qualquer status (D-21 congela custo/mínimo/hora, nunca o preço praticado nem a
  // quantidade, que o dono não muda depois de enviar mesmo assim — a tela trava o campo, não o
  // dado).
  const pecasCentavos = linhas.reduce(
    (soma, linha) => soma + linha.quantidade * linha.precoUnitarioCentavos,
    0,
  );
  const projetoCentavos = projeto.reduce((soma, item) => soma + item.valorCentavos, 0);
  const totalCentavos = pecasCentavos + projetoCentavos + orcamento.freteCentavos;

  const validoAte = somarDias(orcamento.data, orcamento.validadeDias);

  // `parcelasDoPlano` (plano 07) é a MESMA função que desenha o bloco "Pagamento" na tela de
  // edição — o documento não recalcula parcela nenhuma (key_link do plano).
  const parcelas = parcelasDoPlano({
    plano: orcamento.plano,
    sinalPercentual: orcamento.sinalPercentual,
    totalCentavos,
    hoje,
    entregaPrevista: orcamento.entregaPrevista,
  });

  return {
    numeroCompleto: `Orçamento nº ${numeroDeOrcamento(orcamento.ano, orcamento.sequencial)}${rotuloDeRevisao(orcamento.revisao)}`,
    dataFormatada: formatarDataCurta(orcamento.data),
    validoAteTexto: `válido até ${formatarDataCurta(validoAte)}`,
    paraTexto: `Para ${orcamento.clienteNome?.trim() || "—"}${orcamento.titulo ? ` · ${orcamento.titulo}` : ""}`,
    linhas: linhasDoDocumento,
    projeto: projeto.map((item) => ({
      descricao: item.descricao,
      valorFormatado: formatarReais(item.valorCentavos),
    })),
    freteFormatado: orcamento.freteCentavos > 0 ? formatarReais(orcamento.freteCentavos) : null,
    totalFormatado: formatarReais(totalCentavos),
    referencias: fotos.map((foto) => ({ id: foto.id, legenda: foto.legenda })),
    pagamento: parcelas.map((parcela) => ({
      rotulo: parcela.rotulo,
      valorFormatado: formatarReais(parcela.valorCentavos),
    })),
    prazoTexto: `Entrega prevista para ${formatarDataCurta(orcamento.entregaPrevista)}, com o sinal pago até ${formatarDataCurta(validoAte)}. A produção começa quando o sinal entra.`,
    observacoes: orcamento.observacoes,
    fraseConfirmacao: FRASE_CONFIRMACAO_DO_DOCUMENTO,
    notaFeitoAMao: NOTA_FEITO_A_MAO_DO_DOCUMENTO,
  };
}

// Devolve, EM ORDEM, cada texto visível do documento — a entrada do teste de paridade de
// conteúdo (Tarefa 4): compara-se isto com o texto extraído do PDF gerado a partir do MESMO
// `DocumentoDoCliente`. Cabeçalhos fixos de seção ("Peça", "Referências", "Pagamento", "Prazo")
// não entram aqui porque são JSX literal, idêntico nos dois renderizadores — não fazem parte do
// DADO que pode divergir.
export function textosDoDocumento(documento: DocumentoDoCliente): string[] {
  const textos: string[] = [
    documento.numeroCompleto,
    documento.dataFormatada,
    documento.validoAteTexto,
    documento.paraTexto,
  ];

  for (const linha of documento.linhas) {
    textos.push(linha.nome);
    if (linha.cor) textos.push(linha.cor);
    if (linha.personalizacao) textos.push(linha.personalizacao);
    textos.push(linha.quantidadeTexto, linha.precoUnitarioFormatado, linha.totalFormatado);
  }

  for (const item of documento.projeto) {
    textos.push(item.descricao, item.valorFormatado);
  }

  if (documento.freteFormatado) {
    textos.push(documento.freteFormatado);
  }

  textos.push(documento.totalFormatado);

  for (const referencia of documento.referencias) {
    if (referencia.legenda) textos.push(referencia.legenda);
  }

  for (const parcela of documento.pagamento) {
    textos.push(parcela.rotulo, parcela.valorFormatado);
  }

  textos.push(documento.prazoTexto);

  if (documento.observacoes) {
    textos.push(documento.observacoes);
  }

  textos.push(documento.fraseConfirmacao, documento.notaFeitoAMao);

  return textos;
}
