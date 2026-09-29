import type { TipoDoHistorico } from "@/lib/estoque/abas";
import { contarHistorico, listarHistorico, type LinhaDoHistorico } from "@/lib/estoque/consultas";
import { FRASE_ERRO_CARREGAR_HISTORICO, TITULO_ERRO } from "@/lib/estoque/textos";
import { EstadoErro } from "@/components/amassa/estado-erro";
import { TentarDeNovo } from "@/components/amassa/inicio/tentar-de-novo";

import { AbaHistorico } from "./aba-historico";

export type SecaoHistoricoProps = {
  tipo: TipoDoHistorico;
  limite: number;
};

// A seção da aba Histórico — Server Component `async`, dentro do próprio `Suspense` da página (o
// esqueleto é `EsqueletoHistorico`). Molde de `secao-saldos.tsx`/`inicio/bloco-producao.tsx`: a
// leitura num `try`/`catch`; a falha vai para o log do servidor (nunca detalhe do banco na tela) e a
// tela mostra o `EstadoErro` com a frase própria da aba e "Tentar de novo". A barra de abas e a barra
// fixa ficam fora desta seção: continuam utilizáveis quando ela falha (UI · error · E3/E12).
//
// Leitura pura do livro: nada aqui escreve. `tipo` e `limite` já chegam normalizados
// (`lib/estoque/abas.ts`).
export async function SecaoHistorico({ tipo, limite }: SecaoHistoricoProps) {
  let linhas: LinhaDoHistorico[] = [];
  let haMais = false;
  let total = 0;

  try {
    const [pagina, quantas] = await Promise.all([
      listarHistorico({ tipo, limite }),
      contarHistorico({ tipo }),
    ]);
    linhas = pagina.linhas;
    haMais = pagina.haMais;
    total = quantas;
  } catch (erro) {
    console.error("Falha ao carregar o histórico do Estoque:", erro);
    return (
      <EstadoErro
        titulo={TITULO_ERRO}
        corpo={FRASE_ERRO_CARREGAR_HISTORICO}
        acao={<TentarDeNovo />}
        dataTestId="historico-erro"
      />
    );
  }

  // O "agora" do "Hoje"/"Ontem" — um só para a lista inteira, lido na borda (nunca num módulo puro).
  const agora = new Date();

  return (
    <AbaHistorico
      tipo={tipo}
      limite={limite}
      linhas={linhas}
      haMais={haMais}
      total={total}
      agora={agora}
    />
  );
}
