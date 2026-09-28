// Fixture SÓ do teste tests/unit/site-isolamento.test.ts — prova que o percorredor de imports
// nomeia a CADEIA INTEIRA (não só o arquivo final) quando uma importação proibida aparece a
// dois saltos de distância. Nunca importado por código de produção nenhum.
import { algo } from "./meio-proibido";

export const usaAlgoProibido = algo;
