"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Lock } from "lucide-react";
import { toast } from "sonner";

import { ROTULO_VER_NO_CAIXA } from "@/lib/agenda/textos";
import { formatarReais } from "@/lib/financeiro/formato";
import { hrefDoCaixa } from "@/lib/financeiro/navegacao";
import { salvarContagem } from "@/lib/queimas/acoes";
import type { DadosDaFolha } from "@/lib/queimas/consultas";
import {
  CONTAGEM_VAZIA,
  chaveDoTamanho,
  diaMes,
  externasDaContagem,
  lancadoAtivo,
  mesmaContagem,
  precosDosItens,
  somarChip,
  totalDaContagem,
  totalDasExternas,
  totalDasQuantidades,
  ultimaContagemDoMesmoTipo,
  valorDasExternas,
  type ChaveDoContador,
  type ChipDaOrdem,
  type Contagem,
  type Tamanho,
  type VendaLigada,
} from "@/lib/queimas/contagem";
import { diaCivilEmBrasilia } from "@/lib/queimas/formato";
import {
  DICA_EXTERNAS,
  DICA_INTERNAS,
  DICA_SAIU_CHEIO,
  FRASE_FALHA_AO_SALVAR_CONTAGEM,
  FRASE_QUEIMA_DESFEITA_NADA_CONTADO,
  ROTULO_EXTERNAS,
  ROTULO_FECHAR_SEM_SALVAR,
  ROTULO_INTERNAS,
  ROTULO_PULAR,
  ROTULO_SAIU_CHEIO,
  ROTULO_SALVANDO,
  ROTULO_CHIPS,
  ROTULO_NAO_SOMAR_AGORA,
  ROTULO_REPETIR_A_ULTIMA,
  ROTULO_SALVAR,
  SUFIXO_SOMADO,
  TITULO_FOLHA_CONTAGEM,
  ariaDoChip,
  ariaDoTamanhoDaPergunta,
  dicaDoRepetir,
  dicaSemAnterior,
  faixasDaRegua,
  fraseAbaixoDoLancado,
  fraseDaReguaNaFolha,
  fraseExternasLancadas,
  faltaOPrecoDe,
  perguntaDoTamanho,
  resumoDaContagem,
  subtituloDaFolha,
  textoDoChip,
  tituloDaQueima,
  toastContagemCorrigida,
  toastContagemSalva,
  type GrupoDoContador,
  type TipoDeQueima,
} from "@/lib/queimas/textos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CLASSE_DA_FOLHA } from "@/components/amassa/estoque/folha-movimentacao";

import { ConfirmarApagarContagem } from "./confirmar-apagar-contagem";
import { ContadorTamanho } from "./contador-tamanho";

// O que a folha precisa saber da queima — exatamente o que `registrarQueima` já devolve (e o tipo que
// acabou de ser tocado). Nada é buscado no servidor para abrir a folha (U05): ela abre no cliente, no
// mesmo ponto do toast.
export type QueimaParaContar = {
  id: string;
  tipo: TipoDeQueima;
  ocorridaEm: string;
};

export type FolhaContagemProps = {
  // `null` = folha fechada.
  queima: QueimaParaContar | null;
  aoFechar: () => void;
  // Pré-carregados pela página (régua vigente, se a casa tem mais de um forno). Quem abre a folha
  // não a abre sem eles (UI-D19).
  dados: DadosDaFolha;
  nomeDoForno: string;
  // O forno da queima — "Repetir a última" copia a última fornada contada do MESMO forno (D-01).
  fornoId: string;
  // Só `RegistrarQueima` passa: com ele a folha NÃO dá aviso — quem chamou atualiza o próprio aviso
  // do registro no lugar (UI-D12 item 4). Sem ele, a folha dá o aviso dela, de 5 s.
  // Plano 04: `aviso` é o texto pronto do aviso ("Contagem salva: {N} peças. Externas a cobrar: R$ X." —
  // a folha é quem tem os preços), usado nos dois caminhos: o aviso da folha e a troca no lugar do aviso
  // do registro.
  aoSalvar?: (resultado: { total: number; criada: boolean; aviso: string }) => void;
  // A contagem gravada, ao CORRIGIR pelo Histórico (UI-D23): os contadores abrem com ela, o botão da
  // esquerda vira "Fechar sem salvar" e "Salvar" com tudo zero pergunta antes de apagar (UI-D6).
  // Ausente ou `null` = contagem nova.
  inicial?: Contagem | null;
  // Plano 04 (D-07; UI-D7 revisto em 04/10/2026): as vendas ligadas à queima — só o Histórico passa, em
  // "Corrigir contagem". O já lançado em vendas ATIVAS é o PISO das externas de cada tamanho.
  vendas?: readonly VendaLigada[];
};

