// Ponto único de validação das ações da Agenda (CLAUDE.md §Validação): a Server Action valida AQUI,
// no servidor, sempre. Do cliente chega só o que ele escolheu — o resto (o evento, se a data foi
// cancelada, o direito a repor) é lido sob a trava no servidor (T-05-03, T-05-04).
import { z } from "zod";

import { converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { diasEntre, ehDataCivil } from "@/lib/producao/calendario";

import { minutosDe } from "./horario";
import { PRESENCAS } from "./tipos";
import { SEMANAS_MAXIMAS, SEMANAS_MINIMAS } from "./turma";
import {
  FRASE_DIA_DA_SEMANA,
  FRASE_ERRO_CARREGAR_PESSOAS,
  FRASE_ESCOLHA_A_DATA,
  FRASE_FALHA_AO_DESATIVAR_TURMA,
  FRASE_FALHA_AO_MARCAR_SEMANAS,
  FRASE_FALHA_AO_SALVAR_TURMA,
  FRASE_FALHA_AO_CANCELAR,
  FRASE_FALHA_AO_COLOCAR,
  FRASE_FALHA_AO_LANCAR,
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

// "Colocar na lista" (AGE-10, AGE-12): só os dois ids. NENHUM valor vem da tela (T-05-24) — o preço
// da inscrição é lido do evento sob a trava, no servidor.
export const esquemaColocarNaData = z.object({
  eventoId: z.uuid({ error: FRASE_LANCAMENTO_NAO_EXISTE }),
  clienteId: z.uuid({ error: FRASE_FALHA_AO_COLOCAR }),
});

export type ColocarNaDataValidado = z.infer<typeof esquemaColocarNaData>;

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
