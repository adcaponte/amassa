// Ponto único de validação do cadastro de fornecedores (CLAUDE.md §Validação): a Server Action do
// plano 06.2-02 valida AQUI, no servidor, sempre; a folha só mostra o erro embaixo do campo.
//
// Os tetos são os MESMOS dos checks `fornecedores_*_comprimento` da `0028` — duas cópias
// deliberadas (molde `lib/clientes/esquemas.ts` × `clientes`): o Zod dá a frase humana; o check é
// a barreira se o Zod for contornado. Mudar um teto é mudar os dois, no mesmo commit. Contados em
// pontos de código, como o `length()` do Postgres (não em bytes nem em unidades UTF-16).
import { z } from "zod";

import {
  FRASE_AREA_INVALIDA,
  FRASE_FALHA_AO_SALVAR,
  FRASE_FICHA_NAO_EXISTE,
  FRASE_NOME_LONGO,
  FRASE_NOME_VAZIO,
  FRASE_OBSERVACOES_LONGAS,
  ROTULO_CIDADE_ENTREGA,
  ROTULO_EMAIL,
  ROTULO_PAGAMENTO_PRAZO,
  ROTULO_PESSOA_CONTATO,
  ROTULO_SITE,
  ROTULO_VENDE,
  ROTULO_WHATSAPP,
  fraseTextoLongo,
} from "./textos";

// As cinco áreas do Financeiro (`area_financeira` em `db/schema.ts`), na ordem do protótipo — a
// ordem do Select e do filtro da lista. Um teste confere que é o MESMO conjunto do enum do banco.
export const AREAS_DO_FORNECEDOR = ["pecas", "cafeteria", "loja", "espaco", "geral"] as const;

export type AreaDoFornecedor = (typeof AREAS_DO_FORNECEDOR)[number];

export const TETO_DO_NOME = 120;
export const TETO_DO_TEXTO_CURTO = 160;
export const TETO_DO_WHATSAPP = 40;
export const TETO_DO_SITE = 300;
export const TETO_DAS_OBSERVACOES = 4000;

function aparar(texto: string): string {
  return texto.normalize("NFC").trim();
}

function caracteres(texto: string): number {
  return [...texto].length;
}

const campoNome = z
  .string({ error: FRASE_NOME_VAZIO })
  .transform(aparar)
  .refine((nome) => nome.length > 0, { error: FRASE_NOME_VAZIO })
  .refine((nome) => caracteres(nome) <= TETO_DO_NOME, { error: FRASE_NOME_LONGO });

// Texto opcional: vazio, só espaços, nulo ou ausente → `null` (nunca string vazia — o check do
// banco recusa ""); o resto, aparado e dentro do teto.
function textoOpcional(teto: number, frase: string) {
  return z
    .string({ error: frase })
    .nullish()
    .transform((texto) => aparar(texto ?? ""))
    .refine((texto) => caracteres(texto) <= teto, { error: frase })
    .transform((texto) => (texto === "" ? null : texto));
}

export const esquemaFornecedor = z.object({
  nome: campoNome,
  vende: textoOpcional(TETO_DO_TEXTO_CURTO, fraseTextoLongo(ROTULO_VENDE, TETO_DO_TEXTO_CURTO)),
  area: z.enum(AREAS_DO_FORNECEDOR, { error: FRASE_AREA_INVALIDA }),
  cidadeEntrega: textoOpcional(
    TETO_DO_TEXTO_CURTO,
    fraseTextoLongo(ROTULO_CIDADE_ENTREGA, TETO_DO_TEXTO_CURTO),
  ),
  whatsapp: textoOpcional(TETO_DO_WHATSAPP, fraseTextoLongo(ROTULO_WHATSAPP, TETO_DO_WHATSAPP)),
  pessoaContato: textoOpcional(
    TETO_DO_TEXTO_CURTO,
    fraseTextoLongo(ROTULO_PESSOA_CONTATO, TETO_DO_TEXTO_CURTO),
  ),
  email: textoOpcional(TETO_DO_TEXTO_CURTO, fraseTextoLongo(ROTULO_EMAIL, TETO_DO_TEXTO_CURTO)),
  site: textoOpcional(TETO_DO_SITE, fraseTextoLongo(ROTULO_SITE, TETO_DO_SITE)),
  pagamentoPrazo: textoOpcional(
    TETO_DO_TEXTO_CURTO,
    fraseTextoLongo(ROTULO_PAGAMENTO_PRAZO, TETO_DO_TEXTO_CURTO),
  ),
  observacoes: textoOpcional(TETO_DAS_OBSERVACOES, FRASE_OBSERVACOES_LONGAS),
});

export type FornecedorValidado = z.infer<typeof esquemaFornecedor>;

// As chaves do formulário — o plano 02 usa para pôr o erro embaixo do campo certo.
export type CampoDoFornecedor = keyof z.input<typeof esquemaFornecedor>;

// ——— Manter o cadastro (plano 06.2-04): editar, desativar e reativar. ———

// O id que a tela manda (o da ficha aberta). Um id que não é uuid só chega por envio forjado ou
// link velho — a frase é a mesma da ficha de id ruim.
const campoId = z.uuid({ error: FRASE_FICHA_NAO_EXISTE });

// Editar = os MESMOS campos e tetos do cadastrar, mais o id. Nada de `ativo` aqui: editar um
// desativado grava e ele continua desativado (reativar é outro botão — UI E6).
export const esquemaEditarFornecedor = esquemaFornecedor.extend({ id: campoId });

// O ESTADO DESEJADO, nunca "inverter": desativar duas vezes (duas abas) grava `false` duas vezes e
// responde `ok` nas duas — idempotente (FRN-03).
export const esquemaAtivoDoFornecedor = z.object({
  id: campoId,
  ativo: z.boolean({ error: FRASE_FALHA_AO_SALVAR }),
});
