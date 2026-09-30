// Módulo puro, sem nenhum import: `lib/inicio/` só pode conter apresentação pura (GES-09) —
// nenhuma consulta, nenhuma regra de negócio. Regra de módulo mora no módulo (a janela de sete
// dias em `lib/financeiro/vencimentos.ts`, as linhas da produção em `lib/producao/quadro.ts`
// (`linhasParaOInicio`), a capacidade do espaço em `lib/agenda/espaco.ts`).
//
// Nota sobre `date-fns`: o PLAN.md deste plano cita `lib/queimas/formato.ts` como "molde" e pede
// para usar `date-fns` com o locale `ptBR` — mas aquele próprio arquivo documenta, no seu
// comentário de topo, que o projeto dispensou `date-fns` CONSCIENTEMENTE em favor de
// `Intl.DateTimeFormat` nativo (mesma disciplina em `lib/encomendas/formato.ts`), e o pacote
// nem está instalado (`node_modules`/`package.json`). Seguido o "molde" pelo comportamento real
// do arquivo (zero import, só `Intl`), não pela frase que o cita — instalar uma dependência nova
// não documentada em nenhuma outra parte do código, só para uma função, contradiria a própria
// convenção que o plano pede para copiar. Registrado no SUMMARY como desvio (Regra 1/CLAUDE.md).
export function saudacaoDe({ nome, email }: { nome: string; email: string }): string {
  const normalizado = nome.trim().replace(/\s+/g, " ");
  if (normalizado) {
    return normalizado;
  }
  // Nome vazio depois da normalização (só espaços, ou ausente) nunca deixa a saudação sem
  // sujeito — cai no trecho do e-mail antes do arroba (GES-11, aresta `empty`).
  return email.split("@")[0];
}

// Nomes de dia da semana que o `Intl` pt-BR devolve com o sufixo "-feira" (todos exceto sábado e
// domingo) — "Sexta, 18 de dezembro" usa só o primeiro pedaço, capitalizado; sábado/domingo já
// vêm sem sufixo e só precisam da mesma capitalização.
const DIAS_SEM_SUFIXO = new Set(["sábado", "domingo"]);

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// "Sexta, 18 de dezembro" a partir de "2026-12-18" — dia da semana com a primeira letra
// maiúscula, dia do mês sem zero à esquerda, mês em minúscula, sem ano (como o protótipo).
// `Date.UTC` + `timeZone: "UTC"` em todo `Intl.DateTimeFormat`, nunca o fuso do processo: é o
// que garante o MESMO texto para o mesmo `dataIso`, independente de `process.env.TZ`
// (GES-11, aresta `encoding`) — quem já leu o fuso de Brasília é `hojeEmBrasilia`, antes de
// chamar esta função; ela só formata o dia civil que já chegou pronto.
export function dataLongaEmPortugues(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const dataUtc = new Date(Date.UTC(ano, mes - 1, dia));

  const diaDaSemanaLongo = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    timeZone: "UTC",
  }).format(dataUtc);
  const nomeDoDia = DIAS_SEM_SUFIXO.has(diaDaSemanaLongo)
    ? diaDaSemanaLongo
    : diaDaSemanaLongo.split("-")[0];

  const diaDoMes = new Intl.DateTimeFormat("pt-BR", { day: "numeric", timeZone: "UTC" }).format(
    dataUtc,
  );
  const mesLongo = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(
    dataUtc,
  );

  return `${capitalizar(nomeDoDia)}, ${diaDoMes} de ${mesLongo}`;
}
