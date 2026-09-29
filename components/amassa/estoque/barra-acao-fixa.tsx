"use client";

import {
  ROTULO_NOVO_MATERIAL,
  ROTULO_NOVO_MATERIAL_CURTO,
  ROTULO_REGISTRAR_MOVIMENTACAO,
} from "@/lib/estoque/textos";
import { Button } from "@/components/ui/button";

import { useEstoque } from "./provedor-estoque";

// A barra de ação fixa do celular (UI-SPEC §Layout, item 5): só abaixo de 768px, presa ACIMA da
// barra de navegação (`bottom` = altura da barra inferior + faixa de gestos do iOS), nunca por cima
// dela. Altura `--altura-acao-fixa` (68px = 8 + 52 + 8), fundo `--color-fundo` a 94% com desfoque,
// borda de cima. O atributo `data-acao-fixa` é o que faz o aviso (toast) subir acima dela
// (`app/globals.css`, UI-D6). Não depende de dado nenhum: pinta junto com a página; a lista chega
// ao provedor depois. "+ Material" (`outline`, 52px — UI-D5: a 360px o rótulo longo não cabe ao lado)
// abre o "+ Novo material" (plano 06-09). Sem nenhum material, a página nem desenha a barra: o
// único terracota é o "+ Novo material" do estado vazio (UI-D3, decidido no servidor).
//
// A 320px, "Registrar movimentação" pode quebrar em duas linhas dentro dos 52px — permitido, nunca
// reticências (`whitespace-normal`, altura mínima e não fixa no botão).
export function BarraAcaoFixa() {
  const { abrirSeletor, abrirNovoMaterial } = useEstoque();
  return (
    <div
      data-acao-fixa=""
      className="border-borda bg-fundo/94 fixed inset-x-0 z-40 flex h-[var(--altura-acao-fixa)] items-center gap-2 border-t px-6 py-2 backdrop-blur md:hidden"
      style={{ bottom: "calc(var(--altura-barra-inferior) + env(safe-area-inset-bottom))" }}
    >
      <Button
        type="button"
        data-testid="estoque-acao-fixa"
        onClick={() => abrirSeletor("saida")}
        className="text-corpo h-auto min-h-[52px] flex-1 font-semibold leading-tight whitespace-normal"
      >
        {ROTULO_REGISTRAR_MOVIMENTACAO}
      </Button>
      <Button
        type="button"
        variant="outline"
        data-testid="estoque-acao-fixa-material"
        onClick={abrirNovoMaterial}
        className="text-corpo h-auto min-h-[52px] px-4 font-semibold"
      >
        {ROTULO_NOVO_MATERIAL_CURTO}
      </Button>
    </div>
  );
}

// O mesmo "Registrar movimentação" no cabeçalho da página, a partir de 768px (onde a barra fixa não
// existe). Primário — o único terracota da tela.
export function BotaoRegistrarMovimentacao() {
  const { abrirSeletor } = useEstoque();
  return (
    <Button
      type="button"
      data-testid="estoque-registrar-movimentacao"
      onClick={() => abrirSeletor("saida")}
      className="text-corpo hidden min-h-[44px] px-4 font-semibold md:inline-flex"
    >
      {ROTULO_REGISTRAR_MOVIMENTACAO}
    </Button>
  );
}

// "+ Novo material". No cabeçalho, a partir de 768px, `outline` (o terracota é de "Registrar
// movimentação"); no estado vazio sem nenhum material, PRIMÁRIO — lá ele é o único terracota da tela
// (UI-D3). Abre a folha "Novo material" pelo provedor.
export function BotaoNovoMaterial({ destaque = false }: { destaque?: boolean }) {
  const { abrirNovoMaterial } = useEstoque();
  if (destaque) {
    return (
      <Button
        type="button"
        data-testid="estoque-vazio-novo-material"
        onClick={abrirNovoMaterial}
        className="text-corpo min-h-[44px] px-4 font-semibold"
      >
        {ROTULO_NOVO_MATERIAL}
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant="outline"
      data-testid="estoque-novo-material"
      onClick={abrirNovoMaterial}
      className="text-corpo hidden min-h-[44px] px-4 font-semibold md:inline-flex"
    >
      {ROTULO_NOVO_MATERIAL}
    </Button>
  );
}
