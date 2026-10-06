"use client";

import { useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

import { criarFornecedor, type ResultadoDoFornecedor } from "@/lib/fornecedores/acoes";
import {
  AREAS_DO_FORNECEDOR,
  TETO_DAS_OBSERVACOES,
  TETO_DO_NOME,
  TETO_DO_SITE,
  TETO_DO_TEXTO_CURTO,
  TETO_DO_WHATSAPP,
  type AreaDoFornecedor,
  type CampoDoFornecedor,
} from "@/lib/fornecedores/esquemas";
import {
  COMPLEMENTO_VENDE,
  DICA_AREA,
  DICA_FOLHA,
  FRASE_FALHA_AO_SALVAR,
  PLACEHOLDER_CIDADE_ENTREGA,
  PLACEHOLDER_EMAIL,
  PLACEHOLDER_NOME,
  PLACEHOLDER_OBSERVACOES,
  PLACEHOLDER_PAGAMENTO_PRAZO,
  PLACEHOLDER_PESSOA_CONTATO,
  PLACEHOLDER_SITE,
  PLACEHOLDER_VENDE,
  PLACEHOLDER_WHATSAPP,
  ROTULO_AREA,
  ROTULO_CIDADE_ENTREGA,
  ROTULO_EMAIL,
  ROTULO_FECHAR,
  ROTULO_NOME,
  ROTULO_OBSERVACOES,
  ROTULO_PAGAMENTO_PRAZO,
  ROTULO_PESSOA_CONTATO,
  ROTULO_SALVANDO,
  ROTULO_SALVAR_FORNECEDOR,
  ROTULO_SITE,
  ROTULO_VENDE,
  ROTULO_VOLTAR,
  ROTULO_WHATSAPP,
  TITULO_FOLHA_EDITAR,
  TITULO_FOLHA_NOVO,
} from "@/lib/fornecedores/textos";
import { ROTULO_AREA as ROTULO_DA_AREA } from "@/lib/financeiro/textos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Folha, FolhaCorpo, FolhaRodape } from "@/components/amassa/folha";

// Os nove campos de texto (a Área é um Select). Tudo texto: o servidor apara e transforma vazio em
// nulo (`esquemaFornecedor`).
type CampoDeTexto = Exclude<CampoDoFornecedor, "area">;
type ValoresDeTexto = Record<CampoDeTexto, string>;

export type ValoresDoFornecedor = ValoresDeTexto & { area: AreaDoFornecedor };

const VALORES_VAZIOS: ValoresDeTexto = {
  nome: "",
  vende: "",
  cidadeEntrega: "",
  whatsapp: "",
  pessoaContato: "",
  email: "",
  site: "",
  pagamentoPrazo: "",
  observacoes: "",
};

// A área padrão da folha nova (06.2-UI-SPEC.md, "Área": padrão Peças).
const AREA_PADRAO: AreaDoFornecedor = "pecas";

// A ordem dos campos na tela — e a ordem em que o foco procura o primeiro com erro.
const ORDEM_DOS_CAMPOS: readonly CampoDoFornecedor[] = [
  "nome",
  "vende",
  "area",
  "cidadeEntrega",
  "whatsapp",
  "pessoaContato",
  "email",
  "site",
  "pagamentoPrazo",
  "observacoes",
];

type DescricaoDoCampo = {
  campo: CampoDeTexto;
  rotulo: string;
  complemento?: string;
  placeholder: string;
  teto: number;
  inputMode?: "tel" | "email" | "url";
};

const CAMPO_NOME: DescricaoDoCampo = {
  campo: "nome",
  rotulo: ROTULO_NOME,
  placeholder: PLACEHOLDER_NOME,
  teto: TETO_DO_NOME,
};
const CAMPO_VENDE: DescricaoDoCampo = {
  campo: "vende",
  rotulo: ROTULO_VENDE,
  complemento: COMPLEMENTO_VENDE,
  placeholder: PLACEHOLDER_VENDE,
  teto: TETO_DO_TEXTO_CURTO,
};
// Os cinco de texto da grade de duas colunas (a Área é a sexta, primeira da grade).
const CAMPOS_DA_GRADE: readonly DescricaoDoCampo[] = [
  {
    campo: "cidadeEntrega",
    rotulo: ROTULO_CIDADE_ENTREGA,
    placeholder: PLACEHOLDER_CIDADE_ENTREGA,
    teto: TETO_DO_TEXTO_CURTO,
  },
  {
    campo: "whatsapp",
    rotulo: ROTULO_WHATSAPP,
    placeholder: PLACEHOLDER_WHATSAPP,
    teto: TETO_DO_WHATSAPP,
    inputMode: "tel",
  },
  {
    campo: "pessoaContato",
    rotulo: ROTULO_PESSOA_CONTATO,
    placeholder: PLACEHOLDER_PESSOA_CONTATO,
    teto: TETO_DO_TEXTO_CURTO,
  },
  {
    campo: "email",
    rotulo: ROTULO_EMAIL,
    placeholder: PLACEHOLDER_EMAIL,
    teto: TETO_DO_TEXTO_CURTO,
    inputMode: "email",
  },
  { campo: "site", rotulo: ROTULO_SITE, placeholder: PLACEHOLDER_SITE, teto: TETO_DO_SITE, inputMode: "url" },
];
const CAMPO_PAGAMENTO: DescricaoDoCampo = {
  campo: "pagamentoPrazo",
  rotulo: ROTULO_PAGAMENTO_PRAZO,
  placeholder: PLACEHOLDER_PAGAMENTO_PRAZO,
  teto: TETO_DO_TEXTO_CURTO,
};

// Campo nunca menor que 16 px: o `Input` do shadcn traz `md:text-sm` (14 px a partir de 768 px).
const CLASSE_DO_CAMPO = "text-corpo md:text-corpo min-h-[44px]";
const CLASSE_DO_ROTULO = "text-apoio text-tinta font-semibold";

export type FolhaFornecedorProps = {
  // "novo" = "Novo fornecedor"; "editar" = "Editar fornecedor" (`AcoesDaFicha`, plano 04, passa `inicial` e `acao` = `editarFornecedor`).
  modo: "novo" | "editar";
  inicial?: ValoresDoFornecedor;
  // "Cadastrar um agora" (plano 03) abre a folha com o Nome = o texto da busca.
  nomeInicial?: string;
  // A ação que grava. Ausente = `criarFornecedor` (a folha nova).
  acao?: (dados: ValoresDoFornecedor) => Promise<ResultadoDoFornecedor<{ id: string }>>;
  aoFechar: () => void;
  aoSalvar: (id: string) => void;
};

// A folha "Novo fornecedor" / "Editar fornecedor" (06.2-UI-SPEC.md §"Folha Novo fornecedor / Editar
// fornecedor"): tela toda no celular, `md:max-w-lg` centrada; corpo rolável com a dica e os dez
// campos; rodapé preso por flex. A validação é do servidor (o `esquemaFornecedor` dentro da ação); o
// erro de campo aparece embaixo dele, com o foco no primeiro campo com erro, e a folha continua
// preenchida. Enquanto grava: "Salvando…", os dois botões desabilitados, `aria-busy` e uma guarda
// síncrona — um toque duplo grava UMA vez.
//
// Quem usa monta o componente para abrir e o desmonta para fechar: cada abertura nasce limpa.
export function FolhaFornecedor({ modo, inicial, nomeInicial, acao, aoFechar, aoSalvar }: FolhaFornecedorProps) {
  const [valores, setValores] = useState<ValoresDeTexto>(() => {
    if (inicial) {
      return {
        nome: inicial.nome,
        vende: inicial.vende,
        cidadeEntrega: inicial.cidadeEntrega,
        whatsapp: inicial.whatsapp,
        pessoaContato: inicial.pessoaContato,
        email: inicial.email,
        site: inicial.site,
        pagamentoPrazo: inicial.pagamentoPrazo,
        observacoes: inicial.observacoes,
      };
    }
    return { ...VALORES_VAZIOS, nome: nomeInicial ?? "" };
  });
  const [area, setArea] = useState<AreaDoFornecedor>(inicial?.area ?? AREA_PADRAO);
  const [erros, setErros] = useState<Partial<Record<CampoDoFornecedor, string>>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const gravandoAgora = useRef(false);
  const campos = useRef<Partial<Record<CampoDoFornecedor, HTMLElement | null>>>({});

  const titulo = modo === "editar" ? TITULO_FOLHA_EDITAR : TITULO_FOLHA_NOVO;

  function fechar() {
    if (!gravandoAgora.current) {
      aoFechar();
    }
  }

  async function gravar() {
    if (gravandoAgora.current) {
      return;
    }
    gravandoAgora.current = true;
    setGravando(true);
    setErroGeral(null);

    const dados: ValoresDoFornecedor = { ...valores, area };
    let resposta: ResultadoDoFornecedor<{ id: string }>;
    try {
      resposta = acao ? await acao(dados) : await criarFornecedor(dados);
    } catch {
      resposta = { ok: false, erro: FRASE_FALHA_AO_SALVAR };
    }

    gravandoAgora.current = false;
    setGravando(false);

    if (resposta.ok) {
      aoSalvar(resposta.dados.id);
      return;
    }
    const errosDosCampos = resposta.campos ?? {};
    setErros(errosDosCampos);
    const primeiro = ORDEM_DOS_CAMPOS.find((campo) => errosDosCampos[campo] !== undefined);
    if (primeiro) {
      campos.current[primeiro]?.focus();
    } else {
      setErroGeral(resposta.erro);
    }
  }

  function mudarTexto(campo: CampoDeTexto, valor: string) {
    setValores((anteriores) => ({ ...anteriores, [campo]: valor }));
    setErros((anteriores) => ({ ...anteriores, [campo]: undefined }));
  }

  function erroDe(campo: CampoDoFornecedor): ReactNode {
    const mensagem = erros[campo];
    if (mensagem === undefined) {
      return null;
    }
    return (
      <p
        id={`fornecedor-erro-${campo}`}
        role="alert"
        data-testid={`fornecedor-erro-${campo}`}
        className="text-apoio text-erro"
      >
        {mensagem}
      </p>
    );
  }

  function descricaoDe(campo: CampoDoFornecedor, temDica: boolean): string | undefined {
    const partes = [
      temDica ? `fornecedor-dica-${campo}` : null,
      erros[campo] !== undefined ? `fornecedor-erro-${campo}` : null,
    ].filter((parte): parte is string => parte !== null);
    return partes.length > 0 ? partes.join(" ") : undefined;
  }

  function campoDeTexto(descricao: DescricaoDoCampo) {
    const { campo } = descricao;
    return (
      <div key={campo} className="flex min-w-0 flex-col gap-2">
        <label htmlFor={`fornecedor-${campo}`} className={CLASSE_DO_ROTULO}>
          {descricao.rotulo}
          {descricao.complemento ? <span className="font-normal">{descricao.complemento}</span> : null}
        </label>
        <Input
          id={`fornecedor-${campo}`}
          ref={(elemento) => {
            campos.current[campo] = elemento;
          }}
          data-testid={`fornecedor-${campo}`}
          type="text"
          inputMode={descricao.inputMode}
          autoComplete="off"
          maxLength={descricao.teto}
          placeholder={descricao.placeholder}
          aria-describedby={descricaoDe(campo, false)}
          aria-invalid={erros[campo] !== undefined}
          value={valores[campo]}
          onChange={(evento) => mudarTexto(campo, evento.target.value)}
          className={CLASSE_DO_CAMPO}
        />
        {erroDe(campo)}
      </div>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto) {
          fechar();
        }
      }}
    >
      <Folha
        data-testid="folha-fornecedor"
        aria-describedby={undefined}
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          // Foco inicial no Nome só a partir de 768 px — no celular o teclado não sobe sozinho.
          if (window.matchMedia("(min-width: 768px)").matches) {
            campos.current.nome?.focus();
          }
        }}
      >
        <DialogHeader className="border-border flex flex-row items-start justify-between gap-4 border-b px-6 py-4">
          <DialogTitle className="text-titulo text-tinta min-w-0 break-words">{titulo}</DialogTitle>
          <button
            type="button"
            aria-label={ROTULO_FECHAR}
            data-testid="folha-fornecedor-fechar"
            disabled={gravando}
            onClick={fechar}
            className="hover:bg-muted text-tinta flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            <X aria-hidden="true" />
          </button>
        </DialogHeader>

        <form
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            // O diálogo vai para o <body> pelo portal, mas o `submit` do React sobe pela árvore do
            // React — parar aqui (molde CR-01 de `formulario-cliente.tsx`).
            evento.stopPropagation();
            void gravar();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <FolhaCorpo>
            <p className="text-apoio text-tinta-fraca">{DICA_FOLHA}</p>

            {campoDeTexto(CAMPO_NOME)}
            {campoDeTexto(CAMPO_VENDE)}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor="fornecedor-area" className={CLASSE_DO_ROTULO}>
                  {ROTULO_AREA}
                </label>
                <Select
                  value={area}
                  onValueChange={(valor) => {
                    setArea(valor as AreaDoFornecedor);
                    setErros((anteriores) => ({ ...anteriores, area: undefined }));
                  }}
                >
                  <SelectTrigger
                    id="fornecedor-area"
                    ref={(elemento) => {
                      campos.current.area = elemento;
                    }}
                    data-testid="fornecedor-area"
                    aria-describedby={descricaoDe("area", true)}
                    aria-invalid={erros.area !== undefined}
                    className="text-corpo min-h-[44px] w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AREAS_DO_FORNECEDOR.map((valorDaArea) => (
                      <SelectItem key={valorDaArea} value={valorDaArea} className="text-corpo min-h-[44px]">
                        {ROTULO_DA_AREA[valorDaArea]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p id="fornecedor-dica-area" className="text-apoio text-tinta-fraca">
                  {DICA_AREA}
                </p>
                {erroDe("area")}
              </div>

              {CAMPOS_DA_GRADE.map((descricao) => campoDeTexto(descricao))}
            </div>

            {campoDeTexto(CAMPO_PAGAMENTO)}

            <div className="flex min-w-0 flex-col gap-2">
              <label htmlFor="fornecedor-observacoes" className={CLASSE_DO_ROTULO}>
                {ROTULO_OBSERVACOES}
              </label>
              <Textarea
                id="fornecedor-observacoes"
                ref={(elemento) => {
                  campos.current.observacoes = elemento;
                }}
                data-testid="fornecedor-observacoes"
                rows={4}
                maxLength={TETO_DAS_OBSERVACOES}
                placeholder={PLACEHOLDER_OBSERVACOES}
                aria-describedby={descricaoDe("observacoes", false)}
                aria-invalid={erros.observacoes !== undefined}
                value={valores.observacoes}
                onChange={(evento) => mudarTexto("observacoes", evento.target.value)}
                // 4 linhas fixas; o texto longo rola por dentro (`field-sizing-fixed` desliga o
                // crescimento automático do Textarea do shadcn).
                className="text-corpo md:text-corpo min-h-[44px] [field-sizing:fixed]"
              />
              {erroDe("observacoes")}
            </div>
          </FolhaCorpo>

          {/* Rodapé preso por flex, fora da área rolável: o erro geral + "Voltar" · o primário. */}
          <FolhaRodape erro={erroGeral} dataTestIdErro="fornecedor-erro-geral" className="gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                data-testid="fornecedor-voltar"
                disabled={gravando}
                onClick={fechar}
                className="text-corpo h-auto min-h-[52px] px-6 font-semibold"
              >
                {ROTULO_VOLTAR}
              </Button>
              <Button
                type="submit"
                data-testid="fornecedor-salvar"
                disabled={gravando}
                aria-busy={gravando ? "true" : undefined}
                className="text-corpo h-auto min-h-[52px] flex-1 px-6 font-semibold whitespace-normal"
              >
                {gravando ? ROTULO_SALVANDO : ROTULO_SALVAR_FORNECEDOR}
              </Button>
            </div>
          </FolhaRodape>
        </form>
      </Folha>
    </Dialog>
  );
}
