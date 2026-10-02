"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { acrescentarMaterial, definirCobrancaDoMaterial } from "@/lib/agenda/acoes";
import type { MaterialDoUso } from "@/lib/agenda/consultas";
import {
  ARIA_COBRAR_O_MATERIAL,
  DICA_MATERIAL_DO_USO,
  FRASE_ESCOLHA_O_MATERIAL,
  FRASE_FALHA_AO_ACRESCENTAR_MATERIAL,
  FRASE_FALHA_AO_MUDAR_COBRANCA,
  FRASE_MATERIAL_SEM_PRECO,
  ROTULO_ACRESCENTANDO_MATERIAL,
  ROTULO_COBRAR,
  ROTULO_ESCOLHER_MATERIAL,
  ROTULO_INCLUSO,
  ROTULO_ITEM_DO_ESTOQUE,
  ROTULO_MAIS_MATERIAL,
  ROTULO_QUANTO_DO_MATERIAL,
  ROTULO_TROCAR_MATERIAL,
  SUFIXO_MATERIAL_DESATIVADO,
  TEXTO_INCLUSO,
  TEXTO_SEM_MATERIAL,
  TITULO_MATERIAL_USADO,
  dicaQuantoDoMaterial,
  fraseQuantidadeDoMaterial,
  linhaDoMaterial,
} from "@/lib/agenda/textos";
import { valorDaLinhaDeMaterial } from "@/lib/agenda/uso-livre";
import { ROTULO_UNIDADE } from "@/lib/cadastros/catalogo";
import type { AreaFinanceira } from "@/lib/financeiro/textos";
import { formatarReais } from "@/lib/financeiro/formato";
import type { SaldoDoItem } from "@/lib/estoque/consultas";
import { textoParaMilesimos } from "@/lib/estoque/esquemas";
import { textoDeMilesimos } from "@/lib/estoque/saldo";
import {
  FRASE_MATERIAL_NAO_EXISTE_MAIS,
  FRASE_QUANTIDADE_INVALIDA,
  textoSaldoDeAgora,
} from "@/lib/estoque/textos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useEstoque } from "@/components/amassa/estoque/provedor-estoque";
import { SeletorMaterial } from "@/components/amassa/estoque/seletor-material";

import { CLASSE_DO_CAMPO_DA_AGENDA } from "./campos-turma";
import { ConfirmarTirarMaterial } from "./confirmar-tirar-material";

type OpcaoDeCobranca = { valor: boolean; rotulo: string; testId: string };

const OPCOES_DE_COBRANCA: readonly OpcaoDeCobranca[] = [
  { valor: true, rotulo: ROTULO_COBRAR, testId: "material-cobrar" },
  { valor: false, rotulo: ROTULO_INCLUSO, testId: "material-incluso" },
];

