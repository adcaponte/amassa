import { BotaoWhatsapp } from "@/components/site/botao-whatsapp";
import { CartaoDoSite } from "@/components/site/cartao-do-site";
import { Decoracao } from "@/components/site/decoracao";
import { Secao } from "@/components/site/secao";
import { CONTEUDO_SITE } from "@/conteudo/site";

// `#agenda` SEM calendário — desde a Fase 5, plano 15, este componente é a QUEDA da seção viva
// (`components/site/agenda-publica.tsx`): aparece quando não há nenhuma aula ou oficina pública de
// hoje em diante (D-11) e quando a leitura do banco falha (Postgres fora, ou o `next build` sem
// banco). Três cartões de texto (turmas fixas, oficinas de uma tarde, uso livre), dois botões de
// WhatsApp e a frase de aviso, verbatim, em `CONTEUDO_SITE.agAviso` (D-16 da 04.6, versão 11 do
// protótipo).
//
// O que este componente NÃO faz, e por quê: nenhuma grade de datas, nenhuma navegação entre
// períodos, nenhuma legenda por tipo de evento, nenhum cartão de evento com data marcada e
// nenhuma contagem de lugares restantes. O protótipo desenha esse outro estado (o alternador
// "ver como fica quando a Agenda existir") como andaime — não sobe (D-16). O motivo não é
// técnico: um desses elementos vazio, ou com um exemplo qualquer dentro, promete uma aula que
// não existe para quem está decidindo se viaja até Pirenópolis — dano ao público, não detalhe
// de interface.
//
// Com evento público, quem desenha a seção é `AgendaPublica` (o calendário com preço e vagas).
// Este componente não lê nada do módulo Agenda, nem do banco. É conteúdo.
export function AulasEOficinas() {
  return (
    <Secao
      id="agenda"
      testId="site-agenda"
      className="border-y border-site-borda bg-site-papel"
      decoracao={<Decoracao arquivo="flor-c.svg" className="bottom-0 left-[-3%] w-[min(30vw,300px)]" />}
    >
      <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-site-barro uppercase">Aulas e oficinas</p>
      <h2 className="font-titulo-site text-[28px] font-semibold text-site-tinta md:text-[40px]">
        {CONTEUDO_SITE.agendaTitulo}
      </h2>
      <p className="mt-3 max-w-[60ch] text-lg text-site-tinta-media">{CONTEUDO_SITE.agendaLead}</p>

      <div className="mt-7 grid gap-4 md:grid-cols-3 md:gap-5">
        <CartaoDoSite
          cor="--color-site-folha"
          titulo="Turmas fixas"
          corpo={CONTEUDO_SITE.agTurmas}
          testId="site-agenda-cartao"
        />
        <CartaoDoSite
          cor="--color-site-sol"
          titulo="Oficinas de uma tarde"
          corpo={CONTEUDO_SITE.agOficinas}
          testId="site-agenda-cartao"
        />
        <CartaoDoSite
          cor="--color-site-cerrado"
          titulo="Uso livre do ateliê"
          corpo={CONTEUDO_SITE.agLivre}
          testId="site-agenda-cartao"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <BotaoWhatsapp
          mensagem="aulas"
          rotulo="Quero saber das próximas aulas"
          className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-site-cerrado px-[18px] text-[15px] font-semibold text-white"
        />
        <BotaoWhatsapp
          mensagem="usoLivre"
          rotulo="Disponibilidade do uso livre"
          className="flex min-h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-site-barro px-[18px] text-[15px] font-semibold text-site-barro"
        />
        <span className="text-[13px] text-site-tinta-fraca">{CONTEUDO_SITE.agAviso}</span>
      </div>
    </Secao>
  );
}
