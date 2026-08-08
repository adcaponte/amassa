// Módulo puro, sem nenhum import: nomes acessíveis compartilhados entre a interface e os
// testes de acessibilidade, para eliminar divergência de normalização Unicode de acento entre
// os dois lados (mesmo motivo de lib/navegacao/itens.ts existir para os rótulos de navegação).
//
// Vive aqui (não só em components/amassa/cabecalho-movel.tsx) porque tests/e2e/*.spec.ts roda
// fora do bundler do Next.js: importar diretamente de um componente "use client" puxa a cadeia
// de imports dele inteira, incluindo Server Actions que importam next-auth, que por sua vez
// importa "next/server" — um módulo que só resolve dentro do runtime do Next.js, não no
// carregador de TypeScript que o Playwright usa para rodar os arquivos de teste. Um módulo
// puro sem nenhum import nunca tem esse problema. cabecalho-movel.tsx reexporta esta constante
// para quem só olha aquele arquivo continuar encontrando a fonte da string.
export const NOME_ACESSIVEL_MENU_USUARIO = "Abrir menu do usuário";
