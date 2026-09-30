"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";

import { concluirOrdem } from "@/lib/producao/acoes";
import type { PecaParaConcluir } from "@/lib/producao/consultas";
import type { TipoOrdem } from "@/lib/producao/etapas";
import {
  DICA_CONCLUSAO,
  FRASE_CUSTO_DE_CADA_PECA_VAZIO,
  FRASE_FALHA_AO_CONCLUIR,
  ROTULO_CONCLUINDO,
  ROTULO_CONCLUIR_ORDEM,
  ROTULO_CONCLUIR_PARCIAL,
  ROTULO_VOLTAR,
  textoNotaDaCasa,
  textoNotaDaEncomenda,
  textoToastConclusao,
  tituloDaFolhaDeConclusao,
} from "@/lib/producao/textos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CLASSE_DA_FOLHA } from "@/components/amassa/estoque/folha-movimentacao";

import { SecaoPecaConclusao, lerPeca, type ValoresDaPeca } from "./secao-peca-conclusao";

type ErrosDaPeca = { perdidas?: string; destino?: string; custo?: string };

// As chaves de campo que `concluirOrdem` devolve: `perdidas-{id}`, `destino-{id}`, `custo-{id}`.
function errosPorPeca(campos: Record<string, string> | undefined): Record<string, ErrosDaPeca> {
  const porPeca: Record<string, ErrosDaPeca> = {};
  for (const [chave, frase] of Object.entries(campos ?? {})) {
    const separador = chave.indexOf("-");
    const tipo = chave.slice(0, separador);
    const pecaId = chave.slice(separador + 1);
    if (tipo === "perdidas" || tipo === "destino" || tipo === "custo") {
      porPeca[pecaId] = { ...porPeca[pecaId], [tipo]: frase };
    }
  }
  return porPeca;
}

export type FolhaConclusaoProps = {
  ordemId: string;
  tipo: TipoOrdem;
  // A venda do orçamento que abriu a ordem — "O saldo a receber continua no Caixa (venda nº {N})".
  vendaNumero: number | null;
  pecas: PecaParaConcluir[];
  aoFechar: () => void;
};

