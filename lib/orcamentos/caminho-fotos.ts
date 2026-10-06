// Módulo que decide onde a foto de um orçamento mora — e o ÚNICO. Nenhuma rota, Server Action
// ou script deve montar um caminho de foto por conta própria (T-04.5-13): toda travessia passa
// por `caminhoDaFoto()`.
//
// Fase 04.6: a rota que serve o byte se mudou de `/api/orcamentos/fotos/[id]` para
// `/gestao/api/orcamentos/fotos/[id]` (T-04.6-04) — só a URL. O caminho no DISCO, decidido por
// este módulo, não mudou: continua o mesmo bind mount de `docker/compose.yml` (04.5-03, D-30).
// Mexer neste arquivo por causa da mudança de rota quebraria o backup das fotos.
//
// Uma exceção deliberada à regra "módulo puro, sem leitura do ambiente" de `lib/`
// (01-ARQUITETURA.md §3): este arquivo lê `process.env.CAMINHO_FOTOS`, porque decidir ONDE a
// foto mora É o trabalho dele. Nenhuma regra de NEGÓCIO depende do relógio ou de I/O aqui —
// só a localização de um diretório.
import path from "node:path";

// A MESMA expressão regular do `check` da coluna `orcamento_fotos.arquivo`
// (db/migrations/0017_precificacao-e-orcamentos.sql, constraint
// "orcamento_fotos_arquivo_formato") — duas cópias DELIBERADAS da mesma regra. Esta aqui
// recusa cedo, com uma mensagem em português, antes de qualquer I/O; a do banco é a última
// linha de defesa, para o caso (nunca esperado) de algo escrever na tabela sem passar por este
// módulo. Um UUID (qualquer versão, em minúsculas) seguido de ".jpg" — nunca a extensão
// original enviada pelo celular, porque o servidor sempre regrava em JPEG (D-26).
export const NOME_DE_ARQUIVO_VALIDO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

// Devolve o diretório onde as fotos de orçamento moram.
//
// Em produção, `CAMINHO_FOTOS` vem de `docker/compose.yml` — o bind mount decidido pelo dono
// (D-30): `/opt/amassa/dados/fotos-orcamentos` no host, montado em `/dados/fotos-orcamentos`
// dentro do contêiner `app`. Sem a variável — `npm run dev` e o e2e local, que sobem
// `next start`/`node server.js` no diretório do próprio projeto, nunca dentro de um contêiner —,
// cai num diretório dentro do repositório, ignorado pelo git (`.gitignore`: `.dados/`). Nenhuma
// foto de cliente entra no repositório em nenhum dos dois casos — o repositório é público.
export function diretorioDeFotos(): string {
  const doAmbiente = process.env.CAMINHO_FOTOS;
  if (doAmbiente) return doAmbiente;
  // Fase 06.5 (D-22, P6): `turbopackIgnore` — o caminho é decidido em tempo de execução, e sem o
  // comentário o rastreador do `next build` copiava o projeto inteiro (com `.dados/`) para
  // `.next/standalone`. Na imagem a pasta é montada no contêiner (`CAMINHO_FOTOS`).
  return path.join(/*turbopackIgnore: true*/ process.cwd(), ".dados/fotos-orcamentos");
}

// Porta única de travessia de caminho (T-04.5-13): recebe o NOME do arquivo (nunca um caminho),
// recusa (lança) qualquer coisa que não seja exatamente um UUID seguido de ".jpg" — o que
// bloqueia `../`, barra e barra invertida, byte nulo e qualquer extensão diferente —, e só
// então junta com o diretório de fotos. Nenhuma rota, ação ou script deve montar esse caminho
// na mão; sempre por aqui.
export function caminhoDaFoto(arquivo: string): string {
  if (!NOME_DE_ARQUIVO_VALIDO.test(arquivo)) {
    throw new Error(
      `Nome de arquivo de foto inválido: "${arquivo}". Esperado um identificador seguido de ".jpg".`,
    );
  }
  return path.join(diretorioDeFotos(), arquivo);
}
