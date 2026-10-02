import { Suspense } from "react";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { agoraEmBrasilia, hojeEmBrasilia } from "@/lib/financeiro/formato";
import { dataLongaEmPortugues, saudacaoDe } from "@/lib/inicio/saudacao";
import { BlocoAgendaDeHoje } from "@/components/amassa/inicio/bloco-agenda-de-hoje";
import { BlocoAnotacoes } from "@/components/amassa/inicio/bloco-anotacoes";
import { BlocoEsqueleto } from "@/components/amassa/inicio/bloco-esqueleto";
import { BlocoEstoque } from "@/components/amassa/inicio/bloco-estoque";
import { BlocoOQueVence } from "@/components/amassa/inicio/bloco-o-que-vence";
import { BlocoProducao } from "@/components/amassa/inicio/bloco-producao";
import { IndiceDosModulos } from "@/components/amassa/inicio/indice-dos-modulos";
import { PilulasDeAtalho } from "@/components/amassa/inicio/pilulas-de-atalho";

// O Início de verdade (D-21): substitui o painel de quatro cartões vazios da Fase 2
// (`CartaoPainel`, ainda usado por outras telas — só deixou de ser importado aqui). Consome os
// módulos e depende da navegação final (plano 05) para fazer sentido — por isso vem por último
// na ordem da fase. A autorização abre o corpo da função, como PRIMEIRA instrução — regra da
// casa, não exceção desta tela (T-04.6-27, verificado por `npm run verificar-acoes` e pelo
// critério de aceite da Tarefa 1). Esta página não usa `CabecalhoPagina` — a saudação já faz
// esse papel, como sempre fez.
//
// PNL-04 ("fornos em atenção" no painel) fica de fora desta tela por decisão já registrada em
// `04.6-CONTEXT.md`: não está entre os blocos do protótipo aprovado. O cartão antigo
// (`cartao-painel-fornos-em-atencao`) e o texto "SEU DIA HOJE" saem daqui — o banner de
// `/gestao/queimas` (FOR-06) continua existindo, intacto, na tela do próprio módulo.
export default async function Inicio() {
  const usuario = await exigirUsuario();
  // O dia e o agora do ateliê saem do MESMO instante — perto da meia-noite, duas leituras do relógio
  // poderiam cair em dias diferentes.
  const instante = new Date();
  const hoje = hojeEmBrasilia(instante);
  const agora = agoraEmBrasilia(instante);
  const sujeito = saudacaoDe(usuario);
  const dataDeHoje = dataLongaEmPortugues(hoje);

  return (
    <div className="flex flex-col gap-8 px-6 py-8 md:px-8">
      <div className="flex flex-col gap-1">
        <h1 data-testid="inicio-saudacao" className="text-display text-foreground">
          Olá, {sujeito}.
        </h1>
        <p data-testid="inicio-data" className="text-apoio text-muted-foreground">
          {dataDeHoje}
        </p>
      </div>

      <PilulasDeAtalho />

      {/* A grade dos blocos (GES-07): uma coluna no celular, duas a partir do breakpoint `md`
          do Tailwind (768px) — aproximação do 900px do protótipo, mesma convenção já usada em
          `listas-caixa.tsx`/`painel-venda.tsx` para os breakpoints do UI-SPEC que não caem
          exatamente numa das escalas padrão do Tailwind. Ordem fixa: Agenda de hoje · O que
          vence · Produção · Estoque acabando · Anotações da casa (plano 07, D-08). Cada bloco
          entra no seu PRÓPRIO `Suspense` (D-09): um `Suspense` único desfaria duas coisas de uma
          vez — o esqueleto deixaria de ser por bloco, e uma leitura lenta seguraria a página
          inteira.

          Traçador (04.6-06, Tarefa 1): a Agenda provou o mecanismo de esqueleto/erro/retentativa
          com um bloco só, antes de existirem cinco; as demais tarefas encaixaram os outros
          quatro, o último deles (Anotações) no plano 07. */}
      <div data-testid="inicio-blocos" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Suspense fallback={<BlocoEsqueleto titulo="Agenda de hoje" linhas={3} />}>
          <BlocoAgendaDeHoje hoje={hoje} agora={agora} />
        </Suspense>

        <Suspense fallback={<BlocoEsqueleto titulo="O que vence" linhas={3} />}>
          <BlocoOQueVence hoje={hoje} />
        </Suspense>

        <Suspense fallback={<BlocoEsqueleto titulo="Produção" linhas={3} />}>
          <BlocoProducao hoje={hoje} />
        </Suspense>

        <Suspense fallback={<BlocoEsqueleto titulo="Estoque acabando" linhas={2} />}>
          <BlocoEstoque />
        </Suspense>

        <Suspense fallback={<BlocoEsqueleto titulo="Anotações" linhas={4} />}>
          <BlocoAnotacoes />
        </Suspense>
      </div>

      <IndiceDosModulos />
    </div>
  );
}
