import { Skeleton } from "@/components/ui/skeleton";
import { EsqueletoSaldos } from "@/components/amassa/estoque/esqueleto-saldos";

// Esqueleto da rota inteira enquanto a página resolve a sessão — o cabeçalho e o MESMO esqueleto
// da seção de saldos (4 cartões no celular, 6 linhas de tabela a partir de 980px), nunca
// "carregando..." solto nem tela em branco (CLAUDE.md §Estados).
export default function CarregandoEstoque() {
  return (
    <div className="flex flex-col">
      <div className="border-border border-b px-6 py-6 md:px-8">
        <Skeleton className="h-8 w-32" />
      </div>
      <EsqueletoSaldos />
    </div>
  );
}
