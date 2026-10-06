"use client";

import { Suspense, use, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { definirItemAtivo } from "@/lib/cadastros/acoes";
import { ROTULO_UNIDADE } from "@/lib/cadastros/catalogo";
import { FRASE_FALHA_AO_SALVAR, textoItemReativado } from "@/lib/cadastros/textos";
import { formatarReais } from "@/lib/financeiro/formato";
import { ROTULO_AREA } from "@/lib/financeiro/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import type { FolhaDoMaterial, ResultadoDeAcao } from "@/lib/estoque/acoes";
import {
  LIMITE_DO_HISTORICO,
  LIMITE_MAXIMO_DO_HISTORICO,
  PASSO_DO_HISTORICO,
} from "@/lib/estoque/abas";
import type { SaldoDoItem } from "@/lib/estoque/consultas";
import { textoGastoPor } from "@/lib/estoque/historico";
import { alertaDoItem } from "@/lib/estoque/saldo";
import {
  CORPO_MATERIAL_SEM_MOVIMENTACAO,
  NOTA_SOMA_ANTES,
  NOTA_SOMA_DEPOIS,
  ROTULO_EDITAR_FICHAS,
  ROTULO_EDITAR_MATERIAL_CURTO,
  ROTULO_GASTO_POR,
  ROTULO_HISTORICO_DO_MATERIAL,
  ROTULO_MOSTRAR_MAIS,
  ROTULO_REATIVANDO,
  ROTULO_REATIVAR_MATERIAL,
  ROTULO_REGISTRAR_MOVIMENTACAO,
  ROTULO_TENTAR_DE_NOVO,
  TITULO_ERRO,
  TITULO_MATERIAL_SEM_MOVIMENTACAO,
  textoValorEmEstoque,
} from "@/lib/estoque/textos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoErro } from "@/components/amassa/estado-erro";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { Folha, FolhaCabecalho, FolhaCorpo, FolhaRodape } from "@/components/amassa/folha";

import {
  COR_DO_SALDO,
  ChipDoSaldo,
  PontoDaArea,
  formatarMilesimos,
  textoDoCustoMedio,
  textoDoMinimo,
} from "./cartao-saldo";
import { LinhaMovimentacao } from "./linha-movimentacao";

// A leitura da folha em voo. Nunca rejeita: a falha de rede vira `{ ok: false }` com a frase da
// UI-SPEC, e a folha mostra o erro DENTRO dela (nunca o boundary da página).
export type PromessaDaFolhaDoMaterial = Promise<ResultadoDeAcao<FolhaDoMaterial>>;

export type FolhaMaterialProps = {
  itemId: string;
  // O material como a lista da página o conhece — o cabeçalho pinta na hora, antes da leitura.
  // `null` só se a lista ainda não chegou.
  saldo: SaldoDoItem | null;
  // A primeira leitura já começou no toque em "Histórico" (o provedor a dispara no clique).
  promessaInicial: PromessaDaFolhaDoMaterial;
  // Nova leitura (Tentar de novo, Mostrar mais 50, depois de reativar) — mesma porta.
  carregar: (limite: number) => PromessaDaFolhaDoMaterial;
  aoRegistrarMovimentacao: (itemId: string) => void;
  // "Editar" do rodapé (Tarefa 2 do plano 06-09) — recebe o resumo já lido.
  aoEditar?: (dados: FolhaDoMaterial) => void;
  aoFechar: () => void;
};

// A folha de um material — o "Histórico" do cartão e da tabela (UI-SPEC §"Folha do material"): o
// cabeçalho com o nome e "● {Área} · {categoria da compra}"; a caixa de resumo com o saldo em
// Display na cor da situação sobre `superficie-2` (pares P17a/P17b — só válidos nesse tamanho); as
// observações; o "Gasto por" (EST-20); as 50 movimentações mais recentes DESTE material pela MESMA
// `LinhaMovimentacao` da aba Histórico (a mesma movimentação tem a mesma frase nos dois lugares) e
// a nota "Somando de cima para baixo…" — só quando a lista está completa (EST-10). Rodapé: "Editar"
// · "Registrar movimentação", ou "Reativar material" no desativado (UI-D11).
//
// A leitura é uma Server Action (`lerFolhaDoMaterial`) disparada NO TOQUE, e a folha a lê com
// `use()` dentro de um `Suspense` (3 linhas de esqueleto) — sem efeito que busque dado. "Mostrar
// mais 50" e a recarga depois de reativar trocam a promessa numa transição: a lista antiga fica na
// tela até a nova chegar.
export function FolhaMaterial({
  itemId,
  saldo,
  promessaInicial,
  carregar,
  aoRegistrarMovimentacao,
  aoEditar,
  aoFechar,
}: FolhaMaterialProps) {
  const [promessa, setPromessa] = useState(promessaInicial);
  const [ocupado, setOcupado] = useState(false);

  const sub = saldo
    ? [ROTULO_AREA[saldo.area], saldo.categoriaCompraNome].filter(Boolean).join(" · ")
    : null;

  return (
    <Dialog
      open
      onOpenChange={(novoValor) => {
        if (!novoValor && !ocupado) {
          aoFechar();
        }
      }}
    >
      <Folha
        data-testid="folha-material"
        data-item-id={itemId}
        onOpenAutoFocus={(evento) => evento.preventDefault()}
      >
        <FolhaCabecalho
          titulo={saldo ? saldo.nome : ROTULO_HISTORICO_DO_MATERIAL}
          classeTitulo="[overflow-wrap:anywhere]"
          descricao={
            <>
              {saldo ? <PontoDaArea area={saldo.area} className="mt-1.5" /> : null}
              <span className="min-w-0">{sub ?? ROTULO_HISTORICO_DO_MATERIAL}</span>
            </>
          }
          descricaoVisivel
          classeDescricao="flex items-start gap-1 [overflow-wrap:anywhere]"
          aoFechar={aoFechar}
          fecharDesabilitado={ocupado}
          dataTestIdFechar="folha-material-fechar"
        />

        <Suspense fallback={<EsqueletoDaFolhaDoMaterial />}>
          <CorpoDaFolhaDoMaterial
            promessa={promessa}
            trocarPromessa={setPromessa}
            carregar={carregar}
            aoMudarOcupado={setOcupado}
            aoRegistrarMovimentacao={aoRegistrarMovimentacao}
            aoEditar={aoEditar}
          />
        </Suspense>
      </Folha>
    </Dialog>
  );
}

// UI · loading · E7 — três linhas de esqueleto no formato da linha do livro.
function EsqueletoDaFolhaDoMaterial() {
  return (
    <FolhaCorpo aria-busy="true" data-testid="folha-material-carregando">
      <span className="sr-only">Carregando o histórico do material…</span>
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="bg-superficie border-borda divide-borda flex flex-col divide-y rounded-lg border">
        {[0, 1, 2].map((indice) => (
          <div key={indice} className="flex items-start gap-3 p-4">
            <div className="flex w-[76px] shrink-0 flex-col items-end gap-1">
              <Skeleton className="h-6 w-14" />
              <Skeleton className="h-4 w-6" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-full max-w-sm" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ))}
      </div>
    </FolhaCorpo>
  );
}

type CorpoProps = {
  promessa: PromessaDaFolhaDoMaterial;
  trocarPromessa: (promessa: PromessaDaFolhaDoMaterial) => void;
  carregar: (limite: number) => PromessaDaFolhaDoMaterial;
  aoMudarOcupado: (ocupado: boolean) => void;
  aoRegistrarMovimentacao: (itemId: string) => void;
  aoEditar?: (dados: FolhaDoMaterial) => void;
};

function CorpoDaFolhaDoMaterial({
  promessa,
  trocarPromessa,
  carregar,
  aoMudarOcupado,
  aoRegistrarMovimentacao,
  aoEditar,
}: CorpoProps) {
  const resposta = use(promessa);
  const router = useRouter();
  const [recarregando, iniciarRecarga] = useTransition();
  const [reativando, setReativando] = useState(false);
  const [erroDoRodape, setErroDoRodape] = useState<string | null>(null);
  // Guarda síncrona contra o toque duplo: o `disabled` só vale no próximo desenho.
  const emVoo = useRef(false);

  if (!resposta.ok) {
    // UI · error · E7 — dentro da folha, com "Tentar de novo" que chama a ação de novo.
    return (
      // Sem respiro nem `gap`: o `EstadoErro` traz o dele.
      <FolhaCorpo className="gap-0 p-0">
        <EstadoErro
          titulo={TITULO_ERRO}
          corpo={resposta.erro}
          dataTestId="folha-material-erro"
          acao={
            <Button
              type="button"
              variant="outline"
              className="text-corpo min-h-[44px] px-4 font-semibold"
              onClick={() => trocarPromessa(carregar(LIMITE_DO_HISTORICO))}
            >
              {ROTULO_TENTAR_DE_NOVO}
            </Button>
          }
        />
      </FolhaCorpo>
    );
  }

  const dados = resposta.dados;
  const { resumo, linhas, temMais, agora } = dados;
  const unidade = ROTULO_UNIDADE[resumo.unidade];
  const alerta = alertaDoItem(resumo);
  const saldoTexto = formatarMilesimos(resumo.saldoMilesimos);
  const valorEmEstoque = resumo.saldoMilesimos > 0 ? resumo.valorCentavos : 0;
  const linhaDeApoio = [
    textoDoCustoMedio(resumo),
    textoValorEmEstoque(formatarReais(valorEmEstoque)),
    textoDoMinimo(resumo),
  ].join(" · ");
  const gastoPorTexto = textoGastoPor(dados.gastoPor);
  const ocupado = recarregando || reativando;
  // A página atual em múltiplos de 50 (o que a ação aceita) — a lista nunca encolhe numa recarga.
  const paginaAtual = Math.max(
    LIMITE_DO_HISTORICO,
    Math.ceil(linhas.length / PASSO_DO_HISTORICO) * PASSO_DO_HISTORICO,
  );
  // "Mostrar mais 50" some no teto de 1000, como na aba Histórico (T-06-42). Nesse caso a lista
  // continua incompleta: nem o botão nem a nota da soma aparecem.
  const podeMostrarMais = temMais && paginaAtual < LIMITE_MAXIMO_DO_HISTORICO;

  function mostrarMais() {
    iniciarRecarga(() => {
      trocarPromessa(carregar(paginaAtual + PASSO_DO_HISTORICO));
    });
  }

  async function reativar() {
    if (emVoo.current) {
      return;
    }
    emVoo.current = true;
    setReativando(true);
    aoMudarOcupado(true);
    setErroDoRodape(null);
    try {
      const resultado = await definirItemAtivo({ id: resumo.id, ativo: true });
      if (!resultado.ok) {
        setErroDoRodape(resultado.erro);
        return;
      }
      toast.success(textoItemReativado(resultado.dados.nome));
      router.refresh();
      // A folha continua aberta e se relê: o rodapé passa a "Registrar movimentação".
      iniciarRecarga(() => {
        trocarPromessa(carregar(paginaAtual));
      });
    } catch (falha) {
      console.error("Falha ao reativar material:", falha);
      setErroDoRodape(FRASE_FALHA_AO_SALVAR);
    } finally {
      emVoo.current = false;
      setReativando(false);
      aoMudarOcupado(false);
    }
  }

  return (
    <>
      <FolhaCorpo>
        {/* Resumo: `superficie-2`, saldo em Display 28px/700 na cor da situação (P17a/P17b). */}
        <div
          data-testid="folha-material-resumo"
          data-alerta={alerta}
          className="bg-superficie-2 border-borda flex flex-col gap-2 rounded-lg border p-4"
        >
          <p className="flex flex-wrap items-baseline gap-2">
            <span
              data-testid="folha-material-saldo"
              className={cn(
                "text-display whitespace-nowrap tabular-nums",
                COR_DO_SALDO[alerta],
              )}
            >
              {saldoTexto}
            </span>
            <span className="text-corpo text-tinta-media">{unidade}</span>
          </p>
          <p className="text-apoio text-tinta-media tabular-nums [overflow-wrap:anywhere]">
            {linhaDeApoio}
          </p>
          <div className="flex flex-wrap gap-2">
            <ChipDoSaldo saldo={resumo} />
          </div>
        </div>

        {resumo.observacoes ? (
          <p
            data-testid="folha-material-observacoes"
            className="bg-superficie-2 text-tinta-media border-borda text-apoio rounded-md border px-4 py-2 whitespace-pre-line [overflow-wrap:anywhere]"
          >
            {resumo.observacoes}
          </p>
        ) : null}

        {gastoPorTexto !== "" ? (
          <div data-testid="folha-material-gasto-por" className="flex flex-col gap-1">
            <p className="text-apoio text-tinta font-semibold">{ROTULO_GASTO_POR}</p>
            <p
              data-testid="folha-material-gasto-por-lista"
              className="text-apoio text-tinta-media [overflow-wrap:anywhere]"
            >
              {gastoPorTexto}
            </p>
            <Link
              href={rotaDeGestao("/cadastros?sub=catalogo")}
              className="text-apoio text-acento inline-flex min-h-[44px] items-center font-semibold underline underline-offset-4 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
            >
              {ROTULO_EDITAR_FICHAS}
            </Link>
          </div>
        ) : null}

        {linhas.length === 0 ? (
          <EstadoVazio
            titulo={TITULO_MATERIAL_SEM_MOVIMENTACAO}
            corpo={CORPO_MATERIAL_SEM_MOVIMENTACAO}
            testId="folha-material-vazio"
          />
        ) : (
          <>
            {/* A lista é texto: nenhum botão, link ou menu dentro dela (EST-06). */}
            <ol
              data-testid="folha-material-lista"
              aria-label="Movimentações deste material"
              className="bg-superficie border-borda divide-borda flex flex-col divide-y rounded-lg border"
            >
              {linhas.map((linha) => (
                <li key={linha.id}>
                  <LinhaMovimentacao linha={linha} comNome={false} agora={agora} />
                </li>
              ))}
            </ol>

            {podeMostrarMais ? (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="folha-material-mais"
                  disabled={ocupado}
                  aria-busy={recarregando ? "true" : undefined}
                  onClick={mostrarMais}
                  className="text-corpo min-h-[44px] px-4 font-semibold"
                >
                  {ROTULO_MOSTRAR_MAIS}
                </Button>
              </div>
            ) : temMais ? null : (
              // EST-10: só com a lista COMPLETA — somando uma página parcial não se chega ao saldo.
              <p
                data-testid="folha-material-nota-soma"
                className="text-apoio text-tinta-media bg-superficie-2 rounded-lg p-4"
              >
                {NOTA_SOMA_ANTES}
                <strong className="font-semibold tabular-nums">
                  {saldoTexto} {unidade}
                </strong>
                {NOTA_SOMA_DEPOIS}
              </p>
            )}
          </>
        )}
      </FolhaCorpo>

      {/* Rodapé preso por flex, fora da área rolável. */}
      <FolhaRodape erro={erroDoRodape}>
        <div className="flex gap-2">
          {aoEditar ? (
            <Button
              type="button"
              variant="outline"
              data-testid="folha-material-editar"
              disabled={ocupado}
              onClick={() => aoEditar(dados)}
              className="text-corpo min-h-[52px] shrink-0 px-4 font-semibold"
            >
              {ROTULO_EDITAR_MATERIAL_CURTO}
            </Button>
          ) : null}
          {resumo.ativo ? (
            <Button
              type="button"
              data-testid="folha-material-registrar"
              disabled={ocupado}
              onClick={() => aoRegistrarMovimentacao(resumo.id)}
              className="text-corpo h-auto min-h-[52px] flex-1 px-4 font-semibold leading-tight whitespace-normal"
            >
              {ROTULO_REGISTRAR_MOVIMENTACAO}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              data-testid="folha-material-reativar"
              disabled={ocupado}
              aria-busy={reativando ? "true" : undefined}
              onClick={() => void reativar()}
              className="text-corpo h-auto min-h-[52px] flex-1 px-4 font-semibold leading-tight whitespace-normal"
            >
              {reativando ? ROTULO_REATIVANDO : ROTULO_REATIVAR_MATERIAL}
            </Button>
          )}
        </div>
      </FolhaRodape>
    </>
  );
}
