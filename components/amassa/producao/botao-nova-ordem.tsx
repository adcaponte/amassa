"use client";

import { rotaDeGestao } from "@/lib/rotas/gestao";
import { ROTULO_NOVA_ORDEM } from "@/lib/producao/textos";
import { Button } from "@/components/ui/button";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";

// O endereço da folha "Nova ordem" — `?nova=1` na própria Produção (UI-SPEC: é por aqui que um link
// antigo `/gestao/encomendas?nova` cai na ação certa).
export const HREF_NOVA_ORDEM = `${rotaDeGestao("/producao")}?nova=1`;

// "Nova ordem" (primário): abrir é troca de URL sem transição (`pushState`, molde de
// `escolher-peca.tsx`) — a folha não precisa de nada do servidor para abrir; o catálogo ela
// carrega sozinha. No cabeçalho da Produção, ou no estado vazio (UI-D11: aí o cabeçalho fica sem o
// seu).
export function BotaoNovaOrdem() {
  return (
    <Button
      type="button"
      data-testid="nova-ordem-abrir"
      onClick={() => {
        // Preserva o que já está no endereço (vista, filtro) e só acrescenta `nova=1`.
        const parametros = new URLSearchParams(window.location.search);
        parametros.set("nova", "1");
        irParaSemNavegar(`${window.location.pathname}?${parametros.toString()}`);
      }}
      className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
    >
      {ROTULO_NOVA_ORDEM}
    </Button>
  );
}
