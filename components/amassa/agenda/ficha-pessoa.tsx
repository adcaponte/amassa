"use client";

import { X } from "lucide-react";

import type { TurmaDaPessoa, VindaDaPessoa } from "@/lib/agenda/consultas";
import {
  FRASE_AINDA_NAO_VEIO,
  FRASE_ERRO_CARREGAR_FICHA,
  ROTULO_EDITAR,
  ROTULO_FECHAR,
  ROTULO_PRONTO,
  ROTULO_QUADRO_A_RECEBER,
  ROTULO_QUADRO_A_REPOR,
  ROTULO_SEM_TELEFONE,
  ROTULO_TENTAR_DE_NOVO,
  TAG_FALTOU,
  TAG_REPOE,
  TAG_VEIO,
  TITULO_FICHA,
  TITULO_ULTIMAS_VINDAS,
  linhaDeVinda,
  tituloDaVindaDeUsoLivre,
  unidadeDoQuadroARepor,
} from "@/lib/agenda/textos";
import type { ClienteDaLista } from "@/lib/clientes/consultas";
import { formatarReais } from "@/lib/financeiro/formato";
import { formatarDiaMes } from "@/lib/producao/calendario";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CLASSE_DA_FOLHA } from "@/components/amassa/estoque/folha-movimentacao";

import { TagDePagamento } from "./cartao-evento";
import { TurmasDaPessoa } from "./turmas-da-pessoa";

const LINHAS_DO_ESQUELETO = [0, 1, 2, 3] as const;

// O que a ficha mostra além do cabeçalho — chega do servidor. `mes` é o mês de hoje ("AAAA-MM"), o da
// mensalidade que a confirmação de sair cita. `aRepor` é o saldo de reposição (derivado das linhas —
// AGE-09); `aReceberCentavos` é o quadro "A RECEBER" (plano 13 — a mesma regra de "A receber", recortada
// pela pessoa, com a mensalidade do mês já garantida — D-02).
export type ConteudoDaFicha = {
  vindas: VindaDaPessoa[];
  turmas: TurmaDaPessoa[];
  mes: string;
  aRepor: number;
  aReceberCentavos: number;
};

export type FichaPessoaProps = {
  // O que a tela já sabia no toque (a linha da lista, a pessoa recém-cadastrada, o homônimo escolhido)
  // — o cabeçalho real aparece antes de o servidor responder. `null` só quando a leitura falhou sem
  // que a tela soubesse quem é (link direto): o título genérico, sem sub-título nem "Editar".
  pessoa: ClienteDaLista | null;
  // `null` enquanto carrega.
  conteudo: ConteudoDaFicha | null;
  // A leitura falhou: a frase e "Tentar de novo" DENTRO da folha.
  falhou: boolean;
  aoFechar: () => void;
  aoEditar: (pessoa: ClienteDaLista) => void;
  aoTentarDeNovo: () => void;
  // "ver turma": abre a folha da turma no lugar da ficha.
  aoAbrirTurma: (turmaId: string, nome: string) => void;
};

