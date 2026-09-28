import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { DIAS_PADRAO, calcularCronograma, situacaoEm } from "@/lib/encomendas/cronograma";
import { formatarDiaCurto, hojeEmBrasilia } from "@/lib/encomendas/formato";
import { ordenarParaGantt } from "@/lib/encomendas/gantt";
import { listarEncomendasAtivas } from "@/lib/encomendas/consultas";
import {
  FRASE_VAZIO_TITULO,
  NOTA_NADA_PARA_IMPRIMIR,
  TITULO_FOLHA_IMPRESSAO,
  textoDaSituacao,
} from "@/lib/encomendas/textos";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { BotaoImprimirFolha } from "@/components/amassa/encomendas/botao-imprimir-folha";

import estilos from "./impressao.module.css";

// "09/08/2026 às 14:32" em Brasília — só esta rota precisa de um INSTANTE completo (data e
// hora), nunca de uma data civil `YYYY-MM-DD` já calculada pela cascata — por isso não vive em
// `lib/encomendas/formato.ts` (que só formata o que `cronograma.ts` já produziu). `Intl` puro,
// mesma disciplina de zero-dependência de fuso do resto da fase (PD-04, nunca `date-fns`).
function formatarDataEHora(instante: Date): string {
  const data = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(instante);
  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(instante);
  return `${data} às ${hora}`;
}

// A folha A4 de "o que tem e em que pé está" (D-18, ENC-14) — escopo PRÓPRIO e fixo,
// independente do filtro/busca/ordenação vigentes em `/encomendas` (03-UI-SPEC.md "Impressão
// A4"): SEMPRE todas as `rascunho` + `em_producao`, nunca as concluídas/canceladas do
// histórico. `exigirUsuario()` como primeira instrução — mesma regra de toda página do grupo
// protegido; sem sessão, o `middleware.ts` já redireciona para `/login` antes de chegar aqui.
export default async function PaginaImprimirEncomendas() {
  await exigirUsuario();

  const hoje = hojeEmBrasilia(new Date());
  const agora = new Date();
  const encomendasAtivas = await listarEncomendasAtivas();

  if (encomendasAtivas.length === 0) {
    // Mesma nota do botão desabilitado do índice (`botao-imprimir.tsx`) — acessar a rota direto
    // nesse estado mostra a mesma frase, nunca uma segunda versão dela.
    return (
      <div className={estilos.pagina}>
        <EstadoVazio titulo={FRASE_VAZIO_TITULO} corpo={NOTA_NADA_PARA_IMPRIMIR} />
      </div>
    );
  }

  // Ordena PRIMEIRO pelo nome ORIGINAL (mesmo comparador do índice, `ordenarParaGantt`,
  // ENC-14/ordering) — o sufixo " (rascunho)" é só de EXIBIÇÃO e entra DEPOIS, para nunca mudar
  // o desempate por nome entre duas encomendas com a mesma data de início.
  const linhas = ordenarParaGantt(
    encomendasAtivas.map((encomenda) => {
      const cronograma = calcularCronograma(
        encomenda.dataInicio,
        encomenda.etapas.length > 0
          ? encomenda.etapas.map((etapa) => ({
              etapa: etapa.etapa,
              dias: etapa.dias,
              esperaDias: etapa.esperaDias,
            }))
          : DIAS_PADRAO,
      );
      // Variante SEM cor de `textoDaSituacao` (impressão pode ser P&B) — a MESMA função da
      // tela, nunca uma segunda tabela de frases (D-15); o caso "atrasada" já sai sem depender
      // de `--color-atencao`, com o sufixo textual "(atrasada)" embutido na frase.
      const situacao = situacaoEm(cronograma, encomenda.status, hoje);

      return {
        id: encomenda.id,
        nome: encomenda.nome,
        dataInicio: encomenda.dataInicio,
        rascunho: encomenda.status === "rascunho",
        clienteNome: encomenda.clienteNome,
        etapaAtual: textoDaSituacao(situacao, { semCor: true }),
        conclusaoPrevista: cronograma.dataDeConclusao
          ? formatarDiaCurto(cronograma.dataDeConclusao)
          : "—",
      };
    }),
  );

  return (
    <div className={estilos.pagina}>
      <div className={estilos.cabecalho}>
        <h1 className={estilos.titulo}>{TITULO_FOLHA_IMPRESSAO}</h1>
        <div className={estilos.acoesDeTela}>
          <span className={estilos.dataImpressao} data-testid="impresso-em">
            Impresso em {formatarDataEHora(agora)}
          </span>
          <BotaoImprimirFolha />
        </div>
      </div>

      <table className={estilos.tabela}>
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">Cliente</th>
            <th scope="col">Etapa atual</th>
            <th scope="col">Conclusão prevista</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.id} className={estilos.linha} data-testid={`linha-impressao-${linha.id}`}>
              <td data-testid={`impressao-nome-${linha.id}`}>
                {linha.nome}
                {linha.rascunho ? " (rascunho)" : ""}
              </td>
              <td data-testid={`impressao-cliente-${linha.id}`}>{linha.clienteNome ?? "—"}</td>
              <td data-testid={`impressao-etapa-${linha.id}`}>{linha.etapaAtual}</td>
              <td data-testid={`impressao-conclusao-${linha.id}`}>{linha.conclusaoPrevista}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
