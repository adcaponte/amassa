"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";

import { ROTULO_UNIDADE } from "@/lib/cadastros/catalogo";
import { converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { ROTULO_AREA } from "@/lib/financeiro/textos";
import { confirmarContagem } from "@/lib/estoque/acoes";
import type { MaterialDaContagem } from "@/lib/estoque/consultas";
import {
  modoDoMaterial,
  planejarContagem,
  previaDaContagem,
  type ModoDaContagem,
} from "@/lib/estoque/contagem";
import { contadoParaMilesimos } from "@/lib/estoque/esquemas";
import { horaEmBrasilia } from "@/lib/estoque/historico";
import { custoPreenchidoDaPecaPronta, textoDeMilesimos } from "@/lib/estoque/saldo";
import {
  FRASE_CONTADO_VAZIO,
  FRASE_FALHA_AO_GRAVAR_CONTAGEM,
  ROTULO_CONFIRMAR_CONTAGEM,
  ROTULO_CONTADO_DA_CONTAGEM,
  ROTULO_CONTAR_DE_NOVO,
  ROTULO_CUSTOU_AO_TODO,
  ROTULO_GRAVANDO,
  TEXTO_CONFERIDO_JA_CERTO,
  anuncioDaContagem,
  anuncioDaContagemConferida,
  ariaContadoDaContagem,
  ariaCustouAoTodo,
  dicaCustouAoTodo,
  textoContadoGravado,
  textoEmUnidade,
} from "@/lib/estoque/textos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { PontoDaArea } from "./cartao-saldo";

// Uma linha da contagem (UI-SPEC §Contagem do estoque, D-17 refinado, D-18, D-32, UI-D16).
//
// CONTAGEM ÀS CEGAS: o saldo do sistema não aparece antes de a pessoa digitar — ele só surge na
// prévia "o saldo passa de X para Y {un}", depois do número ("Conte, não calcule"). A prévia usa
// `planejarContagem`, a MESMA regra que o servidor aplica sob a trava; o servidor é quem vale, e a
// linha compacta diz o que foi GRAVADO. Sem rascunho: cada linha grava ao ser confirmada.
//
// Enter no "Contado" confirma e leva o foco ao "Contado" da próxima linha aberta (o "Próximo" do
// teclado do celular); com o campo vazio, só passa adiante — vazio não mexe no material.

export const SELETOR_DO_CONTADO = '[data-testid="contagem-contado"]';

type Gravada = {
  gravou: boolean;
  saldoDepoisMilesimos: number;
  hora: string;
};

type ErroDaLinha = { texto: string; campo: "contado" | "custou" | null };

function centavosParaCampo(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

// O "Contado" que vem depois deste, na ordem da tela — lido ANTES de gravar (depois, esta linha
// fica compacta e o campo dela some).
function proximoContado(atual: HTMLInputElement | null): HTMLInputElement | null {
  if (atual === null) {
    return null;
  }
  const todos = [...document.querySelectorAll<HTMLInputElement>(SELETOR_DO_CONTADO)];
  return todos[todos.indexOf(atual) + 1] ?? null;
}

export type LinhaContagemProps = {
  item: MaterialDaContagem;
  // Avisa a lista para o progresso "{c} de {t} contados hoje".
  aoConfirmar: (itemId: string) => void;
};

export function LinhaContagem({ item, aoConfirmar }: LinhaContagemProps) {
  const id = useId();
  const campoContado = useRef<HTMLInputElement | null>(null);
  const unidade = ROTULO_UNIDADE[item.unidade];

  const [contadoTexto, setContadoTexto] = useState("");
  const [custouDigitado, setCustouDigitado] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<ErroDaLinha | null>(null);
  const [anuncio, setAnuncio] = useState("");
  // O que o servidor viu por último (saldo e modo) — vale mais que o da página.
  const [saldoDoServidor, setSaldoDoServidor] = useState<number | null>(null);
  const [modoDoServidor, setModoDoServidor] = useState<ModoDaContagem | null>(null);
  // Contado HOJE, lido do banco: a linha já começa compacta (sobrevive a recarregar).
  const [gravada, setGravada] = useState<Gravada | null>(() =>
    item.contadoHojeEm !== null && item.contadoHojeMilesimos !== null
      ? {
          gravou: true,
          saldoDepoisMilesimos: item.contadoHojeMilesimos,
          hora: horaEmBrasilia(new Date(item.contadoHojeEm)),
        }
      : null,
  );

  const saldo = saldoDoServidor ?? item.saldoMilesimos;
  const modo = modoDoServidor ?? modoDoMaterial(item);
  const contado = contadoParaMilesimos(contadoTexto);
  const temNumero = contadoTexto.trim() !== "" && contado.ok;
  const diferenca = temNumero ? contado.milesimos - saldo : 0;
  const pedeCusto = temNumero && modo === "primeira" && diferenca > 0;

  // Peça pronta com ficha: "Custou ao todo" vem preenchido pela ficha × a diferença (D-22), até a
  // pessoa editar.
  const custouPreenchido =
    pedeCusto && item.custoPorPecaCentavos !== null
      ? centavosParaCampo(
          custoPreenchidoDaPecaPronta({
            custoPorPecaCentavos: item.custoPorPecaCentavos,
            quantidadeMilesimos: diferenca,
          }),
        )
      : "";
  const custouTexto = custouDigitado ?? custouPreenchido;

  async function confirmar(moverFoco: boolean) {
    if (gravando) {
      return;
    }
    const proximo = moverFoco ? proximoContado(campoContado.current) : null;

    if (contadoTexto.trim() === "") {
      if (moverFoco) {
        proximo?.focus();
        return;
      }
      setErro({ texto: FRASE_CONTADO_VAZIO, campo: "contado" });
      return;
    }
    if (!contado.ok) {
      setErro({ texto: contado.erro, campo: "contado" });
      return;
    }
    // A mesma regra do servidor, antes de ir até ele: primeira contagem que ficou positiva sem custo.
    const custo = converterReaisParaCentavos(custouTexto);
    const plano = planejarContagem({
      modo,
      saldoMilesimos: saldo,
      contadoMilesimos: contado.milesimos,
      custouCentavos: custo.ok ? custo.centavos : null,
    });
    if (plano.tipo === "recusa") {
      setErro({ texto: plano.erro, campo: "custou" });
      return;
    }

    setGravando(true);
    setErro(null);
    try {
      const resultado = await confirmarContagem({
        itemId: item.id,
        contadoTexto,
        custouTexto: pedeCusto ? custouTexto : "",
        // Revisão WR-03: o saldo contra o qual a dica do custo foi calculada. Se o do servidor for
        // outro, ele recusa e devolve o novo — a dica abaixo se refaz com a diferença certa.
        saldoEsperadoMilesimos: saldo,
      });
      if (!resultado.ok) {
        if (resultado.saldoMilesimos !== null) {
          setSaldoDoServidor(resultado.saldoMilesimos);
        }
        setErro({ texto: resultado.erro, campo: resultado.campo });
        return;
      }
      const dados = resultado.dados;
      setSaldoDoServidor(dados.saldoDepoisMilesimos);
      setModoDoServidor(dados.gravou ? "conferencia" : dados.modo);
      setGravada({
        gravou: dados.gravou,
        saldoDepoisMilesimos: dados.saldoDepoisMilesimos,
        hora: horaEmBrasilia(new Date(dados.confirmadaEm)),
      });
      setAnuncio(
        dados.gravou
          ? anuncioDaContagem(
              item.nome,
              textoDeMilesimos(dados.saldoAntesMilesimos),
              textoDeMilesimos(dados.saldoDepoisMilesimos),
              unidade,
            )
          : anuncioDaContagemConferida(item.nome),
      );
      aoConfirmar(item.id);
      proximo?.focus();
    } catch (falha) {
      console.error("Falha ao gravar a contagem:", falha);
      setErro({ texto: FRASE_FALHA_AO_GRAVAR_CONTAGEM, campo: null });
    } finally {
      setGravando(false);
    }
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Enter") {
      evento.preventDefault();
      void confirmar(true);
    }
  }

  function contarDeNovo() {
    setGravada(null);
    setContadoTexto("");
    setCustouDigitado(null);
    setErro(null);
    requestAnimationFrame(() => campoContado.current?.focus());
  }

  const idContado = `${id}-contado`;
  const idCustou = `${id}-custou`;
  const idDica = `${id}-dica`;
  const idErro = `${id}-erro`;

  return (
    <li
      data-testid="contagem-linha"
      data-item-id={item.id}
      className="border-borda border-b py-4 last:border-b-0"
    >
      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>

      {gravada ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-corpo text-foreground font-semibold break-words">{item.nome}</span>
            <span data-testid="contagem-feito" className="text-apoio text-sucesso font-semibold tabular-nums">
              {gravada.gravou
                ? textoContadoGravado(textoDeMilesimos(gravada.saldoDepoisMilesimos), unidade, gravada.hora)
                : TEXTO_CONFERIDO_JA_CERTO}
            </span>
          </div>
          <Button
            type="button"
            variant="link"
            data-testid="contagem-contar-de-novo"
            onClick={contarDeNovo}
            className="text-apoio text-acento min-h-[44px] px-0"
          >
            {ROTULO_CONTAR_DE_NOVO}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 min-[980px]:grid min-[980px]:grid-cols-[minmax(0,2fr)_7rem_9rem_10rem_minmax(0,2fr)_auto] min-[980px]:items-end min-[980px]:gap-4">
          <div className="flex min-w-0 flex-col gap-1 min-[980px]:self-center">
            <span className="text-corpo text-foreground font-semibold break-words">{item.nome}</span>
            <span className="text-apoio text-muted-foreground">{textoEmUnidade(unidade)}</span>
          </div>

          <span className="text-apoio text-muted-foreground hidden items-center gap-2 min-[980px]:inline-flex min-[980px]:self-center">
            <PontoDaArea area={item.area} />
            {ROTULO_AREA[item.area]}
          </span>

          <div className="flex flex-col gap-1">
            <label htmlFor={idContado} className="text-apoio text-tinta font-semibold">
              {ROTULO_CONTADO_DA_CONTAGEM}
            </label>
            <Input
              id={idContado}
              ref={campoContado}
              data-testid="contagem-contado"
              inputMode="decimal"
              enterKeyHint="next"
              autoComplete="off"
              aria-label={ariaContadoDaContagem(item.nome, unidade)}
              aria-invalid={erro?.campo === "contado"}
              aria-describedby={erro?.campo === "contado" ? idErro : undefined}
              value={contadoTexto}
              onChange={(evento) => {
                setContadoTexto(evento.target.value);
                if (erro?.campo === "contado") {
                  setErro(null);
                }
              }}
              onKeyDown={aoTeclar}
              className="text-corpo md:text-corpo min-h-[44px] tabular-nums"
            />
          </div>

          <div className={cn("flex flex-col gap-1", !pedeCusto && "hidden min-[980px]:block")}>
            {pedeCusto ? (
              <>
                <label htmlFor={idCustou} className="text-apoio text-tinta font-semibold">
                  {ROTULO_CUSTOU_AO_TODO}
                </label>
                <Input
                  id={idCustou}
                  data-testid="contagem-custou"
                  inputMode="decimal"
                  enterKeyHint="next"
                  autoComplete="off"
                  placeholder="R$ 0,00"
                  aria-label={ariaCustouAoTodo(item.nome)}
                  aria-invalid={erro?.campo === "custou"}
                  aria-describedby={cn(idDica, erro?.campo === "custou" && idErro)}
                  value={custouTexto}
                  onChange={(evento) => {
                    setCustouDigitado(evento.target.value);
                    if (erro?.campo === "custou") {
                      setErro(null);
                    }
                  }}
                  onKeyDown={aoTeclar}
                  className="text-corpo md:text-corpo min-h-[44px] tabular-nums"
                />
                <p id={idDica} className="text-apoio text-tinta-fraca">
                  {dicaCustouAoTodo(textoDeMilesimos(diferenca), unidade)}
                </p>
              </>
            ) : null}
          </div>

          <p
            data-testid="contagem-previa"
            aria-live="polite"
            className="text-apoio text-tinta tabular-nums min-[980px]:self-center"
          >
            {temNumero
              ? previaDaContagem({ saldoMilesimos: saldo, contadoMilesimos: contado.milesimos, unidade: item.unidade })
              : ""}
          </p>

          <Button
            type="button"
            variant="outline"
            data-testid="contagem-confirmar"
            disabled={gravando}
            aria-busy={gravando ? "true" : undefined}
            onClick={() => void confirmar(false)}
            className="text-corpo min-h-[44px] px-4 font-semibold"
          >
            {gravando ? ROTULO_GRAVANDO : ROTULO_CONFIRMAR_CONTAGEM}
          </Button>

          {erro ? (
            <p
              id={idErro}
              role="alert"
              data-testid="contagem-erro"
              className="text-apoio text-erro min-[980px]:col-span-6"
            >
              {erro.texto}
            </p>
          ) : null}
        </div>
      )}
    </li>
  );
}
