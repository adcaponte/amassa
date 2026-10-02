"use client";

import { AlertTriangle } from "lucide-react";

import type { Homonimo } from "@/lib/clientes/acoes";
import { ROTULO_CRIAR_OUTRA_PESSOA, avisoDeHomonimo, rotuloUsarExistente } from "@/lib/clientes/textos";
import { Button } from "@/components/ui/button";

export type AvisoHomonimoProps = {
  // Vazio = nada a avisar (a região viva continua na página, para o leitor de tela anunciar quando
  // o aviso aparece).
  homonimos: readonly Homonimo[];
  // "criar": cada homônimo com "Usar {nome} que já existe" e, embaixo, "Criar outra pessoa".
  // "editar": só o aviso — o primário do formulário vira "Salvar mesmo assim".
  modo: "criar" | "editar";
  gravando: boolean;
  aoUsarExistente: (homonimo: Homonimo) => void;
  aoCriarOutra: () => void;
};

// O aviso de homônimo (D-16, 05-UI-SPEC.md §"Pessoa nova / editar pessoa"): caixa de atenção
// (`atencao` sobre `atencao-fundo`, o par P1 já medido), `role="status"`, uma linha por homônimo,
// distinguidos pelo telefone. Avisa e não bloqueia: quem decide é o gestor; nada é fundido.
export function AvisoHomonimo({ homonimos, modo, gravando, aoUsarExistente, aoCriarOutra }: AvisoHomonimoProps) {
  return (
    <div role="status" aria-live="polite" data-testid="aviso-homonimo">
      {homonimos.length > 0 ? (
        <div className="bg-atencao-fundo text-atencao flex flex-col gap-3 rounded-md p-4">
          {homonimos.map((homonimo) => (
            <div key={homonimo.id} className="flex flex-col gap-2" data-testid="homonimo" data-cliente-id={homonimo.id}>
              <p className="text-apoio flex items-start gap-2 font-semibold break-words">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0">{avisoDeHomonimo(homonimo.nome, homonimo.telefone)}</span>
              </p>
              {modo === "criar" ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={gravando}
                  onClick={() => aoUsarExistente(homonimo)}
                  className="text-corpo text-tinta h-auto min-h-[44px] justify-start px-4 text-left whitespace-normal"
                >
                  {rotuloUsarExistente(homonimo.nome)}
                </Button>
              ) : null}
            </div>
          ))}
          {modo === "criar" ? (
            <Button
              type="button"
              variant="outline"
              data-testid="criar-outra-pessoa"
              disabled={gravando}
              onClick={aoCriarOutra}
              className="text-corpo text-tinta h-auto min-h-[44px] justify-start px-4 text-left whitespace-normal"
            >
              {ROTULO_CRIAR_OUTRA_PESSOA}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
