import Link from "next/link";

import { ROTULO_UNIDADE } from "@/lib/cadastros/catalogo";
import { estadoDoEstoque, listarSaldos, type SaldoDoItem } from "@/lib/estoque/consultas";
import {
  estoqueNuncaContado,
  itensParaOInicio,
  textoDeMilesimos,
  type LinhaDoInicio,
} from "@/lib/estoque/saldo";
import { CHIP_ACABANDO, CHIP_SALDO_NEGATIVO, textoEMais } from "@/lib/estoque/textos";
import { TEXTOS_DOS_BLOCOS } from "@/lib/inicio/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { EstadoErro } from "@/components/amassa/estado-erro";
import { BlocoDoInicio } from "./bloco-do-inicio";
import { TentarDeNovo } from "./tentar-de-novo";

type ConteudoDoBloco =
  | { tipo: "erro" }
  | { tipo: "nao-contado" }
  | { tipo: "lista"; linhas: LinhaDoInicio<SaldoDoItem>[]; maisN: number };

const CLASSE_DO_LINK =
  "text-acento focus-visible:ring-ring inline-flex min-h-[44px] items-center rounded-md font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none";

// "{−X} {un}" ou "{X} {un} · mínimo {m} {un}" — os números pelo mesmo `textoDeMilesimos` do resto do
// Estoque (sinal de menos tipográfico).
function textoDaQuantidade(linha: LinhaDoInicio<SaldoDoItem>): string {
  const unidade = ROTULO_UNIDADE[linha.unidade];
  const saldo = `${textoDeMilesimos(linha.saldoMilesimos)} ${unidade}`;
  if (linha.situacao === "negativo") {
    return saldo;
  }
  return `${saldo} · mínimo ${textoDeMilesimos(linha.estoqueMinimoMilesimos)} ${unidade}`;
}

// O bloco "Estoque acabando" (plano 06-10, D-10, D-21) — Server Component `async` com `try`/`catch`
// PRÓPRIO, no molde de `bloco-producao.tsx`: a falha do Estoque vira `EstadoErro` + "Tentar de novo"
// DENTRO do bloco, e os outros quatro blocos não dependem dele (T-06-47). O esqueleto já está no
// `Suspense` da página.
//
// `lib/inicio/` continua só apresentação: a regra do alerta é `itensParaOInicio`/`alertaDoItem` de
// `lib/estoque/saldo.ts`, e "nunca contado" é `estoqueNuncaContado` sobre a MESMA `estadoDoEstoque`
// que decide o painel da primeira abertura — as duas telas nunca discordam. Nunca contado → o
// convite a contar, em vez de listar negativos que só existem porque ninguém contou ainda.
export async function BlocoEstoque() {
  let conteudo: ConteudoDoBloco;
  try {
    const [estado, saldos] = await Promise.all([estadoDoEstoque(), listarSaldos()]);
    if (estoqueNuncaContado(estado)) {
      conteudo = { tipo: "nao-contado" };
    } else {
      conteudo = { tipo: "lista", ...itensParaOInicio(saldos) };
    }
  } catch (erro) {
    console.error("Falha ao carregar o estoque no Início:", erro);
    conteudo = { tipo: "erro" };
  }

  return (
    <BlocoDoInicio
      titulo="Estoque acabando"
      acaoRotulo="abrir estoque"
      acaoHref={rotaDeGestao("/estoque")}
      dataTestId="inicio-bloco-estoque"
    >
      {conteudo.tipo === "erro" ? (
        <EstadoErro
          titulo="Algo não funcionou."
          corpo={TEXTOS_DOS_BLOCOS.estoque.erro}
          acao={<TentarDeNovo />}
        />
      ) : conteudo.tipo === "nao-contado" ? (
        <p data-testid="inicio-estoque-nao-contado" className="text-corpo text-muted-foreground">
          {TEXTOS_DOS_BLOCOS.estoque.naoContado}{" "}
          <Link href={rotaDeGestao("/estoque/contagem")} className={CLASSE_DO_LINK}>
            {TEXTOS_DOS_BLOCOS.estoque.linkNaoContado}
          </Link>
        </p>
      ) : conteudo.linhas.length === 0 ? (
        <p className="text-corpo text-muted-foreground">{TEXTOS_DOS_BLOCOS.estoque.vazio}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {conteudo.linhas.map((linha) => (
            <div
              key={linha.id}
              data-testid="inicio-estoque-linha"
              data-item-id={linha.id}
              className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0"
            >
              <span className="text-corpo text-foreground line-clamp-1 font-semibold">
                {linha.nome}
              </span>
              <div className="text-apoio text-muted-foreground flex flex-wrap items-center gap-2 tabular-nums">
                {linha.situacao === "negativo" ? (
                  <span className="bg-erro-fundo text-erro rounded-full px-2 py-0.5 font-semibold">
                    {CHIP_SALDO_NEGATIVO}
                  </span>
                ) : (
                  <span className="bg-atencao-fundo text-atencao rounded-full px-2 py-0.5 font-semibold">
                    {CHIP_ACABANDO}
                  </span>
                )}
                <span>{textoDaQuantidade(linha)}</span>
              </div>
            </div>
          ))}
          {conteudo.maisN > 0 ? (
            <Link
              href={`${rotaDeGestao("/estoque")}?aba=saldos&acabando=1`}
              data-testid="inicio-estoque-mais"
              className={`text-apoio ${CLASSE_DO_LINK}`}
            >
              {textoEMais(conteudo.maisN)}
            </Link>
          ) : null}
        </div>
      )}
    </BlocoDoInicio>
  );
}
