"use client";

import { useRef, type FocusEvent, type MouseEvent, type PointerEvent } from "react";
import { X } from "lucide-react";

import type { CatalogoDaNovaOrdem } from "@/lib/producao/consultas";
import type { TipoOrdem } from "@/lib/producao/etapas";
import {
  GRUPO_PECAS_DE_LINHA,
  GRUPO_PECAS_EXCLUSIVAS,
  GRUPO_PECAS_PRECIFICADAS,
  NOTA_PECA_SEM_FICHA,
  OPCAO_OUTRA_PECA,
  PLACEHOLDER_PECA,
  ROTULO_NOME_DA_PECA,
  ROTULO_PECA,
  ROTULO_QUANTAS,
  ariaTirarPeca,
} from "@/lib/producao/textos";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Uma peça da "Nova ordem" ainda não gravada. `escolha` é o valor do seletor: "" (nada escolhido),
// "ficha:{id}" ou "livre" (a opção de escrever o nome — só na encomenda, D-04). Fase 06.5, D-01
// ("a-ficha", dono em 06/10/2026): só peça com ficha vira ordem — o "item:{id}" (item do estoque sem
// ficha) deixou de existir; um valor desconhecido é lido como "nada escolhido".
export type LinhaDaNovaOrdem = {
  chave: number;
  escolha: string;
  descricao: string;
  quantidade: string;
};

export const ESCOLHA_LIVRE = "livre";

export type EscolhaLida =
  | { origem: "ficha"; id: string }
  | { origem: "livre" }
  | { origem: "" };

export function lerEscolha(escolha: string): EscolhaLida {
  if (escolha === ESCOLHA_LIVRE) {
    return { origem: "livre" };
  }
  const [origem, id] = escolha.split(":");
  if (origem === "ficha" && id) {
    return { origem, id };
  }
  return { origem: "" };
}

// O nome do que foi escolhido (para o `aria-label` do "X" e para levar o nome do item quando o tipo
// vira Encomenda) — `null` quando nada foi escolhido ainda.
export function nomeDaEscolha(
  linha: LinhaDaNovaOrdem,
  catalogo: CatalogoDaNovaOrdem | null,
): string | null {
  const lida = lerEscolha(linha.escolha);
  if (lida.origem === "livre") {
    const texto = linha.descricao.trim();
    return texto === "" ? null : texto;
  }
  if (lida.origem === "" || catalogo === null) {
    return null;
  }
  const lista = [...catalogo.fichasDeLinha, ...catalogo.fichasExclusivas];
  return lista.find((opcao) => opcao.id === lida.id)?.nome ?? null;
}

export type LinhaPecaNovaOrdemProps = {
  // 1, 2, 3… — o número que a pessoa lê ("Tirar a peça 2") e o dos `data-testid`.
  numero: number;
  linha: LinhaDaNovaOrdem;
  tipo: TipoOrdem;
  catalogo: CatalogoDaNovaOrdem;
  erroDaPeca: string | null;
  erroDaQuantidade: string | null;
  podeTirar: boolean;
  desabilitada: boolean;
  aoMudar: (mudanca: Partial<Omit<LinhaDaNovaOrdem, "chave">>) => void;
  aoTirar: () => void;
  registrarCampoDaPeca: (elemento: HTMLElement | null) => void;
  registrarCampoDaQuantidade: (elemento: HTMLElement | null) => void;
};

// "Quantas" vem com "1" e, ao tocar, seleciona tudo: o que se digita SUBSTITUI o 1 (Cowork,
// 30/09/2026: "2" digitado sem apagar virava "12"; o dono decidiu manter o 1 e selecionar). Três
// pedaços, por causa do celular:
// - `onFocus` seleciona — basta no foco por teclado (Tab).
// - No toque/clique, o `mouseup` que vem DEPOIS do foco põe o cursor no ponto tocado e desfaz a
//   seleção (Safari do iOS e Chrome). O `pointerdown` marca "este toque deu o foco" (o campo ainda
//   não estava focado) e o `mouseup` seguinte é impedido — só esse; os toques seguintes, com o campo
//   já focado, posicionam o cursor normalmente.
// - O iOS ainda pode aplicar o cursor depois do quadro do foco; a seleção é refeita no próximo
//   ciclo, se o campo continuar focado.
function useSelecionarTudoAoFocar() {
  const focoPeloToque = useRef(false);
  return {
    onPointerDown: (evento: PointerEvent<HTMLInputElement>) => {
      focoPeloToque.current = document.activeElement !== evento.currentTarget;
    },
    onFocus: (evento: FocusEvent<HTMLInputElement>) => {
      const campo = evento.currentTarget;
      campo.select();
      window.setTimeout(() => {
        if (document.activeElement === campo) {
          campo.setSelectionRange(0, campo.value.length);
        }
      }, 0);
    },
    onMouseUp: (evento: MouseEvent<HTMLInputElement>) => {
      if (focoPeloToque.current) {
        focoPeloToque.current = false;
        evento.preventDefault();
      }
    },
  };
}

