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

// ——— A tela do cadastro (plano 06.2-02, o traçador). Verbatim da 06.2-UI-SPEC.md §Copywriting. ———

// Bloco Lista e ações.
export const TITULO_LISTA = "Quem vende para a gente";
export const ROTULO_NOVO_FORNECEDOR = "Novo fornecedor";

// Folha "Novo fornecedor" / "Editar fornecedor" (o modo editar é do plano 04).
export const TITULO_FOLHA_NOVO = "Novo fornecedor";
export const TITULO_FOLHA_EDITAR = "Editar fornecedor";
export const DICA_FOLHA = "Só o nome é obrigatório.";
export const PLACEHOLDER_NOME = "Nome da loja ou de quem vende";
// Vai logo depois do rótulo "O que vende", no peso 400.
export const COMPLEMENTO_VENDE = " (separe por vírgula; é o que a busca encontra)";
export const PLACEHOLDER_VENDE = "argila, esmalte, feldspato";
export const DICA_AREA = "só serve para o filtro da lista";
export const PLACEHOLDER_CIDADE_ENTREGA = "ex.: Goiânia · entrega em 5 dias";
export const PLACEHOLDER_WHATSAPP = "(62) 9 0000-0000";
export const PLACEHOLDER_PESSOA_CONTATO = "Nome de quem atende";
export const PLACEHOLDER_EMAIL = "vendas@…";
export const PLACEHOLDER_SITE = "https://…";
export const PLACEHOLDER_PAGAMENTO_PRAZO = "Pix à vista · boleto 28 dias · pedido mínimo R$ 300";
export const PLACEHOLDER_OBSERVACOES = "O que vale lembrar: qualidade, atraso, quem indicou, lote ruim…";
export const ROTULO_SALVAR_FORNECEDOR = "Salvar fornecedor";
export const ROTULO_SALVANDO = "Salvando…";
export const ROTULO_VOLTAR = "Voltar";
export const ROTULO_FECHAR = "Fechar";

// Erros do salvar (embaixo do Nome / no rodapé da folha).
export const FRASE_NOME_REPETIDO =
  "Já existe um fornecedor ativo com esse nome. Use outro nome — ou abra o que já existe na lista.";
export const FRASE_FALHA_AO_SALVAR =
  "Não deu para salvar. Nada foi gravado — verifique a internet e tente de novo.";

// Toast.
export const TOAST_FORNECEDOR_CADASTRADO = "Fornecedor cadastrado. Agora suba a tabela de preços dele.";

// Vazio total (nenhum ativo nem desativado).
export const FRASE_VAZIO_TITULO = "Nenhum fornecedor cadastrado ainda.";
export const FRASE_VAZIO_CORPO =
  "Aqui fica quem vende para o ateliê: contato, condições e os arquivos que hoje se perdem no WhatsApp — tabela de preços, catálogo, nota.";

// Erros de carregamento.
export const TITULO_ERRO = "Algo não funcionou.";
export const FRASE_ERRO_CARREGAR_LISTA =
  "Não deu para carregar os fornecedores. Verifique a internet e tente de novo.";
export const FRASE_ERRO_CARREGAR_FICHA =
  "Não deu para carregar a ficha deste fornecedor. Verifique a internet e tente de novo.";
export const FRASE_FICHA_NAO_EXISTE = "Esse fornecedor não está no cadastro. Escolha outro na lista.";

// Rodapé da ficha — `data` já formatada ("18/12/26"), quem chama formata no fuso de Brasília.
export function rodapeDaFicha(data: string): string {
  return `Cadastrado em ${data}. Fornecedor não se apaga: desativar tira da lista e dos seletores, e o histórico fica.`;
}
