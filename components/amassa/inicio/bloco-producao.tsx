import { DIAS_PADRAO, calcularCronograma, situacaoEm } from "@/lib/encomendas/cronograma";
import { listarEncomendasAtivas } from "@/lib/encomendas/consultas";
import { ROTULO_ETAPA } from "@/lib/encomendas/textos";
import {
  producaoEmAndamento,
  type EncomendaParaProducao,
  type LinhaDeProducao,
} from "@/lib/encomendas/producao-em-andamento";
import { TEXTOS_DOS_BLOCOS } from "@/lib/inicio/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { EstadoErro } from "@/components/amassa/estado-erro";
import { BlocoDoInicio } from "./bloco-do-inicio";
import { TentarDeNovo } from "./tentar-de-novo";

export type BlocoProducaoProps = {
  hoje: string;
};

function tituloDaEncomenda(nome: string, clienteNome: string | null): string {
  return clienteNome ? `${nome} · ${clienteNome}` : nome;
}

function pluralDias(quantidade: number): string {
  return quantidade === 1 ? "1 dia" : `${quantidade} dias`;
}

function textoDoQueVemDepois(linha: LinhaDeProducao): string | null {
  if (linha.proximaEtapa === null || linha.diasAteProxima === null) {
    return null;
  }
  return `vai para ${ROTULO_ETAPA[linha.proximaEtapa]} em ${pluralDias(linha.diasAteProxima)}`;
}

// Server Component `async` com `try`/`catch` PRÓPRIO (D-09). Reaproveita as funções que o
// módulo de Encomendas já tem — `calcularCronograma`/`situacaoEm` (`lib/encomendas/cronograma.ts`,
// o mesmo par que `app/gestao/(app)/encomendas/page.tsx` usa) — para chegar à etapa atual e a
// próxima; nenhuma regra nova nasce aqui (GES-09). `producaoEmAndamento` (módulo puro, só
// `import type`) é quem garante, pelo TIPO, que o estado que o redesenho da Produção ainda vai
// decidir (D-10) nunca aparece nesta amostra.
export async function BlocoProducao({ hoje }: BlocoProducaoProps) {
  let falhou = false;
  let linhas: LinhaDeProducao[] = [];

  try {
    const encomendas = await listarEncomendasAtivas();
    const encomendasParaProducao: EncomendaParaProducao[] = encomendas.map((encomenda) => {
      const cronograma = calcularCronograma(
        encomenda.dataInicio,
        encomenda.etapas.length > 0
          ? encomenda.etapas.map((etapa) => ({
              etapa: etapa.etapa,
              dias: etapa.dias,
              esperaDias: etapa.esperaDias,
            }))
          : DIAS_PADRAO,
      );
      return {
        id: encomenda.id,
        titulo: tituloDaEncomenda(encomenda.nome, encomenda.clienteNome),
        situacao: situacaoEm(cronograma, encomenda.status, hoje),
      };
    });
    linhas = producaoEmAndamento(encomendasParaProducao);
  } catch (erro) {
    console.error("Falha ao carregar a produção no Início:", erro);
    falhou = true;
  }

  return (
    <BlocoDoInicio
      titulo="Produção"
      acaoRotulo="abrir produção"
      acaoHref={rotaDeGestao("/encomendas")}
      dataTestId="inicio-bloco-producao"
    >
      {falhou ? (
        <EstadoErro
          titulo="Algo não funcionou."
          corpo={TEXTOS_DOS_BLOCOS.producao.erro}
          acao={<TentarDeNovo />}
        />
      ) : linhas.length === 0 ? (
        <p className="text-corpo text-muted-foreground">{TEXTOS_DOS_BLOCOS.producao.vazio}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {linhas.map((linha) => {
            const descricao = textoDoQueVemDepois(linha);
            return (
              <div
                key={linha.id}
                className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <span className="text-corpo font-semibold text-foreground line-clamp-1">
                  {linha.titulo}
                </span>
                <div className="flex flex-wrap items-center gap-2 text-apoio text-muted-foreground">
                  {linha.etapaAtual ? (
                    <span
                      className="rounded px-1.5 py-0.5 font-semibold text-white"
                      style={{ backgroundColor: `var(--color-${linha.etapaAtual})` }}
                    >
                      {ROTULO_ETAPA[linha.etapaAtual]}
                    </span>
                  ) : (
                    <span className="rounded bg-muted px-1.5 py-0.5">Em espera</span>
                  )}
                  {descricao && <span>{descricao}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </BlocoDoInicio>
  );
}
