// Ponto único de validação das ações da Agenda (CLAUDE.md §Validação): a Server Action valida AQUI,
// no servidor, sempre. Do cliente chega só o que ele escolheu — o resto (o evento, se a data foi
// cancelada, o direito a repor) é lido sob a trava no servidor (T-05-03, T-05-04).
import { z } from "zod";

import { textoParaMilesimos } from "@/lib/estoque/esquemas";
import { FRASE_QUANTIDADE_INVALIDA } from "@/lib/estoque/textos";
import { converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { diasEntre, ehDataCivil } from "@/lib/producao/calendario";

import { minutosDe } from "./horario";
import { TIPOS_DE_COBRANCA } from "./receber";
import { PRESENCAS } from "./tipos";
import { SEMANAS_MAXIMAS, SEMANAS_MINIMAS } from "./turma";
import { HORAS_PREVISTAS_MAXIMAS, HORAS_PREVISTAS_MINIMAS, PESSOAS_MAXIMAS, PESSOAS_MINIMAS } from "./uso-livre";
import {
  FRASE_DIA_DA_SEMANA,
  FRASE_ESCOLHA_O_MATERIAL,
  FRASE_FALHA_AO_ACRESCENTAR_MATERIAL,
  FRASE_FALHA_AO_MUDAR_COBRANCA,
  FRASE_ERRO_CARREGAR_PESSOAS,
  FRASE_ESCOLHA_A_DATA,
  FRASE_ESCOLHA_QUEM_VEM,
  FRASE_HORA_DE_CHEGADA,
  FRASE_HORA_DE_SAIDA,
  FRASE_SAIDA_ANTES_DA_CHEGADA,
  FRASE_HORAS_PREVISTAS,
  FRASE_PESSOAS,
  FRASE_EXPERIMENTAL_SEM_ESCOLHA,
  FRASE_EXPERIMENTAL_VALOR,
  FRASE_FALHA_AO_DESATIVAR_TURMA,
  FRASE_FALHA_AO_ENTRAR_NA_TURMA,
  FRASE_FALHA_AO_SAIR_DA_TURMA,
  FRASE_FALHA_AO_MARCAR_SEMANAS,
  FRASE_FALHA_AO_SALVAR_TURMA,
  FRASE_FALHA_AO_CANCELAR,
  FRASE_FALHA_AO_COLOCAR,
  FRASE_FALHA_AO_LANCAR,
  FRASE_FALHA_AO_MARCAR_DIREITO,
  FRASE_FALHA_PRESENCA_GENERICA,
  FRASE_FIM_ANTES_DO_COMECO,
  FRASE_HORARIO_VAZIO,
  FRASE_JA_REMOVIDO,
  FRASE_LANCAMENTO_NAO_EXISTE,
  FRASE_MENSALIDADE,
  FRASE_MOTIVO_LONGO,
  FRASE_MOTIVO_VAZIO,
  FRASE_NOME_DA_AULA,
  FRASE_NOME_DA_TURMA,
  FRASE_NOME_LONGO,
  FRASE_PRECO_POR_PESSOA,
  FRASE_SEMANAS,
  FRASE_VAGAS,
  FRASE_VENCIMENTO,
  FRASE_FALHA_AO_RECEBER,
} from "./textos";

// "Veio" / "Faltou" / desmarcar: o id da inscrição e o estado DESEJADO (Pattern 2) — nunca
// "inverter". `null` é desmarcar.
export const esquemaDefinirPresenca = z.object({
  inscricaoId: z.uuid({ error: FRASE_FALHA_PRESENCA_GENERICA }),
  presenca: z.enum(PRESENCAS, { error: FRASE_FALHA_PRESENCA_GENERICA }).nullable(),
});

export type DefinirPresencaValidado = z.infer<typeof esquemaDefinirPresenca>;

// Texto curto do usuário: aparado, contado em pontos de código (o `length()` do Postgres conta
// caracteres, não unidades UTF-16) — o mesmo limite do check `eventos_titulo_comprimento`.
function textoCurto(fraseVazio: string, fraseLonga: string) {
  return z
    .string({ error: fraseVazio })
    .transform((texto) => texto.normalize("NFC").trim())
    .refine((texto) => texto.length > 0, { error: fraseVazio })
    .refine((texto) => [...texto].length <= 120, { error: fraseLonga });
}

const dataCivil = z.string({ error: FRASE_ESCOLHA_A_DATA }).refine(ehDataCivil, { error: FRASE_ESCOLHA_A_DATA });

// "HH:MM" do `<input type="time">` — vazio é a frase de horário; o servidor nunca grava hora ilegível.
const FORMATO_HORA_DO_CAMPO = /^([01]\d|2[0-3]):[0-5]\d$/;
const horaDoCampo = z
  .string({ error: FRASE_HORARIO_VAZIO })
  .refine((hora) => FORMATO_HORA_DO_CAMPO.test(hora), { error: FRASE_HORARIO_VAZIO });

// Vagas: inteiro de 1 a 999 (check `eventos_vagas_faixa`). Chega como texto do campo ou número.
const vagasDoCampo = z
  .union([z.string(), z.number()], { error: FRASE_VAGAS })
  .transform((valor, contexto) => {
    const texto = String(valor).trim();
    if (!/^\d{1,3}$/.test(texto) || Number(texto) < 1) {
      contexto.addIssue({ code: "custom", message: FRASE_VAGAS });
      return z.NEVER;
    }
    return Number(texto);
  });

// Preço por pessoa: o texto digitado vira centavos INTEIROS pela conversão única do Financeiro
// (nunca ponto flutuante — AGE-12 · precision). Vazio é erro (nenhum preço no código, AGE-17);
// "0" vale 0 (oficina gratuita).
const precoDoCampo = z.string({ error: FRASE_PRECO_POR_PESSOA }).transform((texto, contexto) => {
  const convertido = converterReaisParaCentavos(texto);
  if (!convertido.ok || convertido.centavos === null) {
    contexto.addIssue({ code: "custom", message: FRASE_PRECO_POR_PESSOA });
    return z.NEVER;
  }
  return convertido.centavos;
});

// "Lançar aula" — uma aula ou oficina avulsa (AGE-12). O erro de "fim antes do começo" mora no
// campo do fim; quem falta é apontado campo a campo (o `path` de cada problema).
export const esquemaLancarAvulsa = z
  .object({
    titulo: textoCurto(FRASE_NOME_DA_AULA, FRASE_NOME_LONGO),
    data: dataCivil,
    inicio: horaDoCampo,
    fim: horaDoCampo,
    vagas: vagasDoCampo,
    preco: precoDoCampo,
    publico: z.boolean({ error: FRASE_FALHA_AO_LANCAR }),
  })
  .superRefine((dados, contexto) => {
    // O Zod 4 roda este refinamento mesmo com um campo já recusado: só compara horas legíveis.
    const legiveis = FORMATO_HORA_DO_CAMPO.test(dados.inicio) && FORMATO_HORA_DO_CAMPO.test(dados.fim);
    if (legiveis && minutosDe(dados.fim) <= minutosDe(dados.inicio)) {
      contexto.addIssue({ code: "custom", path: ["fim"], message: FRASE_FIM_ANTES_DO_COMECO });
    }
  })
  .transform(({ preco, ...resto }) => ({ ...resto, precoCentavos: preco }));

export type LancarAvulsaValidado = z.infer<typeof esquemaLancarAvulsa>;

// "Fechar o dia" — o motivo é o título do fechado (privado: o site nunca o seleciona).
export const esquemaFecharDia = z.object({
  data: dataCivil,
  motivo: textoCurto(FRASE_MOTIVO_VAZIO, FRASE_MOTIVO_LONGO),
});

export type FecharDiaValidado = z.infer<typeof esquemaFecharDia>;

// A leitura do aviso D-13 quando a data da folha muda. Com `ate` (a turma: da primeira à última data
// que vão ser marcadas), devolve também os fechados do intervalo — que nunca passa de um ano e um
// dia (52 semanas), para a leitura não virar varredura do banco.
export const esquemaConferirDia = z
  .object({ data: dataCivil, ate: dataCivil.optional() })
  .refine(
    ({ data, ate }) => {
      // Campo já recusado: o erro dele basta (o Zod 4 pode rodar este refinamento mesmo assim).
      if (ate === undefined || !ehDataCivil(data) || !ehDataCivil(ate)) {
        return true;
      }
      const dias = diasEntre(data, ate);
      return dias >= 0 && dias <= 366;
    },
    { error: FRASE_ESCOLHA_A_DATA },
  );

// "Cancelar esta data" / "Desfazer cancelamento" — o estado DESEJADO (Pattern 2), nunca "inverter".
// `confirmado` diz que a pessoa já viu, na confirmação, o que se perde: sem ele, o servidor
// confere sob a trava se algo se perderia e, se sim, devolve as perdas em vez de gravar.
export const esquemaCancelarData = z.object({
  eventoId: z.uuid({ error: FRASE_LANCAMENTO_NAO_EXISTE }),
  cancelada: z.boolean({ error: FRASE_FALHA_AO_CANCELAR }),
  confirmado: z.boolean().optional(),
});

export type CancelarDataValidado = z.infer<typeof esquemaCancelarData>;

// "Tirar o bloqueio" — só o id; o tipo é conferido NA PRÓPRIA instrução de `delete`.
export const esquemaTirarBloqueio = z.object({
  eventoId: z.uuid({ error: FRASE_LANCAMENTO_NAO_EXISTE }),
});

// O seletor de pessoa (UI-D5): a busca (até 160 caracteres — o tamanho de um nome, contado em pontos
// de código) e, quando o seletor está numa data, o id dela (quem já está inscrito não aparece). Sem
// `eventoId` (o "Quem" do uso livre, plano 09), ninguém é tirado.
export const esquemaBuscarPessoas = z.object({
  eventoId: z.uuid({ error: FRASE_ERRO_CARREGAR_PESSOAS }).optional(),
  busca: z
    .string({ error: FRASE_ERRO_CARREGAR_PESSOAS })
    .transform((texto) => texto.normalize("NFC").trim())
    .refine((texto) => [...texto].length <= 160, { error: FRASE_ERRO_CARREGAR_PESSOAS }),
});

export type BuscarPessoasValidado = z.infer<typeof esquemaBuscarPessoas>;

// Como a pessoa entra na data (AGE-10): inscrição paga na oficina, reposição (usa 1 aula a repor) ou
// experimental numa data de turma (D-07, plano 08 — Tarefa 3). Sem `modo`, é a inscrição de oficina
// (o "Colocar na lista" do plano 05).
export const MODOS_DE_COLOCAR = ["oficina", "reposicao", "experimental"] as const;
export type ModoDeColocar = (typeof MODOS_DE_COLOCAR)[number];

// "Colocar na lista" (AGE-10, AGE-12): os dois ids e o modo. NENHUM valor da oficina vem da tela
// (T-05-24) — o preço da inscrição é lido do evento sob a trava; o crédito de reposição é recalculado
// sob a trava do cliente (Pitfall 7), nunca aceito do navegador.
//
// A experimental (D-07; UI-D6): `cobrar` é OBRIGATÓRIO — nada vem escolhido de antemão — e, cobrando, o
// valor é o texto do campo, convertido em centavos INTEIROS pela conversão única do Financeiro (T-05-40:
// nunca ponto flutuante, nunca sinal). Cobrar R$ 0,00 é recusado: quem não paga é "Gratuita". Nos outros
// modos, `cobrar` e `valor` são ignorados — o servidor decide.
export const esquemaColocarNaData = z
  .object({
    eventoId: z.uuid({ error: FRASE_LANCAMENTO_NAO_EXISTE }),
    clienteId: z.uuid({ error: FRASE_FALHA_AO_COLOCAR }),
    modo: z.enum(MODOS_DE_COLOCAR, { error: FRASE_FALHA_AO_COLOCAR }).default("oficina"),
    cobrar: z.boolean({ error: FRASE_EXPERIMENTAL_SEM_ESCOLHA }).nullable().optional(),
    valor: z.string({ error: FRASE_EXPERIMENTAL_VALOR }).nullable().optional(),
  })
  .transform((dados, contexto) => {
    const base = { eventoId: dados.eventoId, clienteId: dados.clienteId, modo: dados.modo };
    if (dados.modo !== "experimental") {
      return { ...base, cobrar: null, valorCentavos: null };
    }
    if (dados.cobrar === undefined || dados.cobrar === null) {
      contexto.addIssue({ code: "custom", path: ["cobrar"], message: FRASE_EXPERIMENTAL_SEM_ESCOLHA });
      return z.NEVER;
    }
    if (!dados.cobrar) {
      return { ...base, cobrar: false, valorCentavos: null };
    }
    const convertido = converterReaisParaCentavos(dados.valor ?? "");
    if (!convertido.ok || convertido.centavos === null || convertido.centavos < 1) {
      contexto.addIssue({ code: "custom", path: ["valor"], message: FRASE_EXPERIMENTAL_VALOR });
      return z.NEVER;
    }
    return { ...base, cobrar: true, valorCentavos: convertido.centavos };
  });

export type ColocarNaDataValidado = z.infer<typeof esquemaColocarNaData>;

// "tem direito a repor esta aula" (AGE-09): o id da inscrição e o estado DESEJADO (Pattern 2) — marcar
// duas vezes vale uma; o que a falta é e em que data ela foi é lido sob a trava, no servidor.
export const esquemaDefinirDireitoARepor = z.object({
  inscricaoId: z.uuid({ error: FRASE_FALHA_AO_MARCAR_DIREITO }),
  direito: z.boolean({ error: FRASE_FALHA_AO_MARCAR_DIREITO }),
});

export type DefinirDireitoARepor = z.infer<typeof esquemaDefinirDireitoARepor>;

// "Tirar da lista" — só o id da inscrição; a venda ligada é lida sob a trava (D-08).
export const esquemaTirarDaLista = z.object({
  inscricaoId: z.uuid({ error: FRASE_JA_REMOVIDO }),
});

export type TirarDaListaValidado = z.infer<typeof esquemaTirarDaLista>;

// Um número inteiro de um campo de texto (ou já número), dentro da faixa — a frase humana do campo
// quando não é. Nunca aceita fração, sinal ou expoente ("1e2").
function inteiroDoCampo(minimo: number, maximo: number, frase: string) {
  return z.union([z.string(), z.number()], { error: frase }).transform((valor, contexto) => {
    const texto = String(valor).trim();
    if (!/^\d{1,3}$/.test(texto) || Number(texto) < minimo || Number(texto) > maximo) {
      contexto.addIssue({ code: "custom", message: frase });
      return z.NEVER;
    }
    return Number(texto);
  });
}

// Mensalidade: centavos INTEIROS pela conversão única do Financeiro, maior que zero (check
// `turmas_mensalidade_faixa`, 1..1.000.000.000). Vazio é erro: nenhum preço no código (AGE-17).
const mensalidadeDoCampo = z.string({ error: FRASE_MENSALIDADE }).transform((texto, contexto) => {
  const convertido = converterReaisParaCentavos(texto);
  if (!convertido.ok || convertido.centavos === null || convertido.centavos < 1 || convertido.centavos > 1_000_000_000) {
    contexto.addIssue({ code: "custom", message: FRASE_MENSALIDADE });
    return z.NEVER;
  }
  return convertido.centavos;
});

// Os campos da turma que valem para lançar e para editar.
const camposDaTurma = {
  nome: textoCurto(FRASE_NOME_DA_TURMA, FRASE_NOME_LONGO),
  inicio: horaDoCampo,
  fim: horaDoCampo,
  vagas: vagasDoCampo,
  mensalidade: mensalidadeDoCampo,
  diaVencimento: inteiroDoCampo(1, 28, FRASE_VENCIMENTO),
  publica: z.boolean({ error: FRASE_FALHA_AO_LANCAR }),
};

function fimDepoisDoComeco(dados: { inicio: string; fim: string }, contexto: z.RefinementCtx): void {
  // O Zod 4 roda este refinamento mesmo com um campo já recusado: só compara horas legíveis.
  const legiveis = FORMATO_HORA_DO_CAMPO.test(dados.inicio) && FORMATO_HORA_DO_CAMPO.test(dados.fim);
  if (legiveis && minutosDe(dados.fim) <= minutosDe(dados.inicio)) {
    contexto.addIssue({ code: "custom", path: ["fim"], message: FRASE_FIM_ANTES_DO_COMECO });
  }
}

// "Lançar turma" (AGE-03): a turma e as N semanas (1..52 — T-05-29: nunca 10.000 datas) a partir de
// "Primeira aula a partir de" (UI-D10). Dia da semana 0 = domingo … 6 = sábado.
export const esquemaLancarTurma = z
  .object({
    ...camposDaTurma,
    diaSemana: inteiroDoCampo(0, 6, FRASE_DIA_DA_SEMANA),
    aPartirDe: dataCivil,
    semanas: inteiroDoCampo(SEMANAS_MINIMAS, SEMANAS_MAXIMAS, FRASE_SEMANAS),
  })
  .superRefine(fimDepoisDoComeco)
  .transform(({ mensalidade, ...resto }) => ({ ...resto, mensalidadeCentavos: mensalidade }));

export type LancarTurmaValidado = z.infer<typeof esquemaLancarTurma>;

// "Salvar turma" (D-03): o que se edita — o dia da semana NÃO (mudar o dia é desativar e lançar
// outra). O id da turma vem da URL; o resto é lido sob a trava, no servidor.
export const esquemaEditarTurma = z
  .object({
    turmaId: z.uuid({ error: FRASE_FALHA_AO_SALVAR_TURMA }),
    ...camposDaTurma,
    publica: z.boolean({ error: FRASE_FALHA_AO_SALVAR_TURMA }),
  })
  .superRefine(fimDepoisDoComeco)
  .transform(({ mensalidade, ...resto }) => ({ ...resto, mensalidadeCentavos: mensalidade }));

export type EditarTurmaValidado = z.infer<typeof esquemaEditarTurma>;

// "Marcar mais N semanas" (D-03): 1..52, como no lançamento (T-05-29).
export const esquemaMarcarMaisSemanas = z.object({
  turmaId: z.uuid({ error: FRASE_FALHA_AO_MARCAR_SEMANAS }),
  semanas: inteiroDoCampo(SEMANAS_MINIMAS, SEMANAS_MAXIMAS, FRASE_SEMANAS),
});

export type MarcarMaisSemanasValidado = z.infer<typeof esquemaMarcarMaisSemanas>;

// "Desativar turma" (D-03): só o id — o que sai é decidido sob a trava, no servidor.
export const esquemaDesativarTurma = z.object({
  turmaId: z.uuid({ error: FRASE_FALHA_AO_DESATIVAR_TURMA }),
});

// Entrar e sair da turma pela ficha (AGE-07): só os dois ids (T-05-33) — o valor, as datas e o
// vencimento são lidos sob a trava da turma e calculados no servidor pelo módulo puro.
export const esquemaEntrarNaTurma = z.object({
  turmaId: z.uuid({ error: FRASE_FALHA_AO_ENTRAR_NA_TURMA }),
  clienteId: z.uuid({ error: FRASE_FALHA_AO_ENTRAR_NA_TURMA }),
});

export type EntrarNaTurmaValidado = z.infer<typeof esquemaEntrarNaTurma>;

export const esquemaSairDaTurma = z.object({
  turmaId: z.uuid({ error: FRASE_FALHA_AO_SAIR_DA_TURMA }),
  clienteId: z.uuid({ error: FRASE_FALHA_AO_SAIR_DA_TURMA }),
});

export type SairDaTurmaValidado = z.infer<typeof esquemaSairDaTurma>;

// ── O uso livre (plano 09 — AGE-13, AGE-05) ─────────────────────────────────────────────────────────
// Do cliente chegam só quem, quando, por quanto tempo e quantas pessoas — e, nas transições, o id e as
// horas de parede. O PREÇO da hora e o VALOR nunca vêm da tela (T-05-42): são lidos e calculados no
// servidor, sob a trava, pelo módulo puro `uso-livre.ts`.

const horaDeChegada = z
  .string({ error: FRASE_HORA_DE_CHEGADA })
  .refine((hora) => FORMATO_HORA_DO_CAMPO.test(hora), { error: FRASE_HORA_DE_CHEGADA });

// "Reservar uso livre": a pessoa (o seletor — sem ninguém escolhido, "Escolha quem vem."), a data, a
// hora prevista de chegada, as horas previstas (1..12) e as pessoas (1..50) — as mesmas faixas dos
// checks `usos_livres_horas_previstas_faixa` e `usos_livres_pessoas_faixa`.
export const esquemaReservarUsoLivre = z.object({
  clienteId: z.uuid({ error: FRASE_ESCOLHA_QUEM_VEM }),
  data: dataCivil,
  chegadaPrevista: horaDeChegada,
  horasPrevistas: inteiroDoCampo(HORAS_PREVISTAS_MINIMAS, HORAS_PREVISTAS_MAXIMAS, FRASE_HORAS_PREVISTAS),
  pessoas: inteiroDoCampo(PESSOAS_MINIMAS, PESSOAS_MAXIMAS, FRASE_PESSOAS),
});

export type ReservarUsoLivreValidado = z.infer<typeof esquemaReservarUsoLivre>;

// "Chegou": o id e a hora de chegada do campo (já preenchido com a hora da reserva, editável).
export const esquemaMarcarChegada = z.object({
  usoLivreId: z.uuid({ error: FRASE_LANCAMENTO_NAO_EXISTE }),
  chegada: horaDeChegada,
});

export type MarcarChegadaValidado = z.infer<typeof esquemaMarcarChegada>;

// "Chegou às" corrigido enquanto a pessoa está no espaço.
export const esquemaCorrigirChegada = esquemaMarcarChegada;

export type CorrigirChegadaValidado = z.infer<typeof esquemaCorrigirChegada>;

// "Cancelar reserva": só o id — o estado é conferido NA PRÓPRIA instrução de `delete`.
export const esquemaCancelarReserva = z.object({
  usoLivreId: z.uuid({ error: FRASE_JA_REMOVIDO }),
});

export type CancelarReservaValidado = z.infer<typeof esquemaCancelarReserva>;

// "Encerrar e cobrar" (AGE-13): o id e as duas horas de parede do campo. A saída tem de ser depois da
// chegada (o erro mora no campo "Saiu às"; nada atravessa a meia-noite — check
// `usos_livres_saida_depois_da_chegada`). Horas cheias, preço da hora e valor são do servidor.
export const esquemaEncerrarUsoLivre = z
  .object({
    usoLivreId: z.uuid({ error: FRASE_LANCAMENTO_NAO_EXISTE }),
    chegada: horaDeChegada,
    saida: z
      .string({ error: FRASE_HORA_DE_SAIDA })
      .refine((hora) => FORMATO_HORA_DO_CAMPO.test(hora), { error: FRASE_HORA_DE_SAIDA }),
  })
  .superRefine((dados, contexto) => {
    // O Zod 4 roda este refinamento mesmo com um campo já recusado: só compara horas legíveis.
    const legiveis = FORMATO_HORA_DO_CAMPO.test(dados.chegada) && FORMATO_HORA_DO_CAMPO.test(dados.saida);
    if (legiveis && minutosDe(dados.saida) <= minutosDe(dados.chegada)) {
      contexto.addIssue({ code: "custom", path: ["saida"], message: FRASE_SAIDA_ANTES_DA_CHEGADA });
    }
  });

export type EncerrarUsoLivreValidado = z.infer<typeof esquemaEncerrarUsoLivre>;

// ── O material do uso livre (plano 10 — AGE-14, D-06, D-14) ─────────────────────────────────────────
// Do cliente chegam só o uso, o item, o TEXTO da quantidade e se cobra (T-05-47): nenhum esquema aceita
// preço, valor, custo ou área. O preço de venda é lido do Catálogo no servidor (e congelado ao encerrar);
// o custo médio e a área são do livro do Estoque (`gravarMovimentacoes`, `areaDoDestino`).

// "+ Material": a quantidade pela MESMA conversão da saída manual da Fase 06 (`textoParaMilesimos` —
// vírgula ou ponto, até 3 casas, > 0, milésimos inteiros; as frases da 06). A tela troca a frase do
// formato pela que diz a unidade ("Digite a quantidade em {unidade} — …"), que ela conhece.
export const esquemaAcrescentarMaterial = z.object({
  usoLivreId: z.uuid({ error: FRASE_LANCAMENTO_NAO_EXISTE }),
  itemId: z.uuid({ error: FRASE_ESCOLHA_O_MATERIAL }),
  quantidade: z.string({ error: FRASE_QUANTIDADE_INVALIDA }).transform((texto, contexto) => {
    const resultado = textoParaMilesimos(texto);
    if (!resultado.ok) {
      contexto.addIssue({ code: "custom", message: resultado.erro });
      return z.NEVER;
    }
    return resultado.milesimos;
  }),
  cobrar: z.boolean({ error: FRASE_FALHA_AO_ACRESCENTAR_MATERIAL }),
});

export type AcrescentarMaterialValidado = z.infer<typeof esquemaAcrescentarMaterial>;

// "Cobrar · Incluso" numa linha já acrescentada: o estado DESEJADO (Pattern 2), nunca "inverter".
export const esquemaDefinirCobrancaDoMaterial = z.object({
  materialId: z.uuid({ error: FRASE_JA_REMOVIDO }),
  cobrar: z.boolean({ error: FRASE_FALHA_AO_MUDAR_COBRANCA }),
});

export type DefinirCobrancaDoMaterialValidado = z.infer<typeof esquemaDefinirCobrancaDoMaterial>;

// "Tirar o material": só o id — o estado do uso e a falta de baixa são conferidos sob a trava do uso.
export const esquemaTirarMaterial = z.object({
  materialId: z.uuid({ error: FRASE_JA_REMOVIDO }),
});

export type TirarMaterialValidado = z.infer<typeof esquemaTirarMaterial>;

// "Recebi agora" (AGE-15, UI-D4): do navegador chegam SÓ o tipo e o id da cobrança e a forma de
// pagamento (T-05-53) — valor, descrição, categoria e cliente da venda vêm do banco, sob a trava. A
// forma usa os mesmos valores do enum `forma_pagamento` do Financeiro. Entrada forjada recebe a frase de
// falha (a tela nunca manda nada fora disto).
export const FORMAS_DE_RECEBER = ["dinheiro", "pix", "cartao"] as const;
export type FormaDeReceber = (typeof FORMAS_DE_RECEBER)[number];

export const esquemaReceberAgora = z.object(
  {
    cobranca: z.object(
      {
        tipo: z.enum(TIPOS_DE_COBRANCA, { error: FRASE_FALHA_AO_RECEBER }),
        id: z.uuid({ error: FRASE_FALHA_AO_RECEBER }),
      },
      { error: FRASE_FALHA_AO_RECEBER },
    ),
    forma: z.enum(FORMAS_DE_RECEBER, { error: FRASE_FALHA_AO_RECEBER }),
  },
  { error: FRASE_FALHA_AO_RECEBER },
);

export type ReceberAgoraValidado = z.infer<typeof esquemaReceberAgora>;
