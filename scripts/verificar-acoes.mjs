#!/usr/bin/env node
// O portão de máquina da regra mais importante do projeto (AUTH-10): toda função marcada como
// código de servidor, num arquivo que alcança o cliente do banco, precisa ter exigirUsuario()
// como primeira instrução do corpo. `02-MODELO-DE-DADOS.md` §0 e `00-BRIEFING.md` §11 item 3
// chamam isso de "verificável em revisão de código" — revisão é uma pessoa cansada às onze da
// noite. Este script decide pela árvore sintática do próprio compilador do TypeScript, nunca
// por expressão regular, que erraria dentro de comentário e de cadeia de caracteres.
//
// Uso: node scripts/verificar-acoes.mjs [caminho...]   (padrão: app lib)
// Cada caminho pode ser um arquivo .ts/.tsx ou um diretório (percorrido recursivamente).
//
// Regra, em uma frase: toda função marcada como ação de servidor ("use server" no topo do
// arquivo, tornando exportada uma ação; ou "use server" dentro do corpo de uma função,
// tornando só aquela uma ação) que esteja num arquivo que importa o cliente do banco precisa
// ter, como primeira instrução do corpo (ignorando a própria diretiva e declarações de tipo),
// uma chamada a exigirUsuario() — direta ou atribuída a uma variável, com ou sem espera.
//
// "Alcança o banco" é decidido pelos imports do próprio arquivo: o alias `@/db`, o caminho
// relativo equivalente, ou o módulo de schema. Um arquivo que não importa nada disso não é
// cobrado — a fronteira deliberada que impede o portão de virar ruído e acabar desligado.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

import ts from "typescript";

const DIRETORIOS_PADRAO = ["app", "lib"];
const IGNORAR = new Set(["node_modules", ".next", ".git"]);

// Aceita tanto um arquivo quanto um diretório — percorrido recursivamente, ignorando pastas
// de ferramental. Um caminho inexistente devolve lista vazia, silenciosamente, do mesmo jeito
// que `find` faria.
function listarArquivosTs(caminho) {
  let info;
  try {
    info = statSync(caminho);
  } catch {
    return [];
  }

  if (info.isFile()) {
    return extname(caminho) === ".ts" || extname(caminho) === ".tsx" ? [caminho] : [];
  }

  if (!info.isDirectory()) return [];

  const resultado = [];
  for (const entrada of readdirSync(caminho)) {
    if (IGNORAR.has(entrada)) continue;
    resultado.push(...listarArquivosTs(join(caminho, entrada)));
  }
  return resultado;
}

// O alias `@/db` (com ou sem `/schema` depois), ou o caminho relativo equivalente
// (qualquer quantidade de `../`/`./` seguida de `db` ou `db/schema`).
function especificadorAlcancaBanco(especificador) {
  return /^(@\/|(\.\.?\/)*)db(\/schema)?$/.test(especificador);
}

function arquivoAlcancaBanco(sourceFile) {
  for (const instrucao of sourceFile.statements) {
    if (
      ts.isImportDeclaration(instrucao) &&
      ts.isStringLiteral(instrucao.moduleSpecifier) &&
      especificadorAlcancaBanco(instrucao.moduleSpecifier.text)
    ) {
      return true;
    }
  }
  return false;
}

function ehDiretivaUseServer(instrucao) {
  return (
    ts.isExpressionStatement(instrucao) &&
    ts.isStringLiteral(instrucao.expression) &&
    instrucao.expression.text === "use server"
  );
}

function arquivoTemDiretivaDeTopo(sourceFile) {
  const primeira = sourceFile.statements[0];
  return primeira ? ehDiretivaUseServer(primeira) : false;
}

// O corpo de uma função-alvo: Block (função nomeada, arrow com chaves) ou Expression (arrow
// concisa, `=> algo`). Undefined quando a função não tem corpo (assinatura de tipo, etc.).
function corpoDe(node) {
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) return node.body;
  if (ts.isArrowFunction(node)) return node.body;
  return undefined;
}

function corpoComecaComDiretiva(corpo) {
  if (!corpo || !ts.isBlock(corpo)) return false;
  const primeira = corpo.statements[0];
  return primeira ? ehDiretivaUseServer(primeira) : false;
}

function ehChamadaExigirUsuario(expressao) {
  let alvo = expressao;
  if (ts.isAwaitExpression(alvo)) alvo = alvo.expression;
  if (!ts.isCallExpression(alvo)) return false;
  return ts.isIdentifier(alvo.expression) && alvo.expression.text === "exigirUsuario";
}