const CLASSE_DO_ITEM = "text-corpo min-h-[44px] py-2 whitespace-normal [overflow-wrap:anywhere]";
const CLASSE_DO_GRUPO = "text-apoio text-tinta-media font-semibold";

// Uma linha do bloco "Peças" (UI-SPEC §"Folha Nova ordem", item 5): fundo `superficie-2`, o `Select`
// agrupado por tipo (UI-D7), "Nome da peça" quando é a opção de escrever, "Quantas" e o "X" de tirar
// (da 2ª em diante). A nota do D-04 aparece embaixo quando a peça fica sem ficha — o texto livre da
// encomenda. Não bloqueia.
export function LinhaPecaNovaOrdem({
  numero,
  linha,
  tipo,
  catalogo,
  erroDaPeca,
  erroDaQuantidade,
  podeTirar,
  desabilitada,
  aoMudar,
  aoTirar,
  registrarCampoDaPeca,
  registrarCampoDaQuantidade,
}: LinhaPecaNovaOrdemProps) {
  const selecionarTudoAoFocar = useSelecionarTudoAoFocar();
  const lida = lerEscolha(linha.escolha);
  const ehLivre = lida.origem === "livre";
  const semFicha = ehLivre;
  const ehCasa = tipo === "casa";

  const idSelect = `nova-ordem-peca-${numero}`;
  const idNome = `nova-ordem-peca-nome-${numero}`;
  const idQuantidade = `nova-ordem-quantidade-${numero}`;
  const idErroDaPeca = `nova-ordem-erro-peca-${numero}`;
  const idErroDaQuantidade = `nova-ordem-erro-quantidade-${numero}`;
  const idNota = `nova-ordem-nota-${numero}`;
  // O erro da peça vai para baixo do nome escrito quando é texto livre; senão, do seletor.
  const erroNoSeletor = erroDaPeca !== null && !ehLivre ? erroDaPeca : null;
  const erroNoNome = erroDaPeca !== null && ehLivre ? erroDaPeca : null;

  // D-01 (06.5, "a-ficha"): na casa, só as peças precificadas — o grupo "Itens do estoque" saiu.
  const gruposDaCasa = [
    { rotulo: GRUPO_PECAS_PRECIFICADAS, prefixo: "ficha", opcoes: catalogo.fichasDeLinha },
  ];
  const gruposDaEncomenda = [
    { rotulo: GRUPO_PECAS_DE_LINHA, prefixo: "ficha", opcoes: catalogo.fichasDeLinha },
    { rotulo: GRUPO_PECAS_EXCLUSIVAS, prefixo: "ficha", opcoes: catalogo.fichasExclusivas },
  ];
  const grupos = (ehCasa ? gruposDaCasa : gruposDaEncomenda).filter(
    (grupo) => grupo.opcoes.length > 0,
  );

  return (
    <div
      data-testid={`nova-ordem-linha-${numero}`}
      className="bg-superficie-2 flex flex-col gap-3 rounded-md p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label htmlFor={idSelect} className="text-corpo text-tinta font-semibold">
            {ROTULO_PECA}
          </label>
          <Select
            value={linha.escolha}
            onValueChange={(valor) => aoMudar({ escolha: valor })}
            disabled={desabilitada}
          >
            <SelectTrigger
              id={idSelect}
              ref={ehLivre ? undefined : registrarCampoDaPeca}
              data-testid={idSelect}
              aria-invalid={erroNoSeletor !== null}
              aria-describedby={
                [erroNoSeletor ? idErroDaPeca : null, semFicha ? idNota : null]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              className="bg-superficie text-corpo min-h-[44px] w-full data-[size=default]:h-auto"
            >
              <SelectValue placeholder={PLACEHOLDER_PECA} />
            </SelectTrigger>
            <SelectContent
              position="popper"
              className="max-w-[calc(100vw-2rem)]"
              data-testid={`nova-ordem-opcoes-${numero}`}
            >
              {grupos.map((grupo) => (
                <SelectGroup key={grupo.rotulo}>
                  <SelectLabel className={CLASSE_DO_GRUPO}>{grupo.rotulo}</SelectLabel>
                  {grupo.opcoes.map((opcao) => (
                    <SelectItem
                      key={`${grupo.prefixo}:${opcao.id}`}
                      value={`${grupo.prefixo}:${opcao.id}`}
                      className={CLASSE_DO_ITEM}
                    >
                      {opcao.nome}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
              {ehCasa ? null : (
                <SelectGroup>
                  <SelectItem value={ESCOLHA_LIVRE} className={cn(CLASSE_DO_ITEM, "font-semibold")}>
                    {OPCAO_OUTRA_PECA}
                  </SelectItem>
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          {erroNoSeletor ? (
            <p
              id={idErroDaPeca}
              role="alert"
              data-testid="nova-ordem-erro"
              data-campo={`peca-${numero}`}
              className="text-apoio text-erro"
            >
              {erroNoSeletor}
            </p>
          ) : null}
        </div>

        <div className="flex w-24 shrink-0 flex-col gap-2">
          <label htmlFor={idQuantidade} className="text-corpo text-tinta font-semibold">
            {ROTULO_QUANTAS}
          </label>
          <Input
            id={idQuantidade}
            ref={registrarCampoDaQuantidade}
            data-testid={idQuantidade}
            inputMode="numeric"
            autoComplete="off"
            disabled={desabilitada}
            aria-invalid={erroDaQuantidade !== null}
            aria-describedby={erroDaQuantidade ? idErroDaQuantidade : undefined}
            value={linha.quantidade}
            onChange={(evento) => aoMudar({ quantidade: evento.target.value })}
            {...selecionarTudoAoFocar}
            className="bg-superficie text-corpo md:text-corpo min-h-[44px] w-24 tabular-nums"
          />
        </div>

        {podeTirar ? (
          <button
            type="button"
            data-testid={`nova-ordem-tirar-${numero}`}
            aria-label={ariaTirarPeca(numero, nomeDaEscolha(linha, catalogo))}
            disabled={desabilitada}
            onClick={aoTirar}
            className="hover:bg-muted text-tinta mt-8 flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            <X aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {erroDaQuantidade ? (
        <p
          id={idErroDaQuantidade}
          role="alert"
          data-testid="nova-ordem-erro"
          data-campo={`quantidade-${numero}`}
          className="text-apoio text-erro"
        >
          {erroDaQuantidade}
        </p>
      ) : null}

      {ehLivre ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={idNome} className="text-corpo text-tinta font-semibold">
            {ROTULO_NOME_DA_PECA}
          </label>
          <Input
            id={idNome}
            ref={registrarCampoDaPeca}
            data-testid={idNome}
            autoComplete="off"
            disabled={desabilitada}
            aria-invalid={erroNoNome !== null}
            aria-describedby={[erroNoNome ? idErroDaPeca : null, idNota].filter(Boolean).join(" ")}
            value={linha.descricao}
            onChange={(evento) => aoMudar({ descricao: evento.target.value })}
            className="bg-superficie text-corpo md:text-corpo min-h-[44px]"
          />
          {erroNoNome ? (
            <p
              id={idErroDaPeca}
              role="alert"
              data-testid="nova-ordem-erro"
              data-campo={`peca-${numero}`}
              className="text-apoio text-erro"
            >
              {erroNoNome}
            </p>
          ) : null}
        </div>
      ) : null}

      {semFicha ? (
        <p
          id={idNota}
          data-testid={`nova-ordem-nota-sem-ficha-${numero}`}
          className="text-apoio text-tinta-media"
        >
          {NOTA_PECA_SEM_FICHA}
        </p>
      ) : null}
    </div>
  );
}
