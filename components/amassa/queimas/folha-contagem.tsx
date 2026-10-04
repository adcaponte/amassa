"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { salvarContagem } from "@/lib/queimas/acoes";
import {
  CONTAGEM_VAZIA,
  diaMes,
  totalDaContagem,
  type ChaveDoContador,
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
  ROTULO_INTERNAS,
  ROTULO_PULAR,
  ROTULO_SAIU_CHEIO,
  ROTULO_SALVANDO,
  ROTULO_SALVAR,
  TITULO_FOLHA_CONTAGEM,
  resumoDaContagem,
  subtituloDaFolha,
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
};

const TAMANHOS: readonly Tamanho[] = ["P", "M", "G"];

function chaveDoContador(grupo: GrupoDoContador, tamanho: Tamanho): ChaveDoContador {
  return `${grupo}${tamanho}` as ChaveDoContador;
}

// O alvo de um toque "fora" da folha está dentro do aviso (sonner)? Então não é "fora": tocar o aviso
// (o "Desfazer" do registro) nunca fecha a folha (UI-D12).
function dentroDoAviso(alvo: EventTarget | null): boolean {
  return alvo instanceof Element && alvo.closest("[data-sonner-toaster]") !== null;
}

// A folha "O que queimou?" (06.4-UI-SPEC.md §"A folha"; QMC-01/QMC-03): tela toda no celular,
// diálogo `max-w-lg` a partir de 768 px (`CLASSE_DA_FOLHA`). Seis contadores e "O forno saiu cheio"
// (marcado por padrão); "Pular" fecha sem gravar; "Salvar" grava por `salvarContagem`. Mora em
// `RegistrarQueima` e é renderizada nos dois ramos dele — sobrevive ao `router.refresh()` que vem
// logo depois do registro (Pitfall 2). A régua nas faixas, o forno no subtítulo, Esc/toque fora com
// mudanças, o aviso atualizado no lugar e o ouro sem "saiu cheio" são do plano 02; as externas já
// lançadas e o piso na tela, do plano 04.
export function FolhaContagem({ queima, aoFechar }: FolhaContagemProps) {
  if (queima === null) {
    return null;
  }
  // `key` pela queima: uma folha nova para outra queima começa zerada; o refresh não muda o id.
  return <FolhaAberta key={queima.id} queima={queima} aoFechar={aoFechar} />;
}

function FolhaAberta({
  queima,
  aoFechar,
}: {
  queima: QueimaParaContar;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const emVoo = useRef(false);
  const conteudo = useRef<HTMLDivElement>(null);
  const [contagem, setContagem] = useState<Contagem>(CONTAGEM_VAZIA);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const total = totalDaContagem(contagem);

  function mudar(chave: ChaveDoContador, valor: number) {
    setErro(null);
    setContagem((atual) => ({ ...atual, [chave]: valor }));
  }

  async function salvar() {
    if (emVoo.current) {
      return;
    }
    // Contagem nova com tudo zero fecha como "Pular": nada gravado, nenhum aviso.
    if (total === 0) {
      aoFechar();
      return;
    }
    emVoo.current = true;
    setErro(null);
    setSalvando(true);
    try {
      const resposta = await salvarContagem({ queimaId: queima.id, ...contagem });
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
      toast.success(toastContagemSalva(resposta.dados.total));
      aoFechar();
      router.refresh();
    } catch {
      setErro(FRASE_FALHA_AO_SALVAR_CONTAGEM);
    } finally {
      emVoo.current = false;
      setSalvando(false);
    }
  }

  function ignorarToqueNoAviso(evento: {
    target: EventTarget | null;
    preventDefault: () => void;
  }) {
    if (dentroDoAviso(evento.target)) {
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
        onInteractOutside={ignorarToqueNoAviso}
        onPointerDownOutside={ignorarToqueNoAviso}
        className={CLASSE_DA_FOLHA}
      >
        <DialogHeader className="border-border flex flex-col gap-1 border-b px-6 py-4 text-left">
          <DialogTitle data-testid="contagem-titulo" className="text-titulo text-tinta">
            {TITULO_FOLHA_CONTAGEM}
          </DialogTitle>
          <DialogDescription className="text-apoio text-tinta-media">
            {subtituloDaFolha(queima.tipo, diaMes(diaCivilEmBrasilia(queima.ocorridaEm)))}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {grupo("internas")}
          {grupo("externas")}
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
              data-testid="contagem-pular"
              disabled={salvando}
              onClick={aoFechar}
              className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
            >
              {ROTULO_PULAR}
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
    </Dialog>
  );
}
