"use client";

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { X } from "lucide-react";

import {
  extensaoDoNome,
  familiaPelaExtensao,
  preenchimentoPeloArquivo,
  recusaNoCliente,
  textoDoTamanho,
} from "@/lib/fornecedores/arquivo";
import {
  TETO_DA_NOTA_DO_ANEXO,
  TETO_DO_NOME_DO_ANEXO,
  TIPOS_DE_ANEXO,
  type TipoDeAnexo,
} from "@/lib/fornecedores/esquemas";
import {
  ARIA_ENVIANDO_O_ARQUIVO,
  DICA_BACKUP_DO_ANEXO,
  DICA_ZONA_ARRASTAR,
  DICA_ZONA_LIMITES,
  FRASE_FALHA_AO_ENVIAR,
  FRASE_NAO_FECHE_A_FOLHA,
  FRASE_NOME_DO_ANEXO_LONGO,
  FRASE_NOME_DO_ANEXO_VAZIO,
  FRASE_NOTA_LONGA,
  FRASE_SESSAO_TERMINOU,
  FRASE_VALE_DESDE_INVALIDA,
  FRASE_VALE_DESDE_SO_TABELA,
  PLACEHOLDER_NOME_DO_ANEXO,
  PLACEHOLDER_NOTA_CURTA,
  ROTULO_ENTRAR_DE_NOVO,
  ROTULO_ENVIANDO,
  ROTULO_ESCOLHER_ARQUIVO,
  ROTULO_FECHAR,
  ROTULO_GUARDAR_ANEXO,
  ROTULO_NOME_DO_ANEXO,
  ROTULO_NOTA_CURTA,
  ROTULO_TIPO_DE_ANEXO,
  ROTULO_TIPO_DO_ANEXO,
  ROTULO_TROCAR_ARQUIVO,
  ROTULO_VALE_A_PARTIR_DE,
  ROTULO_VOLTAR,
  TITULO_FOLHA_ANEXO,
  fraseEnviando,
} from "@/lib/fornecedores/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLASSE_DA_FOLHA } from "@/components/amassa/estoque/folha-movimentacao";

// Os rótulos dos quatro tipos, conferidos contra o enum: um tipo novo sem rótulo não compila.
const ROTULOS_DOS_TIPOS: Record<TipoDeAnexo, string> = ROTULO_TIPO_DE_ANEXO;

// O que o `accept` oferece (06.2-UI-SPEC.md, "Folha Novo anexo"). É conveniência do seletor do sistema:
// o servidor decide pela assinatura.
const ACEITA = ".pdf,image/*,.heic,.xlsx,.xls,.csv";

// Campo nunca menor que 16 px: o `Input` do shadcn traz `md:text-sm` (14 px a partir de 768 px).
const CLASSE_DO_CAMPO = "text-corpo md:text-corpo min-h-[44px]";
const CLASSE_DO_ROTULO = "text-apoio text-tinta font-semibold";

// O botão "Escolher arquivo"/"Trocar arquivo" é o `<label>` do `<input type="file">` desenhado como
// `outline` de 44 px; o anel de foco vem do input (`peer`), que fica `sr-only` mas focável.
const CLASSE_DO_ESCOLHER =
  "border-input bg-background text-corpo text-tinta hover:bg-muted inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-md border px-4 font-semibold peer-focus-visible:ring-ring peer-focus-visible:ring-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50";

// Os erros que o servidor dá para UM campo: aparecem embaixo dele (UI-D9 da 06), não no rodapé.
type CampoDoAnexo = "nome" | "valeDesde" | "nota";
const CAMPO_DA_FRASE: ReadonlyMap<string, CampoDoAnexo> = new Map([
  [FRASE_NOME_DO_ANEXO_VAZIO, "nome"],
  [FRASE_NOME_DO_ANEXO_LONGO, "nome"],
  [FRASE_VALE_DESDE_INVALIDA, "valeDesde"],
  [FRASE_VALE_DESDE_SO_TABELA, "valeDesde"],
  [FRASE_NOTA_LONGA, "nota"],
]);

// A recusa que fica acima do rodapé (`role="alert"`). `sessao` = 401: a frase ganha "Entrar de novo".
type Recusa = { frase: string; sessao: boolean };