// O segmentado "Cobrar · Incluso" (52px, `radiogroup`, setas movem a escolha — o molde de
// `EscolhaExperimental`). Item sem preço de venda: só "Incluso" (D-14).
function SegmentadoDeCobranca({
  cobrar,
  podeCobrar,
  desabilitado,
  aoEscolher,
  descritoPor,
}: {
  cobrar: boolean;
  podeCobrar: boolean;
  desabilitado: boolean;
  aoEscolher: (cobrar: boolean) => void;
  descritoPor?: string;
}) {
  const opcoes = podeCobrar ? OPCOES_DE_COBRANCA : OPCOES_DE_COBRANCA.filter((opcao) => !opcao.valor);
  const botoes = useRef<Record<string, HTMLButtonElement | null>>({});

  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>) {
    const passo =
      evento.key === "ArrowRight" || evento.key === "ArrowDown"
        ? 1
        : evento.key === "ArrowLeft" || evento.key === "ArrowUp"
          ? -1
          : 0;
    if (passo === 0 || opcoes.length < 2) {
      return;
    }
    evento.preventDefault();
    const indice = opcoes.findIndex((opcao) => opcao.valor === cobrar);
    const nova = opcoes[(indice + passo + opcoes.length) % opcoes.length];
    aoEscolher(nova.valor);
    botoes.current[String(nova.valor)]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ARIA_COBRAR_O_MATERIAL}
      aria-describedby={descritoPor}
      className={cn("grid gap-2", opcoes.length === 2 ? "grid-cols-2" : "grid-cols-1")}
    >
      {opcoes.map((opcao) => {
        const marcado = cobrar === opcao.valor;
        return (
          <button
            key={opcao.testId}
            ref={(elemento) => {
              botoes.current[String(opcao.valor)] = elemento;
            }}
            type="button"
            role="radio"
            aria-checked={marcado}
            tabIndex={marcado ? 0 : -1}
            disabled={desabilitado}
            data-testid={opcao.testId}
            onClick={() => aoEscolher(opcao.valor)}
            onKeyDown={aoTeclar}
            className={cn(
              "text-corpo min-h-[52px] rounded-md border px-4 font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50",
              marcado ? "bg-acento border-acento text-white" : "bg-superficie border-borda-forte text-tinta-media",
            )}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}

export type MaterialDoUsoLivreProps = {
  usoLivreId: string;
  materiais: MaterialDoUso[];
  // O preço de venda de agora dos itens ativos com estoque que TÊM preço (D-14) — só antes de encerrar.
  precosDeVenda: Record<string, number>;
  // No espaço (e o dia passado sem encerrar): a lista se mexe. Encerrado: só leitura.
  editavel: boolean;
  // "Encerrando…": nada se mexe enquanto o encerramento grava.
  desabilitado: boolean;
};

// O bloco "Material usado" da folha do uso livre (AGE-14; 05-UI-SPEC.md §"Folha do uso livre", §"Rótulos
// e dicas de campo" — Material): o título (`h3` Apoio 600 caixa alta), a lista — "{q} {un} · {nome}" …
// "{R$}" ou "incluso", com "tirar" e o segmentado "Cobrar · Incluso" por linha — ou "nenhum", e, antes
// de encerrar, a linha de acrescentar: "Item do estoque" (o botão largo de 52px que abre o seletor
// "Qual material?" da Fase 06, por cima da folha; escolhido, a caixa "escolhido" da 06), "Quanto"
// (`inputmode=decimal`, 16px, "em {unidade}"), "Cobrar · Incluso" e "+ Material", que quebram em linhas
// a 320px (nunca rolagem lateral). O material só se REGISTRA aqui: nada sai do Estoque antes de encerrar.
export function MaterialDoUsoLivre({
  usoLivreId,
  materiais,
  precosDeVenda,
  editavel,
  desabilitado,
}: MaterialDoUsoLivreProps) {
  const router = useRouter();
  // O estado DESEJADO de cada linha enquanto a troca "Cobrar · Incluso" grava (sem toast).
  const [cobrancaPendente, setCobrancaPendente] = useState<Record<string, boolean>>({});
  const [erroDaLinha, setErroDaLinha] = useState<{ id: string; mensagem: string } | null>(null);

  async function trocarCobranca(linha: MaterialDoUso, cobrar: boolean) {
    if ((cobrancaPendente[linha.id] ?? linha.cobrar) === cobrar) {
      return;
    }
    setCobrancaPendente((atual) => ({ ...atual, [linha.id]: cobrar }));
    setErroDaLinha(null);
    try {
      const resposta = await definirCobrancaDoMaterial({ materialId: linha.id, cobrar });
      if (!resposta.ok) {
        setErroDaLinha({ id: linha.id, mensagem: resposta.erro });
        router.refresh();
      }
    } catch {
      setErroDaLinha({ id: linha.id, mensagem: FRASE_FALHA_AO_MUDAR_COBRANCA });
    } finally {
      setCobrancaPendente((atual) => {
        const proximo = { ...atual };
        delete proximo[linha.id];
        return proximo;
      });
    }
  }

  return (
    <section className="flex flex-col gap-3" data-testid="material-do-uso" aria-labelledby="material-do-uso-titulo">
      <h3 id="material-do-uso-titulo" className="text-apoio text-tinta-media font-semibold tracking-wide uppercase">
        {TITULO_MATERIAL_USADO}
      </h3>

      {materiais.length === 0 ? (
        <p data-testid="material-nenhum" className="text-corpo text-tinta-fraca">
          {TEXTO_SEM_MATERIAL}
        </p>
      ) : (
        <ul className="flex flex-col">
          {materiais.map((linha) => {
            const cobrar = cobrancaPendente[linha.id] ?? linha.cobrar;
            const valor = valorDaLinhaDeMaterial({ ...linha, cobrar });
            const podeCobrar = linha.itemId in precosDeVenda;
            const idDaDica = `material-sem-preco-${linha.id}`;
            return (
              <li
                key={linha.id}
                data-testid="material-linha"
                data-material-id={linha.id}
                className="border-borda flex flex-col gap-2 border-b py-2"
              >
                <div className="flex items-start gap-3">
                  <span className="text-corpo text-tinta min-w-0 flex-1 pt-2 [overflow-wrap:anywhere]">
                    {linhaDoMaterial(textoDeMilesimos(linha.quantidadeMilesimos), ROTULO_UNIDADE[linha.unidade], linha.nome)}
                  </span>
                  <span
                    data-testid="material-valor"
                    className="text-corpo text-tinta shrink-0 pt-2 text-right whitespace-nowrap tabular-nums"
                  >
                    {cobrar ? (valor === null ? "—" : formatarReais(valor)) : TEXTO_INCLUSO}
                  </span>
                  {editavel ? (
                    <ConfirmarTirarMaterial
                      materialId={linha.id}
                      nome={linha.nome}
                      desabilitado={desabilitado}
                      aoFecharDepoisDaRecusa={() => router.refresh()}
                    />
                  ) : null}
                </div>
                {editavel ? (
                  <div className="flex flex-col gap-1">
                    <SegmentadoDeCobranca
                      // Cobrado sem preço (apagado depois de acrescentar): as duas opções, para poder
                      // voltar a "Incluso".
                      cobrar={cobrar}
                      podeCobrar={podeCobrar || cobrar}
                      desabilitado={desabilitado}
                      aoEscolher={(novo) => void trocarCobranca(linha, novo)}
                      descritoPor={podeCobrar ? undefined : idDaDica}
                    />
                    {podeCobrar ? null : (
                      <p id={idDaDica} className="text-apoio text-tinta-fraca">
                        {FRASE_MATERIAL_SEM_PRECO}
                      </p>
                    )}
                    {erroDaLinha?.id === linha.id ? (
                      <p role="alert" data-testid="material-linha-erro" className="text-apoio text-erro">
                        {erroDaLinha.mensagem}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {editavel ? (
        <LinhaDeAcrescentar usoLivreId={usoLivreId} precosDeVenda={precosDeVenda} desabilitado={desabilitado} />
      ) : null}
    </section>
  );
}

type CampoDoMaterial = "itemId" | "quantidade" | "cobrar" | "geral";
type ErroDoMaterial = { campo: CampoDoMaterial; mensagem: string };

// A linha de acrescentar. O seletor "Qual material?" da Fase 06 abre POR CIMA da folha (um diálogo
// aninhado — a folha continua montada, com o "Chegou às"/"Saiu às" digitados); a lista vem do
// `ProvedorDoEstoque` da página (o carregador da 06: "carregando" mostra o esqueleto do seletor).
function LinhaDeAcrescentar({
  usoLivreId,
  precosDeVenda,
  desabilitado,
}: {
  usoLivreId: string;
  precosDeVenda: Record<string, number>;
  desabilitado: boolean;
}) {
  const { lista } = useEstoque();
  const [itemId, setItemId] = useState<string | null>(null);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [area, setArea] = useState<AreaFinanceira | null>(null);
  const [quantidade, setQuantidade] = useState("");
  // Nasce "Incluso": cobrar é sempre uma escolha (nunca uma cobrança por descuido).
  const [cobrar, setCobrar] = useState(false);
  const [erro, setErro] = useState<ErroDoMaterial | null>(null);
  const [enviando, setEnviando] = useState(false);
  const emVoo = useRef(false);
  const botaoMaterial = useRef<HTMLButtonElement>(null);
  const campoQuanto = useRef<HTMLInputElement>(null);

  // O material escolhido, lido da lista do Estoque — só se ainda estiver ativo (como no seletor).
  // Lista ainda carregando: `undefined` (a caixa mostra o esqueleto).
  const saldo: SaldoDoItem | null | undefined =
    itemId === null
      ? null
      : lista.estado === "pronta"
        ? (lista.saldos.find((linha) => linha.id === itemId && linha.ativo) ?? null)
        : lista.estado === "carregando"
          ? undefined
          : null;
  const unidade = saldo ? ROTULO_UNIDADE[saldo.unidade] : null;
  const podeCobrar = saldo ? saldo.id in precosDeVenda : true;
  const travado = desabilitado || enviando;

  function mostrarErro(novo: ErroDoMaterial) {
    setErro(novo);
    window.requestAnimationFrame(() => {
      if (novo.campo === "quantidade") {
        campoQuanto.current?.focus();
      } else if (novo.campo === "itemId") {
        botaoMaterial.current?.focus();
      }
    });
  }

  function mensagemDaQuantidade(mensagem: string): string {
    return mensagem === FRASE_QUANTIDADE_INVALIDA && unidade ? fraseQuantidadeDoMaterial(unidade) : mensagem;
  }

  async function acrescentar() {
    if (emVoo.current) {
      return;
    }
    if (!saldo) {
      mostrarErro({ campo: "itemId", mensagem: FRASE_ESCOLHA_O_MATERIAL });
      return;
    }
    const conferida = textoParaMilesimos(quantidade);
    if (!conferida.ok) {
      mostrarErro({ campo: "quantidade", mensagem: mensagemDaQuantidade(conferida.erro) });
      return;
    }
    emVoo.current = true;
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await acrescentarMaterial({
        usoLivreId,
        itemId: saldo.id,
        quantidade,
        cobrar: cobrar && podeCobrar,
      });
      if (!resposta.ok) {
        const campo: CampoDoMaterial = resposta.campos?.quantidade
          ? "quantidade"
          : resposta.campos?.itemId ||
              resposta.erro === FRASE_MATERIAL_NAO_EXISTE_MAIS ||
              resposta.erro.endsWith(SUFIXO_MATERIAL_DESATIVADO)
            ? "itemId"
            : resposta.campos?.cobrar
              ? "cobrar"
              : "geral";
        mostrarErro({
          campo,
          mensagem: campo === "quantidade" ? mensagemDaQuantidade(resposta.erro) : resposta.erro,
        });
        return;
      }
      // A ação revalidou a Agenda: a linha nova chega na lista. A linha de acrescentar volta limpa.
      setItemId(null);
      setQuantidade("");
      setCobrar(false);
      window.requestAnimationFrame(() => botaoMaterial.current?.focus());
    } catch {
      setErro({ campo: "geral", mensagem: FRASE_FALHA_AO_ACRESCENTAR_MATERIAL });
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
  }

  function mensagemDe(campo: CampoDoMaterial) {
    if (erro?.campo !== campo) {
      return null;
    }
    return (
      <p
        id={`material-erro-${campo}`}
        role="alert"
        data-testid="material-erro"
        data-campo={campo}
        className="text-apoio text-erro"
      >
        {erro.mensagem}
      </p>
    );
  }

  return (
    <div data-testid="material-acrescentar" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-[1_1_12rem] flex-col gap-2">
          <p id="material-item-rotulo" className="text-apoio text-tinta font-semibold">
            {ROTULO_ITEM_DO_ESTOQUE}
          </p>
          {saldo === undefined ? (
            <Skeleton className="h-[52px] w-full" data-testid="material-escolhido-carregando" />
          ) : saldo === null ? (
            <button
              ref={botaoMaterial}
              type="button"
              data-testid="escolher-material"
              aria-labelledby="material-item-rotulo escolher-material-texto"
              aria-describedby={erro?.campo === "itemId" ? "material-erro-itemId" : undefined}
              disabled={travado}
              onClick={() => setSeletorAberto(true)}
              className="border-borda-forte bg-superficie text-tinta hover:bg-superficie-2 text-corpo min-h-[52px] w-full rounded-md border px-4 font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
            >
              <span id="escolher-material-texto">{ROTULO_ESCOLHER_MATERIAL}</span>
            </button>
          ) : (
            // A caixa "escolhido" da Fase 06: o nome (quebra livre), o saldo de agora e a troca.
            <div
              data-testid="material-escolhido"
              data-item-id={saldo.id}
              className="bg-superficie-2 flex flex-wrap items-center justify-between gap-3 rounded-lg p-3"
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-corpo text-tinta font-semibold [overflow-wrap:anywhere]">{saldo.nome}</span>
                <span className="text-apoio text-tinta-media tabular-nums">
                  {textoSaldoDeAgora(textoDeMilesimos(saldo.saldoMilesimos), unidade ?? "")}
                </span>
              </div>
              <button
                ref={botaoMaterial}
                type="button"
                data-testid="trocar-material"
                disabled={travado}
                onClick={() => setSeletorAberto(true)}
                className="border-borda-forte bg-superficie text-tinta hover:bg-superficie-2 text-corpo min-h-[44px] shrink-0 rounded-md border px-4 font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              >
                {ROTULO_TROCAR_MATERIAL}
              </button>
            </div>
          )}
          {mensagemDe("itemId")}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="material-quanto" className="text-apoio text-tinta font-semibold">
            {ROTULO_QUANTO_DO_MATERIAL}
          </label>
          <Input
            id="material-quanto"
            ref={campoQuanto}
            data-testid="material-quanto"
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            disabled={travado}
            aria-invalid={erro?.campo === "quantidade"}
            aria-describedby={
              [unidade ? "material-quanto-dica" : null, erro?.campo === "quantidade" ? "material-erro-quantidade" : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
            value={quantidade}
            onChange={(evento) => {
              setQuantidade(evento.target.value);
              if (erro?.campo === "quantidade") {
                setErro(null);
              }
            }}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") {
                evento.preventDefault();
                void acrescentar();
              }
            }}
            className={`${CLASSE_DO_CAMPO_DA_AGENDA} min-h-[52px] w-24 tabular-nums`}
          />
          {unidade ? (
            <p id="material-quanto-dica" className="text-apoio text-tinta-fraca">
              {dicaQuantoDoMaterial(unidade)}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-[1_1_12rem] flex-col gap-2">
          <SegmentadoDeCobranca
            cobrar={cobrar && podeCobrar}
            podeCobrar={podeCobrar}
            desabilitado={travado}
            aoEscolher={(novo) => {
              setCobrar(novo);
              if (erro?.campo === "cobrar") {
                setErro(null);
              }
            }}
            descritoPor={podeCobrar ? undefined : "material-acrescentar-sem-preco"}
          />
          {podeCobrar ? null : (
            <p id="material-acrescentar-sem-preco" data-testid="material-sem-preco" className="text-apoio text-tinta-fraca">
              {FRASE_MATERIAL_SEM_PRECO}
            </p>
          )}
          {mensagemDe("cobrar")}
        </div>

        <Button
          type="button"
          variant="outline"
          data-testid="mais-material"
          disabled={travado}
          aria-busy={enviando ? "true" : undefined}
          onClick={() => void acrescentar()}
          className="text-corpo h-auto min-h-[52px] px-4 font-semibold whitespace-normal"
        >
          {enviando ? ROTULO_ACRESCENTANDO_MATERIAL : ROTULO_MAIS_MATERIAL}
        </Button>
      </div>
      {mensagemDe("geral")}
      <p className="text-apoio text-tinta-fraca">{DICA_MATERIAL_DO_USO}</p>

      {seletorAberto ? (
        <SeletorMaterial
          lista={lista}
          area={area}
          aoMudarArea={setArea}
          aoEscolher={(escolhido) => {
            setItemId(escolhido);
            setSeletorAberto(false);
            if (erro?.campo === "itemId" || erro?.campo === "cobrar") {
              setErro(null);
            }
            window.requestAnimationFrame(() => campoQuanto.current?.focus());
          }}
          aoFechar={() => setSeletorAberto(false)}
        />
      ) : null}
    </div>
  );
}
