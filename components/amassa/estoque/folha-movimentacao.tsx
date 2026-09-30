"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";

import { ROTULO_UNIDADE } from "@/lib/cadastros/catalogo";
import { converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { formatarReais } from "@/lib/financeiro/formato";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { registrarMovimentacao } from "@/lib/estoque/acoes";
import type { EncomendaParaVinculo, SaldoDoItem } from "@/lib/estoque/consultas";
import { DESTINOS_DE_SAIDA, type DestinoDeSaida } from "@/lib/estoque/destinos";
import { contadoParaMilesimos, textoParaMilesimos } from "@/lib/estoque/esquemas";
import { atalhosDaUnidade, custoPreenchidoDaPecaPronta } from "@/lib/estoque/saldo";
import {
  DICA_CAFETERIA,
  DICA_CUSTO,
  DICA_DESTINO,
  DICA_MOTIVO_AJUSTE,
  DICA_VINCULO_OPCIONAL,
  DICA_VINCULO_ORDEM,
  FRASE_CONTADO_VAZIO,
  FRASE_CUSTO_OBRIGATORIO,
  FRASE_DESTINO_OBRIGATORIO,
  FRASE_ORDEM_FORA_DE_ANDAMENTO,
  FRASE_FALHA_AO_REGISTRAR,
  FRASE_QUANTIDADE_INVALIDA,
  FRASE_QUANTIDADE_ZERO,
  FRASE_VINCULO_LONGO,
  LIMITE_DO_VINCULO,
  NOTA_COMPRA_NO_FINANCEIRO,
  OPCAO_NENHUMA_ENCOMENDA,
  PLACEHOLDER_MOTIVO_AJUSTE,
  ROTULO_AJUSTE,
  ROTULO_CONTADO,
  ROTULO_CUSTO,
  ROTULO_DESTINO,
  ROTULO_ENTRADA,
  ROTULO_IR_PARA_COMPRA,
  ROTULO_MOTIVO_AJUSTE,
  ROTULO_O_QUE_ACONTECEU,
  ROTULO_QUANTIDADE,
  ROTULO_REGISTRANDO,
  ROTULO_REGISTRAR_MOVIMENTACAO,
  ROTULO_SAIDA,
  ROTULO_TROCAR_MATERIAL,
  ROTULO_VINCULO_ENCOMENDA,
  ROTULO_VINCULO_O_QUE_ACONTECEU,
  ROTULO_VINCULO_TURMA,
  TOAST_CONFERIDO,
  dicaCustoPecaPronta,
  dicaDaQuantidade,
  dicaDoContado,
  rotuloDoAtalho,
  rotuloDoBotaoDeGravar,
  textoSaldoDeAgora,
  textoToastAjuste,
  textoToastBaixa,
  textoToastEntrada,
} from "@/lib/estoque/textos";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { formatarMilesimos } from "./cartao-saldo";
import { GradeDestinos } from "./grade-destinos";
import { PreviaDoSaldo } from "./previa-do-saldo";
import type { TipoDeMovimentacao } from "./provedor-estoque";

// O contêiner das folhas do Estoque (movimentação e seletor): o `Dialog` do projeto (padrão de
// `formulario-forno.tsx`) — tela toda no celular (`h-[100dvh]`, desliza de baixo), modal
// centralizado `max-w-lg` a partir de `md`. Rodapé preso por flex, nunca `position: sticky`.
export const CLASSE_DA_FOLHA = cn(
  "inset-x-0 top-auto bottom-0 left-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none rounded-t-none border-0 border-t p-0 data-open:slide-in-from-bottom-10 data-open:zoom-in-100 data-closed:slide-out-to-bottom-10 data-closed:zoom-out-100",
  "md:top-1/2 md:right-auto md:bottom-auto md:left-1/2 md:h-auto md:max-h-[85svh] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border md:data-open:zoom-in-95 md:data-closed:zoom-out-95",
);

type CampoDaFolha =
  | "quantidade"
  | "contado"
  | "custo"
  | "destino"
  | "vinculo"
  | "motivo"
  | "geral";

// Um erro por vez, embaixo do campo a que se refere (UI-D9 — nunca toast); o `geral` fica no topo
// do rodapé (falha ao gravar, material desativado no meio do caminho).
type ErroDaFolha = { campo: CampoDaFolha; mensagem: string };

export type FolhaMovimentacaoProps = {
  saldo: SaldoDoItem;
  tipoInicial: TipoDeMovimentacao;
  // As ordens de produção aguardando o sinal ou em andamento, carregadas com a página
  // (`listarEncomendasParaVinculo`) — o vínculo "Qual ordem?" do destino "Consumo em encomenda".
  encomendas: readonly EncomendaParaVinculo[];
  // Custo por peça pela ficha de precificação (`custosDasPecasProntas`); `null` = sem ficha, ou
  // ficha sem custo calculável — o custo vem vazio e obrigatório (D-22).
  custoPorPecaCentavos: number | null;
  aoTrocarMaterial: (tipo: TipoDeMovimentacao) => void;
  aoFechar: () => void;
};

const TIPOS: readonly { valor: TipoDeMovimentacao; rotulo: string }[] = [
  { valor: "entrada", rotulo: ROTULO_ENTRADA },
  { valor: "saida", rotulo: ROTULO_SAIDA },
  { valor: "ajuste", rotulo: ROTULO_AJUSTE },
];

// Milésimos inteiros → o texto que VAI PARA O CAMPO ("12", "2,5") — sem separador de milhar: o
// "1.000" de `formatarQuantidade` voltaria como 1 pela conversão do campo.
export function milesimosParaCampo(milesimos: number): string {
  const inteiro = Math.trunc(milesimos / 1000);
  const resto = milesimos % 1000;
  if (resto === 0) {
    return String(inteiro);
  }
  return `${inteiro},${String(resto).padStart(3, "0").replace(/0+$/, "")}`;
}

// Centavos → "12,34" para o campo de custo (sem "R$" e sem milhar — a conversão aceita os dois,
// mas o campo fica mais fácil de editar assim).
function centavosParaCampo(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

// Texto livre curto: o mesmo corte do servidor (NFC, aparado, contado em pontos de código).
function textoLongoDemais(texto: string): boolean {
  return [...texto.normalize("NFC").trim()].length > LIMITE_DO_VINCULO;
}

// A dica e, quando há, o erro do campo — os dois lidos pelo leitor de tela (`aria-describedby`).
function juntarIds(...ids: (string | undefined)[]): string {
  return ids.filter(Boolean).join(" ");
}

// A folha de movimentação inteira (UI-SPEC §"Folha de movimentação"): caixa "escolhido" com
// "Trocar material"; segmentado Entrada · Saída · Ajuste; o campo grande (quantidade, ou o CONTADO
// no ajuste — EST-07, nunca a diferença); os atalhos que somam ao campo; por tipo, a nota da compra
// e o custo (Entrada), os cinco destinos e o vínculo (Saída) ou "Por quê?" (Ajuste); e o rodapé
// preso com a prévia "o saldo passa de X para Y" e o botão que diz o que vai gravar.
//
// Orçamento de toques (EST-09), a partir da aba Saldos: "Dar baixa" (abre em Saída, material
// escolhido, SEM teclado) → atalho "+1" → um destino → "Registrar baixa" (no rodapé, sempre
// visível). Saída que deixa negativo não pede confirmação: avisa na prévia e grava (D-06).
//
// Quem abre (o `ProvedorDoEstoque`) a monta com `key` nova a cada abertura: nasce limpa. Trocar de
// tipo PRESERVA o que foi digitado em cada tipo. Nenhum foco automático abaixo de 768px (UI-D13).
export function FolhaMovimentacao({
  saldo,
  tipoInicial,
  encomendas,
  custoPorPecaCentavos,
  aoTrocarMaterial,
  aoFechar,
}: FolhaMovimentacaoProps) {
  const router = useRouter();

  const [tipo, setTipo] = useState<TipoDeMovimentacao>(tipoInicial);
  const [quantidades, setQuantidades] = useState<Record<"entrada" | "saida", string>>({
    entrada: "",
    saida: "",
  });
  // `null` = a pessoa ainda não mexeu no custo: na peça pronta ele segue a quantidade (EST-21 ·
  // idempotency). Depois do primeiro toque no campo, fica o que ela digitou.
  const [custoDigitado, setCustoDigitado] = useState<string | null>(null);
  const [destino, setDestino] = useState<DestinoDeSaida | null>(null);
  const [turmaTexto, setTurmaTexto] = useState("");
  const [encomendaId, setEncomendaId] = useState("");
  const [oQueAconteceuTexto, setOQueAconteceuTexto] = useState("");
  const [contadoTexto, setContadoTexto] = useState("");
  const [motivoTexto, setMotivoTexto] = useState("");
  const [erro, setErro] = useState<ErroDaFolha | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Guarda síncrona contra o toque duplo (T-06-56): o `disabled` do botão só vale depois do
  // próximo desenho; a referência vale já no segundo clique do mesmo gesto.
  const emVoo = useRef(false);
  const botoesDeTipo = useRef<Partial<Record<TipoDeMovimentacao, HTMLButtonElement | null>>>({});
  const campos = useRef<Partial<Record<CampoDaFolha, HTMLElement | null>>>({});

  const unidade = ROTULO_UNIDADE[saldo.unidade];
  const ehPecaPronta = saldo.ehPecaPronta;
  const destinoMarcado = DESTINOS_DE_SAIDA.find((opcao) => opcao.valor === destino) ?? null;

  const quantidadeTexto = tipo === "ajuste" ? "" : quantidades[tipo];
  const quantidadeEntrada = textoParaMilesimos(quantidades.entrada);
  const quantidadeSaida = textoParaMilesimos(quantidades.saida);
  const contado = contadoParaMilesimos(contadoTexto);

  // O custo da peça pronta com ficha: custo da peça × quantidade, até a pessoa editar (D-22).
  const custoPreenchido =
    custoPorPecaCentavos !== null && quantidadeEntrada.ok
      ? centavosParaCampo(
          custoPreenchidoDaPecaPronta({
            custoPorPecaCentavos,
            quantidadeMilesimos: quantidadeEntrada.milesimos,
          }),
        )
      : "";
  const custoTexto = custoDigitado ?? custoPreenchido;
  const custo = converterReaisParaCentavos(custoTexto);

  function registrarCampo(campo: CampoDaFolha) {
    return (elemento: HTMLElement | null) => {
      campos.current[campo] = elemento;
    };
  }

  // O erro aparece embaixo do campo e o foco vai até ele (UI-D9) — nunca num toast.
  function mostrarErro(novo: ErroDaFolha) {
    setErro(novo);
    if (novo.campo === "geral") {
      return;
    }
    window.requestAnimationFrame(() => {
      const alvo =
        novo.campo === "destino"
          ? campos.current.destino?.querySelector<HTMLElement>('[tabindex="0"]')
          : campos.current[novo.campo];
      alvo?.focus();
    });
  }

  function limparErroDe(campo: CampoDaFolha) {
    if (erro?.campo === campo) {
      setErro(null);
    }
  }

  function escolherTipo(novo: TipoDeMovimentacao) {
    setTipo(novo);
    setErro(null);
  }

  // Setas do teclado movem a escolha no segmentado (padrão de `radiogroup`).
  function aoTeclarNoTipo(evento: KeyboardEvent<HTMLButtonElement>) {
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
    const indice = TIPOS.findIndex((opcao) => opcao.valor === tipo);
    const novo = TIPOS[(indice + passo + TIPOS.length) % TIPOS.length].valor;
    escolherTipo(novo);
    botoesDeTipo.current[novo]?.focus();
  }

  function mudarQuantidade(valor: string) {
    if (tipo === "ajuste") {
      return;
    }
    setQuantidades((atuais) => ({ ...atuais, [tipo]: valor }));
    limparErroDe("quantidade");
  }

  // Os atalhos SOMAM ao que já está no campo (herdado); campo vazio ou ilegível conta como zero.
  function somarAtalho(unidades: number) {
    if (tipo === "ajuste") {
      return;
    }
    const atual = textoParaMilesimos(quantidades[tipo]);
    const base = atual.ok ? atual.milesimos : 0;
    mudarQuantidade(milesimosParaCampo(base + unidades * 1000));
  }

  function validarNoCliente(): ErroDaFolha | null {
    if (tipo === "ajuste") {
      if (!contado.ok) {
        return { campo: "contado", mensagem: contado.erro };
      }
      if (textoLongoDemais(motivoTexto)) {
        return { campo: "motivo", mensagem: FRASE_VINCULO_LONGO };
      }
      return null;
    }
    const quantidade = tipo === "entrada" ? quantidadeEntrada : quantidadeSaida;
    if (!quantidade.ok) {
      return { campo: "quantidade", mensagem: quantidade.erro };
    }
    if (tipo === "entrada") {
      if (!custo.ok) {
        return { campo: "custo", mensagem: custo.erro };
      }
      // Peça pronta de graça derrubaria o custo médio das outras (EST-21) — o servidor recusa
      // igual; aqui só se avisa antes.
      if (custo.centavos === null || (ehPecaPronta && custo.centavos === 0)) {
        return { campo: "custo", mensagem: FRASE_CUSTO_OBRIGATORIO };
      }
      return null;
    }
    if (destino === null) {
      return { campo: "destino", mensagem: FRASE_DESTINO_OBRIGATORIO };
    }
    const textoDoVinculo =
      destinoMarcado?.vinculo === "turma"
        ? turmaTexto
        : destinoMarcado?.vinculo === "o-que-aconteceu"
          ? oQueAconteceuTexto
          : "";
    if (textoLongoDemais(textoDoVinculo)) {
      return { campo: "vinculo", mensagem: FRASE_VINCULO_LONGO };
    }
    return null;
  }

  // A resposta do servidor volta como UMA frase; as conhecidas vão para baixo do campo delas.
  function campoDaFraseDoServidor(mensagem: string): CampoDaFolha {
    if (mensagem === FRASE_CUSTO_OBRIGATORIO) return "custo";
    if (mensagem === FRASE_DESTINO_OBRIGATORIO) return "destino";
    if (mensagem === FRASE_ORDEM_FORA_DE_ANDAMENTO) return "vinculo";
    if (mensagem === FRASE_CONTADO_VAZIO) return tipo === "ajuste" ? "contado" : "geral";
    if (mensagem === FRASE_VINCULO_LONGO) return tipo === "ajuste" ? "motivo" : "vinculo";
    if (mensagem === FRASE_QUANTIDADE_ZERO || mensagem === FRASE_QUANTIDADE_INVALIDA) {
      return tipo === "ajuste" ? "contado" : "quantidade";
    }
    return "geral";
  }

  function pedido() {
    if (tipo === "entrada") {
      return { tipo, itemId: saldo.id, quantidadeTexto: quantidades.entrada, custoTexto };
    }
    if (tipo === "saida") {
      return {
        tipo,
        itemId: saldo.id,
        quantidadeTexto: quantidades.saida,
        destino,
        turmaTexto,
        encomendaId,
        oQueAconteceuTexto,
      };
    }
    return { tipo, itemId: saldo.id, contadoTexto, motivoTexto };
  }

  async function registrar() {
    if (emVoo.current) {
      return;
    }
    const erroDoCliente = validarNoCliente();
    if (erroDoCliente) {
      mostrarErro(erroDoCliente);
      return;
    }

    emVoo.current = true;
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await registrarMovimentacao(pedido());
      if (!resposta.ok) {
        // A folha continua aberta e preenchida — nada do que foi digitado se perde.
        mostrarErro({ campo: campoDaFraseDoServidor(resposta.erro), mensagem: resposta.erro });
        return;
      }

      // O toast conta o que foi GRAVADO, lido sob a trava no servidor — se alguém mexeu no saldo
      // entre abrir e gravar, a verdade é esta, não a prévia (T-06-54).
      const gravada = resposta.dados;
      if (gravada.conferido) {
        toast.success(TOAST_CONFERIDO);
        aoFechar();
        return;
      }
      const unidadeGravada = ROTULO_UNIDADE[gravada.unidade];
      const quantidade = formatarMilesimos(Math.abs(gravada.quantidadeMilesimos));
      if (gravada.tipo === "saida") {
        toast.success(
          textoToastBaixa({
            quantidade,
            unidade: unidadeGravada,
            nome: gravada.nome,
            saldoNegativo:
              gravada.saldoDepoisMilesimos < 0
                ? formatarMilesimos(gravada.saldoDepoisMilesimos)
                : null,
          }),
        );
      } else if (gravada.tipo === "entrada") {
        toast.success(textoToastEntrada({ quantidade, unidade: unidadeGravada, nome: gravada.nome }));
      } else {
        toast.success(
          textoToastAjuste({
            nome: gravada.nome,
            diferenca:
              gravada.quantidadeMilesimos > 0
                ? `+${quantidade}`
                : formatarMilesimos(gravada.quantidadeMilesimos),
            unidade: unidadeGravada,
          }),
        );
      }
      aoFechar();
      router.refresh();
    } catch (falha) {
      console.error("Falha ao registrar movimentação:", falha);
      setErro({ campo: "geral", mensagem: FRASE_FALHA_AO_REGISTRAR });
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
  }

  function idDoErro(campo: CampoDaFolha) {
    return erro?.campo === campo ? `folha-erro-${campo}` : undefined;
  }

  function mensagemDe(campo: CampoDaFolha) {
    if (erro?.campo !== campo) {
      return null;
    }
    return (
      <p
        id={`folha-erro-${campo}`}
        role="alert"
        data-testid="folha-erro"
        className="text-apoio text-erro"
      >
        {erro.mensagem}
      </p>
    );
  }

  const classeDoCampoGrande = "text-display md:text-display h-[60px] text-center tabular-nums";
  const classeDoCampo = "text-corpo md:text-corpo min-h-[44px]";

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
        data-testid="folha-movimentacao"
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          if (window.matchMedia("(min-width: 768px)").matches) {
            (tipoInicial === "ajuste" ? campos.current.contado : campos.current.quantidade)?.focus();
          }
        }}
        className={CLASSE_DA_FOLHA}
      >
        <DialogHeader className="border-border flex flex-row items-start justify-between gap-4 border-b px-6 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="text-titulo text-tinta">
              {ROTULO_REGISTRAR_MOVIMENTACAO}
            </DialogTitle>
            <DialogDescription className="text-apoio text-tinta-fraca break-words">
              {saldo.nome}
            </DialogDescription>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            data-testid="folha-fechar"
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
            void registrar();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
            {/* Caixa "escolhido": o material, o saldo de agora e a volta ao seletor. */}
            <div
              data-testid="folha-escolhido"
              className="bg-superficie-2 flex flex-wrap items-center justify-between gap-3 rounded-lg p-4"
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-corpo text-tinta font-semibold break-words">{saldo.nome}</span>
                <span className="text-apoio text-tinta-media tabular-nums">
                  {textoSaldoDeAgora(formatarMilesimos(saldo.saldoMilesimos), unidade)}
                </span>
              </div>
              <button
                type="button"
                data-testid="folha-trocar-material"
                disabled={enviando}
                onClick={() => aoTrocarMaterial(tipo)}
                className="border-borda-forte bg-superficie text-tinta hover:bg-superficie-2 text-corpo min-h-[44px] shrink-0 rounded-md border px-4 font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              >
                {ROTULO_TROCAR_MATERIAL}
              </button>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend id="folha-tipo-rotulo" className="text-corpo text-tinta mb-2 font-semibold">
                {ROTULO_O_QUE_ACONTECEU}
              </legend>
              <div
                role="radiogroup"
                aria-labelledby="folha-tipo-rotulo"
                className="grid grid-cols-3 gap-2"
              >
                {TIPOS.map((opcao) => {
                  const marcado = tipo === opcao.valor;
                  return (
                    <button
                      key={opcao.valor}
                      ref={(elemento) => {
                        botoesDeTipo.current[opcao.valor] = elemento;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={marcado}
                      tabIndex={marcado ? 0 : -1}
                      data-testid={`folha-tipo-${opcao.valor}`}
                      onClick={() => escolherTipo(opcao.valor)}
                      onKeyDown={aoTeclarNoTipo}
                      className={cn(
                        "text-corpo min-h-[52px] rounded-md border px-2 font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
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

            {/* Entrada de material comum: compra de verdade se lança no Financeiro (UI-D14) — a
                entrada manual não vai ao Caixa, e lançada nos dois lugares entra em dobro. */}
            {tipo === "entrada" && !ehPecaPronta ? (
              <p
                data-testid="folha-nota-compra"
                className="text-apoio text-tinta-media bg-superficie-2 border-borda rounded-md border p-4"
              >
                {NOTA_COMPRA_NO_FINANCEIRO}{" "}
                <Link
                  href={rotaDeGestao("/financeiro?aba=despesa")}
                  className="text-acento inline-flex min-h-[44px] items-center font-semibold underline underline-offset-4 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                >
                  {ROTULO_IR_PARA_COMPRA}
                </Link>
              </p>
            ) : null}

            {tipo === "ajuste" ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="folha-contado" className="text-corpo text-tinta font-semibold">
                  {ROTULO_CONTADO}
                </label>
                <p id="folha-contado-dica" className="text-apoio text-tinta-fraca">
                  {dicaDoContado(unidade)}
                </p>
                <Input
                  id="folha-contado"
                  ref={registrarCampo("contado")}
                  data-testid="folha-contado"
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoComplete="off"
                  aria-describedby={juntarIds("folha-contado-dica", idDoErro("contado"))}
                  aria-invalid={erro?.campo === "contado"}
                  value={contadoTexto}
                  onChange={(evento) => {
                    setContadoTexto(evento.target.value);
                    limparErroDe("contado");
                  }}
                  className={classeDoCampoGrande}
                />
                {mensagemDe("contado")}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label htmlFor="folha-quantidade" className="text-corpo text-tinta font-semibold">
                  {ROTULO_QUANTIDADE}
                </label>
                <p id="folha-quantidade-dica" className="text-apoio text-tinta-fraca">
                  {dicaDaQuantidade(unidade)}
                </p>
                <Input
                  id="folha-quantidade"
                  ref={registrarCampo("quantidade")}
                  data-testid="folha-quantidade"
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoComplete="off"
                  aria-describedby={juntarIds("folha-quantidade-dica", idDoErro("quantidade"))}
                  aria-invalid={erro?.campo === "quantidade"}
                  value={quantidadeTexto}
                  onChange={(evento) => mudarQuantidade(evento.target.value)}
                  className={classeDoCampoGrande}
                />
                {mensagemDe("quantidade")}
                <div className="flex flex-wrap gap-2" data-testid="folha-atalhos">
                  {atalhosDaUnidade(saldo.unidade).map((valor) => (
                    <button
                      key={valor}
                      type="button"
                      data-testid="folha-atalho"
                      data-valor={valor}
                      aria-label={rotuloDoAtalho(String(valor), unidade)}
                      onClick={() => somarAtalho(valor)}
                      className="border-borda-forte bg-superficie-2 text-tinta-media hover:bg-acento-fundo hover:border-acento hover:text-acento text-apoio min-h-[44px] rounded-full border px-4 font-semibold tabular-nums focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                    >
                      +{valor}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tipo === "entrada" ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="folha-custo" className="text-corpo text-tinta font-semibold">
                  {ROTULO_CUSTO}
                </label>
                <p id="folha-custo-dica" data-testid="folha-custo-dica" className="text-apoio text-tinta-fraca">
                  {custoPorPecaCentavos !== null
                    ? dicaCustoPecaPronta(formatarReais(custoPorPecaCentavos))
                    : DICA_CUSTO}
                </p>
                <Input
                  id="folha-custo"
                  ref={registrarCampo("custo")}
                  data-testid="folha-custo"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="R$ 0,00"
                  aria-describedby={juntarIds("folha-custo-dica", idDoErro("custo"))}
                  aria-invalid={erro?.campo === "custo"}
                  value={custoTexto}
                  onChange={(evento) => {
                    setCustoDigitado(evento.target.value);
                    limparErroDe("custo");
                  }}
                  className={cn(classeDoCampo, "tabular-nums")}
                />
                {mensagemDe("custo")}
              </div>
            ) : null}

            {tipo === "saida" ? (
              <div className="flex flex-col gap-2">
                <p id="folha-destino-rotulo" className="text-corpo text-tinta font-semibold">
                  {ROTULO_DESTINO}
                </p>
                <p id="folha-destino-dica" className="text-apoio text-tinta-fraca">
                  {DICA_DESTINO}
                </p>
                <div ref={registrarCampo("destino")}>
                  <GradeDestinos
                    destino={destino}
                    aoMudar={(novo) => {
                      setDestino(novo);
                      limparErroDe("destino");
                      limparErroDe("vinculo");
                    }}
                    rotuloId="folha-destino-rotulo"
                    dicaId={juntarIds("folha-destino-dica", idDoErro("destino"))}
                    invalida={erro?.campo === "destino"}
                  />
                </div>
                {mensagemDe("destino")}

                {destinoMarcado?.vinculo === "turma" ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <label htmlFor="folha-vinculo-turma" className="text-corpo text-tinta font-semibold">
                      {ROTULO_VINCULO_TURMA}
                    </label>
                    <p id="folha-vinculo-turma-dica" className="text-apoio text-tinta-fraca">
                      {DICA_VINCULO_OPCIONAL}
                    </p>
                    <Input
                      id="folha-vinculo-turma"
                      ref={registrarCampo("vinculo")}
                      data-testid="folha-vinculo-turma"
                      autoComplete="off"
                      aria-describedby={juntarIds("folha-vinculo-turma-dica", idDoErro("vinculo"))}
                      aria-invalid={erro?.campo === "vinculo"}
                      value={turmaTexto}
                      onChange={(evento) => {
                        setTurmaTexto(evento.target.value);
                        limparErroDe("vinculo");
                      }}
                      className={classeDoCampo}
                    />
                  </div>
                ) : null}

                {destinoMarcado?.vinculo === "encomenda" ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <label
                      htmlFor="folha-vinculo-encomenda"
                      className="text-corpo text-tinta font-semibold"
                    >
                      {ROTULO_VINCULO_ENCOMENDA}
                    </label>
                    <p id="folha-vinculo-encomenda-dica" className="text-apoio text-tinta-fraca">
                      {DICA_VINCULO_ORDEM}
                    </p>
                    <select
                      id="folha-vinculo-encomenda"
                      ref={registrarCampo("vinculo")}
                      data-testid="folha-vinculo-encomenda"
                      aria-describedby={juntarIds("folha-vinculo-encomenda-dica", idDoErro("vinculo"))}
                      aria-invalid={erro?.campo === "vinculo"}
                      value={encomendaId}
                      onChange={(evento) => {
                        setEncomendaId(evento.target.value);
                        limparErroDe("vinculo");
                      }}
                      className="border-input bg-superficie text-corpo text-tinta min-h-[44px] w-full rounded-md border px-3 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <option value="">{OPCAO_NENHUMA_ENCOMENDA}</option>
                      {encomendas.map((encomenda) => (
                        <option key={encomenda.id} value={encomenda.id}>
                          {encomenda.rotulo}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {destinoMarcado?.vinculo === "o-que-aconteceu" ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <label htmlFor="folha-vinculo-perda" className="text-corpo text-tinta font-semibold">
                      {ROTULO_VINCULO_O_QUE_ACONTECEU}
                    </label>
                    <p id="folha-vinculo-perda-dica" className="text-apoio text-tinta-fraca">
                      {DICA_VINCULO_OPCIONAL}
                    </p>
                    <Input
                      id="folha-vinculo-perda"
                      ref={registrarCampo("vinculo")}
                      data-testid="folha-vinculo-perda"
                      autoComplete="off"
                      aria-describedby={juntarIds("folha-vinculo-perda-dica", idDoErro("vinculo"))}
                      aria-invalid={erro?.campo === "vinculo"}
                      value={oQueAconteceuTexto}
                      onChange={(evento) => {
                        setOQueAconteceuTexto(evento.target.value);
                        limparErroDe("vinculo");
                      }}
                      className={classeDoCampo}
                    />
                  </div>
                ) : null}
                {mensagemDe("vinculo")}

                {destino === "cafeteria" ? (
                  <p data-testid="folha-dica-cafeteria" className="text-apoio text-tinta-media">
                    {DICA_CAFETERIA}
                  </p>
                ) : null}
              </div>
            ) : null}

            {tipo === "ajuste" ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="folha-motivo" className="text-corpo text-tinta font-semibold">
                  {ROTULO_MOTIVO_AJUSTE}
                </label>
                <p id="folha-motivo-dica" className="text-apoio text-tinta-fraca">
                  {DICA_MOTIVO_AJUSTE}
                </p>
                <Input
                  id="folha-motivo"
                  ref={registrarCampo("motivo")}
                  data-testid="folha-motivo"
                  autoComplete="off"
                  placeholder={PLACEHOLDER_MOTIVO_AJUSTE}
                  aria-describedby={juntarIds("folha-motivo-dica", idDoErro("motivo"))}
                  aria-invalid={erro?.campo === "motivo"}
                  value={motivoTexto}
                  onChange={(evento) => {
                    setMotivoTexto(evento.target.value);
                    limparErroDe("motivo");
                  }}
                  className={classeDoCampo}
                />
                {mensagemDe("motivo")}
              </div>
            ) : null}
          </div>

          {/* Rodapé preso por FLEX, fora da área rolável, nunca `position: sticky` (G-03-1): o
              erro de gravação no topo, a prévia e o botão — sempre visíveis (toque 4 do EST-09). */}
          <div className="border-border bg-popover flex flex-col gap-3 border-t px-6 py-4">
            {mensagemDe("geral")}
            <PreviaDoSaldo
              entrada={{
                tipo,
                unidade: saldo.unidade,
                saldoMilesimos: saldo.saldoMilesimos,
                valorCentavos: saldo.valorCentavos,
                ultimaEntradaComPreco: saldo.ultimaEntradaComPreco,
                minimoMilesimos: saldo.estoqueMinimoMilesimos,
                quantidadeMilesimos:
                  tipo === "entrada"
                    ? quantidadeEntrada.ok
                      ? quantidadeEntrada.milesimos
                      : null
                    : tipo === "saida" && quantidadeSaida.ok
                      ? quantidadeSaida.milesimos
                      : null,
                contadoMilesimos: contado.ok ? contado.milesimos : null,
                custoCentavos: custo.ok ? custo.centavos : null,
              }}
            />
            <button
              type="submit"
              data-testid="folha-registrar"
              disabled={enviando}
              aria-busy={enviando}
              className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[52px] w-full items-center justify-center rounded-md px-4 font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? ROTULO_REGISTRANDO : rotuloDoBotaoDeGravar(tipo)}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