type RespostaDoEnvio = { ok: true; dados: { id: string } } | { ok: false; erro: string };

export type FolhaAnexoProps = {
  fornecedorId: string;
  // O dia civil de Brasília que a PÁGINA calculou no servidor — nunca o dia UTC do navegador. É o
  // "Vale a partir de" que o PDF preenche.
  hoje: string;
  aoFechar: () => void;
  aoGuardar: () => void;
  // O tipo com que a folha abre (plano 08: "Subir a primeira" abre com Tabela de preços). Conta como
  // escolhido pela pessoa: o arquivo escolhido depois não o troca (uma foto da tabela continua tabela).
  tipoInicial?: TipoDeAnexo;
};

// A folha "Novo anexo" (06.2-UI-SPEC.md §"Folha Novo anexo"; FRN-06, D-01): a mesma casca da
// `FolhaFornecedor` — tela toda no celular, `md:max-w-lg` centrada, corpo rolável, rodapé preso.
//
// O arquivo vai como o corpo CRU de um `fetch` `PUT` para a rota do plano 05 (nunca multipart), com os
// metadados na query (Pitfall 6). A folha não decide nada que o servidor não confira: tipo, tamanho,
// sessão e origem são do PUT, e a folha mostra a frase que o corpo JSON traz.
//
// Antes da rede (plano 07): `recusaNoCliente` — com as MESMAS constantes de limite que o PUT usa, de
// `lib/fornecedores/arquivo.ts` — barra a extensão fora da lista, o arquivo vazio e o grande demais; a
// frase fica dentro da zona, "Guardar anexo" desabilita e nenhuma requisição sai. A foto aceita ganha a
// prévia (`URL.createObjectURL`, até 220 px), revogada ao trocar de arquivo e ao fechar a folha (um
// celular não segura a memória de cada foto escolhida); o formato que o navegador não desenha (HEIC no
// Chrome) esconde a prévia pelo `onError`, sem mensagem — quem fala do HEIC é o servidor (D-07).
//
// Enquanto envia (UI-D10, UI-D11): barra indeterminada sem porcentagem (o `fetch` não informa
// progresso de envio), os dois botões desabilitados, o fechar some, e Esc e toque fora não fecham. Em
// toda recusa o arquivo continua escolhido para tentar de novo — menos no 401, em que a sessão acabou
// e o caminho é entrar de novo.
//
// Quem usa monta o componente para abrir e o desmonta para fechar: cada abertura nasce limpa.
export function FolhaAnexo({ fornecedorId, hoje, aoFechar, aoGuardar, tipoInicial }: FolhaAnexoProps) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoDeAnexo>(tipoInicial ?? "tabela");
  const [tipoTocado, setTipoTocado] = useState(tipoInicial !== undefined);
  const [valeDesde, setValeDesde] = useState("");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [recusa, setRecusa] = useState<Recusa | null>(null);
  const [erros, setErros] = useState<Partial<Record<CampoDoAnexo, string>>>({});
  const [previa, setPrevia] = useState<string | null>(null);
  const [previaFalhou, setPreviaFalhou] = useState(false);
  // Guarda síncrona: um toque duplo envia UMA vez.
  const enviandoAgora = useRef(false);
  const campoDoArquivo = useRef<HTMLInputElement | null>(null);
  const campos = useRef<Partial<Record<CampoDoAnexo, HTMLElement | null>>>({});
  // A URL da prévia em uso — a única que existe a cada momento; revogada ao trocar e ao desmontar.
  const urlDaPrevia = useRef<string | null>(null);

  // A recusa ANTES da rede: derivada do arquivo escolhido, nunca guardada à parte.
  const recusaDoCliente = arquivo === null ? null : recusaNoCliente({ nome: arquivo.name, bytes: arquivo.size });

  // Fechar a folha a desmonta (quem usa monta para abrir): a URL da prévia sai junto.
  useEffect(() => {
    const prevista = urlDaPrevia;
    return () => {
      if (prevista.current !== null) {
        URL.revokeObjectURL(prevista.current);
        prevista.current = null;
      }
    };
  }, []);

  function trocarPrevia(foto: File | null) {
    if (urlDaPrevia.current !== null) {
      URL.revokeObjectURL(urlDaPrevia.current);
    }
    urlDaPrevia.current = foto === null ? null : URL.createObjectURL(foto);
    setPrevia(urlDaPrevia.current);
    setPreviaFalhou(false);
  }

  function fechar() {
    if (!enviandoAgora.current) {
      aoFechar();
    }
  }

  function receber(escolhido: File) {
    setArquivo(escolhido);
    setRecusa(null);
    const recusado = recusaNoCliente({ nome: escolhido.name, bytes: escolhido.size }) !== null;
    const ehFoto = familiaPelaExtensao(extensaoDoNome(escolhido.name)) === "foto";
    trocarPrevia(!recusado && ehFoto ? escolhido : null);
    // Um arquivo recusado na hora não preenche nada: o Nome dele ficaria para o próximo arquivo.
    if (recusado) {
      return;
    }
    const preenchido = preenchimentoPeloArquivo({
      nomeDoArquivo: escolhido.name,
      hoje,
      nomeAtual: nome,
      valeDesdeAtual: valeDesde,
      tipoTocadoPelaPessoa: tipoTocado,
    });
    setNome(preenchido.nome);
    if (preenchido.tipo !== null) {
      setTipo(preenchido.tipo);
    }
    // Aberta já como tabela ("Subir a primeira"), o tipo conta como escolhido e o preenchimento não o
    // toca — mas um PDF ainda leva "Vale a partir de" = hoje (só se vazia), como no caminho comum.
    const pdfNaTabelaInicial =
      tipoInicial === "tabela" &&
      tipo === "tabela" &&
      familiaPelaExtensao(extensaoDoNome(escolhido.name)) === "documento" &&
      preenchido.valeDesde === "";
    setValeDesde(pdfNaTabelaInicial ? hoje : preenchido.valeDesde);
    setErros((anteriores) => ({ ...anteriores, nome: undefined }));
  }

  function aoSoltar(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    setArrastando(false);
    if (enviandoAgora.current) {
      return;
    }
    const primeiro = evento.dataTransfer.files[0];
    if (primeiro) {
      receber(primeiro);
    }
  }

  function aoArrastarPorCima(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    if (!enviandoAgora.current) {
      setArrastando(true);
    }
  }

  function enderecoDoEnvio(escolhido: File): string {
    const query = new URLSearchParams({
      fornecedorId,
      nome,
      tipo,
      extensao: extensaoDoNome(escolhido.name),
    });
    // A data só existe em tabela de preços (o banco recusa fora dela): com outro tipo, não vai.
    if (tipo === "tabela" && valeDesde !== "") {
      query.set("valeDesde", valeDesde);
    }
    if (nota.trim() !== "") {
      query.set("nota", nota);
    }
    return rotaDeGestao(`/api/fornecedores/anexos?${query.toString()}`);
  }

  function mostrarRecusa(frase: string) {
    const campo = CAMPO_DA_FRASE.get(frase);
    if (campo) {
      setErros({ [campo]: frase });
      campos.current[campo]?.focus();
      return;
    }
    setRecusa({ frase, sessao: false });
  }

  async function guardar() {
    if (enviandoAgora.current || arquivo === null || recusaDoCliente !== null) {
      return;
    }
    enviandoAgora.current = true;
    setEnviando(true);
    setRecusa(null);
    setErros({});

    let status = 0;
    let corpo: RespostaDoEnvio | null = null;
    try {
      const resposta = await fetch(enderecoDoEnvio(arquivo), { method: "PUT", body: arquivo });
      status = resposta.status;
      try {
        corpo = (await resposta.json()) as RespostaDoEnvio;
      } catch {
        corpo = null;
      }
    } catch {
      // `TypeError` do `fetch`: a rede caiu, ou a conexão foi cortada no meio do envio.
      status = 0;
    }

    enviandoAgora.current = false;
    setEnviando(false);

    if (status >= 200 && status < 300 && corpo?.ok) {
      aoGuardar();
      return;
    }
    if (status === 401) {
      // A sessão acabou: nada foi guardado, e o arquivo sai — o caminho é entrar de novo.
      setArquivo(null);
      trocarPrevia(null);
      setRecusa({ frase: FRASE_SESSAO_TERMINOU, sessao: true });
      return;
    }
    // Só a sessão vencida descarta o arquivo — 06.2-WR-01, 05/10/2026. Em toda outra falha ele e a
    // prévia FICAM: tocar "Guardar anexo" de novo basta. Num 5xx, a frase do servidor (sempre fixa, de
    // `lib/fornecedores/textos.ts` — T-06.2-24) quando ele a mandou; senão, a genérica.
    if (status >= 500 && corpo !== null && !corpo.ok && typeof corpo.erro === "string" && corpo.erro !== "") {
      setRecusa({ frase: corpo.erro, sessao: false });
      return;
    }
    if (status === 0 || status >= 500 || corpo === null || corpo.ok) {
      setRecusa({ frase: FRASE_FALHA_AO_ENVIAR, sessao: false });
      return;
    }
    mostrarRecusa(corpo.erro);
  }

  function erroDe(campo: CampoDoAnexo): ReactNode {
    const mensagem = erros[campo];
    if (mensagem === undefined) {
      return null;
    }
    return (
      <p id={`anexo-erro-${campo}`} role="alert" data-testid={`anexo-erro-${campo}`} className="text-apoio text-erro">
        {mensagem}
      </p>
    );
  }

  function conteudoDaZona(): ReactNode {
    if (enviando && arquivo !== null) {
      return (
        <div className="flex w-full flex-col items-center gap-2">
          <p className="[overflow-wrap:anywhere]">
            {fraseEnviando(arquivo.name, textoDoTamanho(arquivo.size))}
          </p>
          {/* Indeterminada (sem `aria-valuenow`): o `fetch` não informa progresso de envio (UI-D10).
              Com `prefers-reduced-motion`, a barra fica parada. */}
          <div
            role="progressbar"
            aria-label={ARIA_ENVIANDO_O_ARQUIVO}
            data-testid="anexo-progresso"
            className="bg-superficie-2 h-2 w-full overflow-hidden rounded-full"
          >
            <div className="bg-acento h-full w-full animate-pulse rounded-full motion-reduce:animate-none" />
          </div>
          <p className="text-tinta-fraca">{FRASE_NAO_FECHE_A_FOLHA}</p>
        </div>
      );
    }
    if (arquivo !== null && recusaDoCliente !== null) {
      // "Recusado (cliente)": a frase em `--color-erro`, o nome do arquivo em 600 quando a frase começa
      // por ele (as de tamanho); "Trocar arquivo" à mão.
      const comecaPeloNome = recusaDoCliente.startsWith(arquivo.name);
      return (
        <>
          <p role="alert" data-testid="anexo-recusa" className="text-erro [overflow-wrap:anywhere]">
            {comecaPeloNome ? (
              <>
                <span className="font-semibold">{arquivo.name}</span>
                {recusaDoCliente.slice(arquivo.name.length)}
              </>
            ) : (
              recusaDoCliente
            )}
          </p>
          <label htmlFor="anexo-arquivo" className={CLASSE_DO_ESCOLHER}>
            {ROTULO_TROCAR_ARQUIVO}
          </label>
        </>
      );
    }
    if (arquivo !== null) {
      return (
        <>
          <p className="[overflow-wrap:anywhere]" data-testid="anexo-escolhido">
            <span className="text-tinta font-semibold">{arquivo.name}</span>
            <span className="tabular-nums"> · {textoDoTamanho(arquivo.size)}</span>
          </p>
          <label htmlFor="anexo-arquivo" className={CLASSE_DO_ESCOLHER}>
            {ROTULO_TROCAR_ARQUIVO}
          </label>
        </>
      );
    }
    return (
      <>
        <label htmlFor="anexo-arquivo" className={CLASSE_DO_ESCOLHER}>
          {ROTULO_ESCOLHER_ARQUIVO}
        </label>
        <p>{DICA_ZONA_LIMITES}</p>
        <p className="text-tinta-fraca">{DICA_ZONA_ARRASTAR}</p>
      </>
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
      <DialogContent
        showCloseButton={false}
        data-testid="folha-anexo"
        aria-describedby={undefined}
        aria-busy={enviando ? "true" : undefined}
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          // A zona é o foco visual da folha; o foco do teclado vai a ela só a partir de 768 px (no
          // celular, focar o campo não abre nada, mas também não ajuda).
          if (window.matchMedia("(min-width: 768px)").matches) {
            campoDoArquivo.current?.focus();
          }
        }}
        // UI-D11: durante o envio, Esc e toque fora não fecham a folha.
        onEscapeKeyDown={(evento) => {
          if (enviandoAgora.current) {
            evento.preventDefault();
          }
        }}
        onInteractOutside={(evento) => {
          if (enviandoAgora.current) {
            evento.preventDefault();
          }
        }}
        className={CLASSE_DA_FOLHA}
      >
        <DialogHeader className="border-border flex flex-row items-start justify-between gap-4 border-b px-6 py-4">
          <DialogTitle className="text-titulo text-tinta min-w-0 break-words">{TITULO_FOLHA_ANEXO}</DialogTitle>
          {enviando ? null : (
            <button
              type="button"
              aria-label={ROTULO_FECHAR}
              data-testid="folha-anexo-fechar"
              onClick={fechar}
              className="hover:bg-muted text-tinta flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
            >
              <X aria-hidden="true" />
            </button>
          )}
        </DialogHeader>

        <form
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            // O diálogo vai para o <body> pelo portal, mas o `submit` do React sobe pela árvore do
            // React — parar aqui (molde CR-01 de `formulario-cliente.tsx`).
            evento.stopPropagation();
            void guardar();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            <div
              data-testid="anexo-zona"
              data-arrastando={arrastando ? "true" : undefined}
              onDragEnter={aoArrastarPorCima}
              onDragOver={aoArrastarPorCima}
              onDragLeave={() => setArrastando(false)}
              onDrop={aoSoltar}
              className={cn(
                "text-apoio text-tinta-media flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-4 text-center",
                arrastando ? "border-acento bg-acento-fundo" : "border-borda-forte bg-fundo",
              )}
            >
              <input
                ref={campoDoArquivo}
                id="anexo-arquivo"
                type="file"
                accept={ACEITA}
                disabled={enviando}
                className="peer sr-only"
                onChange={(evento) => {
                  const escolhido = evento.target.files?.[0];
                  // Limpa o valor: escolher o MESMO arquivo de novo (depois de uma recusa) dispara `change`.
                  evento.target.value = "";
                  if (escolhido) {
                    receber(escolhido);
                  }
                }}
              />
              {conteudoDaZona()}
            </div>

            {/* A prévia (só foto aceita; UI-SPEC item 2). `<img>` puro, de propósito: a URL é um `blob:`
                local, que o `next/image` não otimiza. O que o navegador não desenha (HEIC no Chrome)
                some pelo `onError`, sem mensagem. */}
            {arquivo !== null && previa !== null && !previaFalhou ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previa}
                alt={`Prévia de ${arquivo.name}`}
                data-testid="anexo-previa"
                onError={() => setPreviaFalhou(true)}
                className="border-border max-h-[220px] max-w-full self-center rounded-lg border object-contain"
              />
            ) : null}

            <div className="flex min-w-0 flex-col gap-2">
              <label htmlFor="anexo-nome" className={CLASSE_DO_ROTULO}>
                {ROTULO_NOME_DO_ANEXO}
              </label>
              <Input
                id="anexo-nome"
                ref={(elemento) => {
                  campos.current.nome = elemento;
                }}
                data-testid="anexo-nome"
                type="text"
                autoComplete="off"
                maxLength={TETO_DO_NOME_DO_ANEXO}
                placeholder={PLACEHOLDER_NOME_DO_ANEXO}
                aria-describedby={erros.nome !== undefined ? "anexo-erro-nome" : undefined}
                aria-invalid={erros.nome !== undefined}
                value={nome}
                onChange={(evento) => {
                  setNome(evento.target.value);
                  setErros((anteriores) => ({ ...anteriores, nome: undefined }));
                }}
                className={CLASSE_DO_CAMPO}
              />
              {erroDe("nome")}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor="anexo-tipo" className={CLASSE_DO_ROTULO}>
                  {ROTULO_TIPO_DO_ANEXO}
                </label>
                <Select
                  value={tipo}
                  onValueChange={(valor) => {
                    setTipo(valor as TipoDeAnexo);
                    setTipoTocado(true);
                    setErros((anteriores) => ({ ...anteriores, valeDesde: undefined }));
                  }}
                >
                  <SelectTrigger id="anexo-tipo" data-testid="anexo-tipo" className="text-corpo min-h-[44px] w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_DE_ANEXO.map((valorDoTipo) => (
                      <SelectItem key={valorDoTipo} value={valorDoTipo} className="text-corpo min-h-[44px]">
                        {ROTULOS_DOS_TIPOS[valorDoTipo]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* UI-D8: a data só aparece com Tipo = Tabela de preços (o banco a recusa fora dela). */}
              {tipo === "tabela" ? (
                <div className="flex min-w-0 flex-col gap-2">
                  <label htmlFor="anexo-vale-desde" className={CLASSE_DO_ROTULO}>
                    {ROTULO_VALE_A_PARTIR_DE}
                  </label>
                  <Input
                    id="anexo-vale-desde"
                    ref={(elemento) => {
                      campos.current.valeDesde = elemento;
                    }}
                    data-testid="anexo-vale-desde"
                    type="date"
                    aria-describedby={erros.valeDesde !== undefined ? "anexo-erro-valeDesde" : undefined}
                    aria-invalid={erros.valeDesde !== undefined}
                    value={valeDesde}
                    onChange={(evento) => {
                      setValeDesde(evento.target.value);
                      setErros((anteriores) => ({ ...anteriores, valeDesde: undefined }));
                    }}
                    className={CLASSE_DO_CAMPO}
                  />
                  {erroDe("valeDesde")}
                </div>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <label htmlFor="anexo-nota" className={CLASSE_DO_ROTULO}>
                {ROTULO_NOTA_CURTA}
              </label>
              <Input
                id="anexo-nota"
                ref={(elemento) => {
                  campos.current.nota = elemento;
                }}
                data-testid="anexo-nota"
                type="text"
                autoComplete="off"
                maxLength={TETO_DA_NOTA_DO_ANEXO}
                placeholder={PLACEHOLDER_NOTA_CURTA}
                aria-describedby={erros.nota !== undefined ? "anexo-erro-nota" : undefined}
                aria-invalid={erros.nota !== undefined}
                value={nota}
                onChange={(evento) => {
                  setNota(evento.target.value);
                  setErros((anteriores) => ({ ...anteriores, nota: undefined }));
                }}
                className={CLASSE_DO_CAMPO}
              />
              {erroDe("nota")}
            </div>

            <p className="text-apoio text-tinta-fraca">{DICA_BACKUP_DO_ANEXO}</p>
          </div>

          {/* Rodapé preso por flex, fora da área rolável: a recusa do servidor + "Voltar" · o primário. */}
          <div className="border-border bg-popover flex flex-col gap-2 border-t px-6 py-4">
            {recusa ? (
              <p role="alert" data-testid="anexo-erro" className="text-apoio text-erro">
                {recusa.frase}
                {recusa.sessao ? (
                  <>
                    {" "}
                    <a
                      href={rotaDeGestao("/login")}
                      data-testid="anexo-entrar-de-novo"
                      className="text-acento font-semibold underline underline-offset-2"
                    >
                      {ROTULO_ENTRAR_DE_NOVO}
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                data-testid="anexo-voltar"
                disabled={enviando}
                onClick={fechar}
                className="text-corpo h-auto min-h-[52px] px-6 font-semibold"
              >
                {ROTULO_VOLTAR}
              </Button>
              <Button
                type="submit"
                data-testid="anexo-guardar"
                disabled={enviando || arquivo === null || recusaDoCliente !== null}
                aria-busy={enviando ? "true" : undefined}
                className="text-corpo h-auto min-h-[52px] flex-1 px-6 font-semibold whitespace-normal"
              >
                {enviando ? ROTULO_ENVIANDO : ROTULO_GUARDAR_ANEXO}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
