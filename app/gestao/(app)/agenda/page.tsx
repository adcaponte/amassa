import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de app/(app)/encomendas/page.tsx.
export default async function PaginaAgenda() {
  await exigirUsuario();

  return (
    <>
      <CabecalhoPagina titulo="Agenda" />
      <EstadoVazio
        titulo="Nenhuma turma na grade ainda."
        corpo="Cadastre a primeira turma e as aulas da semana aparecem aqui, com data e presença por aluna."
        rotuloBotao="Nova turma"
        notaBotao="Chega na Fase 5."
      />
    </>
  );
}
