// Módulo puro, sem nenhum import — mesmo molde de `lib/auth/rotas-publicas.ts`. Nasce aqui, na
// Agenda, e não em `lib/inicio/`, porque a ocupação é uma regra do módulo da Agenda (GES-09):
// quando a Agenda existir de verdade, é este arquivo que ganha a consulta de ocupação real, e o
// Início continua só chamando `ocupacaoDoEspaco`.
//
// 🔴 NÃO EXISTE CAPACIDADE DO ESPAÇO, e isso é decisão do dono, de 29/09/2026, no portão de
// verificação humana da Fase 04.6 (item 13). O plano 06 tinha nascido com
// `LUGARES_DO_ESPACO = 10` e a linha "N de M lugares", número que veio do protótipo aprovado
// ("3 de 10 lugares", `prototipo-gestao.html`) e NUNCA de uma medição do espaço físico. Ao ser
// perguntado quantos lugares o espaço tem de verdade, o dono respondeu que a pergunta não se
// aplica: "no espaço em si pode ser que caiba mais, pode ser que eu coloque umas mesas a mais na
// parte externa"; a gestão é dele, no dia, "de acordo com as pessoas que estão e o que estão
// fazendo". Um denominador fixo seria um limite inventado, e mostrá-lo na tela daria a impressão
// de uma regra que o ateliê não tem.
//
// O que PERMANECE é o número de relance — quantas pessoas estão no espaço agora —, porque é
// justamente ele que alimenta a decisão do dono. O que saiu é a fração.
//
// Isto NÃO retira o limite por TURMA: aulas e oficinas têm, cada uma, um máximo próprio definido
// conforme a aula ("teremos um até número x de pessoas, que será definido de acordo com a aula e
// oficina"). Isso é a Fase 5, requisitos AGD-02/03/04 (assentos da turma: aberta, completa,
// excedida), que seguem valendo e não foram tocados aqui.

// Plural em português: 0 e 2+ pedem "pessoas", 1 pede "pessoa". Sem `Intl` porque este módulo é
// puro de propósito (nenhum import) e a regra aqui tem duas saídas.
export function ocupacaoDoEspaco(ocupados: number): string {
  return ocupados === 1 ? "1 pessoa" : `${ocupados} pessoas`;
}
