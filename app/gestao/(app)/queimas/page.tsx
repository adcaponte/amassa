import Link from "next/link";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { medirForno } from "@/lib/queimas/contador";
import { listarFornosDoIndice } from "@/lib/queimas/consultas";
import { ordenarParaBanner } from "@/lib/queimas/filtros";
import { FRASE_VAZIO_CORPO, FRASE_VAZIO_TITULO, ROTULO_NOVO_FORNO } from "@/lib/queimas/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { Button } from "@/components/ui/button";
import { BannerAtencao } from "@/components/amassa/queimas/banner-atencao";
import { FormularioForno } from "@/components/amassa/queimas/formulario-forno";
import { ListaFornos } from "@/components/amassa/queimas/lista-fornos";
import { SeletorQueimas } from "@/components/amassa/queimas/seletor-queimas";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de app/(app)/encomendas/page.tsx.
// D-02: não existe tela de cadastro de fornos — o botão "Novo forno" abre `?novo` (masculino,
// "forno") na própria rota, mesma convenção de `?nova` em Encomendas.
export default async function PaginaQueimas() {
  await exigirUsuario();

  const fornosDoIndice = await listarFornosDoIndice();

  // O banner (FOR-06) é calculado sobre a MESMA lista que alimenta os cartões — nunca uma
  // segunda consulta ao banco. `medirForno` é a mesma função pura que `cartao-forno.tsx` chama
  // por forno; recalcular aqui é barato (dado já em memória) e garante que os dois nunca
  // discordem, já que a mesma entrada sempre devolve a mesma medida.
  const fornosEmAtencao = ordenarParaBanner(
    fornosDoIndice.map((forno) => {
      const medida = medirForno({
        limite: forno.limite,
        ocorrenciasDeQueima: forno.ocorrenciasDeQueima,
        ultimaManutencaoEm: forno.ultimaManutencaoEm,
      });
      return {
        nome: forno.nome,
        ativo: forno.ativo,
        nivel: medida.nivel,
        contador: medida.contador,
        limite: medida.limite,
      };
    }),
  );

  return (
    <>
      <CabecalhoPagina titulo="Queimas">
        <Button asChild variant="default" className="min-h-[44px]">
          <Link href="/queimas?novo">{ROTULO_NOVO_FORNO}</Link>
        </Button>
      </CabecalhoPagina>

      {/* Seletor de topo (D-01, plano 04-06) — logo abaixo do cabeçalho, nas três telas do
          módulo. "Fornos" fica ativo aqui e em `/queimas/[id]`. */}
      <SeletorQueimas />

      {/* Montado sempre — mesmo com o índice vazio, `?novo` precisa abrir o formulário a partir
          do `EstadoVazio` (o primeiríssimo forno do ateliê), achado do 03-06 replicado aqui. */}
      <FormularioForno />

      {/* Entre o cabeçalho e a lista/vazio (04-05-PLAN.md Tarefa 1) — faz parte do mesmo Server
          Component da página, então entra no `loading.tsx` da rota igual ao resto e some junto
          se `error.tsx` cobrir a tela; devolve `null` sozinho quando N=0. */}
      <BannerAtencao fornos={fornosEmAtencao} />

      {fornosDoIndice.length === 0 ? (
        <EstadoVazio
          titulo={FRASE_VAZIO_TITULO}
          corpo={FRASE_VAZIO_CORPO}
          rotuloBotao={ROTULO_NOVO_FORNO}
          hrefBotao="/queimas?novo"
        />
      ) : (
        <ListaFornos fornos={fornosDoIndice} />
      )}
    </>
  );
}
