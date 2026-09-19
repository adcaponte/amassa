// A virada do Financeiro (04.4-04-PLAN.md, Tarefa 2; BRIEFING.md §7): traz para "A pagar" as
// parcelas da Abertura do Espaço que ainda não venceram na data da virada, com o rótulo "n de N"
// preservado, a categoria certa (Material → categoria de custo; as demais → "Equipamento e
// obra"), e grava o saldo inicial do caixa que o dono informa. Roda pelo estágio `ferramentas`
// do Dockerfile, como os outros scripts de linha de comando:
//
//   docker compose run --rm ferramentas npm run importar-parcelas-abertura -- \
//     --data-da-virada "2026-12-01" --autor "dono@exemplo.com"
//
// Por padrão é um ENSAIO — nada é gravado. Só grava com --aplicar (e aí --saldo-inicial passa a
// ser obrigatório):
//
//   docker compose run --rm ferramentas npm run importar-parcelas-abertura -- \
//     --data-da-virada "2026-12-01" --autor "dono@exemplo.com" --saldo-inicial "3200,00" --aplicar
//
// NÃO roda nesta fase: quem roda é o dono, na virada, seguindo o Roteiro 11
// (`docs/operacao/11-virada-do-financeiro.md`) — este script só sai pronto, testado e
// documentado. Módulo de USO ÚNICO que sai junto com o código da Abertura (Roteiro 8) — por isso
// importa `../lib/virada/parcelas-da-abertura` por caminho relativo, no molde de
// `criar-usuario.ts`.
//
// O script LÊ `abertura_itens` (só `select`) e nunca escreve em tabela `abertura_*` — a regra de
// dono único do briefing (§7): gasto que está na Abertura não é lançado de novo à mão, e a
// Abertura não é mexida por este script.
import { existsSync } from "node:fs";

