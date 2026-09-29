import { Suspense } from "react";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { listarParaContagem } from "@/lib/estoque/consultas";
import { ROTULO_VOLTAR_AO_ESTOQUE, TITULO_CONTAGEM } from "@/lib/estoque/textos";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { CarregadorDoSeletor } from "@/components/amassa/estoque/carregador-do-seletor";
import { ListaContagem } from "@/components/amassa/estoque/lista-contagem";
import { ProvedorDoEstoque } from "@/components/amassa/estoque/provedor-estoque";

// A contagem do estoque (plano 06-10, D-16, D-17, D-18, D-32, UI-D2) — rota própria.
// A sessão é exigida na PRIMEIRA instrução (T-06-44).
//
// O modo é POR MATERIAL (sem movimentação manual → "Ainda sem contagem"; com → "Conferência"), e
// não existe rascunho: cada linha grava ao ser confirmada, e "contados hoje" vem do banco. A lista é
// lida no servidor, com o "hoje" de Brasília; se a leitura falha, o `error.tsx` desta rota mostra a
// frase da UI-SPEC com "Tentar de novo", e o `loading.tsx` mostra 6 linhas de esqueleto enquanto
// ela chega. O `ProvedorDoEstoque` está aqui pelo "+ Novo material" (vazio "Nada para contar.") —
// o `CarregadorDoSeletor` entrega a ele as categorias de compra, sem atrasar a lista.
export default async function PaginaContagem() {
  await exigirUsuario();

  const itens = await listarParaContagem(hojeEmBrasilia(new Date()));

  return (
    <ProvedorDoEstoque>
      <CabecalhoPagina
        titulo={TITULO_CONTAGEM}
        voltar={{ href: rotaDeGestao("/estoque"), rotulo: ROTULO_VOLTAR_AO_ESTOQUE }}
      />
      <Suspense fallback={null}>
        <CarregadorDoSeletor />
      </Suspense>
      <ListaContagem itens={itens} />
    </ProvedorDoEstoque>
  );
}