// A recusa do piso vinda do servidor (`gravarContagem`, sob a trava): a frase de `fraseAbaixoDoLancado`.
// A folha a reconhece pelo começo — mantém os números e relê a página, para o piso novo vir do banco.
function ehRecusaDoPiso(frase: string): boolean {
  return frase.startsWith("Já foi lançada") || frase.startsWith("Já foram lançadas");
}

const TAMANHOS: readonly Tamanho[] = ["P", "M", "G"];

function chaveDoContador(grupo: GrupoDoContador, tamanho: Tamanho): ChaveDoContador {
  return `${grupo}${tamanho}` as ChaveDoContador;
}

// Cópia de `classeDaPilula` de `components/amassa/agenda/folha-lancar.tsx` (que a copiou da barra de
// saldos do Estoque) — o molde da casa é a cópia por tela, não exportar da Agenda. Aqui só a forma
// "não marcada" é usada: os chips da Produção somam `border-dashed` (06.4-UI-SPEC.md §Color).
function classeDaPilula(marcada: boolean): string {
  return cn(
    "text-apoio focus-visible:ring-ring inline-flex min-h-[44px] items-center gap-1 rounded-full border px-4 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none",
    marcada
      ? "border-acento bg-acento-fundo text-acento font-semibold"
      : "border-borda bg-superficie text-tinta hover:bg-superficie-2 font-normal",
  );
}

// O alvo de um toque "fora" da folha está dentro do aviso (sonner)? Então não é "fora": tocar o aviso
// (o "Desfazer" do registro) nunca fecha a folha (UI-D12).
function dentroDoAviso(alvo: EventTarget | null): boolean {
  return alvo instanceof Element && alvo.closest("[data-sonner-toaster]") !== null;
}

// A folha "O que queimou?" (06.4-UI-SPEC.md §"A folha"; QMC-01/QMC-03): tela toda no celular,
// diálogo `max-w-lg` a partir de 768 px (`CLASSE_DA_FOLHA`), com o pé a 104 px da janela no
// computador (o `max-h` do `DialogContent`, 104 px acima e abaixo) para o aviso caber embaixo (UI-D12). Seis contadores
// com a faixa da régua VIGENTE e "O forno saiu cheio" (marcado por padrão; não existe em ouro — D-02,
// UI-D8 — e a contagem de ouro grava `saiu_cheio = true`); "Pular" fecha sem gravar; "Salvar" grava
// por `salvarContagem`. Os três pontos de entrada usam este componente: depois do registro
// (`RegistrarQueima`, que a renderiza nos dois ramos — sobrevive ao `router.refresh()`, Pitfall 2),
// "Contar agora" da lista "Sem contagem" e o Histórico. Esc e toque fora fecham SÓ se nada foi
// mexido (UI-D18); tocar o aviso nunca fecha.
//
// Plano 04 (D-07; UI-D7 revisto em 04/10/2026): ao corrigir uma queima com peças lançadas em venda
// ATIVA, a caixa "Já lançado: venda nº … (…)" com "ver no Caixa" fica acima das Externas, e cada
// tamanho das externas tem PISO = o já lançado ativo (o "−" para nele; um número digitado abaixo volta
// ao piso ao sair do campo, com a frase do porquê). Subir é livre; internas e "saiu cheio" também. O
// servidor recusa abaixo do piso de novo, sob a trava. À direita de "Externas", o valor das externas
// contadas pelo preço ATUAL do Catálogo.
export function FolhaContagem({ queima, ...resto }: FolhaContagemProps) {
  if (queima === null) {
    return null;
  }
  // `key` pela queima: uma folha nova para outra queima começa zerada; o refresh não muda o id.
  return <FolhaAberta key={queima.id} queima={queima} {...resto} />;
}

