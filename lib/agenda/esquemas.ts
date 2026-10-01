// Ponto único de validação das ações da Agenda (CLAUDE.md §Validação): a Server Action valida AQUI,
// no servidor, sempre. Do cliente chega só o que ele escolheu — o resto (o evento, se a data foi
// cancelada, o direito a repor) é lido sob a trava no servidor (T-05-03, T-05-04).
import { z } from "zod";

import { converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { ehDataCivil } from "@/lib/producao/calendario";

import { minutosDe } from "./horario";
import { PRESENCAS } from "./tipos";
import {
  FRASE_ESCOLHA_A_DATA,
  FRASE_FALHA_AO_CANCELAR,
  FRASE_FALHA_AO_LANCAR,
  FRASE_FALHA_PRESENCA_GENERICA,
  FRASE_FIM_ANTES_DO_COMECO,
  FRASE_HORARIO_VAZIO,
  FRASE_LANCAMENTO_NAO_EXISTE,
  FRASE_MOTIVO_LONGO,
  FRASE_MOTIVO_VAZIO,
  FRASE_NOME_DA_AULA,
  FRASE_NOME_LONGO,
  FRASE_PRECO_POR_PESSOA,
  FRASE_VAGAS,
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

// A leitura do aviso D-13 quando a data da folha muda.
export const esquemaConferirDia = z.object({ data: dataCivil });

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
