import { Suspense, type ReactNode } from "react";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { hojeEmBrasilia } from "@/lib/abertura/formato";
import { obterConfiguracaoDaAbertura } from "@/lib/abertura/consultas";
import { TITULO_MODULO } from "@/lib/abertura/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { BotaoAdicionarAbertura } from "@/components/amassa/abertura/botao-adicionar-abertura";
import { ProvedorNavegacaoAbertura } from "@/components/amassa/abertura/contexto-navegacao";
import { DataInauguracao } from "@/components/amassa/abertura/data-inauguracao";
import { EsqueletoDataInauguracao } from "@/components/amassa/abertura/data-inauguracao-skeleton";

// Server Component assíncrono À PARTE (não inline em `LayoutAbertura`) para poder ficar dentro
// do próprio `<Suspense>` do layout — `loading.tsx` só cobre `{children}` de um layout, nunca o
// conteúdo do PRÓPRIO layout, então sem este limite a busca abaixo bloquearia a rota inteira sem
// nenhum estado de carregamento (CLAUDE.md §Estados: "tela em branco enquanto carrega é
// defeito").
async function DataInauguracaoComBusca({ hoje }: { hoje: string }) {
  const configuracao = await obterConfiguracaoDaAbertura();
  return <DataInauguracao inauguracaoEm={configuracao?.inauguracaoEm ?? null} hoje={hoje} />;
}

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de `page.tsx` (idempotente, não
// consulta o banco de novo dentro da mesma requisição).
//
// Cabeçalho + data de inauguração vivem AQUI, não em `page.tsx` — layouts do Next.js NÃO recebem
// `searchParams` e NÃO são re-executados no servidor quando só a query string muda (documentado:
// "Next.js will not fetch, render, or execute the layouts again" numa navegação de mesma rota).
// Isto é o que resolve o achado quantitativo de .planning/debug/abertura-navegacao-trava.md: cada
// Client Component a MENOS no patch RSC de uma navegação `?item=`/`?tarefa=` reduz a chance
// medida de a transição travar em produção (0/24 travamentos com 1 componente montado no patch,
// ~20-37% com 4). `BotaoAdicionarAbertura`/`DataInauguracao` continuam reativos a `?aba=`/estado
// de edição porque leem via `useSearchParams()` (client-side, dentro de `ProvedorNavegacaoAbertura`)
// — a reatividade do cliente não depende de qual segmento do servidor disparou a navegação.
export default async function LayoutAbertura({ children }: { children: ReactNode }) {
  await exigirUsuario();

  const hoje = hojeEmBrasilia(new Date());

  return (
    <ProvedorNavegacaoAbertura>
      <CabecalhoPagina titulo={TITULO_MODULO}>
        <BotaoAdicionarAbertura />
      </CabecalhoPagina>

      <Suspense fallback={<EsqueletoDataInauguracao />}>
        <DataInauguracaoComBusca hoje={hoje} />
      </Suspense>

      {children}
    </ProvedorNavegacaoAbertura>
  );
}