// A ficha da pessoa (`?pessoa={id}`, 05-UI-SPEC.md §"Ficha da pessoa"): diálogo de tela toda no
// celular, `max-w-lg` a partir de `md`. Cabeçalho: o nome (Título, quebra livre) + "Editar" (abre o
// formulário de pessoa no lugar — UI-D24) + fechar 44×44; sub-título o telefone ou "sem telefone".
// "Turmas fixas" (entrar e sair — plano 07), "Últimas vindas" (até 8, mais recentes primeiro) e "Pronto"
// no rodapé.
export function FichaPessoa({
  pessoa,
  conteudo,
  falhou,
  aoFechar,
  aoEditar,
  aoTentarDeNovo,
  aoAbrirTurma,
}: FichaPessoaProps) {
  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto) {
          aoFechar();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        data-testid="ficha-pessoa"
        data-cliente-id={pessoa?.id}
        {...(pessoa === null ? { "aria-describedby": undefined } : {})}
        onOpenAutoFocus={(evento) => evento.preventDefault()}
        className={CLASSE_DA_FOLHA}
      >
        <DialogHeader className="border-border flex flex-row items-start justify-between gap-2 border-b px-6 py-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle className="text-titulo text-tinta break-words">{pessoa?.nome ?? TITULO_FICHA}</DialogTitle>
            {pessoa !== null ? (
              <DialogDescription className="text-apoio text-tinta-fraca break-words" data-testid="ficha-telefone">
                {pessoa.telefone ?? ROTULO_SEM_TELEFONE}
              </DialogDescription>
            ) : null}
          </div>
          <div className="flex shrink-0 items-start gap-1">
            {pessoa !== null ? (
              <Button
                type="button"
                variant="outline"
                data-testid="ficha-editar"
                onClick={() => aoEditar(pessoa)}
                className="text-corpo min-h-[44px] px-4"
              >
                {ROTULO_EDITAR}
              </Button>
            ) : null}
            <button
              type="button"
              aria-label={ROTULO_FECHAR}
              data-testid="ficha-pessoa-fechar"
              onClick={aoFechar}
              className="hover:bg-muted text-tinta flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {falhou ? (
            <div role="alert" className="flex flex-col items-start gap-3" data-testid="ficha-erro">
              <p className="text-corpo text-tinta">{FRASE_ERRO_CARREGAR_FICHA}</p>
              <Button type="button" variant="outline" onClick={aoTentarDeNovo} className="text-corpo min-h-[44px] px-4">
                {ROTULO_TENTAR_DE_NOVO}
              </Button>
            </div>
          ) : conteudo === null ? (
            <div aria-busy="true" className="flex flex-col gap-3" data-testid="ficha-carregando">
              <Skeleton className="h-4 w-40" />
              {LINHAS_DO_ESQUELETO.map((linha) => (
                <Skeleton key={linha} className="h-11 w-full" />
              ))}
            </div>
          ) : (
            <>
              {/* Os quadros (05-UI-SPEC.md §"Ficha da pessoa"): "A REPOR" {n} "aula"/"aulas" e "A RECEBER"
                  {R$} ("R$ 0,00" quando nada) — o número Display, `tabular-nums`, quebrando dentro do quadro. */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  data-testid="quadro-a-repor"
                  className="bg-superficie-2 flex min-w-0 flex-col gap-1 rounded-md p-3"
                >
                  <span className="text-apoio text-tinta-media font-semibold tracking-[0.06em]">
                    {ROTULO_QUADRO_A_REPOR}
                  </span>
                  <span className="text-tinta flex flex-wrap items-baseline gap-x-2">
                    <span data-testid="quadro-a-repor-numero" className="text-display font-semibold tabular-nums">
                      {conteudo.aRepor}
                    </span>
                    <span className="text-apoio text-tinta-media">{unidadeDoQuadroARepor(conteudo.aRepor)}</span>
                  </span>
                </div>
                <div
                  data-testid="quadro-a-receber"
                  className="bg-superficie-2 flex min-w-0 flex-col gap-1 rounded-md p-3"
                >
                  <span className="text-apoio text-tinta-media font-semibold tracking-[0.06em]">
                    {ROTULO_QUADRO_A_RECEBER}
                  </span>
                  <span
                    data-testid="quadro-a-receber-valor"
                    className="text-display text-tinta font-semibold tabular-nums [overflow-wrap:anywhere]"
                  >
                    {formatarReais(conteudo.aReceberCentavos)}
                  </span>
                </div>
              </div>
              {pessoa !== null ? (
                <TurmasDaPessoa
                  pessoa={{ id: pessoa.id, nome: pessoa.nome }}
                  turmas={conteudo.turmas}
                  mes={conteudo.mes}
                  aoAbrirTurma={aoAbrirTurma}
                />
              ) : null}
              <section className="flex flex-col gap-2" aria-labelledby="ficha-ultimas-vindas">
                <h3
                  id="ficha-ultimas-vindas"
                  className="text-apoio text-tinta-media font-semibold tracking-[0.06em] uppercase"
                >
                  {TITULO_ULTIMAS_VINDAS}
                </h3>
                {conteudo.vindas.length === 0 ? (
                  <p className="text-corpo text-tinta-fraca" data-testid="ficha-sem-vindas">
                    {FRASE_AINDA_NAO_VEIO}
                  </p>
                ) : (
                  <ul className="divide-border flex flex-col divide-y" data-testid="ficha-vindas">
                    {conteudo.vindas.map((vinda) => (
                      <li
                        key={`${vinda.tipo}:${vinda.id}`}
                        data-testid="ficha-vinda"
                        data-tipo={vinda.tipo}
                        className="flex min-h-[44px] items-center justify-between gap-3 py-2"
                      >
                        <span className="text-corpo text-tinta min-w-0 break-words">
                          {linhaDeVinda(
                            formatarDiaMes(vinda.data),
                            vinda.tipo === "uso_livre" ? tituloDaVindaDeUsoLivre(vinda.horas) : vinda.titulo,
                          )}
                        </span>
                        {vinda.tipo === "uso_livre" ? (
                          vinda.pagamento !== null ? (
                            <span className="flex shrink-0 flex-wrap justify-end gap-1">
                              <TagDePagamento pagamento={vinda.pagamento} className="text-apoio" />
                            </span>
                          ) : null
                        ) : vinda.presenca !== null ? (
                          <span className="flex shrink-0 flex-wrap justify-end gap-1">
                            <span
                              className={cn(
                                "text-apoio rounded-sm px-2 font-semibold",
                                vinda.presenca === "veio" ? "bg-sucesso-fundo text-sucesso" : "bg-erro-fundo text-erro",
                              )}
                            >
                              {vinda.presenca === "veio" ? TAG_VEIO : TAG_FALTOU}
                            </span>
                            {vinda.presenca === "faltou" && vinda.direitoARepor ? (
                              <span
                                data-testid="tag-repoe"
                                className="text-apoio bg-atencao-fundo text-atencao rounded-sm px-2 font-semibold"
                              >
                                {TAG_REPOE}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>

        <div className="border-border bg-popover flex justify-end border-t px-6 py-4">
          <Button
            type="button"
            variant="default"
            data-testid="ficha-pronto"
            onClick={aoFechar}
            className="text-corpo min-h-[52px] px-6 font-semibold"
          >
            {ROTULO_PRONTO}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
