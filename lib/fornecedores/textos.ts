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

// Folha "Novo fornecedor" / "Editar fornecedor" (o modo editar abre pela ficha — plano 04).
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

// ——— A lista inteira e a ficha de leitura (plano 06.2-03). Verbatim da 06.2-UI-SPEC.md §Copywriting. ———

// Busca e pílulas de área (Bloco Lista, itens 2 e 3).
export const ROTULO_BUSCA = "Buscar fornecedor";
export const PLACEHOLDER_BUSCA = "Buscar por nome ou material (argila, esmalte, embalagem…)";
export const ROTULO_FILTRAR_POR_AREA = "Filtrar por área";
export const ROTULO_TUDO = "Tudo";

// À direita do nome, na linha da lista: plural de verdade, nunca com parêntese.
export function rotuloDosAnexos(quantos: number): string {
  if (quantos === 0) {
    return "sem anexo";
  }
  return quantos === 1 ? "1 anexo" : `${quantos} anexos`;
}

// O link do rodapé — só aparece com N > 0 (quem chama decide); plural de verdade.
export function rotuloDosDesativados(quantos: number, mostrando: boolean): string {
  const verbo = mostrando ? "esconder" : "mostrar";
  return quantos === 1 ? `${verbo} 1 desativado` : `${verbo} ${quantos} desativados`;
}

// Rodapé da lista: os que a busca/filtro mostram, de quantos (os ativos — ou todos, com os desativados
// à mostra).
export function textoDoRodape(mostrados: number, total: number): string {
  return `${mostrados} de ${total}`;
}

// Estados vazios da lista.
export const FRASE_NENHUM_ATIVO = "Nenhum fornecedor ativo.";
export function fraseSemResultado(busca: string): string {
  return `Nenhum fornecedor com “${busca}”.`;
}
// `rotuloDaArea` é o rótulo como a pílula o mostra ("Cafeteria", "Espaço"…).
export function fraseSemResultadoDaArea(rotuloDaArea: string): string {
  return `Nenhum fornecedor de ${rotuloDaArea}.`;
}
export const ROTULO_CADASTRAR_UM_AGORA = "Cadastrar um agora";
export const FRASE_TOQUE_NUM_FORNECEDOR = "Toque num fornecedor para ver a ficha.";

// Ficha — navegação no celular (só abaixo de 1024 px).
export const ROTULO_VOLTAR_A_LISTA = "Voltar à lista";

// Cartões de contato, nesta ordem (06.2-UI-SPEC.md, "Linhas de leitura"). A caixa alta é do CSS.
export const ROTULO_CARTAO_WHATSAPP = "WhatsApp";
export const ROTULO_CARTAO_CONTATO = "Contato";
export const ROTULO_CARTAO_EMAIL = "E-mail";
export const ROTULO_CARTAO_SITE = "Site";
export const ROTULO_CARTAO_PAGAMENTO = "Pagamento e prazo";
export const ROTULO_CARTAO_CIDADE = "Cidade / entrega";

// Ações dos contatos: o verbo visível é curto; o nome do fornecedor vai no `aria-label`.
export const ROTULO_COPIAR = "copiar";
export const ROTULO_ABRIR_WHATSAPP = "abrir WhatsApp";
export const ROTULO_ABRIR = "abrir";
export function ariaCopiarWhatsapp(nome: string): string {
  return `Copiar o WhatsApp de ${nome}`;
}
export function ariaAbrirWhatsapp(nome: string): string {
  return `Abrir o WhatsApp de ${nome} numa aba nova`;
}
export function ariaCopiarEmail(nome: string): string {
  return `Copiar o e-mail de ${nome}`;
}
export function ariaAbrirSite(nome: string): string {
  return `Abrir o site de ${nome} numa aba nova`;
}

// Toasts do "copiar".
export function toastCopiado(valor: string): string {
  return `Copiado: ${valor}`;
}
export function toastNaoDeuParaCopiar(valor: string): string {
  return `Não deu para copiar. Está aqui: ${valor}`;
}

