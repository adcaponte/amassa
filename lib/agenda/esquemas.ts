// Ponto único de validação das ações da Agenda (CLAUDE.md §Validação): a Server Action valida AQUI,
// no servidor, sempre. Do cliente chega só o que ele escolheu — o resto (o evento, se a data foi
// cancelada, o direito a repor) é lido sob a trava no servidor (T-05-03, T-05-04).
import { z } from "zod";

import { PRESENCAS } from "./tipos";
import { FRASE_FALHA_PRESENCA_GENERICA } from "./textos";

// "Veio" / "Faltou" / desmarcar: o id da inscrição e o estado DESEJADO (Pattern 2) — nunca
// "inverter". `null` é desmarcar.
export const esquemaDefinirPresenca = z.object({
  inscricaoId: z.uuid({ error: FRASE_FALHA_PRESENCA_GENERICA }),
  presenca: z.enum(PRESENCAS, { error: FRASE_FALHA_PRESENCA_GENERICA }).nullable(),
});

export type DefinirPresencaValidado = z.infer<typeof esquemaDefinirPresenca>;
