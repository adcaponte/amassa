import type { OrdemEmAndamento } from "@/lib/producao/consultas";
import { seloDaOrdem } from "@/lib/producao/leitura";
import { DICA_SECAO_AGUARDANDO, TITULO_SECAO_AGUARDANDO } from "@/lib/producao/textos";

import { CartaoOrdem } from "./cartao-ordem";

// A seção "Aguardando o sinal" da Produção (UI-SPEC §"Página `/gestao/producao`" item 6; plano 03,
// PRD-11): as ordens vindas de orçamento aprovado que ainda não começaram a contar prazo. Ficam FORA
// do quadro — só entram nele quando o dono libera. O id `aguardando-o-sinal` é o destino do link do
// Início. Só existe quando há alguma (quem chama não a desenha com a lista vazia; aqui também não).
// Os cartões são os mesmos do quadro (`CartaoOrdem`): nome com quebra livre, cliente ou "da casa",
// peças com plural de verdade, "ainda não começou · entrega {dd/mm}" e o selo "aguardando o sinal".
export function SecaoAguardando({ ordens }: { ordens: readonly OrdemEmAndamento[] }) {
  if (ordens.length === 0) {
    return null;
  }
  return (
    <section
      id="aguardando-o-sinal"
      data-testid="producao-aguardando"
      aria-labelledby="aguardando-o-sinal-titulo"
      className="bg-superficie border-borda flex min-w-0 flex-col gap-4 rounded-lg border p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="aguardando-o-sinal-titulo" className="text-titulo text-tinta">
          {TITULO_SECAO_AGUARDANDO}
        </h2>
        <p className="text-apoio text-tinta-fraca">{DICA_SECAO_AGUARDANDO}</p>
      </div>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {ordens.map((ordem) => {
          const leitura = { tipo: "aguardando" } as const;
          return (
            <li key={ordem.id} className="flex min-w-0 flex-col">
              <CartaoOrdem ordem={ordem} leitura={leitura} selo={seloDaOrdem(leitura)} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