// A folha de conclusão (UI-SPEC §"Folha de conclusão (diálogo)"): tela toda no celular,
// `md:max-w-lg`, fechar próprio 44×44. A dica do topo; uma seção por peça (só "Quantas se
// perderam" se digita — o resto sai do módulo puro, no cliente para mostrar e de novo no servidor
// para gravar); a nota do fim; o rodapé preso com "Voltar" e "Concluir ordem" / "Concluir como
// entrega parcial" (o rótulo troca na hora), "Concluindo…" em voo. Erros embaixo do campo; a recusa
// de estado mudado (já concluída noutro celular) vira toast e a tela recarrega. Sucesso: toast,
// fecha e recarrega.
//
// Quem abre a monta com `key` nova a cada abertura: nasce limpa.
export function FolhaConclusao({ ordemId, tipo, vendaNumero, pecas, aoFechar }: FolhaConclusaoProps) {
  const router = useRouter();
  const [valores, setValores] = useState<Record<string, ValoresDaPeca>>(() =>
    Object.fromEntries(
      pecas.map((peca) => [peca.id, { perdidasTexto: "", destino: null, custoTexto: "" }]),
    ),
  );
  const [erros, setErros] = useState<Record<string, ErrosDaPeca>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Guarda síncrona contra o toque duplo: o `disabled` só vale depois do próximo desenho.
  const emVoo = useRef(false);
  const camposPerdidas = useRef<(HTMLInputElement | null)[]>([]);
  const botaoConcluir = useRef<HTMLButtonElement>(null);

  const lidas = pecas.map((peca) => ({ peca, lida: lerPeca(peca, tipo, valores[peca.id]) }));
  const parcial = lidas.some(({ lida }) => lida.faltam > 0);
  const boasDaCasa = lidas.reduce((total, { lida }) => total + lida.paraEstoque, 0);

  function mudar(pecaId: string, novos: ValoresDaPeca) {
    setValores((atuais) => ({ ...atuais, [pecaId]: novos }));
    setErros((atuais) => {
      if (!atuais[pecaId]) {
        return atuais;
      }
      const { [pecaId]: _removido, ...resto } = atuais;
      void _removido;
      return resto;
    });
  }

  function focarPrimeiroErro(novos: Record<string, ErrosDaPeca>) {
    window.requestAnimationFrame(() => {
      const indice = pecas.findIndex((peca) => novos[peca.id] !== undefined);
      if (indice === -1) {
        return;
      }
      const erro = novos[pecas[indice].id];
      const alvo = erro.custo
        ? document.getElementById(`conclusao-${pecas[indice].id}-custo`)
        : camposPerdidas.current[indice];
      alvo?.focus();
    });
  }

  async function concluir() {
    if (emVoo.current) {
      return;
    }
    // Conferência antes de enviar (conveniência — o servidor confere tudo de novo).
    const locais: Record<string, ErrosDaPeca> = {};
    for (const { peca, lida } of lidas) {
      if (!lida.derivada.ok) {
        locais[peca.id] = { perdidas: lida.derivada.frase };
      } else if (lida.precisaDeCusto && valores[peca.id].custoTexto.trim() === "") {
        locais[peca.id] = { custo: FRASE_CUSTO_DE_CADA_PECA_VAZIO };
      }
    }
    if (Object.keys(locais).length > 0) {
      setErros(locais);
      focarPrimeiroErro(locais);
      return;
    }

    emVoo.current = true;
    setEnviando(true);
    setErroGeral(null);
    try {
      const resposta = await concluirOrdem({
        ordemId,
        pecas: lidas.map(({ peca, lida }) => ({
          pecaId: peca.id,
          perdidasTexto: valores[peca.id].perdidasTexto,
          destino: lida.destino,
          custoTexto: lida.precisaDeCusto ? valores[peca.id].custoTexto : null,
        })),
      });
      if (resposta.ok) {
        toast.success(textoToastConclusao(resposta.dados));
        aoFechar();
        router.refresh();
        return;
      }
      if (resposta.recarregar) {
        // O estado mudou (outro celular): a folha fecha junto com a tela velha — a frase fica no
        // toast, que sobrevive à recarga.
        toast.error(resposta.erro);
        aoFechar();
        router.refresh();
        return;
      }
      const porPeca = errosPorPeca(resposta.campos);
      if (Object.keys(porPeca).length > 0) {
        setErros(porPeca);
        focarPrimeiroErro(porPeca);
      } else {
        setErroGeral(resposta.erro);
      }
    } catch (falha) {
      console.error("Falha ao concluir a ordem:", falha);
      setErroGeral(FRASE_FALHA_AO_CONCLUIR);
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
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
        data-testid="folha-conclusao"
        onOpenAutoFocus={(evento) => {
          // No celular nada recebe foco ao abrir — o teclado cobriria a folha.
          evento.preventDefault();
          if (window.matchMedia("(min-width: 768px)").matches) {
            camposPerdidas.current[0]?.focus();
          }
        }}
        className={CLASSE_DA_FOLHA}
      >
        <DialogHeader className="border-border flex flex-row items-start justify-between gap-4 border-b px-6 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="text-titulo text-tinta">{tituloDaFolhaDeConclusao(tipo)}</DialogTitle>
            <DialogDescription className="text-apoio text-tinta-media">{DICA_CONCLUSAO}</DialogDescription>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            data-testid="folha-conclusao-fechar"
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
            void concluir();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-2">
            {pecas.map((peca, indice) => (
              <SecaoPecaConclusao
                key={peca.id}
                peca={peca}
                tipo={tipo}
                valores={valores[peca.id]}
                aoMudar={(novos) => mudar(peca.id, novos)}
                erros={erros[peca.id] ?? {}}
                desabilitado={enviando}
                campoPerdidasRef={(elemento) => {
                  camposPerdidas.current[indice] = elemento;
                }}
                aoAvancar={() => {
                  const proximo = camposPerdidas.current[indice + 1];
                  if (proximo) {
                    proximo.focus();
                  } else {
                    botaoConcluir.current?.focus();
                  }
                }}
              />
            ))}
            <p data-testid="conclusao-nota" className="text-apoio text-tinta-media py-4">
              {tipo === "encomenda" ? textoNotaDaEncomenda(vendaNumero) : textoNotaDaCasa(boasDaCasa)}
            </p>
          </div>

          {/* Rodapé preso por FLEX, fora da área rolável: o erro de gravação e os dois botões. */}
          <div className="border-border bg-popover flex flex-col gap-3 border-t px-6 py-4">
            {erroGeral ? (
              <p role="alert" data-testid="conclusao-erro" className="text-apoio text-erro">
                {erroGeral}
              </p>
            ) : null}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                data-testid="conclusao-voltar"
                disabled={enviando}
                onClick={aoFechar}
                className="text-corpo h-auto min-h-[52px] px-4 font-semibold"
              >
                {ROTULO_VOLTAR}
              </Button>
              <button
                ref={botaoConcluir}
                type="submit"
                data-testid="conclusao-gravar"
                disabled={enviando}
                aria-busy={enviando}
                className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[52px] flex-1 items-center justify-center rounded-md px-4 leading-tight font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviando ? ROTULO_CONCLUINDO : parcial ? ROTULO_CONCLUIR_PARCIAL : ROTULO_CONCLUIR_ORDEM}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
