"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";

import { carregarCatalogoDaNovaOrdem, criarOrdem } from "@/lib/producao/acoes";
import type { CatalogoDaNovaOrdem } from "@/lib/producao/consultas";
import type { CaminhoOrdem, TipoOrdem } from "@/lib/producao/etapas";
import {
  LIMITE_DE_PECAS_POR_ORDEM,
  validarNovaOrdem,
  type ErrosDaNovaOrdem,
} from "@/lib/producao/esquemas";
import {
  DICA_FIM_NOVA_ORDEM,
  DICA_PECA_CASA,
  DICA_PECA_ENCOMENDA,
  FRASE_CATALOGO_CARREGANDO,
  FRASE_CATALOGO_VAZIO_CASA,
  FRASE_ERRO_CARREGAR_CATALOGO,
  FRASE_FALHA_AO_CRIAR,
  FRASE_PECAS_TIRADAS,
  PLACEHOLDER_NOME_DA_ORDEM,
  ROTULO_CAMINHO_BISCOITO,
  ROTULO_CAMINHO_COMPLETO,
  ROTULO_CAMINHO_DA_ORDEM,
  ROTULO_CLIENTE_DA_ORDEM,
  ROTULO_CRIANDO,
  ROTULO_CRIAR_ORDEM,
  ROTULO_ENTREGA_PROMETIDA,
  ROTULO_FECHAR,
  ROTULO_NOME_DA_ORDEM,
  ROTULO_OUTRA_PECA,
  ROTULO_TENTAR_DE_NOVO,
  ROTULO_TIPO_CASA,
  ROTULO_TIPO_DA_ORDEM,
  ROTULO_TIPO_ENCOMENDA,
  ROTULO_VOLTAR,
  TITULO_NOVA_ORDEM,
  TITULO_PECAS_DA_NOVA_ORDEM,
  TOAST_ORDEM_CRIADA,
} from "@/lib/producao/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { cn } from "@/lib/utils";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import {
  ESCOLHA_LIVRE,
  LinhaPecaNovaOrdem,
  lerEscolha,
  nomeDaEscolha,
  type LinhaDaNovaOrdem,
} from "./linha-peca-nova-ordem";

// O contêiner: tela toda abaixo de 768px (desliza de baixo), modal `max-w-lg` e até 85svh a partir
// de `md` — o mesmo desenho das folhas do Estoque. Rodapé preso por flex, nunca `position: sticky`.
const CLASSE_DA_FOLHA = cn(
  "inset-x-0 top-auto bottom-0 left-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none rounded-t-none border-0 border-t p-0 data-open:slide-in-from-bottom-10 data-open:zoom-in-100 data-closed:slide-out-to-bottom-10 data-closed:zoom-out-100",
  "md:top-1/2 md:right-auto md:bottom-auto md:left-1/2 md:h-auto md:max-h-[85svh] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border md:data-open:zoom-in-95 md:data-closed:zoom-out-95",
);

const CLASSE_DO_CAMPO = "text-corpo md:text-corpo min-h-[44px]";

type Segmento<V extends string> = { valor: V; rotulo: string };

const TIPOS: readonly Segmento<TipoOrdem>[] = [
  { valor: "casa", rotulo: ROTULO_TIPO_CASA },
  { valor: "encomenda", rotulo: ROTULO_TIPO_ENCOMENDA },
];

const CAMINHOS: readonly Segmento<CaminhoOrdem>[] = [
  { valor: "completo", rotulo: ROTULO_CAMINHO_COMPLETO },
  { valor: "biscoito", rotulo: ROTULO_CAMINHO_BISCOITO },
];

type EstadoDoCatalogo =
  | { estado: "carregando" }
  | { estado: "erro" }
  | { estado: "pronto"; catalogo: CatalogoDaNovaOrdem };

// O endereço sem `nova=1` (preserva o resto da query) — fechar a folha.
function enderecoSemNova(): string {
  const parametros = new URLSearchParams(window.location.search);
  parametros.delete("nova");
  const resto = parametros.toString();
  return resto ? `${window.location.pathname}?${resto}` : window.location.pathname;
}

