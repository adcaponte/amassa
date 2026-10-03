// Módulo que decide onde o arquivo de um anexo de fornecedor mora — e o ÚNICO (molde exato de
// `lib/orcamentos/caminho-fotos.ts`). Nenhuma rota, Server Action ou script deve montar um caminho de
// anexo por conta própria (T-06.2-17): toda travessia passa por `caminhoDoAnexo()`.
//
// Uma exceção deliberada à regra "módulo puro, sem leitura do ambiente" de `lib/`
// (01-ARQUITETURA.md §3): este arquivo lê `process.env.CAMINHO_ANEXOS_FORNECEDORES`, porque decidir
// ONDE o anexo mora É o trabalho dele. Nenhuma regra de NEGÓCIO depende do relógio ou de I/O aqui — só
// a localização de um diretório e o sorteio de um nome.
import { randomUUID } from "node:crypto";
import path from "node:path";

// A MESMA expressão regular do `check` `fornecedor_anexos_arquivo_formato` da coluna
// `fornecedor_anexos.arquivo_caminho` (db/migrations/0028_fornecedores.sql) — duas cópias DELIBERADAS
// da mesma regra. Esta aqui recusa cedo, antes de qualquer I/O; a do banco é a última linha de defesa,
// para o caso (nunca esperado) de algo escrever na tabela sem passar por este módulo. Um UUID (em
// minúsculas) seguido de uma das cinco extensões que o servidor grava — nunca o nome que a pessoa deu.
// Mudar uma é mudar as duas, no mesmo commit.
export const NOME_DE_ANEXO_VALIDO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|xlsx|xls|csv)$/;

export type ExtensaoNoDisco = "pdf" | "jpg" | "xlsx" | "xls" | "csv";

// Devolve o diretório onde os anexos dos fornecedores moram.
//
// Em produção, `CAMINHO_ANEXOS_FORNECEDORES` vem da imagem e de `docker/compose.yml` — o bind mount
// `/opt/amassa/dados/anexos-fornecedores:/dados/anexos-fornecedores` (D-A02; a imagem e o compose são
// do plano 06). Sem a variável — `npm run dev` e o e2e local, que sobem o servidor no diretório do
// próprio projeto —, cai num diretório dentro do repositório, ignorado pelo git (`.gitignore`:
// `.dados/`). Nunca dentro de `public/`: nenhum anexo tem URL pública; só sai pela rota sob
// `/gestao/api/`, atrás da sessão.
export function diretorioDeAnexos(): string {
  const doAmbiente = process.env.CAMINHO_ANEXOS_FORNECEDORES;
  if (doAmbiente) return doAmbiente;
  return path.join(process.cwd(), ".dados/anexos-fornecedores");
}

// Porta única de travessia de caminho (T-06.2-17): recebe o NOME do arquivo (nunca um caminho), recusa
// (lança) qualquer coisa que não seja exatamente um UUID seguido de uma das cinco extensões — o que
// bloqueia `../`, barra e barra invertida, byte nulo e qualquer outra extensão —, e só então junta com o
// diretório de anexos.
export function caminhoDoAnexo(arquivo: string): string {
  if (!NOME_DE_ANEXO_VALIDO.test(arquivo)) {
    throw new Error(
      `Nome de arquivo de anexo inválido: "${arquivo}". Esperado um identificador seguido de uma extensão aceita.`,
    );
  }
  return path.join(diretorioDeAnexos(), arquivo);
}

// O nome no disco de um anexo novo: um UUID sorteado pelo SERVIDOR + a extensão decidida pela
// classificação (nunca a do nome original).
export function nomeDeArquivoNovo(extensao: ExtensaoNoDisco): string {
  const nome = `${randomUUID()}.${extensao}`;
  if (!NOME_DE_ANEXO_VALIDO.test(nome)) {
    throw new Error(`Extensão de anexo inválida: "${extensao}".`);
  }
  return nome;
}

// O temporário do envio em curso: `.envio-<uuid>` DENTRO da própria pasta de anexos (Pitfall 5 — o
// `rename` para o nome final fica no mesmo sistema de arquivos, sem `EXDEV`; nunca a pasta temporária do
// sistema, que no contêiner é outro sistema de arquivos). O ponto inicial e o prefixo fazem o nome nunca
// casar com `NOME_DE_ANEXO_VALIDO`: a rota de leitura jamais serve um envio pela metade.
export function caminhoTemporario(): string {
  return path.join(diretorioDeAnexos(), `.envio-${randomUUID()}`);
}
