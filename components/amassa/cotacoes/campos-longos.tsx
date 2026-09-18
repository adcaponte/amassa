import { TriangleAlert } from "lucide-react";

import type { Cotacao } from "@/lib/cotacoes/consultas";
import { CAMPOS_LONGOS } from "@/lib/cotacoes/textos";
import { cn } from "@/lib/utils";

export type CamposLongosProps = {
  cotacao: Cotacao;
};

// Os SEIS campos longos de D-06, compartilhados pelo detalhe (`detalhe-cotacao.tsx`, Tarefa 2) E
// pela comparação lado a lado (`comparacao-cotacoes.tsx`, Tarefa 3) — um componente só, com o
// rótulo, a ordem e o tratamento de alerta/vazio vivendo NUM lugar. É isso que impede o detalhe e
// a comparação de divergirem na primeira mudança de cópia (key_links do plano). Server Component
// puro: nenhum estado, nenhum evento.
export function CamposLongos({ cotacao }: CamposLongosProps) {
  return (
    <div className="flex flex-col gap-3">
      {CAMPOS_LONGOS.map((campo) => {
        const valor = cotacao[campo.id];
        // D-12: só o campo `alertas` (`campo.alerta === true`) ganha o tratamento vermelho, e só
        // quando PREENCHIDO — vazio é só mais um campo vazio, nunca um alerta "silencioso".
        const comAlerta = Boolean(campo.alerta) && valor.length > 0;

        return (
          <div key={campo.id} data-testid={campo.alerta ? "cotacoes-campo-alertas" : undefined}>
            <div
              className={cn(
                "text-micro flex items-center gap-1 font-semibold tracking-wide uppercase",
                comAlerta ? "text-erro" : "text-muted-foreground",
              )}
            >
              {/* Ícone (pista VISUAL, escondida do leitor de tela) — o rótulo já diz "Alertas"
                  por extenso, então a cor nunca é a única pista (WCAG 1.4.1). */}
              {comAlerta && (
                <TriangleAlert
                  aria-hidden="true"
                  data-testid="cotacoes-alerta-icone"
                  className="size-4 flex-none"
                />
              )}
              {campo.rotulo}
            </div>
            {/* Campo vazio: travessão em tom apagado e itálico — nunca um espaço em branco que
                pareça falha de carregamento (§UI Considerations, long-text). Preenchido: quebra
                de linha PRESERVADA (`whitespace-pre-wrap`), sem truncamento — é o conteúdo que a
                comparação existe para mostrar por inteiro. */}
            <div
              className={cn(
                "text-corpo whitespace-pre-wrap",
                valor.length > 0 ? "" : "text-muted-foreground italic",
                comAlerta && "bg-erro-fundo rounded-lg px-2.5 py-2",
              )}
            >
              {valor.length > 0 ? valor : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
