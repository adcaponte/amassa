import type { Metadata } from "next";
import Link from "next/link";

import { CONTEUDO_SITE } from "@/conteudo/site";
import { Rodape } from "@/components/site/rodape";
import { rotuloTelefoneDoZap } from "@/lib/site/whatsapp";

// Política de privacidade do site público (04/10/2026). Nasceu de uma exigência do Google: para
// publicar o app OAuth `amassa-backup` (o `client_id` próprio do `rclone`, que leva as cópias de
// segurança ao Google Drive), a tela de consentimento pede o URL de uma política de privacidade no
// domínio autorizado. Estática como a raiz (D-15): sem banco, sem sessão — nada daqui importa de
// `lib/` com acesso a dados. O texto descreve o que o sistema faz HOJE; se isso mudar (formulário no
// site, analytics, outro destino de backup), esta página muda junto.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacidade — AMASSA CERRADO",
  description: "Como a AMASSA CERRADO trata os dados de quem visita o site e de quem é atendido pelo ateliê.",
  metadataBase: new URL("https://amassacerrado.com.br"),
};

const ATUALIZADA_EM = "4 de outubro de 2026";

export default function PaginaDePrivacidade() {
  // D-28 (06/10/2026): o telefone sai do `zap`, o mesmo do "Onde fica" — vazio se o `zap` estiver
  // fora do formato, e então a frase termina no Instagram.
  const telefone = rotuloTelefoneDoZap(CONTEUDO_SITE.zap);

  return (
    <div className="min-h-screen bg-site-fundo text-site-tinta">
      <main className="mx-auto max-w-[68ch] px-4 py-14 md:py-20">
        <Link href="/" className="text-sm text-site-tinta-fraca underline">
          ← AMASSA CERRADO
        </Link>
        <p className="mt-8 mb-3 text-xs font-semibold tracking-[0.14em] text-site-barro uppercase">
          Atualizada em {ATUALIZADA_EM}
        </p>
        <h1 className="font-titulo-site text-[28px] font-semibold md:text-[40px]">Privacidade</h1>

        <div className="mt-6 flex flex-col gap-6 text-lg text-site-tinta-media">
          <section className="flex flex-col gap-2">
            <h2 className="font-titulo-site text-xl font-semibold text-site-tinta">Este site</h2>
            <p>
              O site amassacerrado.com.br não tem formulário, não pede cadastro e não usa cookies de rastreamento
              nem ferramentas de análise de visitas. Os botões de WhatsApp e Instagram levam a esses serviços, que
              seguem as políticas de privacidade deles.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-titulo-site text-xl font-semibold text-site-tinta">Quando você é atendido pelo ateliê</h2>
            <p>
              Para combinar uma encomenda, uma aula ou o uso do espaço, guardamos o que você nos passa: nome, telefone,
              o que foi combinado e os pagamentos. Esses dados ficam num sistema interno do ateliê, em servidor
              contratado por nós, e só a equipe da AMASSA CERRADO tem acesso. Não vendemos nem compartilhamos seus dados
              com ninguém.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-titulo-site text-xl font-semibold text-site-tinta">Cópias de segurança</h2>
            <p>
              Uma vez por dia, o sistema faz uma cópia de segurança e a guarda numa conta do Google Drive da própria
              AMASSA CERRADO. O aplicativo “amassa-backup” existe só para isso: ele acessa apenas essa conta, para
              gravar e, se preciso, recuperar as cópias. Não acessa dados de nenhuma outra pessoa.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-titulo-site text-xl font-semibold text-site-tinta">Seus direitos</h2>
            <p>
              Pela Lei Geral de Proteção de Dados (LGPD), você pode pedir para ver, corrigir ou apagar os dados que
              temos sobre você. Fale com a gente pelo Instagram{" "}
              <a
                href={CONTEUDO_SITE.contato.instagramUrl}
                target="_blank"
                rel="noopener"
                className="text-site-tinta underline"
              >
                {CONTEUDO_SITE.contato.instagramUsuario}
              </a>
              {telefone ? ` ou pelo WhatsApp ${telefone}` : null}.
            </p>
          </section>
        </div>
      </main>
      <Rodape />
    </div>
  );
}