// Observações (o título da seção é o ROTULO_OBSERVACOES, em caixa alta pelo CSS).
export const FRASE_SEM_OBSERVACAO = "Nenhuma observação ainda.";

// ——— Manter o cadastro (plano 06.2-04). Verbatim da 06.2-UI-SPEC.md §Copywriting. ———

// Os botões do cabeçalho da ficha: verbo curto visível; o nome vai no `aria-label` (UI-D27).
export const ROTULO_EDITAR = "Editar";
export const ROTULO_DESATIVAR = "Desativar";
export const ROTULO_REATIVAR = "Reativar";
export const ROTULO_REATIVANDO = "Reativando…";
export function ariaEditar(nome: string): string {
  return `Editar ${nome}`;
}
export function ariaDesativar(nome: string): string {
  return `Desativar ${nome}`;
}
export function ariaReativar(nome: string): string {
  return `Reativar ${nome}`;
}

// A confirmação de desativar (06.2-UI-SPEC.md §Confirmações → Desativar).
export function tituloDesativarFornecedor(nome: string): string {
  return `Desativar ${nome}?`;
}
export const CORPO_DESATIVAR_FORNECEDOR =
  "Ele some da lista e do campo “Fornecedor” da Despesa. Os anexos, as observações e as despesas ligadas a ele ficam guardados; dá para reativar depois.";
export const ROTULO_DESATIVAR_FORNECEDOR = "Desativar fornecedor";
export const ROTULO_DESATIVANDO = "Desativando…";

// Toasts.
export const TOAST_FORNECEDOR_ATUALIZADO = "Fornecedor atualizado.";
export const TOAST_FORNECEDOR_DESATIVADO = "Fornecedor desativado.";
export const TOAST_FORNECEDOR_REATIVADO = "Fornecedor reativado.";

// Erros (06.2-UI-SPEC.md §Erros). Reativar com nome repetido (Pitfall 11): embaixo dos botões da
// ficha, `role="alert"`.
export const FRASE_REATIVAR_NOME_REPETIDO =
  "Já existe um fornecedor ativo com esse nome. Renomeie um dos dois antes de reativar.";
export const FRASE_FALHA_AO_DESATIVAR = "Não deu para desativar. Verifique a internet e tente de novo.";
export const FRASE_FALHA_AO_REATIVAR = "Não deu para reativar. Verifique a internet e tente de novo.";

// ——— O caminho do byte: envio e leitura de anexos (plano 06.2-05). Verbatim da 06.2-UI-SPEC.md §Erros,
// onde ela tem a frase; as que ela não tem estão marcadas e entram no "Decidido sem o Theo" do SUMMARY.
// Os rótulos e ações da folha "Novo anexo" são do plano 06. ———

// Tamanho (cliente, sem rede; e 413 do servidor). `nome` é o nome do arquivo como a pessoa o vê;
// `tamanho` já formatado por `textoDoTamanho` ("23,4 MB").
export function fraseTamanhoDeDocumento(nome: string, tamanho: string): string {
  return `${nome} tem ${tamanho}. O limite é 20 MB para PDF e planilha.`;
}
export function fraseTamanhoDeFoto(nome: string, tamanho: string): string {
  return `${nome} tem ${tamanho}. O limite é 10 MB para foto.`;
}

// Tipo recusado pela extensão (cliente) — `extensao` sem o ponto.
export function fraseTipoPelaExtensao(extensao: string): string {
  return `.${extensao} não entra. Aceita PDF, foto (JPG, PNG, WebP, HEIC) e planilha (XLSX, XLS, CSV).`;
}

// Tipo recusado pela assinatura (415 do servidor).
export const FRASE_TIPO_PELA_ASSINATURA =
  "Esse arquivo não entra: o conteúdo dele não é PDF, foto nem planilha, mesmo que o nome diga que é. Aceita PDF, foto (JPG, PNG, WebP, HEIC) e planilha (XLSX, XLS, CSV).";

