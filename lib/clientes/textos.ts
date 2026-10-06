// As frases do cadastro de pessoas (D-01) — o MESMO cadastro em Cadastros → Clientes e na Agenda →
// Pessoas. Módulo sem import de valor: não lê React nem o banco. Os textos vêm verbatim da
// 05-UI-SPEC.md (§Copywriting: Ações, Rótulos, Erros, Estados vazios, Toasts).
//
// "Sem cadastro paralelo" (D-01): não existe outro cadastro de pessoas no sistema. A Venda manual, o
// Orçamento e a Produção continuam com o nome escrito à mão nesta fase — e `documentos.pessoa_nome`
// continua preenchido mesmo nas vendas que a Agenda liga a um cliente.

export type ContextoDoCadastro = "agenda" | "cadastros";

// O formulário (05-UI-SPEC.md §"Pessoa nova / editar pessoa").
export const TITULO_PESSOA_NOVA = "Pessoa nova";
export const TITULO_NOVO_CLIENTE = "Novo cliente";

export function tituloEditarPessoa(nome: string): string {
  return `Editar ${nome}`;
}

export const ROTULO_SALVAR_PESSOA = "Salvar pessoa";
export const ROTULO_SALVAR_CLIENTE = "Salvar cliente";
export const ROTULO_SALVAR_MESMO_ASSIM = "Salvar mesmo assim";
export const ROTULO_SALVANDO = "Salvando…";
export const ROTULO_VOLTAR = "Voltar";
export const ROTULO_FECHAR = "Fechar";

export const ROTULO_NOME = "Nome";
export const DICA_NOME = "até 160 caracteres";
export const ROTULO_TELEFONE = "Telefone (opcional)";
export const DICA_TELEFONE = "até 40 caracteres, do jeito que você escreve";

// Erros (05-UI-SPEC.md §Erros, "Pessoa —").
export const FRASE_NOME_VAZIO = "Diga o nome da pessoa.";
export const FRASE_NOME_LONGO = "O nome pode ter até 160 caracteres.";
export const FRASE_TELEFONE_LONGO = "O telefone pode ter até 40 caracteres.";
export const FRASE_CLIENTE_NAO_EXISTE =
  "Esse cadastro não existe mais — talvez tenha sido removido em outro celular.";
// "Ação genérica" da UI-SPEC: "Não deu para {verbo}. Verifique a internet e tente de novo."
export const FRASE_FALHA_AO_SALVAR = "Não deu para salvar. Verifique a internet e tente de novo.";

// Homônimo (D-16): avisa, nunca bloqueia nem funde.
export function avisoDeHomonimo(nome: string, telefone: string | null): string {
  return `Já existe ${nome} · ${telefone ?? "sem telefone"}. É a mesma pessoa?`;
}

export function rotuloUsarExistente(nome: string): string {
  return `Usar ${nome} que já existe`;
}

export const ROTULO_CRIAR_OUTRA_PESSOA = "Criar outra pessoa";

// Toasts — a forma neutra, nunca concordando com o nome (05-UI-SPEC.md §Toasts).
export const TOAST_PESSOA_CADASTRADA = "Pessoa cadastrada.";
export const TOAST_CADASTRO_SALVO = "Cadastro salvo.";

// A busca — igual nas duas telas (05-UI-SPEC.md §Rótulos, "Pessoas — busca").
export const ARIA_BUSCAR_PESSOA = "Buscar pessoa";
export const PLACEHOLDER_BUSCA = "Buscar pelo nome";

export function rotuloCadastrarBusca(busca: string): string {
  return `Cadastrar “${busca}”`;
}

export const ROTULO_MOSTRAR_MAIS = "Mostrar mais 50";

// Cadastros → Clientes (05-UI-SPEC.md §"Cadastros → Clientes", §Estados vazios).
export const ROTULO_NOVO_CLIENTE = "Novo cliente";
export const ROTULO_EDITAR = "Editar";

export function ariaEditarCliente(nome: string): string {
  return `Editar ${nome}`;
}

export const DICA_CLIENTES =
  "É o mesmo cadastro das Pessoas da Agenda. As vendas que a Agenda cria ficam ligadas ao cliente; Venda manual, Orçamento e Produção ainda usam o nome escrito à mão.";
export const FRASE_VAZIO_CLIENTES_TITULO = "Nenhum cliente cadastrado ainda.";
export const FRASE_VAZIO_CLIENTES_CORPO =
  "Clientes nascem aqui ou pela Agenda (Pessoas → + Pessoa) — é o mesmo cadastro.";

// Backstop E22·error (a UI-SPEC não desenhava): a frase PRÓPRIA da sub-aba, nunca a de outra.
export const TITULO_ERRO = "Algo não funcionou.";
export const FRASE_ERRO_CARREGAR_CLIENTES =
  "Não deu para carregar os clientes. Verifique a internet e tente de novo.";
export const ROTULO_TENTAR_DE_NOVO = "Tentar de novo";
