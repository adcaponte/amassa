// Isolamento de teste que olha número agregado (CLAUDE.md §Conventions: "teste não pode afirmar
// condição global do banco sem isolamento"). Um teste do extrato ou do Mês soma TODOS os
// lançamentos de um mês inteiro — "quanto entrou em dinheiro?", "quanto a Loja deixou?" — e essa
// afirmação disputa o mesmo número com qualquer outro teste que escreva no MESMO mês. Sob
// `fullyParallel: true` (`playwright.config.ts`), os projetos `desktop` e `celular` rodam a MESMA
// `test()` ao mesmo tempo, então cada chave reserva DOIS meses (um por projeto) — nunca o mesmo
// mês para os dois lados da mesma chave.
//
// Os meses são espaçados de 3 em 3 (nunca adjacentes entre chaves diferentes) de propósito: mais
// de um caso de teste navega para "o mês anterior" e espera achá-lo VAZIO (a fronteira do extrato
// e do Mês, D-11) — se dois meses reservados fossem vizinhos, o "anterior" de um seria o "atual"
// do outro, e o teste que espera vazio encontraria dado de verdade.
//
// Todos entre 2021 e 2025 — depois do piso de 2020 do Zod (`dataDentroDoIntervaloPermitido`,
// lib/financeiro/esquemas.ts) e antes de qualquer dado real do ateliê (inauguração em dezembro de
// 2026). Planos futuros (10, 11) ACRESCENTAM registros aqui — nunca reaproveitam um mês já usado.

type RegistroDeMesReservado = { chave: string; desktop: string; celular: string };

const MESES_RESERVADOS: readonly RegistroDeMesReservado[] = [
  // 04.4-09-PLAN.md — Tarefa 2 (extrato: navegação por mês, filtro por forma, os dois vazios).
  { chave: "extrato-lancamentos", desktop: "2021-01", celular: "2021-04" },
  // 04.4-09-PLAN.md — Tarefa 3 (Mês).
  { chave: "mes-areas", desktop: "2021-07", celular: "2021-10" },
  { chave: "mes-custo-veredito", desktop: "2022-01", celular: "2022-04" },
  { chave: "mes-taxa", desktop: "2022-07", celular: "2022-10" },
  { chave: "mes-fora", desktop: "2023-01", celular: "2023-04" },
  { chave: "mes-cancelado", desktop: "2023-07", celular: "2023-10" },
  { chave: "mes-fronteira", desktop: "2024-01", celular: "2024-04" },
  { chave: "mes-vazio", desktop: "2024-07", celular: "2024-10" },
];

// Guarda de unicidade: nenhum mês pode aparecer duas vezes em TODO o array (nem entre chaves
// diferentes, nem entre desktop/celular da MESMA chave) — lança já no carregamento do módulo,
// nunca silenciosamente no meio de um teste.
(function conferirUnicidadeDosMesesReservados() {
  const vistoPor = new Map<string, string>();
  for (const registro of MESES_RESERVADOS) {
    for (const [projeto, mes] of [
      ["desktop", registro.desktop],
      ["celular", registro.celular],
    ] as const) {
      const dono = vistoPor.get(mes);
      if (dono) {
        throw new Error(
          `mes-reservado.ts: o mês "${mes}" já está reservado por "${dono}" — "${registro.chave}" (${projeto}) não pode reaproveitá-lo. Acrescente um mês novo, nunca reaproveite um existente.`,
        );
      }
      vistoPor.set(mes, `${registro.chave} (${projeto})`);
    }
  }
})();

// O mês reservado ("AAAA-MM") de UMA chave, para o projeto do Playwright que está rodando —
// `nomeDoProjeto` vem de `test.info().project.name` ("desktop" ou "celular"). Falha alto para
// chave ou projeto desconhecidos, nunca cai num mês qualquer por engano.
export function mesReservado(chave: string, nomeDoProjeto: string): string {
  const registro = MESES_RESERVADOS.find((item) => item.chave === chave);
  if (!registro) {
    throw new Error(
      `mesReservado: nenhum registro para a chave "${chave}" — acrescente-a em MESES_RESERVADOS.`,
    );
  }
  if (nomeDoProjeto === "desktop") {
    return registro.desktop;
  }
  if (nomeDoProjeto === "celular") {
    return registro.celular;
  }
  throw new Error(`mesReservado: projeto desconhecido "${nomeDoProjeto}" (esperado "desktop" ou "celular").`);
}

// "AAAA-MM-DD" a partir do mês reservado e um dia do mês (1-31) — nunca `Date`, só concatenação de
// texto (mesmo cuidado do resto do Financeiro: dia civil é sempre texto comparado como texto).
export function diaDoMes(mes: string, dia: number): string {
  return `${mes}-${String(dia).padStart(2, "0")}`;
}