// HEIC que o servidor não abre (D-07) — quem a usa é o ramo da foto (plano 07).
export const FRASE_HEIC_NAO_ABRE =
  "Essa foto está em HEIC e não deu para abrir aqui. No iPhone, envie pela galeria (ela converte para JPG) ou ative “Mais compatível” em Ajustes → Câmera → Formatos.";

// Sessão expirada no envio (401 do PUT).
export const FRASE_SESSAO_TERMINOU =
  "Sua sessão terminou. Entre de novo e envie o arquivo outra vez — nada foi guardado.";

// Fornecedor desativado no meio do envio (409 do PUT).
export const FRASE_FORNECEDOR_DESATIVADO_NO_ENVIO =
  "Este fornecedor foi desativado enquanto você enviava. Reative-o para subir anexos — nada foi guardado.";

// Envio falhou (rede, 500, `TypeError` do `fetch`).
export const FRASE_FALHA_AO_ENVIAR =
  "Não deu para enviar. Confira o tamanho do arquivo e a conexão e tente de novo.";

// Arquivo de 0 byte (400 do PUT) — a frase do plano 06.2-05.
export const FRASE_ARQUIVO_VAZIO = "Esse arquivo está vazio. Escolha outro.";

// `Origin` de outro endereço (403 do PUT, Pitfall 8). A UI-SPEC não tem frase: só um envio de fora da
// plataforma chega aqui.
export const FRASE_ORIGEM_RECUSADA =
  "Esse envio não veio da plataforma e foi recusado. Abra a ficha do fornecedor e envie por lá.";

// GET sem sessão: o MESMO corpo que o middleware devolve para toda rota `/gestao/api/` (UI-SPEC: "não
// muda nesta fase").
export const FRASE_NAO_AUTORIZADO = "Não autorizado.";

// GET de id malformado ou de anexo que não existe (404). A UI-SPEC não tem frase; molde
// `FRASE_FOTO_NAO_ENCONTRADA` dos orçamentos.
export const FRASE_ANEXO_NAO_ENCONTRADO = "Esse anexo não existe.";

// Abrir anexo cujo arquivo sumiu do disco (404 da rota).
export const FRASE_ARQUIVO_SUMIU =
  "Não deu para achar este arquivo no servidor. Avise quem cuida do backup.";

// GET que falha por outro motivo do disco (500). A UI-SPEC não tem frase; molde
// `FRASE_NAO_DEU_PARA_LER_FOTO`.
export const FRASE_NAO_DEU_PARA_LER_ANEXO = "Não deu para abrir este arquivo. Tente de novo.";

// Os metadados do envio (Zod da query do PUT).
export const FRASE_NOME_DO_ANEXO_VAZIO = "Dê um nome ao anexo.";
// Só um envio forjado passa do `maxLength` 120 do campo.
export const FRASE_NOME_DO_ANEXO_LONGO = "O nome do anexo pode ter até 120 caracteres.";
export const FRASE_NOTA_LONGA = "A nota pode ter até 160 caracteres.";
// O Tipo é um Select: só um envio forjado chega aqui.
export const FRASE_TIPO_DE_ANEXO_INVALIDO = "Escolha o tipo na lista.";
export const FRASE_VALE_DESDE_INVALIDA = "Escolha uma data válida em “Vale a partir de”.";
// O campo só aparece com Tipo = Tabela de preços; só um envio forjado chega aqui.
export const FRASE_VALE_DESDE_SO_TABELA = "“Vale a partir de” só vale para tabela de preços.";

// ——— A folha "Novo anexo" e a seção de anexos da ficha (plano 06.2-06). Verbatim da 06.2-UI-SPEC.md
// §Copywriting (Ações, "Folha Novo anexo", Linhas de leitura, Toasts, Estados vazios). ———

// Seção de anexos da ficha. O título vai em caixa alta pelo CSS; a contagem, " · {n}", ao lado.
export const TITULO_ANEXOS = "Anexos";
export const ROTULO_NOVO_ANEXO = "Novo anexo";
export const FRASE_SEM_ANEXOS =
  "Nenhum arquivo deste fornecedor. É aqui que a tabela de preços e o catálogo param de se perder no WhatsApp.";
