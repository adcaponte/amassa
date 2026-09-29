import Link from "next/link";

import { listarContasEmAberto, type ContaEmAberto } from "@/lib/financeiro/consultas";
import { contasQueVencem } from "@/lib/financeiro/vencimentos";
import { hrefDoCaixa } from "@/lib/financeiro/navegacao";
import { formatarDataCurta, formatarReais } from "@/lib/financeiro/formato";
import { rotuloBotaoBaixa, ROTULO_TAG_VENCIDA, textoVence } from "@/lib/financeiro/textos";
import { TEXTOS_DOS_BLOCOS } from "@/lib/inicio/textos";
import { EstadoErro } from "@/components/amassa/estado-erro";
import { BlocoDoInicio } from "./bloco-do-inicio";
import { TentarDeNovo } from "./tentar-de-novo";

export type BlocoOQueVenceProps = {
  // Dia civil de Brasília, calculado UMA vez na página (`hojeEmBrasilia`) — este bloco nunca lê
  // o relógio sozinho, mesma disciplina de `CartaoConta` no Caixa.
  hoje: string;
};

type LinhaComMarca = { conta: ContaEmAberto; vencida: boolean };

// Server Component `async` com `try`/`catch` PRÓPRIO (D-09/T-04.6-30): o erro fica só no
// console do servidor, a tela mostra a frase humana do bloco — nunca detalhe de banco. D-05: a
// janela de sete dias e a separação vencidas/aVencer são regra do MÓDULO
// (`lib/financeiro/vencimentos.ts`), este componente só chama e apresenta (GES-09).
export async function BlocoOQueVence({ hoje }: BlocoOQueVenceProps) {
  let falhou = false;
  let linhas: LinhaComMarca[] = [];

  try {
    const contas = await listarContasEmAberto();
    const { vencidas, aVencer } = contasQueVencem(contas, hoje);
    // Vencidas primeiro (D-05), preservando dentro de cada grupo a ordem que o módulo já
    // devolveu — este bloco nunca reordena (GES-09, aresta `ordering`).
    linhas = [
      ...vencidas.map((conta) => ({ conta, vencida: true })),
      ...aVencer.map((conta) => ({ conta, vencida: false })),
    ];
  } catch (erro) {
    console.error("Falha ao carregar o que vence no Início:", erro);
    falhou = true;
  }

  return (
    <BlocoDoInicio
      titulo="O que vence"
      acaoRotulo="abrir caixa"
      // D-06: "abrir caixa" abre a aba Caixa — sem `?aba=`, o Financeiro abre na Venda.
      acaoHref={hrefDoCaixa()}
      dataTestId="inicio-bloco-vence"
    >
      {falhou ? (
        <EstadoErro
          titulo="Algo não funcionou."
          corpo={TEXTOS_DOS_BLOCOS.vence.erro}
          acao={<TentarDeNovo />}
        />
      ) : linhas.length === 0 ? (
        <p className="text-corpo text-muted-foreground">{TEXTOS_DOS_BLOCOS.vence.vazio}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {linhas.map(({ conta, vencida }) => (
            <div
              key={conta.parcelaId}
              data-testid="inicio-vence-linha"
              className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-corpo min-w-0 flex-1 font-semibold text-foreground line-clamp-1">
                  {conta.titulo}
                </span>
                <span
                  className={
                    "text-corpo tabular-nums whitespace-nowrap " +
                    (conta.tipo === "venda" ? "text-sucesso" : "text-foreground")
                  }
                >
                  {formatarReais(conta.valorCentavos)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-apoio text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5">
                  {conta.tipo === "despesa" ? "a pagar" : "a receber"}
                </span>
                <span>{textoVence(formatarDataCurta(conta.vencimento))}</span>
                {vencida && (
                  <span
                    data-testid="conta-vencida"
                    className="bg-erro-fundo text-erro rounded px-1.5 py-0.5 font-semibold"
                  >
                    {ROTULO_TAG_VENCIDA}
                  </span>
                )}
              </div>

              {/* D-06, com o comentário obrigatório: o protótipo (`prototipo-gestao.html`,
                  telaInicio()) navega para a aba Venda ao tocar aqui — mas o briefing VENCEU
                  porque isto é regra de DADO (onde o dinheiro é confirmado), e a regra da casa
                  só dá o protótipo como vencedor em matéria de INTERFACE. O botão abaixo é só
                  navegação (um `<Link>` de verdade) para o Caixa, na parcela específica — nunca
                  um formulário, nunca uma Server Action, nunca um manipulador de clique que
                  confirme pagamento. Quem mexer nisto depois achando que é defeito: não é. */}
              <Link
                href={hrefDoCaixa({ parcelaFoco: conta.parcelaId })}
                className="text-acento focus-visible:ring-ring inline-flex min-h-[44px] w-fit items-center rounded-md text-apoio font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                {rotuloBotaoBaixa(conta.tipo)}
              </Link>
            </div>
          ))}
        </div>
      )}
    </BlocoDoInicio>
  );
}

// Decisão do dono, registrada no briefing: este bloco não mostra saldo em lugar nenhum — o
// saldo é uma pergunta do Caixa, não do Início.
