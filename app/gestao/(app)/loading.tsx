import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto de navegação entre módulos — no FORMATO do conteúdo que ele substitui (D-03): um
// retângulo do tamanho do título de página (papel `display`) e, abaixo, blocos do tamanho da
// área de conteúdo. Nunca um "carregando..." solto — só componentes `Skeleton` e elementos de
// leiaute, nenhuma cadeia de texto entre as tags.
//
// Este arquivo raramente aparece nesta fase: `exigirUsuario()` resolve a sessão no servidor
// antes de renderizar qualquer página, então não há espera perceptível no cliente para
// exercitá-lo hoje. Ele é o padrão que as Fases 3 a 6 vão copiar quando uma página tiver
// consulta real ao banco — aí sim há um carregamento de verdade para cobrir. Não é espaço
// reservado permanente: um esqueleto que nunca resolve lê como travamento (D-03).
export default function CarregandoApp() {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-6 md:px-8">
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="flex flex-1 flex-col items-center gap-3 px-6 py-16">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-4 w-72" />
      </div>
    </div>
  );
}
