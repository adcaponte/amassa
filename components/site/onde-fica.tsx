import { BotaoWhatsapp } from "@/components/site/botao-whatsapp";
import { Decoracao } from "@/components/site/decoracao";
import { ImagemDoSite } from "@/components/site/imagem-do-site";
import { Secao } from "@/components/site/secao";
import { CONTEUDO_SITE, SLOTS_DE_IMAGEM } from "@/conteudo/site";

type CampoDeContatoProps = {
  rotulo: string;
  children: string;
};

// Regra de campo vazio (deste plano, distinta de D-20 logo abaixo): um valor de conteúdo que
// seja string vazia ou só espaço não renderiza o PAR inteiro — nem o rótulo. Um "Endereço" sem
// endereço é pior que a ausência da linha. Hoje os quatro campos vêm preenchidos (com colchete
// onde falta dado real, D-14); esta guarda é o que sobra são quando o cadastro editável adiado
// permitir apagar um campo.
function CampoDeContato({ rotulo, children }: CampoDeContatoProps) {
  if (children.trim().length === 0) return null;

  return (
    <div>
      <b className="mb-0.5 block text-xs font-semibold tracking-[0.12em] text-site-tinta-fraca uppercase">
        {rotulo}
      </b>
      {children}
    </div>
  );
}

// `#onde`: endereço, horário, WhatsApp e Instagram — os quatro pares de
// `CONTEUDO_SITE.contato`. Endereço e telefone sobem com colchete (D-14) até o dono mandar o
// valor real.
export function OndeFica() {
  const { contato } = CONTEUDO_SITE;
  const whatsappPreenchido = contato.whatsappRotulo.trim().length > 0;
  const instagramPreenchido = contato.instagramUsuario.trim().length > 0;

  return (
    <Secao
      id="onde"
      testId="site-onde"
      decoracao={<Decoracao arquivo="flor-b.svg" espelhar className="top-[-70px] left-[52%] w-[min(38vw,380px)]" />}
    >
      <div className="grid gap-6 md:grid-cols-2 md:gap-12">
        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-site-barro uppercase">Onde fica</p>
          <h2 className="font-titulo-site text-[28px] font-semibold text-site-tinta md:text-[40px]">
            {CONTEUDO_SITE.ondeTitulo}
          </h2>

          <div data-testid="site-contato" className="mt-5 grid gap-3.5 text-[15.5px] text-site-tinta">
            <CampoDeContato rotulo="Endereço">{contato.endereco}</CampoDeContato>
            <CampoDeContato rotulo="Horário">{contato.horario}</CampoDeContato>
            {whatsappPreenchido ? (
              <div>
                <b className="mb-0.5 block text-xs font-semibold tracking-[0.12em] text-site-tinta-fraca uppercase">
                  WhatsApp
                </b>
                <BotaoWhatsapp mensagem="site" rotulo={contato.whatsappRotulo} className="text-site-barro underline" />
              </div>
            ) : null}
            {instagramPreenchido ? (
              <div>
                <b className="mb-0.5 block text-xs font-semibold tracking-[0.12em] text-site-tinta-fraca uppercase">
                  Instagram
                </b>
                <a href={contato.instagramUrl} target="_blank" rel="noopener" className="text-site-barro underline">
                  {contato.instagramUsuario}
                </a>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <BotaoWhatsapp
              mensagem="site"
              rotulo="Chamar no WhatsApp"
              className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-site-cerrado px-[18px] text-[15px] font-semibold text-white"
            />
            <a
              href="https://www.google.com/maps/search/?api=1&query=AMASSA+CERRADO+Piren%C3%B3polis"
              target="_blank"
              rel="noopener"
              className="flex min-h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-site-barro px-[18px] text-[15px] font-semibold text-site-barro"
            >
              Abrir no mapa
            </a>
          </div>
        </div>

        {/* D-20, mesma regra da faixa da fachada (`faixa-da-fachada.tsx`), aplicada ao slot
            `mapa`: `ImagemDoSite` já devolve `null` para o `<Image>` quando `arquivo` é nulo,
            mas SEM este `if` em volta, o envelope (proporção + arredondamento) ainda desenharia
            um retângulo vazio no meio da seção — o próprio "buraco desenhado" que D-20 proíbe.
            O `if` garante que NADA é montado, nem o envelope, enquanto a foto não existir. */}
        {SLOTS_DE_IMAGEM.mapa.arquivo ? (
          <div className="relative aspect-video overflow-hidden rounded-2xl">
            <ImagemDoSite slot="mapa" sizes="(min-width: 768px) 45vw, 100vw" />
          </div>
        ) : null}
      </div>
    </Secao>
  );
}