// A folha "Nova ordem" (UI-SPEC §"Folha Nova ordem (diálogo)"), aberta por `?nova=1` — abrir e
// fechar mexem só na URL (`pushState`, molde de `escolher-peca.tsx`). A folha nasce limpa a cada
// abertura (o formulário só existe enquanto ela está aberta).
//
// Plano 06.1-14: `?nova` sem valor também abre. É o que o índice antigo de Encomendas gravava
// (`/gestao/encomendas?nova`); o redirecionamento de seis meses leva a query junto, e a UI-SPEC
// promete que esse favorito antigo "cai na ação certa".
export function FolhaNovaOrdem({ hoje }: { hoje: string }) {
  const parametros = useSearchParams();
  const nova = parametros.get("nova");
  if (nova !== "1" && nova !== "") {
    return null;
  }
  return <FormularioNovaOrdem hoje={hoje} aoFechar={() => irParaSemNavegar(enderecoSemNova())} />;
}

type FormularioNovaOrdemProps = {
  // O "hoje" de Brasília, decidido no servidor pela página (UI-SPEC Assunção 5) — só para avisar
  // antes; a ação confere de novo com o dela.
  hoje: string;
  aoFechar: () => void;
};

function FormularioNovaOrdem({ hoje, aoFechar }: FormularioNovaOrdemProps) {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoOrdem>("casa");
  const [caminho, setCaminho] = useState<CaminhoOrdem>("completo");
  const [clienteNome, setClienteNome] = useState("");
  const [entregaPrometida, setEntregaPrometida] = useState("");
  const proximaChave = useRef(1);
  const [pecas, setPecas] = useState<LinhaDaNovaOrdem[]>(() => [
    { chave: 0, escolha: "", descricao: "", quantidade: "1" },
  ]);
  const [catalogo, setCatalogo] = useState<EstadoDoCatalogo>({ estado: "carregando" });
  const [erros, setErros] = useState<ErrosDaNovaOrdem>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Guarda síncrona contra o toque duplo: o `disabled` só vale depois do próximo desenho; a
  // referência vale já no segundo clique do mesmo gesto.
  const emVoo = useRef(false);
  const campos = useRef<Record<string, HTMLElement | null>>({});
  const botoesDeTipo = useRef<Partial<Record<TipoOrdem, HTMLButtonElement | null>>>({});
  const botoesDeCaminho = useRef<Partial<Record<CaminhoOrdem, HTMLButtonElement | null>>>({});

  const carregar = useCallback(async () => {
    setCatalogo({ estado: "carregando" });
    try {
      const resposta = await carregarCatalogoDaNovaOrdem();
      setCatalogo(resposta.ok ? { estado: "pronto", catalogo: resposta.dados } : { estado: "erro" });
    } catch (falha) {
      console.error("Falha ao carregar o catálogo da Nova ordem:", falha);
      setCatalogo({ estado: "erro" });
    }
  }, []);

  useEffect(() => {
    // Carrega AO ABRIR (UI-SPEC): a lista do seletor não vem com a página.
    void carregar();
  }, [carregar]);

  const catalogoPronto = catalogo.estado === "pronto" ? catalogo.catalogo : null;
  const catalogoDaCasaVazio =
    tipo === "casa" &&
    catalogoPronto !== null &&
    catalogoPronto.fichasDeLinha.length === 0 &&
    catalogoPronto.itensDoEstoque.length === 0;
  // Revisão 06.1, WR-107: sem o catálogo pronto as linhas de peça não existem na tela — um toque em
  // "Criar ordem" daria um erro preso a um campo que não está lá (nada visível acontecia). O botão
  // fica desligado e aponta para o texto que diz por quê (carregando, ou o erro com "Tentar de novo").
  const motivoDoCriarDesligado = catalogoDaCasaVazio
    ? "nova-ordem-catalogo-vazio"
    : catalogo.estado === "carregando"
      ? "nova-ordem-catalogo-carregando-texto"
      : catalogo.estado === "erro"
        ? "nova-ordem-catalogo-erro-texto"
        : undefined;

  function registrarCampo(campo: string) {
    return (elemento: HTMLElement | null) => {
      campos.current[campo] = elemento;
    };
  }

  function limparErro(campo: string) {
    setErros((atuais) => {
      if (!(campo in atuais)) {
        return atuais;
      }
      const resto = { ...atuais };
      delete resto[campo];
      return resto;
    });
  }

  // A ordem dos campos na folha — o foco vai para o primeiro com erro.
  function ordemDosCampos(): string[] {
    return [
      "nome",
      "clienteNome",
      "entregaPrometida",
      ...pecas.flatMap((_, indice) => [`peca-${indice}`, `quantidade-${indice}`]),
    ];
  }

  function mostrarErros(novos: ErrosDaNovaOrdem) {
    setErros(novos);
    const conhecidos = ordemDosCampos();
    const semCampo = Object.entries(novos).find(([campo]) => !conhecidos.includes(campo));
    setErroGeral(semCampo ? semCampo[1] : null);
    const primeiro = conhecidos.find((campo) => campo in novos);
    if (primeiro) {
      // O campo pode não estar na tela (WR-107): a frase vai também para o rodapé, nunca some.
      if (!semCampo && !campos.current[primeiro]) {
        setErroGeral(novos[primeiro] ?? null);
      }
      window.requestAnimationFrame(() => campos.current[primeiro]?.focus());
    }
  }

  // Trocar Encomenda → Produção da casa tira o que só serve à encomenda (texto livre e fichas
  // exclusivas) e avisa em `role="status"`. O caminho de volta (casa → encomenda) não perde nada:
  // o item do estoque sem ficha vira texto livre com o nome dele — na encomenda, peça sem ficha é
  // texto livre (D-04), com a mesma nota.
  function escolherTipo(novo: TipoOrdem) {
    if (novo === tipo) {
      return;
    }
    setTipo(novo);
    setErros({});
    setErroGeral(null);
    if (novo === "casa") {
      const exclusivas = new Set(catalogoPronto?.fichasExclusivas.map((ficha) => ficha.id) ?? []);
      const ficam = pecas.filter((linha) => {
        const lida = lerEscolha(linha.escolha);
        return !(lida.origem === "livre" || (lida.origem === "ficha" && exclusivas.has(lida.id)));
      });
      if (ficam.length < pecas.length) {
        setPecas(
          ficam.length > 0
            ? ficam
            : [{ chave: proximaChave.current++, escolha: "", descricao: "", quantidade: "1" }],
        );
        setAviso(FRASE_PECAS_TIRADAS);
      } else {
        setAviso("");
      }
      return;
    }
    setAviso("");
    setPecas((atuais) =>
      atuais.map((linha) =>
        lerEscolha(linha.escolha).origem === "item"
          ? { ...linha, escolha: ESCOLHA_LIVRE, descricao: nomeDaEscolha(linha, catalogoPronto) ?? "" }
          : linha,
      ),
    );
  }

  // Setas movem a escolha num segmentado (padrão de `radiogroup`).
  function teclarNoSegmentado<V extends string>(
    evento: KeyboardEvent<HTMLButtonElement>,
    opcoes: readonly Segmento<V>[],
    atual: V,
    escolher: (valor: V) => void,
    botoes: Partial<Record<V, HTMLButtonElement | null>>,
  ) {
    const passo =
      evento.key === "ArrowRight" || evento.key === "ArrowDown"
        ? 1
        : evento.key === "ArrowLeft" || evento.key === "ArrowUp"
          ? -1
          : 0;
    if (passo === 0) {
      return;
    }
    evento.preventDefault();
    const indice = opcoes.findIndex((opcao) => opcao.valor === atual);
    const novo = opcoes[(indice + passo + opcoes.length) % opcoes.length].valor;
    escolher(novo);
    botoes[novo]?.focus();
  }

  function mudarPeca(indice: number, mudanca: Partial<Omit<LinhaDaNovaOrdem, "chave">>) {
    setPecas((atuais) =>
      atuais.map((linha, posicao) => (posicao === indice ? { ...linha, ...mudanca } : linha)),
    );
    if ("escolha" in mudanca || "descricao" in mudanca) {
      limparErro(`peca-${indice}`);
    }
    if ("quantidade" in mudanca) {
      limparErro(`quantidade-${indice}`);
    }
  }

  // As chaves de erro das peças seguem a POSIÇÃO: tirar ou acrescentar uma peça zera os erros das
  // peças (voltam no próximo "Criar ordem").
  function semErrosDePecas() {
    setErros((atuais) =>
      Object.fromEntries(
        Object.entries(atuais).filter(
          ([campo]) => !campo.startsWith("peca-") && !campo.startsWith("quantidade-"),
        ),
      ),
    );
  }

  function acrescentarPeca() {
    if (pecas.length >= LIMITE_DE_PECAS_POR_ORDEM) {
      return;
    }
    semErrosDePecas();
    const chave = proximaChave.current++;
    setPecas((atuais) => [...atuais, { chave, escolha: "", descricao: "", quantidade: "1" }]);
  }

  function tirarPeca(indice: number) {
    semErrosDePecas();
    setPecas((atuais) => atuais.filter((_, posicao) => posicao !== indice));
  }

  function pedido() {
    return {
      nome,
      tipo,
      caminho,
      clienteNome: tipo === "encomenda" ? clienteNome : "",
      entregaPrometida,
      pecas: pecas.map((linha) => {
        const lida = lerEscolha(linha.escolha);
        if (lida.origem === "livre") {
          return { origem: "livre", descricao: linha.descricao, quantidadeTexto: linha.quantidade };
        }
        if (lida.origem === "ficha") {
          return { origem: "ficha", fichaId: lida.id, quantidadeTexto: linha.quantidade };
        }
        if (lida.origem === "item") {
          return { origem: "item", itemCatalogoId: lida.id, quantidadeTexto: linha.quantidade };
        }
        return { origem: "", quantidadeTexto: linha.quantidade };
      }),
    };
  }

  async function criar() {
    if (emVoo.current || motivoDoCriarDesligado !== undefined) {
      return;
    }
    const entrada = pedido();
    // Conveniência: o mesmo esquema do servidor avisa antes, todos os campos de uma vez.
    const local = validarNovaOrdem(entrada, hoje);
    if (!local.ok) {
      mostrarErros(local.erros);
      return;
    }

    emVoo.current = true;
    setEnviando(true);
    setErros({});
    setErroGeral(null);
    try {
      const resposta = await criarOrdem(entrada);
      if (!resposta.ok) {
        // A folha continua aberta e preenchida — nada do que foi digitado se perde.
        if (resposta.campos && Object.keys(resposta.campos).length > 0) {
          mostrarErros(resposta.campos);
        } else {
          setErroGeral(resposta.erro);
        }
        emVoo.current = false;
        setEnviando(false);
        return;
      }
      // Sucesso: a folha sai do histórico (voltar não a reabre), a tela abre a ordem nova e o
      // toast confirma. `emVoo` fica preso — nenhum segundo toque cria outra ordem.
      toast.success(TOAST_ORDEM_CRIADA);
      window.history.replaceState(null, "", enderecoSemNova());
      router.push(rotaDeGestao(`/producao/${resposta.dados.id}`));
    } catch (falha) {
      console.error("Falha ao criar a ordem:", falha);
      setErroGeral(FRASE_FALHA_AO_CRIAR);
      emVoo.current = false;
      setEnviando(false);
    }
  }

  function idDoErro(campo: string) {
    return erros[campo] ? `nova-ordem-erro-${campo}` : undefined;
  }

  function mensagemDe(campo: string) {
    const mensagem = erros[campo];
    if (!mensagem) {
      return null;
    }
    return (
      <p
        id={`nova-ordem-erro-${campo}`}
        role="alert"
        data-testid="nova-ordem-erro"
        data-campo={campo}
        className="text-apoio text-erro"
      >
        {mensagem}
      </p>
    );
  }

  function segmentado<V extends string>(d: {
    id: string;
    rotulo: string;
    opcoes: readonly Segmento<V>[];
    atual: V;
    escolher: (valor: V) => void;
    botoes: Partial<Record<V, HTMLButtonElement | null>>;
    prefixoDoTeste: string;
  }) {
    return (
      <fieldset className="flex flex-col gap-2">
        <legend id={d.id} className="text-corpo text-tinta mb-2 font-semibold">
          {d.rotulo}
        </legend>
        <div role="radiogroup" aria-labelledby={d.id} className="grid grid-cols-2 gap-2">
          {d.opcoes.map((opcao) => {
            const marcado = d.atual === opcao.valor;
            return (
              <button
                key={opcao.valor}
                ref={(elemento) => {
                  d.botoes[opcao.valor] = elemento;
                }}
                type="button"
                role="radio"
                aria-checked={marcado}
                tabIndex={marcado ? 0 : -1}
                disabled={enviando}
                data-testid={`${d.prefixoDoTeste}-${opcao.valor}`}
                onClick={() => d.escolher(opcao.valor)}
                onKeyDown={(evento) =>
                  teclarNoSegmentado(evento, d.opcoes, d.atual, d.escolher, d.botoes)
                }
                className={cn(
                  "text-corpo min-h-[52px] rounded-md border px-2 py-2 font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  marcado
                    ? "bg-acento border-acento text-white"
                    : "bg-superficie border-borda-forte text-tinta-media",
                )}
              >
                {opcao.rotulo}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }

  function blocoDasPecas() {
    if (catalogo.estado === "carregando") {
      return (
        <div data-testid="nova-ordem-catalogo-carregando" className="flex flex-col gap-3" aria-busy="true">
          <p id="nova-ordem-catalogo-carregando-texto" className="text-apoio text-tinta-media">
            {FRASE_CATALOGO_CARREGANDO}
          </p>
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      );
    }
    if (catalogo.estado === "erro") {
      return (
        <div
          role="alert"
          data-testid="nova-ordem-catalogo-erro"
          className="bg-superficie-2 flex flex-col items-start gap-3 rounded-md p-4"
        >
          <p id="nova-ordem-catalogo-erro-texto" className="text-apoio text-erro">
            {FRASE_ERRO_CARREGAR_CATALOGO}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void carregar()}
            className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
          >
            {ROTULO_TENTAR_DE_NOVO}
          </Button>
        </div>
      );
    }
    if (catalogoDaCasaVazio) {
      return (
        <p
          id="nova-ordem-catalogo-vazio"
          data-testid="nova-ordem-catalogo-vazio"
          className="text-apoio text-tinta-media bg-superficie-2 rounded-md p-4"
        >
          {FRASE_CATALOGO_VAZIO_CASA}
        </p>
      );
    }
    const doCatalogo = catalogo.catalogo;
    return (
      <>
        {pecas.map((linha, indice) => (
          <LinhaPecaNovaOrdem
            key={linha.chave}
            numero={indice + 1}
            linha={linha}
            tipo={tipo}
            catalogo={doCatalogo}
            erroDaPeca={erros[`peca-${indice}`] ?? null}
            erroDaQuantidade={erros[`quantidade-${indice}`] ?? null}
            podeTirar={indice > 0}
            desabilitada={enviando}
            aoMudar={(mudanca) => mudarPeca(indice, mudanca)}
            aoTirar={() => tirarPeca(indice)}
            registrarCampoDaPeca={registrarCampo(`peca-${indice}`)}
            registrarCampoDaQuantidade={registrarCampo(`quantidade-${indice}`)}
          />
        ))}
        {pecas.length < LIMITE_DE_PECAS_POR_ORDEM ? (
          <Button
            type="button"
            variant="outline"
            data-testid="nova-ordem-outra-peca"
            disabled={enviando}
            onClick={acrescentarPeca}
            className="text-corpo h-auto min-h-[44px] self-start px-4 font-semibold"
          >
            {ROTULO_OUTRA_PECA}
          </Button>
        ) : null}
      </>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(novoValor) => {
        if (!novoValor && !enviando) {
          aoFechar();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        data-testid="folha-nova-ordem"
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          // Foco inicial em "Nome" só a partir de 768px — no celular, o teclado não sobe sozinho
          // (UI-D13 da Fase 06).
          if (window.matchMedia("(min-width: 768px)").matches) {
            campos.current.nome?.focus();
          }
        }}
        className={CLASSE_DA_FOLHA}
      >
        <DialogHeader className="border-border flex flex-row items-center justify-between gap-4 border-b px-6 py-4">
          <DialogTitle className="text-titulo text-tinta">{TITULO_NOVA_ORDEM}</DialogTitle>
          <DialogDescription className="sr-only">{DICA_FIM_NOVA_ORDEM}</DialogDescription>
          <button
            type="button"
            aria-label={ROTULO_FECHAR}
            data-testid="nova-ordem-fechar"
            disabled={enviando}
            onClick={aoFechar}
            className="hover:bg-muted text-tinta flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            <X aria-hidden="true" />
          </button>
        </DialogHeader>

        <form
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            void criar();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="nova-ordem-nome" className="text-corpo text-tinta font-semibold">
                {ROTULO_NOME_DA_ORDEM}
              </label>
              <Input
                id="nova-ordem-nome"
                ref={registrarCampo("nome")}
                data-testid="nova-ordem-nome"
                autoComplete="off"
                placeholder={PLACEHOLDER_NOME_DA_ORDEM}
                disabled={enviando}
                aria-invalid={Boolean(erros.nome)}
                aria-describedby={idDoErro("nome")}
                value={nome}
                onChange={(evento) => {
                  setNome(evento.target.value);
                  limparErro("nome");
                }}
                className={CLASSE_DO_CAMPO}
              />
              {mensagemDe("nome")}
            </div>

            {segmentado({
              id: "nova-ordem-tipo-rotulo",
              rotulo: ROTULO_TIPO_DA_ORDEM,
              opcoes: TIPOS,
              atual: tipo,
              escolher: escolherTipo,
              botoes: botoesDeTipo.current,
              prefixoDoTeste: "nova-ordem-tipo",
            })}

            {/* O aviso da troca de tipo — sempre no documento, para o leitor de tela anunciar. */}
            <p role="status" data-testid="nova-ordem-aviso" className="text-apoio text-tinta-media empty:hidden">
              {aviso}
            </p>

            {segmentado({
              id: "nova-ordem-caminho-rotulo",
              rotulo: ROTULO_CAMINHO_DA_ORDEM,
              opcoes: CAMINHOS,
              atual: caminho,
              escolher: setCaminho,
              botoes: botoesDeCaminho.current,
              prefixoDoTeste: "nova-ordem-caminho",
            })}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {tipo === "encomenda" ? (
                <div className="flex flex-col gap-2">
                  <label htmlFor="nova-ordem-cliente" className="text-corpo text-tinta font-semibold">
                    {ROTULO_CLIENTE_DA_ORDEM}
                  </label>
                  <Input
                    id="nova-ordem-cliente"
                    ref={registrarCampo("clienteNome")}
                    data-testid="nova-ordem-cliente"
                    autoComplete="off"
                    disabled={enviando}
                    aria-invalid={Boolean(erros.clienteNome)}
                    aria-describedby={idDoErro("clienteNome")}
                    value={clienteNome}
                    onChange={(evento) => {
                      setClienteNome(evento.target.value);
                      limparErro("clienteNome");
                    }}
                    className={CLASSE_DO_CAMPO}
                  />
                  {mensagemDe("clienteNome")}
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                <label htmlFor="nova-ordem-entrega" className="text-corpo text-tinta font-semibold">
                  {ROTULO_ENTREGA_PROMETIDA}
                </label>
                <Input
                  id="nova-ordem-entrega"
                  ref={registrarCampo("entregaPrometida")}
                  data-testid="nova-ordem-entrega"
                  type="date"
                  min={hoje}
                  disabled={enviando}
                  aria-invalid={Boolean(erros.entregaPrometida)}
                  aria-describedby={idDoErro("entregaPrometida")}
                  value={entregaPrometida}
                  onChange={(evento) => {
                    setEntregaPrometida(evento.target.value);
                    limparErro("entregaPrometida");
                  }}
                  className={CLASSE_DO_CAMPO}
                />
                {mensagemDe("entregaPrometida")}
              </div>
            </div>

            <section aria-labelledby="nova-ordem-pecas-titulo" className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h3
                  id="nova-ordem-pecas-titulo"
                  className="text-apoio text-tinta-media font-semibold tracking-wide uppercase"
                >
                  {TITULO_PECAS_DA_NOVA_ORDEM}
                </h3>
                <p className="text-apoio text-tinta-fraca">
                  {tipo === "casa" ? DICA_PECA_CASA : DICA_PECA_ENCOMENDA}
                </p>
              </div>
              {blocoDasPecas()}
            </section>

            <p className="text-apoio text-tinta-fraca">{DICA_FIM_NOVA_ORDEM}</p>
          </div>

          {/* Rodapé preso por FLEX, fora da área rolável: o erro de gravação e os dois botões. */}
          <div className="border-border bg-popover flex flex-col gap-3 border-t px-6 py-4">
            {erroGeral ? (
              <p
                role="alert"
                data-testid="nova-ordem-erro"
                data-campo="geral"
                className="text-apoio text-erro"
              >
                {erroGeral}
              </p>
            ) : null}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                data-testid="nova-ordem-voltar"
                disabled={enviando}
                onClick={aoFechar}
                className="text-corpo h-auto min-h-[52px] px-4 font-semibold"
              >
                {ROTULO_VOLTAR}
              </Button>
              <button
                type="submit"
                data-testid="nova-ordem-criar"
                disabled={enviando || motivoDoCriarDesligado !== undefined}
                aria-busy={enviando}
                aria-describedby={motivoDoCriarDesligado}
                className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[52px] flex-1 items-center justify-center rounded-md px-4 font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviando ? ROTULO_CRIANDO : ROTULO_CRIAR_ORDEM}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
