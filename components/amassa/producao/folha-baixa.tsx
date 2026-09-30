"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";

import { ROTULO_UNIDADE } from "@/lib/cadastros/catalogo";
import type { AreaFinanceira } from "@/lib/financeiro/textos";
import type { SaldoDoItem } from "@/lib/estoque/consultas";
import { textoParaMilesimos } from "@/lib/estoque/esquemas";
import { textoDeMilesimos } from "@/lib/estoque/saldo";
import {
  FRASE_MATERIAL_NAO_EXISTE_MAIS,
  FRASE_QUANTIDADE_INVALIDA,
  FRASE_QUANTIDADE_ZERO,
  textoSaldoDeAgora,
} from "@/lib/estoque/textos";
import { darBaixaNaOrdem } from "@/lib/producao/acoes";
import {
  baixaTotalSugerida,
  mgEmMilesimos,
  miligramasPorMilesimo,
  situacaoDoMaterial,
  type MaterialDaOrdem,
} from "@/lib/producao/material";
import {
  DICA_BAIXA_PARCIAL,
  DICA_BAIXA_TOTAL,
  FRASE_ESCOLHA_O_MATERIAL,
  FRASE_FALHA_AO_DAR_BAIXA,
  ROTULO_DANDO_BAIXA,
  ROTULO_DAR_BAIXA,
  ROTULO_ESCOLHER_MATERIAL,
  ROTULO_QUAL_MATERIAL_DO_ESTOQUE,
  ROTULO_QUANTO,
  ROTULO_TROCAR_MATERIAL,
  ROTULO_VOLTAR,
  TEXTO_ESCOLHA_PARA_VER_O_SALDO,
  dicaDoQuanto,
  dicaUnidadeNaoComparavel,
  fraseQuantidadeNaUnidade,
  textoResumoDaFolhaDeBaixa,
  textoToastBaixaDaOrdem,
  tituloDaFolhaDeBaixa,
} from "@/lib/producao/textos";
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
import { CLASSE_DA_FOLHA, milesimosParaCampo } from "@/components/amassa/estoque/folha-movimentacao";
import { PreviaDoSaldo } from "@/components/amassa/estoque/previa-do-saldo";
import { useEstoque } from "@/components/amassa/estoque/provedor-estoque";
import { SeletorMaterial } from "@/components/amassa/estoque/seletor-material";

// O que abriu a folha: "Baixa total" / "Baixa parcial" de argila ou esmalte, ou "+ Dar baixa de outro
// material" (`material` nulo, previsto e baixado zero). `itemPreEscolhidoId` = o item da última
// baixa do mesmo material nesta ordem (UI-D6).
export type PedidoDeBaixa = {
  modo: "total" | "parcial" | "outro";
  material: MaterialDaOrdem | null;
  previstoMg: number;
  baixadoMg: number;
  itemPreEscolhidoId: string | null;
};

type CampoDaBaixa = "material" | "quantidade" | "geral";
type ErroDaBaixa = { campo: CampoDaBaixa; mensagem: string };

const SUFIXO_DESATIVADO = "Reative-o no Estoque para dar baixa.";

// "4,2" a partir de miligramas — a conta de kg da ordem.
function kg(mg: number): string {
  return textoDeMilesimos(mgEmMilesimos(Math.max(0, mg), "kg") ?? 0);
}