// "Primeira instrução" ignora a própria diretiva e declarações de tipo, e aceita tanto a
// chamada com espera (`await exigirUsuario()`) quanto a atribuição do resultado a uma
// variável (`const usuario = await exigirUsuario();`).
function primeiraInstrucaoChamaExigirUsuario(corpo) {
  if (!corpo) return false;

  if (!ts.isBlock(corpo)) {
    // Corpo de expressão única (arrow concisa): a própria expressão é a única instrução —
    // não há como uma diretiva existir aqui.
    return ehChamadaExigirUsuario(corpo);
  }

  for (const instrucao of corpo.statements) {
    if (ehDiretivaUseServer(instrucao)) continue;
    if (ts.isTypeAliasDeclaration(instrucao) || ts.isInterfaceDeclaration(instrucao)) continue;

    if (ts.isExpressionStatement(instrucao)) {
      return ehChamadaExigirUsuario(instrucao.expression);
    }
    if (ts.isVariableStatement(instrucao)) {
      const [primeiraDeclaracao] = instrucao.declarationList.declarations;
      return primeiraDeclaracao?.initializer
        ? ehChamadaExigirUsuario(primeiraDeclaracao.initializer)
        : false;
    }
    return false;
  }

  return false;
}

function temModificadorExport(node) {
  return (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0;
}

function nomeDaFuncao(node) {
  if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name) {
    return node.name.text;
  }
  // Arrow atribuída a uma variável — usa o nome da variável, que é como a função é chamada
  // pelo resto do código.
  if (node.parent && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
    return node.parent.name.text;
  }
  return "(função anônima)";
}

// Coleta toda função-alvo do arquivo:
// (a) qualquer função, em qualquer profundidade, cujo PRÓPRIO corpo comece com "use server"
//     (marcação de função) — regardless de exportação;
// (b) se o arquivo tiver a diretiva no topo, toda função de nível superior EXPORTADA
//     (marcação de arquivo inteiro) — a regra explícita do texto da tarefa.
function coletarAcoes(sourceFile) {
  const acoes = [];
  const vistos = new Set();

  function registrar(node, nome) {
    if (vistos.has(node)) return;
    vistos.add(node);
    acoes.push({ node, nome });
  }

  function visitar(node) {
    if (
      (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) &&
      corpoComecaComDiretiva(corpoDe(node))
    ) {
      registrar(node, nomeDaFuncao(node));
    }
    ts.forEachChild(node, visitar);
  }
  visitar(sourceFile);

  if (arquivoTemDiretivaDeTopo(sourceFile)) {
    for (const instrucao of sourceFile.statements) {
      if (ts.isFunctionDeclaration(instrucao) && temModificadorExport(instrucao) && instrucao.name) {
        registrar(instrucao, instrucao.name.text);
      }
      if (ts.isVariableStatement(instrucao) && temModificadorExport(instrucao)) {
        for (const declaracao of instrucao.declarationList.declarations) {
          if (
            declaracao.initializer &&
            (ts.isArrowFunction(declaracao.initializer) || ts.isFunctionExpression(declaracao.initializer)) &&
            ts.isIdentifier(declaracao.name)
          ) {
            registrar(declaracao.initializer, declaracao.name.text);
          }
        }
      }
    }
  }

  return acoes;
}

function conferirArquivo(caminho) {
  const texto = readFileSync(caminho, "utf8");
  const sourceFile = ts.createSourceFile(
    caminho,
    texto,
    ts.ScriptTarget.Latest,
    true,
    caminho.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  if (!arquivoAlcancaBanco(sourceFile)) {
    return { conferidas: 0, violacoes: [] };
  }

  const acoes = coletarAcoes(sourceFile);
  const violacoes = [];

  for (const { node, nome } of acoes) {
    if (!primeiraInstrucaoChamaExigirUsuario(corpoDe(node))) {
      const linha = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile)).line + 1;
      violacoes.push({
        arquivo: caminho,
        linha,
        funcao: nome,
        mensagem: `a função "${nome}" toca o banco sem chamar exigirUsuario() como primeira instrução do corpo`,
      });
    }
  }

  return { conferidas: acoes.length, violacoes };
}

function main() {
  const argumentos = process.argv.slice(2);
  const alvos = argumentos.length > 0 ? argumentos : DIRETORIOS_PADRAO;

  const arquivos = alvos.flatMap((alvo) => listarArquivosTs(alvo));

  let totalConferidas = 0;
  const todasViolacoes = [];

  for (const arquivo of arquivos) {
    const { conferidas, violacoes } = conferirArquivo(arquivo);
    totalConferidas += conferidas;
    todasViolacoes.push(...violacoes);
  }

  if (todasViolacoes.length > 0) {
    console.error("verificar-acoes encontrou ação(ões) sem exigirUsuario() na primeira instrução:\n");
    for (const violacao of todasViolacoes) {
      console.error(`${violacao.arquivo}:${violacao.linha} (${violacao.funcao}) — ${violacao.mensagem}`);
    }
    console.error(`\n${todasViolacoes.length} violação(ões) em ${totalConferidas} ação(ões) conferida(s).`);
    process.exit(1);
  }

  // Um portão que passa em silêncio absoluto é indistinguível de um portão quebrado — esta
  // linha é o que prova que ele rodou.
  console.log(`verificar-acoes: ${totalConferidas} ação(ões) conferida(s), 0 violações.`);
  process.exit(0);
}

main();
