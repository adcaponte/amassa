import Link from "next/link";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { listarFornosDoIndice } from "@/lib/queimas/consultas";
import { FRASE_VAZIO_CORPO, FRASE_VAZIO_TITULO, ROTULO_NOVO_FORNO } from "@/lib/queimas/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { Button } from "@/components/ui/button";
import { FormularioForno } from "@/components/amassa/queimas/formulario-forno";
import { ListaFornos } from "@/components/amassa/queimas/lista-fornos";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de app/(app)/encomendas/page.tsx.
// D-02: não existe tela de cadastro de fornos — o botão "Novo forno" abre `?novo` (masculino,
// "forno") na própria rota, mesma convenção de `?nova` em Encomendas.
export default async function PaginaQueimas() {
  await exigirUsuario();

  const fornosDoIndice = await listarFornosDoIndice();

  return (
    <>
      <CabecalhoPagina titulo="Queimas">
        <Button asChild variant="default" className="min-h-[44px]">
          <Link href="/queimas?novo">{ROTULO_NOVO_FORNO}</Link>
        </Button>
      </CabecalhoPagina>

      {/* Montado sempre — mesmo com o índice vazio, `?novo` precisa abrir o formulário a partir
          do `EstadoVazio` (o primeiríssimo forno do ateliê), achado do 03-06 replicado aqui. */}
      <FormularioForno />

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
