import Link from "next/link";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { fornosQuePrecisamDeAtencao, type FornoEmAtencao } from "@/lib/queimas/consultas";
import { fraseDoBanner, prefixoDoBanner } from "@/lib/queimas/textos";
import { CartaoPainel } from "@/components/amassa/cartao-painel";
import { EstadoErro } from "@/components/amassa/estado-erro";

// Painel inicial (D-02, D-16): substitui a rota provisória da Fase 2a. `exigirUsuario()`
// continua na primeira linha — é o padrão de toda página protegida, não uma exceção desta
// tela. Os quatro cartões nascem vazios; cada um ganha dado real quando a fase do módulo
// correspondente entrar (Encomendas: Fase 3, Aulas: Fase 5, Fornos: Fase 4, Estoque: Fase 6).
// O painel de verdade, respondendo "o que preciso fazer hoje?", é a Fase 7 (PNL-01). Esta tela
// não usa `CabecalhoPagina` — a saudação já faz esse papel (D-02).
export default async function Painel() {
  const usuario = await exigirUsuario();

  // FOR-13/E11 (plano 04-05): a consulta pode falhar sem derrubar o painel inteiro — os outros
  // três cartões continuam de pé. Erro engolido em silêncio faria um forno crítico parecer "tudo
  // em dia" (T-04-21), por isso o erro vira um `EstadoErro` DENTRO do próprio cartão, nunca um
  // cartão populado pela metade.
  let fornosEmAtencao: FornoEmAtencao[] = [];
  let falhaAoCarregarFornos = false;
  try {
    fornosEmAtencao = await fornosQuePrecisamDeAtencao();
  } catch (erro) {
    console.error("Falha ao carregar fornos em atenção no painel inicial:", erro);
    falhaAoCarregarFornos = true;
  }

  return (
    <div className="flex flex-col gap-8 px-6 py-8 md:px-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display text-foreground">Olá, {usuario.nome}.</h1>
        <p className="text-micro uppercase text-muted-foreground">SEU DIA HOJE</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CartaoPainel titulo="Encomendas por etapa" vazio="Nenhuma encomenda em andamento." />
        <CartaoPainel titulo="Aulas de hoje" vazio="Nenhuma aula hoje." />

        {/* Zero fornos em atenção → o cartão inteiro não renderiza (mesma disciplina do banner
            de /queimas, E5) — a ausência é o sinal de normalidade, igual ao resto do módulo. */}
        {falhaAoCarregarFornos ? (
          <CartaoPainel titulo="Fornos em atenção" vazio="Nenhum forno em atenção.">
            <EstadoErro
              titulo="Algo não funcionou."
              corpo="Não deu para carregar os fornos em atenção."
            />
          </CartaoPainel>
        ) : (
          fornosEmAtencao.length > 0 && (
            <CartaoPainel titulo="Fornos em atenção" vazio="Nenhum forno em atenção.">
              <div className="flex flex-col gap-3" data-testid="cartao-painel-fornos-em-atencao">
                {/* Mesmo par de funções do banner de /queimas (`fraseDoBanner`/`prefixoDoBanner`,
                    lib/queimas/textos.ts) — nunca uma segunda redação da mesma frase (E11). */}
                <p className="text-apoio text-foreground [overflow-wrap:anywhere]">
                  <strong className="font-semibold">
                    {prefixoDoBanner(fornosEmAtencao.length)}
                  </strong>
                  {fraseDoBanner(fornosEmAtencao).slice(
                    prefixoDoBanner(fornosEmAtencao.length).length,
                  )}
                </p>
                <Link
                  href="/queimas"
                  className="text-apoio text-acento focus-visible:ring-ring inline-flex min-h-[44px] w-fit items-center rounded-md font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  Ver fornos
                </Link>
              </div>
            </CartaoPainel>
          )
        )}

        <CartaoPainel titulo="Estoque baixo" vazio="Nenhum material em alerta." />
      </div>
    </div>
  );
}
