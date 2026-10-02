import { AgendaPublicaCalendario } from "@/components/site/agenda-publica-calendario";
import { AulasEOficinas } from "@/components/site/aulas-e-oficinas";
import { BotaoWhatsapp } from "@/components/site/botao-whatsapp";
import { CartaoDoSite } from "@/components/site/cartao-do-site";
import { Decoracao } from "@/components/site/decoracao";
import { Secao } from "@/components/site/secao";
import { CONTEUDO_SITE } from "@/conteudo/site";
import { agendaPublica, type AgendaPublicaPronta } from "@/lib/agenda/publico/agenda";
import { lerAgendaPublica } from "@/lib/agenda/publico/consultas";

// `#agenda` viva (AGE-18, SIT-02). Server Component da raiz — SEM a diretiva de Server Action e sem
// `next/headers`. A raiz é `force-static` com `revalidate = 300` (ISR): esta leitura roda no build e
// depois no máximo a cada 5 minutos, ou na hora quando uma ação da Agenda revalida `/` — nunca a cada
// visita.
//
// A raiz NUNCA depende do banco para responder (D-11, Assumption A10): se a leitura falhar (Postgres
// fora, ou o `next build` da imagem, que não tem `DATABASE_URL`), a seção cai no `AulasEOficinas` — o
// estado aprovado da 04.6 —, sem erro. Sem nenhum evento público, o mesmo: nunca um calendário vazio.
type AgendaComEventos = Extract<AgendaPublicaPronta, { temEventos: true }>;

// O conteúdo da seção com eventos — reaproveitado pela aba "No site" da gestão (UI-D18), que lê ao
// vivo e mostra exatamente isto dentro da moldura.
export function ConteudoDaAgendaViva({ agenda }: { agenda: AgendaComEventos }) {
  return (
    <>
      <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-site-barro uppercase">Aulas e oficinas</p>
      <h2 className="font-titulo-site text-[28px] font-semibold text-site-tinta md:text-[40px]">
        {CONTEUDO_SITE.agendaTitulo}
      </h2>
      <p className="mt-3 max-w-[60ch] text-lg text-site-tinta-media">{CONTEUDO_SITE.agendaLead}</p>

      <AgendaPublicaCalendario agenda={agenda} />

      {/* D-10: o uso livre continua SEM preço — mantém a D-18 da 04.6 neste bloco. */}
      <div data-testid="site-uso-livre" className="mt-6 flex flex-col gap-3">
        <CartaoDoSite cor="--color-site-cerrado" titulo="Uso livre do ateliê" corpo={CONTEUDO_SITE.agLivre} />
        <div className="flex flex-wrap gap-2.5">
          <BotaoWhatsapp
            mensagem="usoLivre"
            rotulo="Consulte disponibilidade no WhatsApp"
            className="flex min-h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-site-barro px-[18px] text-[15px] font-semibold text-site-barro"
          />
        </div>
      </div>
    </>
  );
}

export async function AgendaPublica({ hoje }: { hoje: string }) {
  let agenda: AgendaPublicaPronta;
  try {
    agenda = agendaPublica(await lerAgendaPublica(hoje), hoje);
  } catch (erro) {
    console.error("[site] a agenda pública não carregou — mostrando a seção sem calendário", erro);
    return <AulasEOficinas />;
  }

  if (!agenda.temEventos) {
    return <AulasEOficinas />;
  }

  return (
    <Secao
      id="agenda"
      testId="site-agenda"
      className="border-y border-site-borda bg-site-papel"
      decoracao={<Decoracao arquivo="flor-c.svg" className="bottom-0 left-[-3%] w-[min(30vw,300px)]" />}
    >
      <ConteudoDaAgendaViva agenda={agenda} />
    </Secao>
  );
}