function FolhaAberta({
  queima,
  aoFechar,
  dados,
  nomeDoForno,
  fornoId,
  aoSalvar,
  inicial: gravada = null,
  vendas = [],
}: Omit<FolhaContagemProps, "queima"> & { queima: QueimaParaContar }) {
  const router = useRouter();
  const emVoo = useRef(false);
  const conteudo = useRef<HTMLDivElement>(null);
  // O estado de abertura: a contagem gravada (corrigir) ou tudo zero (nova). Fixado na montagem — o
  // refresh que vem depois de salvar não o troca por baixo da folha.
  const [existente] = useState<Contagem | null>(gravada);
  const [inicial] = useState<Contagem>(existente ?? CONTAGEM_VAZIA);
  const [contagem, setContagem] = useState<Contagem>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoApagar, setConfirmandoApagar] = useState(false);
  // 06.4-WR-01 (quick 261005-2yu, 05/10/2026): a contagem que esta folha ESPERA estar gravada — a da
  // abertura. Vai junto em "Salvar" e em "Apagar"; o servidor recusa sob a trava se a gravada for outra
  // (alguém salvou ou apagou no meio). Na recusa, ela passa a ser a gravada AGORA: os números digitados
  // FICAM e salvar de novo grava de propósito por cima.
  const [esperada, setEsperada] = useState<Contagem | null>(existente);
  const corrigindo = esperada !== null;

  // Os chips somados nesta abertura da folha (fechar e reabrir zera; desfazer é pelos "−").
  const [somados, setSomados] = useState<ReadonlySet<string>>(() => new Set());
  // O chip com peça sem medida cuja pergunta de tamanho está aberta (uma por vez — D-06).
  const [perguntando, setPerguntando] = useState<ChipDaOrdem | null>(null);
  const botoesDosChips = useRef(new Map<string, HTMLButtonElement>());
  const primeiroTamanho = useRef<HTMLButtonElement>(null);
  // O chip que deve receber o foco quando a pergunta fechar.
  const chipParaFocar = useRef<string | null>(null);
  const idDaDicaDoRepetir = useId();

  const total = totalDaContagem(contagem);
  const ouro = queima.tipo === "ouro";
  // O piso das externas (D-07): o já lançado em vendas ATIVAS, por tamanho — vem do banco a cada carga
  // (a venda cancelada no Caixa baixa o piso sozinha).
  const vendasAtivas = vendas.filter((venda) => !venda.cancelada);
  const piso = lancadoAtivo(vendas);
  const comLancado = totalDasQuantidades(piso) > 0;
  // O valor das externas CONTADAS, à direita de "Externas" (a folha fala da contagem; "a cobrar" e o
  // Histórico falam do que falta). Sem os itens (a leitura falhou), nada.
  const valorDasContadas =
    dados.itens === null || totalDasExternas(contagem) === 0
      ? null
      : valorDasExternas(externasDaContagem(contagem), precosDosItens(dados.itens));
  // Chips (QMC-06, D-06): biscoito ↔ ordens na etapa `queima1`, esmalte ↔ `queima2`; ouro nunca. A
  // leitura da Produção que falhou (`chips: null`) só esconde a área (UI-D28).
  const chips: readonly ChipDaOrdem[] =
    dados.chips === null || ouro
      ? []
      : queima.tipo === "biscoito"
        ? dados.chips.queima1
        : dados.chips.queima2;
  // "Repetir a última" (QMC-05, D-01): a última contada do MESMO forno e tipo, sem a própria queima.
  const anterior = ultimaContagemDoMesmoTipo(dados.ultimasContagens, {
    fornoId,
    tipo: queima.tipo,
    queimaIdAtual: queima.id,
  });

  // Foco (06.4-UI-SPEC.md §Teclado): a pergunta abre com o foco no "P"; fechada, ele volta ao chip.
  useEffect(() => {
    if (perguntando !== null) {
      primeiroTamanho.current?.focus();
      return;
    }
    if (chipParaFocar.current !== null) {
      botoesDosChips.current.get(chipParaFocar.current)?.focus();
      chipParaFocar.current = null;
    }
  }, [perguntando]);
  const faixas = faixasDaRegua(dados.regua);
  // Esc e toque fora só fecham sem mudanças (UI-D18) — e nunca no meio da gravação.
  const podeFecharSemPerguntar = !salvando && mesmaContagem(contagem, inicial);

  function mudar(chave: ChaveDoContador, valor: number) {
    setErro(null);
    setContagem((atual) => ({ ...atual, [chave]: valor }));
  }

  // A frase do piso de um tamanho, com as vendas ATIVAS que têm aquele tamanho — a mesma do servidor.
  function fraseDoPiso(tamanho: Tamanho): string {
    const chave = chaveDoTamanho(tamanho);
    return fraseAbaixoDoLancado(
      tamanho,
      piso[chave],
      vendasAtivas.filter((venda) => venda.quantidades[chave] > 0).map((venda) => venda.numero),
    );
  }

  // Um toque num chip soma as pendentes nas INTERNAS do tamanho delas. Só leitura da Produção: nada
  // é gravado lá — "Salvar" grava só a contagem desta queima.
  // Com peça sem medida, o toque NÃO soma nada: abre a pergunta de tamanho (D-06, UI-D17) — tudo de
  // uma vez, na resposta, ou nada.
  function tocarChip(chip: ChipDaOrdem) {
    if (somados.has(chip.ordemId) || salvando) {
      return;
    }
    if (chip.semMedida > 0) {
      setPerguntando(chip);
      return;
    }
    somar(chip, null);
  }

  function somar(chip: ChipDaOrdem, tamanhoDoResto: Tamanho | null) {
    setErro(null);
    setContagem((atual) => somarChip(atual, chip, tamanhoDoResto));
    setSomados((atual) => new Set(atual).add(chip.ordemId));
  }

  // A resposta da pergunta: um tamanho soma a parte medida E as sem medida nele; `null` ("Não somar
  // agora") fecha sem somar nada e o chip volta a tocável.
  function responderPergunta(tamanho: Tamanho | null) {
    if (perguntando === null) {
      return;
    }
    if (tamanho !== null) {
      somar(perguntando, tamanho);
    }
    chipParaFocar.current = perguntando.ordemId;
    setPerguntando(null);
  }

  // Copia os seis números e o "saiu cheio" da anterior — SOBRESCREVE (tocar duas vezes dá o mesmo).
  // Os chips voltam a tocáveis: o que eles tinham somado foi sobrescrito. Com peça lançada em venda
  // ativa (D-07, UI-D10), copia só as internas e o "saiu cheio": as externas ficam como estão.
  function repetirAUltima() {
    if (anterior === null || salvando) {
      return;
    }
    setErro(null);
    setContagem((atual) =>
      comLancado
        ? {
            ...atual,
            internasP: anterior.contagem.internasP,
            internasM: anterior.contagem.internasM,
            internasG: anterior.contagem.internasG,
            saiuCheio: anterior.contagem.saiuCheio,
          }
        : { ...anterior.contagem },
    );
    setSomados(new Set());
    setPerguntando(null);
  }

  async function salvar() {
    if (emVoo.current) {
      return;
    }
    if (total === 0) {
      // Contagem EXISTENTE com tudo zero: pergunta e, confirmado, apaga (UI-D6) — nunca um botão que
      // não faz nada. Contagem nova com tudo zero fecha como "Pular": nada gravado, nenhum aviso.
      if (corrigindo) {
        setConfirmandoApagar(true);
      } else {
        aoFechar();
      }
      return;
    }
    emVoo.current = true;
    setErro(null);
    setSalvando(true);
    try {
      // Ouro não tem a caixa (D-02: não entra nas médias de capacidade) e grava o padrão, cheio.
      const enviada = ouro ? { ...contagem, saiuCheio: true } : contagem;
      const resposta = await salvarContagem({ queimaId: queima.id, ...enviada, esperada });
      if (!resposta.ok) {
        if (resposta.telaMudou) {
          // A contagem gravada mudou desde que a folha abriu: a frase diz o que está gravado agora, os
          // números digitados ficam, e a página é relida.
          setErro(resposta.erro);
          setEsperada(resposta.contagemAtual ?? null);
          router.refresh();
        } else if (resposta.erro === FRASE_QUEIMA_DESFEITA_NADA_CONTADO) {
          toast.error(resposta.erro);
          aoFechar();
        } else {
          // Inclusive o piso da D-07: a frase fica na folha e os números FICAM; com o piso, a página é
          // relida para o piso novo (outra venda pode ter acabado de nascer) vir do banco.
          setErro(resposta.erro);
          if (ehRecusaDoPiso(resposta.erro)) {
            router.refresh();
          }
        }
        return;
      }
      // O aviso (UI-SPEC §Toasts): uma contagem NOVA com externas diz o valor delas (nada foi lançado
      // ainda, então é o das externas contadas) ou que falta o preço; sem os itens (a leitura falhou —
      // UI-D19), a frase sem externas. "Corrigir" continua "Contagem corrigida: {N} peças.".
      const externasSalvas = externasDaContagem(enviada);
      const aviso = !resposta.dados.criada
        ? toastContagemCorrigida(resposta.dados.total)
        : dados.itens === null || totalDasQuantidades(externasSalvas) === 0
          ? toastContagemSalva(resposta.dados.total)
          : toastContagemSalva(resposta.dados.total, {
              valorCentavos: valorDasExternas(externasSalvas, precosDosItens(dados.itens))
                .valorCentavos,
            });
      if (aoSalvar) {
        aoSalvar({ ...resposta.dados, aviso });
      } else {
        toast.success(aviso);
      }
      aoFechar();
      router.refresh();
    } catch {
      setErro(FRASE_FALHA_AO_SALVAR_CONTAGEM);
    } finally {
      emVoo.current = false;
      setSalvando(false);
    }
  }

  function tratarToqueFora(evento: {
    target: EventTarget | null;
    preventDefault: () => void;
  }) {
    if (dentroDoAviso(evento.target) || !podeFecharSemPerguntar) {
      evento.preventDefault();
    }
  }

  function grupo(nome: GrupoDoContador) {
    const interno = nome === "internas";
    return (
      <section
        className="flex flex-col gap-1"
        aria-label={interno ? ROTULO_INTERNAS : ROTULO_EXTERNAS}
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              "size-2 rounded-full",
              interno ? "bg-area-pecas" : "bg-area-loja",
            )}
          />
          <span className="text-corpo text-tinta font-semibold">
            {interno ? ROTULO_INTERNAS : ROTULO_EXTERNAS}
          </span>
          {!interno && valorDasContadas !== null ? (
            valorDasContadas.valorCentavos === null ? (
              // Preço faltando no Catálogo (UI-D5): diz qual — salvar continua livre.
              <span
                data-testid="contagem-valor-externas"
                className="text-apoio text-tinta-fraca ml-auto text-right"
              >
                {faltaOPrecoDe(valorDasContadas.tamanhosSemPreco)}
              </span>
            ) : (
              <span
                data-testid="contagem-valor-externas"
                className="text-corpo text-tinta ml-auto font-semibold whitespace-nowrap tabular-nums"
              >
                {formatarReais(valorDasContadas.valorCentavos)}
              </span>
            )
          ) : null}
        </div>
        <p className="text-apoio text-tinta-fraca">
          {interno ? DICA_INTERNAS : DICA_EXTERNAS}
        </p>
        {!interno && comLancado ? (
          <div
            data-testid="externas-lancadas"
            className="bg-superficie-2 text-tinta-media text-apoio flex items-start gap-2 rounded-md p-4"
          >
            <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <div className="flex min-w-0 flex-col items-start gap-1">
              <p className="[overflow-wrap:anywhere]">{fraseExternasLancadas(vendasAtivas)}</p>
              <Link
                href={hrefDoCaixa()}
                className="text-acento focus-visible:ring-ring inline-flex min-h-[44px] items-center font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                {ROTULO_VER_NO_CAIXA}
              </Link>
            </div>
          </div>
        ) : null}
        {TAMANHOS.map((tamanho) => {
          const chave = chaveDoContador(nome, tamanho);
          // O piso só vale para as externas: internas e "saiu cheio" continuam livres.
          const minimo = interno ? 0 : piso[chaveDoTamanho(tamanho)];
          return (
            <ContadorTamanho
              key={tamanho}
              grupo={nome}
              tamanho={tamanho}
              faixa={faixas[tamanho]}
              valor={contagem[chave]}
              aoMudar={(valor) => mudar(chave, valor)}
              desabilitado={salvando}
              minimo={minimo}
              aoFicarAbaixoDoMinimo={
                minimo > 0 ? () => setErro(fraseDoPiso(tamanho)) : undefined
              }
            />
          );
        })}
      </section>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(aberta) => {
        if (!aberta && !salvando) {
          aoFechar();
        }
      }}
    >
      <DialogContent
        ref={conteudo}
        showCloseButton={false}
        data-folha-contagem=""
        data-testid="folha-contagem"
        data-queima-id={queima.id}
        aria-busy={salvando ? "true" : undefined}
        onOpenAutoFocus={(evento) => {
          // Foco no próprio diálogo, nunca num campo: no celular abriria o teclado por cima.
          evento.preventDefault();
          conteudo.current?.focus();
        }}
        onEscapeKeyDown={(evento) => {
          if (!podeFecharSemPerguntar) {
            evento.preventDefault();
          }
        }}
        onInteractOutside={tratarToqueFora}
        onPointerDownOutside={tratarToqueFora}
        className={cn(CLASSE_DA_FOLHA, "md:max-h-[calc(100svh-208px)]")}
      >
        <DialogHeader className="border-border flex flex-col gap-1 border-b px-6 py-4 text-left">
          <DialogTitle data-testid="contagem-titulo" className="text-titulo text-tinta">
            {TITULO_FOLHA_CONTAGEM}
          </DialogTitle>
          <DialogDescription className="text-apoio text-tinta-media">
            {subtituloDaFolha(
              queima.tipo,
              diaMes(diaCivilEmBrasilia(queima.ocorridaEm)),
              dados.maisDeUmForno ? nomeDoForno : null,
            )}
          </DialogDescription>
          <p data-testid="contagem-regua" className="text-apoio text-tinta-fraca">
            {fraseDaReguaNaFolha(dados.regua)}
          </p>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {chips.length > 0 ? (
            <div className="flex flex-col gap-2" data-testid="contagem-chips">
              <p className="text-apoio text-tinta-media">{ROTULO_CHIPS}</p>
              <div className="flex flex-wrap gap-2">
                {chips.map((chip) => {
                  const somado = somados.has(chip.ordemId);
                  return (
                    <button
                      key={chip.ordemId}
                      type="button"
                      data-testid="chip-ordem"
                      data-ordem-id={chip.ordemId}
                      data-somado={somado ? "true" : "false"}
                      ref={(botao) => {
                        if (botao === null) {
                          botoesDosChips.current.delete(chip.ordemId);
                        } else {
                          botoesDosChips.current.set(chip.ordemId, botao);
                        }
                      }}
                      // Somado = desabilitado por `aria-disabled` (o toque não faz nada): o botão
                      // continua focável, para o foco voltar a ele quando a pergunta fecha.
                      disabled={salvando}
                      aria-disabled={somado ? true : undefined}
                      aria-expanded={chip.semMedida > 0 ? perguntando?.ordemId === chip.ordemId : undefined}
                      // Somado: sem `aria-label`, o leitor lê o texto visível com " · somado"
                      // (nunca só a cor).
                      aria-label={somado ? undefined : ariaDoChip(chip.pendentes, chip.nome)}
                      onClick={() => tocarChip(chip)}
                      className={cn(
                        classeDaPilula(false),
                        "text-left whitespace-normal [overflow-wrap:anywhere]",
                        somado
                          ? "bg-superficie-2 text-tinta-fraca cursor-default border-solid"
                          : "border-dashed",
                      )}
                    >
                      {somado ? <Check aria-hidden="true" className="size-4 shrink-0" /> : null}
                      <span>
                        {textoDoChip(chip.pendentes, chip.nome)}
                        {somado ? SUFIXO_SOMADO : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
              {perguntando !== null ? (
                <div
                  role="group"
                  aria-label={perguntaDoTamanho(perguntando.nome, perguntando.semMedida)}
                  data-testid="pergunta-tamanho"
                  className="border-borda flex flex-col gap-2 rounded-md border p-3"
                >
                  <p className="text-apoio text-tinta [overflow-wrap:anywhere]">
                    {perguntaDoTamanho(perguntando.nome, perguntando.semMedida)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {TAMANHOS.map((tamanho) => (
                      <Button
                        key={tamanho}
                        ref={tamanho === "P" ? primeiroTamanho : undefined}
                        type="button"
                        variant="outline"
                        data-testid={`pergunta-tamanho-${tamanho.toLowerCase()}`}
                        aria-label={ariaDoTamanhoDaPergunta(perguntando.semMedida, tamanho)}
                        onClick={() => responderPergunta(tamanho)}
                        className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
                      >
                        {tamanho}
                      </Button>
                    ))}
                    <button
                      type="button"
                      data-testid="pergunta-tamanho-nao-somar"
                      onClick={() => responderPergunta(null)}
                      className="text-apoio text-acento focus-visible:ring-ring inline-flex min-h-[44px] items-center px-2 font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {ROTULO_NAO_SOMAR_AGORA}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-col items-start gap-1">
            <Button
              type="button"
              variant="outline"
              data-testid="contagem-repetir"
              disabled={anterior === null || salvando}
              aria-describedby={idDaDicaDoRepetir}
              onClick={repetirAUltima}
              className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
            >
              {ROTULO_REPETIR_A_ULTIMA}
            </Button>
            <p
              id={idDaDicaDoRepetir}
              data-testid="contagem-repetir-dica"
              className="text-apoio text-tinta-fraca"
            >
              {anterior === null
                ? dicaSemAnterior(queima.tipo)
                : dicaDoRepetir(
                    anterior.tipo,
                    diaMes(anterior.diaCivil),
                    totalDaContagem(anterior.contagem),
                  )}
            </p>
          </div>
          {grupo("internas")}
          {grupo("externas")}
          {ouro ? null : (
            <label className="flex min-h-[44px] items-center gap-2">
              <Checkbox
                data-testid="contagem-saiu-cheio"
                checked={contagem.saiuCheio}
                disabled={salvando}
                onCheckedChange={(marcado) => {
                  setErro(null);
                  setContagem((atual) => ({ ...atual, saiuCheio: marcado === true }));
                }}
                className="border-tinta-fraca data-[state=checked]:bg-tinta data-[state=checked]:border-tinta size-6 border-2"
              />
              <span className="text-corpo text-tinta">{ROTULO_SAIU_CHEIO}</span>
              <span className="text-apoio text-tinta-fraca">{DICA_SAIU_CHEIO}</span>
            </label>
          )}
        </div>

        <div className="border-border bg-popover flex flex-wrap items-center gap-2 border-t px-6 py-4">
          {erro !== null ? (
            <p
              role="alert"
              data-testid="contagem-erro"
              className="text-apoio text-erro basis-full"
            >
              {erro}
            </p>
          ) : null}
          <p
            data-testid="contagem-resumo"
            aria-live="polite"
            className="text-corpo text-tinta mr-auto font-semibold tabular-nums"
          >
            {resumoDaContagem(total)}
          </p>
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              variant="outline"
              // Ao corrigir, "Pular" diria que nada foi contado: "Fechar sem salvar" (UI-D23) — a
              // contagem gravada continua como estava. Os dois sempre fecham sem gravar.
              data-testid={corrigindo ? "contagem-fechar-sem-salvar" : "contagem-pular"}
              disabled={salvando}
              onClick={aoFechar}
              className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
            >
              {corrigindo ? ROTULO_FECHAR_SEM_SALVAR : ROTULO_PULAR}
            </Button>
            <Button
              type="button"
              data-testid="contagem-salvar"
              disabled={salvando}
              aria-busy={salvando ? "true" : undefined}
              onClick={() => void salvar()}
              className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
            >
              {salvando ? ROTULO_SALVANDO : ROTULO_SALVAR}
            </Button>
          </div>
        </div>
      </DialogContent>
      {esperada !== null ? (
        <ConfirmarApagarContagem
          queimaId={queima.id}
          esperada={esperada}
          pecasContadas={totalDaContagem(esperada)}
          tituloDaQueima={tituloDaQueima(
            queima.tipo,
            diaMes(diaCivilEmBrasilia(queima.ocorridaEm)),
            null,
          )}
          aberto={confirmandoApagar}
          aoMudarAberto={setConfirmandoApagar}
          aoApagar={aoFechar}
          aoTelaMudar={(frase, atual) => {
            setErro(frase);
            setEsperada(atual);
          }}
        />
      ) : null}
    </Dialog>
  );
}