// No lugar do "Novo anexo", com o fornecedor desativado (UI-D24).
export const FRASE_DESATIVADO_SEM_ENVIO = "Fornecedor desativado. Reative para subir anexos.";

// Os quatro tipos do enum `tipo_anexo_fornecedor`, como o Select e a linha do anexo os mostram.
export const ROTULO_TIPO_DE_ANEXO = {
  tabela: "Tabela de preços",
  catalogo: "Catálogo",
  nota: "Nota / orçamento",
  outro: "Outro",
} as const;

// Ações da linha do anexo: PDF e foto abrem numa aba nova; planilha baixa (UI-D9). O verbo é curto; o
// nome do anexo vai no `aria-label`.
export const ROTULO_ABRIR_ANEXO = "Abrir";
export const ROTULO_BAIXAR_ANEXO = "Baixar";
export function ariaAbrirAnexo(nome: string): string {
  return `Abrir ${nome}`;
}
export function ariaBaixarAnexo(nome: string): string {
  return `Baixar ${nome}`;
}

// A 2ª linha do anexo (Apoio, `tinta-fraca`): "{Tipo}" + (" · vale desde {dd/mm/aa}") + " · {EXT} ·
// {tamanho} · {quem}, {dd/mm/aa}". As datas e o tamanho chegam já formatados.
export function metaDoAnexo({
  tipo,
  valeDesde,
  extensao,
  tamanho,
  quem,
  enviadoEm,
}: {
  tipo: string;
  valeDesde: string | null;
  extensao: string;
  tamanho: string;
  quem: string;
  enviadoEm: string;
}): string {
  const vale = valeDesde === null ? "" : ` · vale desde ${valeDesde}`;
  return `${tipo}${vale} · ${extensao.toUpperCase()} · ${tamanho} · ${quem}, ${enviadoEm}`;
}

// A folha "Novo anexo".
export const TITULO_FOLHA_ANEXO = "Novo anexo";
export const ROTULO_ESCOLHER_ARQUIVO = "Escolher arquivo";
export const ROTULO_TROCAR_ARQUIVO = "Trocar arquivo";
export const DICA_ZONA_LIMITES = "PDF ou planilha até 20 MB · foto até 10 MB";
export const DICA_ZONA_ARRASTAR =
  "No computador dá para arrastar o arquivo aqui; no celular abre a galeria ou os arquivos.";
export const ROTULO_NOME_DO_ANEXO = "Nome do anexo";
export const PLACEHOLDER_NOME_DO_ANEXO = "ex.: Tabela de preços set/2026";
export const ROTULO_TIPO_DO_ANEXO = "Tipo";
export const ROTULO_VALE_A_PARTIR_DE = "Vale a partir de";
export const ROTULO_NOTA_CURTA = "Nota curta";
export const PLACEHOLDER_NOTA_CURTA = "ex.: preços com frete até Pirenópolis incluso";
export const DICA_BACKUP_DO_ANEXO =
  "O arquivo fica guardado na plataforma e entra no backup diário, como as fotos de orçamento. Quem subiu e quando fica gravado.";
export const ROTULO_GUARDAR_ANEXO = "Guardar anexo";
export const ROTULO_ENVIANDO = "Enviando…";

// O estado "Enviando" da zona (UI-D10: sem porcentagem — o `fetch` não dá progresso de envio).
export function fraseEnviando(nomeDoArquivo: string, tamanho: string): string {
  return `Enviando ${nomeDoArquivo} · ${tamanho}…`;
}
export const FRASE_NAO_FECHE_A_FOLHA = "Pode levar um minuto no celular. Não feche esta folha.";
export const ARIA_ENVIANDO_O_ARQUIVO = "Enviando o arquivo";

// Sessão expirada no envio (401): o link ao lado da `FRASE_SESSAO_TERMINOU`, para o login na mesma aba.
export const ROTULO_ENTRAR_DE_NOVO = "Entrar de novo";

// Toast.
export function toastAnexoGuardado(nomeDoFornecedor: string): string {
  return `Anexo guardado em ${nomeDoFornecedor}.`;
}
