import { lerFolhaDaCasa } from "@/lib/anotacoes/consultas";
import { FRASE_ERRO_DO_BLOCO } from "@/lib/anotacoes/textos";
import { lerLembretesDoInicio, listarPessoasDaCasa } from "@/lib/lembretes/consultas";
import {
  FRASE_ERRO_DA_COLUNA,
  ROTULO_VER_TODOS_OS_LEMBRETES,
  TITULO_DA_FOLHA,
  TITULO_DO_BLOCO,
  TITULO_PARA_FAZER,
} from "@/lib/lembretes/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { EstadoErro } from "@/components/amassa/estado-erro";
import { ListaDoInicio } from "@/components/amassa/lembretes/lista-do-inicio";
import { BlocoDoInicio } from "./bloco-do-inicio";
import { EditorDeAnotacoes } from "./editor-de-anotacoes";
import { TentarDeNovo } from "./tentar-de-novo";

// O quinto bloco do Início (D-08/GES-07), "Anotações e lembretes" desde a Fase 06.3: um bloco
// DUPLO — a folha da casa (`anotacoes_da_casa`, Fase 04.6, intocada) numa coluna e a lista "Para
// fazer" (`lembretes`) na outra; empilhadas abaixo de 1024 px, lado a lado a partir dele.
//
// Server Component `async` no molde dos outros quatro blocos (D-09: um bloco que falha não derruba a
// página) — e, aqui dentro, um `try` POR COLUNA: as duas leituras vão por `Promise.allSettled` e
// cada `rejected` mostra o erro SÓ na sua coluna. É a janela entre o deploy e o `db:migrate` da
// 0029: com o código publicado e a tabela `lembretes` ainda inexistente, a leitura dos lembretes
// falha e a folha da casa ao lado continua funcionando.
//
// Desde o plano 06.3-03 o bloco tem destino próprio: o link "ver todos os lembretes" do cabeçalho
// leva à rota `/gestao/lembretes` (D-01 — "ver todos" é rota, não folha sobre o Início). E ocupa as
// duas colunas da grade do Início a partir de 768 px (`className` do envelope). O `<h3>` "Para
// fazer" é desenhado pela `ListaDoInicio` (a contagem ao lado dele muda com os toques, no cliente);
// aqui ele só aparece no caso de erro da coluna.
//
// `hoje` vem da página — o MESMO instante da saudação — e desce até os rótulos de prazo.
//
// `data-testid="inicio-bloco-anotacoes"` preservado: `tests/e2e/inicio.spec.ts` afirma a ordem dos
// cinco blocos por ele.
export async function BlocoAnotacoes({ hoje }: { hoje: string }) {
  // As pessoas da casa (pílulas e cor dos chips) andam JUNTO com os lembretes: a falha delas cai no
  // erro da coluna "Para fazer", nunca na folha.
  const [folha, lembretes] = await Promise.allSettled([
    lerFolhaDaCasa(),
    Promise.all([lerLembretesDoInicio(), listarPessoasDaCasa()]),
  ]);

  if (folha.status === "rejected") {
    console.error("Falha ao carregar as anotações da casa no Início:", folha.reason);
  }
  if (lembretes.status === "rejected") {
    console.error("Falha ao carregar os lembretes no Início:", lembretes.reason);
  }

  return (
    <BlocoDoInicio
      titulo={TITULO_DO_BLOCO}
      acaoRotulo={ROTULO_VER_TODOS_OS_LEMBRETES}
      acaoHref={rotaDeGestao("/lembretes")}
      dataTestId="inicio-bloco-anotacoes"
      className="md:col-span-2"
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-apoio text-muted-foreground font-semibold tracking-[0.05em] uppercase">
            {TITULO_DA_FOLHA}
          </h3>
          {folha.status === "fulfilled" ? (
            <EditorDeAnotacoes
              textoInicial={folha.value.texto}
              salvoPorNomeInicial={folha.value.salvoPorNome}
              atualizadoEmInicial={folha.value.atualizadoEm}
            />
          ) : (
            <EstadoErro
              titulo="Algo não funcionou."
              corpo={FRASE_ERRO_DO_BLOCO}
              acao={<TentarDeNovo />}
            />
          )}
        </div>

        <div
          data-testid="lembretes-coluna"
          className="@container flex min-w-0 flex-col gap-2"
        >
          {lembretes.status === "fulfilled" ? (
            <ListaDoInicio
              inicio={lembretes.value[0]}
              hoje={hoje}
              pessoas={lembretes.value[1]}
            />
          ) : (
            <>
              <h3 className="text-apoio text-muted-foreground font-semibold tracking-[0.05em] uppercase">
                {TITULO_PARA_FAZER}
              </h3>
              <EstadoErro
                titulo="Algo não funcionou."
                corpo={FRASE_ERRO_DA_COLUNA}
                acao={<TentarDeNovo />}
                dataTestId="lembretes-erro"
              />
            </>
          )}
        </div>
      </div>
    </BlocoDoInicio>
  );
}
