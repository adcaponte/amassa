// Ponto único de validação do cadastro de pessoas (CLAUDE.md §Validação): `criarCliente` e
// `editarCliente` validam AQUI, no servidor, sempre; o formulário só mostra o erro embaixo do campo.
// Os tetos são os mesmos dos checks da `0026` (`clientes_nome_comprimento`,
// `clientes_telefone_comprimento`), contados em pontos de código como o `length()` do Postgres.
import { z } from "zod";

import {
  FRASE_CLIENTE_NAO_EXISTE,
  FRASE_NOME_LONGO,
  FRASE_NOME_VAZIO,
  FRASE_TELEFONE_LONGO,
} from "./textos";

const TETO_DO_NOME = 160;
const TETO_DO_TELEFONE = 40;

function aparar(texto: string): string {
  return texto.normalize("NFC").trim();
}

const campoNome = z
  .string({ error: FRASE_NOME_VAZIO })
  .transform(aparar)
  .refine((nome) => nome.length > 0, { error: FRASE_NOME_VAZIO })
  .refine((nome) => [...nome].length <= TETO_DO_NOME, { error: FRASE_NOME_LONGO });

// Telefone é texto livre e opcional (D-16: é o que distingue homônimos). Vazio, só espaços, nulo ou
// ausente → `null`.
const campoTelefone = z
  .string({ error: FRASE_TELEFONE_LONGO })
  .nullish()
  .transform((telefone) => aparar(telefone ?? ""))
  .refine((telefone) => [...telefone].length <= TETO_DO_TELEFONE, { error: FRASE_TELEFONE_LONGO })
  .transform((telefone) => (telefone === "" ? null : telefone));

// `confirmarHomonimo: true` só pula o AVISO de homônimo (D-16, T-05-22 aceito): homônimo é permitido
// por decisão do dono — forjar a flag não dá acesso a nada que o botão "Criar outra pessoa" não dê.
export const esquemaCliente = z.object({
  nome: campoNome,
  telefone: campoTelefone,
  confirmarHomonimo: z.boolean().optional(),
});

export type ClienteValidado = z.infer<typeof esquemaCliente>;

export const esquemaEdicaoDeCliente = esquemaCliente.extend({
  id: z.uuid({ error: FRASE_CLIENTE_NAO_EXISTE }),
});

export type EdicaoDeClienteValidada = z.infer<typeof esquemaEdicaoDeCliente>;
