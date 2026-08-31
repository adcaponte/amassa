"use client";

import { useEffect, useState } from "react";

import type { ItemDaAbertura } from "@/lib/abertura/consultas";
import { formatarDiaEMes, formatarReais } from "@/lib/abertura/formato";
import { calcularParcelas, proximaParcela } from "@/lib/abertura/parcelas";
import { entregaVencida } from "@/lib/abertura/prazos";
import { ROTULO_A_PRAZO, ROTULO_A_VISTA } from "@/lib/abertura/textos";
import { cn } from "@/lib/utils";
import { CaixaMarcacao } from "@/components/amassa/abertura/caixa-marcacao";
import { FerramentasLinha } from "@/components/amassa/abertura/ferramentas-linha";

// Client Component, e é DE PROPÓSITO — esta linha era um Server Component e o defeito estava
// exatamente aí. Medido em produção (servidor `standalone`, o mesmo do VPS): marcar um item
// deixava de atualizar o resto da linha em 83% dos toques, porque o aviso "não chegou", o
// esmaecido e a borda dependiam de o SERVIDOR redesenhar a tela depois da Server Action — e essa
// confirmação de transição falha em silêncio no React/Next (mesma raiz de
// .planning/debug/abertura-navegacao-trava.md, provada também sobre ACTION_SERVER_ACTION).
//
// A correção não é esperar melhor pelo servidor: é não precisar dele para esta informação. Um
// item que a pessoa acabou de marcar como resolvido não "não chegou" — isso é dedução do estado
// que o cliente JÁ TEM no instante do toque. A UI-SPEC desta fase já pedia salvamento otimista;
// ele existia só na caixinha, e agora vale para a linha inteira.
//
// A REGRA continua no módulo puro: `entregaVencida` é quem decide, aqui e no servidor — este
// componente só lhe entrega o valor otimista de `resolvido` em vez do que veio do banco.
// Contagens do CABEÇALHO do grupo seguem vindo do servidor (elas somam linhas que este
// componente não conhece) e podem chegar um instante depois. A linha, não.
export function LinhaDeItem({
  item,
  hoje,
  tarefasAbertas,
}: {
  item: ItemDaAbertura;
  hoje: string;
  // 0 = nenhuma tarefa aberta (chave ausente do mapa) — nunca desenha etiqueta "0 tarefas
  // abertas", só a ausência dela.
  tarefasAbertas: number;
}) {
  const [resolvido, setResolvido] = useState(item.resolvido);

  // Quando o servidor ENFIM redesenha (ou quando outra pessoa mexeu), o valor do banco volta a
  // mandar — o estado otimista nunca fica preso divergindo da verdade.
  useEffect(() => {
    setResolvido(item.resolvido);
  }, [item.resolvido]);

  const parcelas = calcularParcelas(item);
  const { tipo, parcela } = proximaParcela(parcelas, hoje);
  const aPrazo = item.formaPagamento === "prazo";
  const vencida = entregaVencida({ ...item, resolvido }, hoje);

  return (
    <div
      className={cn(
        "border-border bg-card flex items-start gap-3 rounded-md border p-3 shadow-sm",
        vencida && "border-l-3 border-l-erro pl-2.5",
        resolvido && "bg-muted/40",
      )}
      data-testid="abertura-linha-item"
    >
      <CaixaMarcacao
        tipo="item"
        id={item.id}
        nome={item.nome}
        marcado={resolvido}
        aoMudar={setResolvido}
      />

      <div className="min-w-0 flex-1">
        <div className="text-corpo font-medium break-words">{item.nome}</div>
        <div className="text-apoio mt-1 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "text-micro rounded-full px-2 py-0.5 font-semibold whitespace-nowrap",
              aPrazo ? "bg-acento-fundo text-acento" : "bg-sucesso-fundo text-sucesso",
            )}
          >
            {aPrazo ? ROTULO_A_PRAZO : ROTULO_A_VISTA}
          </span>

          {/* D-04/D-07/ABE-04: "não chegou · DD/MM" no lugar de "chega DD/MM" quando os três
              fatos de `entregaVencida` valem ao mesmo tempo — a marcação como resolvido é a
              ÚNICA coisa que apaga este alerta. Um item resolvido antes do vencimento não
              mostra "chega" nenhum (já foi resolvido, a data deixou de importar). */}
          {item.entregaPrevistaEm &&
            (vencida ? (
              <span
                className="text-micro bg-erro-fundo text-erro rounded-full px-2 py-0.5 font-semibold whitespace-nowrap"
                data-testid="abertura-nao-chegou"
              >
                não chegou · {formatarDiaEMes(item.entregaPrevistaEm)}
              </span>
            ) : (
              !resolvido && (
                <span className="text-micro bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium whitespace-nowrap">
                  chega {formatarDiaEMes(item.entregaPrevistaEm)}
                </span>
              )
            ))}

          {/* A leitura que D-13 chama de mais importante: sem ela, um item marcado como
              comprado parece encerrado enquanto a instalação ainda não aconteceu. `tarefasAbertas
              === 0` não desenha nada — nunca "0 tarefas abertas". */}
          {tarefasAbertas > 0 && (
            <span
              className="text-micro bg-atencao-fundo text-atencao rounded-full px-2 py-0.5 font-semibold whitespace-nowrap"
              data-testid="abertura-tarefas-abertas"
            >
              {tarefasAbertas} {tarefasAbertas === 1 ? "tarefa aberta" : "tarefas abertas"}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-none flex-col items-end gap-0.5 text-right">
        <span
          className="text-corpo font-bold tabular-nums whitespace-nowrap"
          data-testid="abertura-valor-item"
        >
          {formatarReais(item.valorEmCentavos)}
        </span>
        {aPrazo ? (
          <>
            <span
              className="text-apoio text-muted-foreground tabular-nums whitespace-nowrap"
              data-testid="abertura-parcela"
            >
              {item.parcelas}× {formatarReais(parcela.valorEmCentavos)}
            </span>
            <span className="text-apoio text-muted-foreground tabular-nums whitespace-nowrap">
              {tipo === "proxima" ? "próxima" : "última"} {formatarDiaEMes(parcela.vencimentoEm)}
            </span>
          </>
        ) : (
          <span
            className="text-apoio text-muted-foreground tabular-nums whitespace-nowrap"
            data-testid="abertura-parcela"
          >
            {formatarDiaEMes(item.primeiraParcelaEm)}
          </span>
        )}
      </div>

      <FerramentasLinha
        id={item.id}
        tipo="item"
        nome={item.nome}
        hrefEditar={`/abertura?item=${item.id}`}
        hrefRemover={`/abertura?removerItem=${item.id}`}
      />
    </div>
  );
}