import { and, asc, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";

import { converterReaisParaCentavos, TETO_CENTAVOS } from "../lib/financeiro/dinheiro";
import { formatarReais } from "../lib/financeiro/formato";
import {
  planejarImportacao,
  type CategoriaDaAbertura,
  type DocumentoPlanejado,
  type ItemDaAberturaParaVirada,
} from "../lib/virada/parcelas-da-abertura";

// Na máquina do desenvolvedor, DATABASE_URL vem de `.env.local` — scripts soltos não herdam o
// carregamento de ambiente do Next.js. No servidor a variável já vem do ambiente do contêiner
// `ferramentas`.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const CATEGORIA_MATERIAL_PADRAO = "Argila, esmalte e insumos";
const CATEGORIA_DEMAIS_PADRAO = "Equipamento e obra";

const ROTULO_CATEGORIA_ABERTURA: Record<CategoriaDaAbertura, string> = {
  moveis: "Móveis",
  equipamentos: "Equipamentos",
  material: "Material",
  utensilios: "Utensílios",
  obra: "Obra",
  outros: "Outros",
};

const USO =
  'Uso: importar-parcelas-abertura --data-da-virada "AAAA-MM-01" --autor "seu@email.com" ' +
  '[--categoria-material "Nome"] [--categoria-demais "Nome"] ' +
  '[--aplicar --saldo-inicial "1.234,56"]';

const PRIMEIRO_DIA_DO_MES = /^(\d{4})-(\d{2})-01$/;

function dataDaViradaValida(valor: string): boolean {
  const casamento = PRIMEIRO_DIA_DO_MES.exec(valor);
  if (!casamento) {
    return false;
  }
  const mes = Number(casamento[2]);
  return mes >= 1 && mes <= 12;
}

const argumentosSchema = z.object({
  dataDaVirada: z
    .string({ message: "Informe --data-da-virada." })
    .refine(dataDaViradaValida, 'A data da virada precisa ser o primeiro dia de um mês, no formato "AAAA-MM-01".'),
  autor: z
    .string({ message: "Informe --autor." })
    .trim()
    .toLowerCase()
    .pipe(z.email("O e-mail do autor não é válido.")),
});

function lerArgumento(nomeArgumento: string): string | undefined {
  const prefixo = `--${nomeArgumento}=`;
  const comIgual = process.argv.find((argumento) => argumento.startsWith(prefixo));
  if (comIgual) return comIgual.slice(prefixo.length);

  const indice = process.argv.indexOf(`--${nomeArgumento}`);
  if (indice !== -1 && process.argv[indice + 1] !== undefined) {
    return process.argv[indice + 1];
  }

  return undefined;
}

function lerBandeira(nomeArgumento: string): boolean {
  return process.argv.includes(`--${nomeArgumento}`);
}

function falharComUso(mensagens: string[]): never {
  console.error(USO);
  for (const mensagem of mensagens) {
    console.error(`  - ${mensagem}`);
  }
  process.exit(1);
}

// "7 de 10" / "10 de 10" → "parcelas 7 a 10 de 10". Uma parcela só com rótulo → "parcela 7 de
// 10". Sem rótulo nenhum (item à vista) → "à vista".
function descricaoDasParcelas(documento: DocumentoPlanejado): string {
  const rotulos = documento.parcelas.map((parcela) => parcela.rotulo).filter((rotulo) => rotulo !== null);
  if (rotulos.length === 0) {
    return "à vista";
  }
  if (rotulos.length === 1) {
    return `parcela ${rotulos[0]}`;
  }
  const primeiroNumero = rotulos[0].split(" de ")[0];
  const ultimoRotulo = rotulos[rotulos.length - 1];
  return `parcelas ${primeiroNumero} a ${ultimoRotulo}`;
}

async function main() {
  const resultado = argumentosSchema.safeParse({
    dataDaVirada: lerArgumento("data-da-virada"),
    autor: lerArgumento("autor"),
  });

  if (!resultado.success) {
    falharComUso(resultado.error.issues.map((problema) => problema.message));
  }

  const { dataDaVirada, autor } = resultado.data;
  const aplicar = lerBandeira("aplicar");
  const categoriaMaterialNome = (lerArgumento("categoria-material") ?? CATEGORIA_MATERIAL_PADRAO).trim();
  const categoriaDemaisNome = (lerArgumento("categoria-demais") ?? CATEGORIA_DEMAIS_PADRAO).trim();
  const saldoInicialTextoBruto = lerArgumento("saldo-inicial");

  if (aplicar && saldoInicialTextoBruto === undefined) {
    falharComUso(["--saldo-inicial é obrigatório junto de --aplicar."]);
    return;
  }

  let saldoInicialCentavos: number | null = null;
  if (saldoInicialTextoBruto !== undefined) {
    const conversao = converterReaisParaCentavos(saldoInicialTextoBruto);
    if (!conversao.ok) {
      falharComUso([`--saldo-inicial: ${conversao.erro}`]);
      return;
    }
    if (conversao.centavos === null) {
      falharComUso(["--saldo-inicial: informe um valor (pode ser 0)."]);
      return;
    }
    saldoInicialCentavos = conversao.centavos;
  }

  const { db, pool } = await import("../db");
  const { aberturaItens, categorias, configuracaoFinanceira, documentoLinhas, documentos, parcelas, usuarios } =
    await import("../db/schema");

  try {
    const resultadoDoBanco = await db.execute<{ banco: string }>("select current_database() as banco");
    console.log(`Banco conectado: ${resultadoDoBanco.rows[0].banco}`);

    const [autorEncontrado] = await db
      .select({ id: usuarios.id, ativo: usuarios.ativo })
      .from(usuarios)
      .where(eq(sql`lower(${usuarios.email})`, autor))
      .limit(1);
    if (!autorEncontrado || !autorEncontrado.ativo) {
      console.error(
        `O autor "${autor}" não existe ou está desativado — informe o e-mail de um gestor ativo.`,
      );
      process.exitCode = 1;
      return;
    }

    const [categoriaMaterial] = await db
      .select({ id: categorias.id, grupo: categorias.grupo })
      .from(categorias)
      .where(eq(categorias.nome, categoriaMaterialNome))
      .limit(1);
    if (!categoriaMaterial) {
      console.error(`A categoria de material "${categoriaMaterialNome}" não existe.`);
      process.exitCode = 1;
      return;
    }
    if (categoriaMaterial.grupo !== "custo") {
      console.error(
        `A categoria de material "${categoriaMaterialNome}" precisa ser do grupo "custo" (veio "${categoriaMaterial.grupo}").`,
      );
      process.exitCode = 1;
      return;
    }

    const [categoriaDemais] = await db
      .select({ id: categorias.id, grupo: categorias.grupo })
      .from(categorias)
      .where(eq(categorias.nome, categoriaDemaisNome))
      .limit(1);
    if (!categoriaDemais) {
      console.error(`A categoria dos demais itens "${categoriaDemaisNome}" não existe.`);
      process.exitCode = 1;
      return;
    }
    if (categoriaDemais.grupo !== "fora") {
      console.error(
        `A categoria dos demais itens "${categoriaDemaisNome}" precisa ser do grupo "fora" (veio "${categoriaDemais.grupo}").`,
      );
      process.exitCode = 1;
      return;
    }

    const itensDaAbertura = await db
      .select({
        id: aberturaItens.id,
        nome: aberturaItens.nome,
        categoria: aberturaItens.categoria,
        valorCentavos: aberturaItens.valorCentavos,
        formaPagamento: aberturaItens.formaPagamento,
        parcelas: aberturaItens.parcelas,
        primeiraParcelaEm: aberturaItens.primeiraParcelaEm,
        resolvido: aberturaItens.resolvido,
      })
      .from(aberturaItens);

    const itensParaVirada: ItemDaAberturaParaVirada[] = itensDaAbertura.map((item) => ({
      id: item.id,
      nome: item.nome,
      categoria: item.categoria,
      valorEmCentavos: item.valorCentavos,
      formaPagamento: item.formaPagamento,
      parcelas: item.parcelas,
      primeiraParcelaEm: item.primeiraParcelaEm,
      resolvido: item.resolvido,
    }));

    const plano = planejarImportacao({
      itens: itensParaVirada,
      dataDaVirada,
      categoriaMaterialId: categoriaMaterial.id,
      categoriaDemaisId: categoriaDemais.id,
    });

    console.log("");
    console.log(`Itens que virariam documento de despesa (${plano.documentos.length}):`);
    for (const documento of plano.documentos) {
      const categoriaDestinoNome =
        documento.categoriaFinanceiraId === categoriaMaterial.id ? categoriaMaterialNome : categoriaDemaisNome;
      console.log(
        `  - ${documento.nome} — ${ROTULO_CATEGORIA_ABERTURA[documento.categoriaAbertura]} → ` +
          `${categoriaDestinoNome} — ${descricaoDasParcelas(documento)} — ` +
          `${formatarReais(documento.valorCentavos)} — resolvido: ${documento.resolvido ? "sim" : "não"}`,
      );
    }

    console.log("");
    console.log(`Itens ignorados (${plano.ignorados.length}):`);
    for (const ignorado of plano.ignorados) {
      console.log(`  - ${ignorado.nome} — ${ignorado.motivo}`);
    }

    const totalGeralCentavos = plano.documentos.reduce((total, documento) => total + documento.valorCentavos, 0);
    console.log("");
    console.log(`Total de documentos a gravar: ${plano.documentos.length}`);
    console.log(`Soma dos documentos: ${formatarReais(totalGeralCentavos)}`);
    if (saldoInicialCentavos !== null) {
      console.log(
        `Saldo inicial que seria gravado: ${formatarReais(saldoInicialCentavos)} em ${dataDaVirada}.`,
      );
    }

    if (!aplicar) {
      console.log("");
      console.log("Nada foi gravado (ensaio). Rode de novo com --aplicar para gravar.");
      return;
    }

    // Guarda (T-04.4-28): parcela paga, de documento não cancelado, com data de pagamento
    // anterior à virada — ela já está fora do que o saldo inicial representa, e gravar mesmo
    // assim contaria esse dinheiro duas vezes.
    const parcelasAnterioresAVirada = await db
      .select({
        numero: documentos.numero,
        pagoEm: parcelas.pagoEm,
        valorCentavos: parcelas.valorCentavos,
      })
      .from(parcelas)
      .innerJoin(documentos, eq(parcelas.documentoId, documentos.id))
      .where(
        and(isNotNull(parcelas.pagoEm), lt(parcelas.pagoEm, dataDaVirada), isNull(documentos.canceladoEm)),
      )
      .orderBy(asc(parcelas.pagoEm));

    if (parcelasAnterioresAVirada.length > 0) {
      console.log("");
      console.error(
        "Existem parcelas pagas antes da virada, em documentos não cancelados — elas contariam " +
          "duas vezes com o saldo inicial:",
      );
      for (const parcela of parcelasAnterioresAVirada) {
        console.error(
          `  - Documento nº ${parcela.numero} — pago em ${parcela.pagoEm} — ${formatarReais(parcela.valorCentavos)}`,
        );
      }
      console.error(
        "Cancele esses lançamentos antes da virada — eles contariam duas vezes com o saldo inicial.",
      );
      process.exitCode = 1;
      return;
    }

    // Não-nulo aqui: validado acima (obrigatório junto de --aplicar).
    const saldoParaGravar = saldoInicialCentavos as number;
    if (saldoParaGravar > TETO_CENTAVOS) {
      console.error("--saldo-inicial passa do teto permitido.");
      process.exitCode = 1;
      return;
    }

    const { criados, jaExistiam } = await db.transaction(async (tx) => {
      let criadosNestaExecucao = 0;
      let jaExistiamNestaExecucao = 0;

      for (const documento of plano.documentos) {
        const [documentoInserido] = await tx
          .insert(documentos)
          .values({
            tipo: "despesa",
            data: documento.data,
            titulo: documento.nome,
            chaveDeImportacao: documento.chaveDeImportacao,
            criadoPor: autorEncontrado.id,
          })
          .onConflictDoNothing({ target: documentos.chaveDeImportacao })
          .returning({ id: documentos.id });

        if (!documentoInserido) {
          // Chave de importação já ocupada — o script já rodou para este item antes; nada de
          // novo a gravar (idempotência, T-04.4-27).
          jaExistiamNestaExecucao += 1;
          continue;
        }
        criadosNestaExecucao += 1;

        await tx.insert(documentoLinhas).values({
          documentoId: documentoInserido.id,
          ordem: 0,
          descricao: documento.nome,
          categoriaId: documento.categoriaFinanceiraId,
          quantidade: 1,
          valorCentavos: documento.valorCentavos,
        });

        await tx.insert(parcelas).values(
          documento.parcelas.map((parcela) => ({
            documentoId: documentoInserido.id,
            numero: parcela.numero,
            vencimento: parcela.vencimento,
            valorCentavos: parcela.valorCentavos,
            forma: parcela.forma,
            rotulo: parcela.rotulo,
          })),
        );
      }

      await tx
        .insert(configuracaoFinanceira)
        .values({
          linhaUnica: true,
          saldoInicialCentavos: saldoParaGravar,
          dataSaldoInicial: dataDaVirada,
        })
        .onConflictDoUpdate({
          target: configuracaoFinanceira.linhaUnica,
          set: { saldoInicialCentavos: saldoParaGravar, dataSaldoInicial: dataDaVirada },
        });

      return { criados: criadosNestaExecucao, jaExistiam: jaExistiamNestaExecucao };
    });

    console.log("");
    console.log(
      `Gravado: ${criados} documento(s) novo(s), ${jaExistiam} já existia(m) (chave de importação já ocupada).`,
    );
    console.log(`Saldo inicial gravado: ${formatarReais(saldoParaGravar)} em ${dataDaVirada}.`);
  } finally {
    await pool.end();
  }
}

main().catch((erro) => {
  console.error("Falha ao importar as parcelas da Abertura:", erro);
  process.exitCode = 1;
});