// A folha de baixa de material da ordem (UI-SPEC §"Folha de baixa de material"): o resumo do
// previsto, o material do Estoque pelo seletor "Qual material?" da Fase 06 (só ativos, busca) com a
// pré-escolha, o "Quanto" no campo grande da 06 na unidade DO ITEM (sem seletor de unidade), a dica
// herdada e o rodapé preso com a prévia do saldo (`aria-live`), "Voltar" e "Dar baixa".
//
// O seletor abre NO LUGAR da folha (uma folha por vez, como no Estoque), e a folha volta com tudo o
// que já foi digitado — o estado mora aqui, que continua montado.
//
// Quem abre a monta com `key` nova a cada abertura: nasce limpa.
export function FolhaBaixa({
  ordemId,
  pedido,
  aoFechar,
}: {
  ordemId: string;
  pedido: PedidoDeBaixa;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const { lista } = useEstoque();

  const [itemId, setItemId] = useState<string | null>(pedido.itemPreEscolhidoId);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [areaDoSeletor, setAreaDoSeletor] = useState<AreaFinanceira | null>(null);
  // `null` = a pessoa ainda não mexeu no campo: na "Baixa total" ele segue o que falta, na unidade
  // do material escolhido. Depois do primeiro toque, fica o que ela digitou.
  const [quantidadeDigitada, setQuantidadeDigitada] = useState<string | null>(null);
  const [erro, setErro] = useState<ErroDaBaixa | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Guarda síncrona contra o toque duplo: o `disabled` só vale depois do próximo desenho.
  const emVoo = useRef(false);
  const campoQuanto = useRef<HTMLInputElement>(null);
  const botaoMaterial = useRef<HTMLButtonElement>(null);

  // O material escolhido, lido da lista do Estoque — só se ainda estiver ativo (desativado some da
  // escolha, como no seletor). Lista ainda carregando: `undefined` (a caixa mostra o esqueleto).
  const saldo: SaldoDoItem | null | undefined =
    itemId === null
      ? null
      : lista.estado === "pronta"
        ? (lista.saldos.find((linha) => linha.id === itemId && linha.ativo) ?? null)
        : lista.estado === "carregando"
          ? undefined
          : null;

  const unidade = saldo ? ROTULO_UNIDADE[saldo.unidade] : null;
  const sugerida =
    pedido.modo === "total" && saldo
      ? baixaTotalSugerida(pedido.previstoMg, pedido.baixadoMg, saldo.unidade)
      : null;
  const quantidadeTexto =
    quantidadeDigitada ?? (sugerida !== null && sugerida > 0 ? milesimosParaCampo(sugerida) : "");
  const quantidade = textoParaMilesimos(quantidadeTexto);
  // Argila ou esmalte num material contado em un/ml/L/m: a conta de kg não se aplica (Pitfall 10).
  const naoComparavel =
    pedido.material !== null &&
    saldo !== null &&
    saldo !== undefined &&
    miligramasPorMilesimo(saldo.unidade) === null;

  const situacao =
    pedido.material !== null ? situacaoDoMaterial(pedido.previstoMg, pedido.baixadoMg) : null;

  function mensagemDaQuantidade(mensagem: string): string {
    if (mensagem === FRASE_QUANTIDADE_INVALIDA && unidade) {
      return fraseQuantidadeNaUnidade(unidade);
    }
    return mensagem;
  }

  function mostrarErro(novo: ErroDaBaixa) {
    setErro(novo);
    window.requestAnimationFrame(() => {
      if (novo.campo === "quantidade") {
        campoQuanto.current?.focus();
      } else if (novo.campo === "material") {
        botaoMaterial.current?.focus();
      }
    });
  }

  // As frases conhecidas do servidor vão para baixo do campo delas; o resto, para o topo do rodapé.
  function campoDaFraseDoServidor(mensagem: string): CampoDaBaixa {
    if (
      mensagem === FRASE_ESCOLHA_O_MATERIAL ||
      mensagem === FRASE_MATERIAL_NAO_EXISTE_MAIS ||
      mensagem.endsWith(SUFIXO_DESATIVADO)
    ) {
      return "material";
    }
    if (mensagem === FRASE_QUANTIDADE_ZERO || mensagem === FRASE_QUANTIDADE_INVALIDA) {
      return "quantidade";
    }
    return "geral";
  }

  async function darBaixa() {
    if (emVoo.current) {
      return;
    }
    if (!saldo) {
      mostrarErro({ campo: "material", mensagem: FRASE_ESCOLHA_O_MATERIAL });
      return;
    }
    if (!quantidade.ok) {
      mostrarErro({ campo: "quantidade", mensagem: mensagemDaQuantidade(quantidade.erro) });
      return;
    }

    emVoo.current = true;
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await darBaixaNaOrdem({
        ordemId,
        itemId: saldo.id,
        quantidadeTexto,
        material: pedido.material,
        // Revisão 06.1, WR-101: na "Baixa total", o que esta tela acreditava já baixado — o servidor
        // refaz a soma sob a trava da ordem e recusa se outra baixa entrou no meio.
        baixadoEsperadoMg: pedido.modo === "total" ? pedido.baixadoMg : null,
      });
      if (!resposta.ok && resposta.recarregar) {
        // O "total" desta folha já não vale: ela fecha, a frase fica no toast (que sobrevive à
        // recarga) e a tela recarrega com o que falta de verdade — a recusa volta antes de qualquer
        // `revalidatePath`, então a recarga é daqui.
        toast.error(resposta.erro);
        aoFechar();
        router.refresh();
        return;
      }
      if (!resposta.ok) {
        // A folha continua aberta e preenchida.
        const campo = campoDaFraseDoServidor(resposta.erro);
        mostrarErro({
          campo,
          mensagem: campo === "quantidade" ? mensagemDaQuantidade(resposta.erro) : resposta.erro,
        });
        return;
      }
      // O toast conta o que foi GRAVADO, lido sob a trava no servidor.
      const gravada = resposta.dados;
      const unidadeGravada = ROTULO_UNIDADE[gravada.unidade];
      toast.success(
        textoToastBaixaDaOrdem({
          quantidade: textoDeMilesimos(Math.abs(gravada.quantidadeMilesimos)),
          unidade: unidadeGravada,
          nome: gravada.nome,
          saldoNegativo:
            gravada.saldoDepoisMilesimos < 0 ? textoDeMilesimos(gravada.saldoDepoisMilesimos) : null,
        }),
      );
      aoFechar();
      router.refresh();
    } catch (falha) {
      console.error("Falha ao dar baixa de material na ordem:", falha);
      setErro({ campo: "geral", mensagem: FRASE_FALHA_AO_DAR_BAIXA });
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
  }

  function mensagemDe(campo: CampoDaBaixa) {
    if (erro?.campo !== campo) {
      return null;
    }
    return (
      <p
        id={`folha-baixa-erro-${campo}`}
        role="alert"
        data-testid="folha-baixa-erro"
        data-campo={campo}
        className="text-apoio text-erro"
      >
        {erro.mensagem}
      </p>
    );
  }

  if (seletorAberto) {
    return (
      <SeletorMaterial
        lista={lista}
        area={areaDoSeletor}
        aoMudarArea={setAreaDoSeletor}
        aoEscolher={(escolhido) => {
          setItemId(escolhido);
          setSeletorAberto(false);
          if (erro?.campo === "material") {
            setErro(null);
          }
        }}
        aoFechar={() => setSeletorAberto(false)}
      />
    );
  }

  const titulo = tituloDaFolhaDeBaixa(pedido.modo, pedido.material);
  const dica = pedido.modo === "total" ? DICA_BAIXA_TOTAL : DICA_BAIXA_PARCIAL;
  const classeDoCampoGrande = "text-display md:text-display h-[60px] text-center tabular-nums";

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
        data-testid="folha-baixa"
        onOpenAutoFocus={(evento) => {
          // No celular nada recebe foco ao abrir — o teclado cobriria a folha (UI-D13 da 06).
          evento.preventDefault();
          if (window.matchMedia("(min-width: 768px)").matches) {
            (itemId ? campoQuanto.current : botaoMaterial.current)?.focus();
          }
        }}
        className={CLASSE_DA_FOLHA}
      >
        <DialogHeader className="border-border flex flex-row items-start justify-between gap-4 border-b px-6 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="text-titulo text-tinta">{titulo}</DialogTitle>
            {pedido.material !== null && situacao ? (
              <DialogDescription
                data-testid="folha-baixa-resumo"
                className="text-apoio text-tinta-media"
              >
                {textoResumoDaFolhaDeBaixa({
                  previstoKg: kg(pedido.previstoMg),
                  baixadoKg: kg(pedido.baixadoMg),
                  faltamKg: situacao.tipo === "passou" ? null : kg(pedido.previstoMg - pedido.baixadoMg),
                  aMaisKg: situacao.tipo === "passou" ? kg(situacao.diferencaMg) : null,
                })}
              </DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{dica}</DialogDescription>
            )}
          </div>
          <button
            type="button"
            aria-label="Fechar"
            data-testid="folha-baixa-fechar"
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
            void darBaixa();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
            <div className="flex flex-col gap-2">
              <p id="folha-baixa-material-rotulo" className="text-corpo text-tinta font-semibold">
                {ROTULO_QUAL_MATERIAL_DO_ESTOQUE}
              </p>
              {saldo === undefined ? (
                <Skeleton className="h-[76px] w-full" data-testid="folha-baixa-material-carregando" />
              ) : saldo === null ? (
                <button
                  ref={botaoMaterial}
                  type="button"
                  data-testid="folha-baixa-escolher"
                  aria-describedby={
                    erro?.campo === "material" ? "folha-baixa-erro-material" : undefined
                  }
                  disabled={enviando}
                  onClick={() => setSeletorAberto(true)}
                  className="border-borda-forte bg-superficie text-tinta hover:bg-superficie-2 text-corpo min-h-[52px] w-full rounded-md border px-4 font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                >
                  {ROTULO_ESCOLHER_MATERIAL}
                </button>
              ) : (
                // A caixa "escolhido" da Fase 06: o nome (quebra livre), o saldo de agora e a troca.
                <div
                  data-testid="folha-baixa-escolhido"
                  data-item-id={saldo.id}
                  className="bg-superficie-2 flex flex-wrap items-center justify-between gap-3 rounded-lg p-4"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="text-corpo text-tinta font-semibold [overflow-wrap:anywhere]">
                      {saldo.nome}
                    </span>
                    <span className="text-apoio text-tinta-media tabular-nums">
                      {textoSaldoDeAgora(textoDeMilesimos(saldo.saldoMilesimos), unidade ?? "")}
                    </span>
                  </div>
                  <button
                    ref={botaoMaterial}
                    type="button"
                    data-testid="folha-baixa-trocar"
                    disabled={enviando}
                    onClick={() => setSeletorAberto(true)}
                    className="border-borda-forte bg-superficie text-tinta hover:bg-superficie-2 text-corpo min-h-[44px] shrink-0 rounded-md border px-4 font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                  >
                    {ROTULO_TROCAR_MATERIAL}
                  </button>
                </div>
              )}
              {mensagemDe("material")}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="folha-baixa-quanto" className="text-corpo text-tinta font-semibold">
                {ROTULO_QUANTO}
              </label>
              {unidade ? (
                <p id="folha-baixa-quanto-dica" className="text-apoio text-tinta-fraca">
                  {naoComparavel ? dicaUnidadeNaoComparavel(unidade) : dicaDoQuanto(unidade)}
                </p>
              ) : null}
              <Input
                id="folha-baixa-quanto"
                ref={campoQuanto}
                data-testid="folha-baixa-quanto"
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
                aria-describedby={
                  [
                    unidade ? "folha-baixa-quanto-dica" : null,
                    erro?.campo === "quantidade" ? "folha-baixa-erro-quantidade" : null,
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                aria-invalid={erro?.campo === "quantidade"}
                value={quantidadeTexto}
                onChange={(evento) => {
                  setQuantidadeDigitada(evento.target.value);
                  if (erro?.campo === "quantidade") {
                    setErro(null);
                  }
                }}
                className={classeDoCampoGrande}
              />
              {mensagemDe("quantidade")}
            </div>

            <p data-testid="folha-baixa-dica" className="text-apoio text-tinta-media">
              {dica}
            </p>
          </div>

          {/* Rodapé preso por FLEX, fora da área rolável (G-03-1): o erro de gravação, a prévia e os
              dois botões — sempre visíveis. */}
          <div className="border-border bg-popover flex flex-col gap-3 border-t px-6 py-4">
            {mensagemDe("geral")}
            {saldo ? (
              <PreviaDoSaldo
                entrada={{
                  tipo: "saida",
                  unidade: saldo.unidade,
                  saldoMilesimos: saldo.saldoMilesimos,
                  valorCentavos: saldo.valorCentavos,
                  ultimaEntradaComPreco: saldo.ultimaEntradaComPreco,
                  minimoMilesimos: saldo.estoqueMinimoMilesimos,
                  quantidadeMilesimos: quantidade.ok ? quantidade.milesimos : null,
                  contadoMilesimos: null,
                  custoCentavos: null,
                  nomeDoMaterial: saldo.nome,
                  semValor: true,
                }}
              />
            ) : (
              <p
                aria-live="polite"
                data-testid="folha-previa"
                className="text-apoio bg-superficie-2 text-tinta-media border-borda rounded-md border px-4 py-2"
              >
                {TEXTO_ESCOLHA_PARA_VER_O_SALDO}
              </p>
            )}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                data-testid="folha-baixa-voltar"
                disabled={enviando}
                onClick={aoFechar}
                className="text-corpo h-auto min-h-[52px] px-4 font-semibold"
              >
                {ROTULO_VOLTAR}
              </Button>
              <button
                type="submit"
                data-testid="folha-baixa-dar"
                disabled={enviando}
                aria-busy={enviando}
                className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[52px] flex-1 items-center justify-center rounded-md px-4 font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviando ? ROTULO_DANDO_BAIXA : ROTULO_DAR_BAIXA}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
