// As frases do cadastro de fornecedores (Fase 06.2). Módulo sem import: não lê React nem o banco.
// Os textos vêm verbatim da 06.2-UI-SPEC.md (§Copywriting Contract: "Rótulos e dicas de campo" e
// "Erros"). O plano 06.2-01 escreve só o que o Zod do servidor usa; o plano 02 acrescenta as frases
// da tela.

// Os dez rótulos da folha "Novo fornecedor" / "Editar fornecedor" (06.2-UI-SPEC.md, tabela
// "Folha Novo fornecedor / Editar fornecedor"). A tela os usa como rótulo do campo; o Zod, como o
// {Campo} da frase de texto longo.
export const ROTULO_NOME = "Nome";
export const ROTULO_VENDE = "O que vende";
export const ROTULO_AREA = "Área que mais usa";
export const ROTULO_CIDADE_ENTREGA = "Cidade / entrega";
export const ROTULO_WHATSAPP = "WhatsApp / telefone";
export const ROTULO_PESSOA_CONTATO = "Pessoa de contato";
export const ROTULO_EMAIL = "E-mail";
export const ROTULO_SITE = "Site / loja online";
export const ROTULO_PAGAMENTO_PRAZO = "Pagamento e prazo";
export const ROTULO_OBSERVACOES = "Observações";

// Erros do Zod (06.2-UI-SPEC.md §Erros).
export const FRASE_NOME_VAZIO = "Diga o nome do fornecedor.";
export const FRASE_NOME_LONGO = "O nome pode ter até 120 caracteres.";
export const FRASE_OBSERVACOES_LONGAS = "As observações podem ter até 4.000 caracteres.";
// Escolher a área é um Select com padrão "Peças": só um envio forjado chega aqui.
export const FRASE_AREA_INVALIDA = "Escolha a área na lista.";

// "{Campo} pode ter até {n} caracteres." — o {Campo} é o rótulo do campo, como a tela o mostra.
export function fraseTextoLongo(rotulo: string, teto: number): string {
  return `${rotulo} pode ter até ${teto} caracteres.`;
}
