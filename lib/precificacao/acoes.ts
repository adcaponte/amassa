"use server";

import { and, desc, eq, lte } from "drizzle-orm";

import { db } from "@/db";
import { parametrosPrecificacao } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";

import { calcularHora } from "./hora";
import type { ChaveDeParametro } from "./parametros";
import { esquemaCalculoDaHora, esquemaSeloDeParametro, esquemaValorDeParametro } from "./esquemas";
import { FRASE_FALHA_AO_SALVAR, FRASE_INFORME_AS_HORAS, FRASE_PARAMETRO_NAO_EXISTE_MAIS } from "./textos";

// Mesma forma de `lib/financeiro/acoes.ts`/`lib/cadastros/acoes.ts` — cada módulo redeclara hoje,
// não há tipo compartilhado entre módulos.
export type ResultadoDeAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

function primeiraMensagemDeErro(resultado: { error: { issues: { message: string }[] } }): string {
  return resultado.error.issues[0]?.message ?? "Não deu para validar os dados enviados.";
}

// A gravação por HISTÓRICO (D-15), o único caminho de escrita de VALOR de parâmetro do sistema:
// `insert ... on conflict (chave, vigente_desde) do update` sobre a restrição única da tabela.
// Duas edições da MESMA chave no MESMO dia caem no `on conflict` e atualizam a linha de hoje — a
// vigência não muda, então o gatilho `recusar_mudanca_de_valor_do_parametro` (migração 0018)
// deixa passar; uma edição num dia novo insere a linha seguinte, e a anterior nunca é tocada.
// Chamada por `definirParametro` e por `usarHoraCalculada` (a hora é só mais uma chave).
async function gravarValorDeParametro({
  chave,
  valorInteiro,
  criadoPor,
  hoje,
}: {
  chave: ChaveDeParametro;
  valorInteiro: number;
  criadoPor: string;
  hoje: string;
}): Promise<void> {
  await db
    .insert(parametrosPrecificacao)
    .values({ chave, valorInteiro, vigenteDesde: hoje, criadoPor })
    .onConflictDoUpdate({
      target: [parametrosPrecificacao.chave, parametrosPrecificacao.vigenteDesde],
      set: { valorInteiro },
    });
}

// Mudar o valor de um parâmetro (D-15). `exigirUsuario()` é a PRIMEIRA instrução do corpo
// (verificado por `npm run verificar-acoes`, decidido por árvore sintática).
export async function definirParametro(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ chave: ChaveDeParametro }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaValorDeParametro.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { chave, valorInteiro } = resultado.data;

  try {
    await gravarValorDeParametro({
      chave,
      valorInteiro,
      criadoPor: usuario.id,
      hoje: hojeEmBrasilia(new Date()),
    });
    return { ok: true, dados: { chave } };
  } catch (erro) {
    console.error("Falha ao gravar parâmetro:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// O selo estimado ↔ medido — a ÚNICA atualização DIRETA de `parametros_precificacao` do módulo
// inteiro (D-15: o gatilho do banco recusa qualquer outra coluna). Atualiza a linha VIGENTE hoje
// para aquela chave (achada por leitura, nunca por `vigente_desde = hoje`: o valor pode ter sido
// definido num dia anterior). `exigirUsuario()` é a PRIMEIRA instrução do corpo.
export async function marcarParametroComoMedido(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ chave: ChaveDeParametro; medido: boolean }>> {
  await exigirUsuario();

  const resultado = esquemaSeloDeParametro.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { chave, medido } = resultado.data;
  const hoje = hojeEmBrasilia(new Date());

  try {
    const [vigente] = await db
      .select({ vigenteDesde: parametrosPrecificacao.vigenteDesde })
      .from(parametrosPrecificacao)
      .where(and(eq(parametrosPrecificacao.chave, chave), lte(parametrosPrecificacao.vigenteDesde, hoje)))
      .orderBy(desc(parametrosPrecificacao.vigenteDesde))
      .limit(1);

    if (!vigente) {
      return { ok: false, erro: FRASE_PARAMETRO_NAO_EXISTE_MAIS };
    }

    await db
      .update(parametrosPrecificacao)
      .set({ medido })
      .where(
        and(
          eq(parametrosPrecificacao.chave, chave),
          eq(parametrosPrecificacao.vigenteDesde, vigente.vigenteDesde),
        ),
      );

    return { ok: true, dados: { chave, medido } };
  } catch (erro) {
    console.error("Falha ao marcar parâmetro como medido:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}

// "Calcular minha hora" → "Usar esta hora" (ORC-04): valida os três campos, chama a mesma conta
// pura que o diálogo mostra ao vivo, e — sem horas informadas — devolve a MESMA frase que o
// diálogo já mostrava antes do envio; com horas, grava a chave `trabalho_hora` pelo caminho comum
// de histórico (D-15). O selo da hora nasce sempre "estimado" (`gravarValorDeParametro` nunca
// grava `medido`, e a coluna nasce com o padrão `false` do banco). `exigirUsuario()` é a PRIMEIRA
// instrução do corpo.
export async function usarHoraCalculada(
  entradaBruta: unknown,
): Promise<ResultadoDeAcao<{ horaCentavos: number }>> {
  const usuario = await exigirUsuario();

  const resultado = esquemaCalculoDaHora.safeParse(entradaBruta);
  if (!resultado.success) {
    return { ok: false, erro: primeiraMensagemDeErro(resultado) };
  }
  const { retiradaCentavos, casaCentavos, horasMilesimos } = resultado.data;

  const horaCentavos = calcularHora({ retiradaCentavos, casaCentavos, horasMilesimos });
  if (horaCentavos === null) {
    return { ok: false, erro: FRASE_INFORME_AS_HORAS };
  }

  try {
    await gravarValorDeParametro({
      chave: "trabalho_hora",
      valorInteiro: horaCentavos,
      criadoPor: usuario.id,
      hoje: hojeEmBrasilia(new Date()),
    });
    return { ok: true, dados: { horaCentavos } };
  } catch (erro) {
    console.error("Falha ao gravar a hora calculada:", erro);
    return { ok: false, erro: FRASE_FALHA_AO_SALVAR };
  }
}
