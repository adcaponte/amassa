"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { salvarContagem } from "@/lib/queimas/acoes";
import type { DadosDaFolha } from "@/lib/queimas/consultas";
import {
  CONTAGEM_VAZIA,
  diaMes,
  mesmaContagem,
  somarChip,
  totalDaContagem,
  type ChaveDoContador,
  type ChipDaOrdem,
  type Contagem,
  type Tamanho,
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
  ROTULO_SALVAR,
  SUFIXO_SOMADO,
  TITULO_FOLHA_CONTAGEM,
  ariaDoChip,
  faixasDaRegua,
  fraseDaReguaNaFolha,
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
  // Só `RegistrarQueima` passa: com ele a folha NÃO dá aviso — quem chamou atualiza o próprio aviso
  // do registro no lugar (UI-D12 item 4). Sem ele, a folha dá o aviso dela, de 5 s.
  aoSalvar?: (resultado: { total: number; criada: boolean }) => void;
  // A contagem gravada, ao CORRIGIR pelo Histórico (UI-D23): os contadores abrem com ela, o botão da
  // esquerda vira "Fechar sem salvar" e "Salvar" com tudo zero pergunta antes de apagar (UI-D6).
  // Ausente ou `null` = contagem nova.
  inicial?: Contagem | null;
};

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
// mexido (UI-D18); tocar o aviso nunca fecha. As externas já lançadas e o piso na tela são do plano 04.
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
  aoSalvar,
  inicial: gravada = null,
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
  const corrigindo = existente !== null;

  // Os chips somados nesta abertura da folha (fechar e reabrir zera; desfazer é pelos "−").
  const [somados, setSomados] = useState<ReadonlySet<string>>(() => new Set());

  const total = totalDaContagem(contagem);
  const ouro = queima.tipo === "ouro";
  // Chips (QMC-06, D-06): biscoito ↔ ordens na etapa `queima1`, esmalte ↔ `queima2`; ouro nunca. A
  // leitura da Produção que falhou (`chips: null`) só esconde a área (UI-D28).
  const chips: readonly ChipDaOrdem[] =
    dados.chips === null || ouro
      ? []
      : queima.tipo === "biscoito"
        ? dados.chips.queima1
        : dados.chips.queima2;
  const chipsVisiveis = chips.filter((chip) => chip.semMedida === 0);
  const faixas = faixasDaRegua(dados.regua);
  // Esc e toque fora só fecham sem mudanças (UI-D18) — e nunca no meio da gravação.
  const podeFecharSemPerguntar = !salvando && mesmaContagem(contagem, inicial);

  function mudar(chave: ChaveDoContador, valor: number) {
    setErro(null);
    setContagem((atual) => ({ ...atual, [chave]: valor }));
  }

  // Um toque num chip soma as pendentes nas INTERNAS do tamanho delas. Só leitura da Produção: nada
  // é gravado lá — "Salvar" grava só a contagem desta queima.
  function somar(chip: ChipDaOrdem) {
    if (somados.has(chip.ordemId)) {
      return;
    }
    setErro(null);
    setContagem((atual) => somarChip(atual, chip, null));
    setSomados((atual) => new Set(atual).add(chip.ordemId));
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
      const resposta = await salvarContagem({ queimaId: queima.id, ...enviada });
      if (!resposta.ok) {
        if (resposta.erro === FRASE_QUEIMA_DESFEITA_NADA_CONTADO) {
          toast.error(resposta.erro);
          aoFechar();
        } else {
          // Inclusive o piso da D-07: a frase fica na folha e os números FICAM.
          setErro(resposta.erro);
        }
        return;
      }
      if (aoSalvar) {
        aoSalvar(resposta.dados);
      } else {
        toast.success(
          resposta.dados.criada
            ? toastContagemSalva(resposta.dados.total)
            : toastContagemCorrigida(resposta.dados.total),
        );
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
        </div>
        <p className="text-apoio text-tinta-fraca">
          {interno ? DICA_INTERNAS : DICA_EXTERNAS}
        </p>
        {TAMANHOS.map((tamanho) => {
          const chave = chaveDoContador(nome, tamanho);
          return (
            <ContadorTamanho
              key={tamanho}
              grupo={nome}
              tamanho={tamanho}
              faixa={faixas[tamanho]}
              valor={contagem[chave]}
              aoMudar={(valor) => mudar(chave, valor)}
              desabilitado={salvando}
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
          {chipsVisiveis.length > 0 ? (
            <div className="flex flex-col gap-2" data-testid="contagem-chips">
              <p className="text-apoio text-tinta-media">{ROTULO_CHIPS}</p>
              <div className="flex flex-wrap gap-2">
                {chipsVisiveis.map((chip) => {
                  const somado = somados.has(chip.ordemId);
                  return (
                    <button
                      key={chip.ordemId}
                      type="button"
                      data-testid="chip-ordem"
                      data-ordem-id={chip.ordemId}
                      data-somado={somado ? "true" : "false"}
                      disabled={somado || salvando}
                      // Somado: sem `aria-label`, o leitor lê o texto visível com " · somado"
                      // (nunca só a cor).
                      aria-label={somado ? undefined : ariaDoChip(chip.pendentes, chip.nome)}
                      onClick={() => somar(chip)}
                      className={cn(
                        classeDaPilula(false),
                        "text-left whitespace-normal [overflow-wrap:anywhere]",
                        somado
                          ? "bg-superficie-2 text-tinta-fraca border-solid"
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
            </div>
          ) : null}
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
      {existente !== null ? (
        <ConfirmarApagarContagem
          queimaId={queima.id}
          pecasContadas={totalDaContagem(existente)}
          tituloDaQueima={tituloDaQueima(
            queima.tipo,
            diaMes(diaCivilEmBrasilia(queima.ocorridaEm)),
            null,
          )}
          aberto={confirmandoApagar}
          aoMudarAberto={setConfirmandoApagar}
          aoApagar={aoFechar}
        />
      ) : null}
    </Dialog>
  );
}
