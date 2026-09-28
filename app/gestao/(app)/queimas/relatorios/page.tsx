import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { carregarQueimasParaRelatorio } from "@/lib/queimas/consultas";
import { diaCivilEmBrasilia, hojeEmBrasilia } from "@/lib/queimas/formato";
import {
  agregarPorForno,
  agregarPorMes,
  agregarPorSemana,
  estatisticasDeQueimas,
} from "@/lib/queimas/relatorios";
import {
  FRASE_RELATORIOS_VAZIO_CORPO,
  FRASE_RELATORIOS_VAZIO_TITULO,
  ROTULO_VER_FORNOS,
} from "@/lib/queimas/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { EstatisticasQueimas } from "@/components/amassa/queimas/estatisticas-queimas";
import { RelatoriosRecharts } from "@/components/amassa/queimas/relatorios-recharts";
import { SeletorQueimas } from "@/components/amassa/queimas/seletor-queimas";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de `app/(app)/queimas/page.tsx`
// (T-04-01, provado por `npm run verificar-acoes`). D-01: rota PRÓPRIA, carrega só o que a sua
// tela precisa — quem abre para registrar uma queima em `/queimas` não paga o custo desta
// agregação.
export default async function PaginaRelatoriosDeQueimas() {
  await exigirUsuario();

  const hoje = hojeEmBrasilia(new Date());
  const queimasCarregadas = await carregarQueimasParaRelatorio();

  // `carregarQueimasParaRelatorio()` roda UMA VEZ — as duas agregações e as estatísticas saem do
  // MESMO conjunto em memória, então o alternador Semana/Mês do componente de cliente nunca
  // dispara consulta nova nem pode discordar do total (must_have deste plano).
  const queimasReduzidas = queimasCarregadas.map((queima) => ({
    diaCivil: diaCivilEmBrasilia(queima.ocorridaEm),
    tipo: queima.tipo,
  }));

  const estatisticas = estatisticasDeQueimas(queimasReduzidas, hoje);
  const baldesPorSemana = agregarPorSemana(queimasReduzidas, hoje);
  const baldesPorMes = agregarPorMes(queimasReduzidas, hoje);
  const barrasPorForno = agregarPorForno(queimasCarregadas);

  return (
    <>
      <CabecalhoPagina titulo="Relatórios" />

      {/* Sempre montado, mesmo com zero queimas — o item "Relatórios" continua visível e
          alcançável (D-08). */}
      <SeletorQueimas />

      {queimasCarregadas.length === 0 ? (
        // D-08: gráfico de eixos desenhados e nenhuma barra parece defeito — o vazio dá lugar
        // aos gráficos por inteiro, com o caminho de volta para os fornos.
        <EstadoVazio
          titulo={FRASE_RELATORIOS_VAZIO_TITULO}
          corpo={FRASE_RELATORIOS_VAZIO_CORPO}
          rotuloBotao={ROTULO_VER_FORNOS}
          hrefBotao="/queimas"
        />
      ) : (
        // Estatísticas primeiro, gráficos depois — D-07: é a ordem que o celular exige, e no
        // desktop ela não atrapalha (04-UI-SPEC.md §"Visual Hierarchy").
        <div className="flex flex-col gap-8 px-6 py-6 md:px-8">
          <EstatisticasQueimas estatisticas={estatisticas} />
          <RelatoriosRecharts
            baldesPorSemana={baldesPorSemana}
            baldesPorMes={baldesPorMes}
            barrasPorForno={barrasPorForno}
          />
        </div>
      )}
    </>
  );
}
