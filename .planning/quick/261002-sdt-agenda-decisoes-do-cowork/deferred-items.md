# Itens adiados — quick 261002-sdt

## `queimas-banner.spec.ts` instável no projeto `vazio-historico` (fora do escopo)

- **Onde apareceu:** primeira invocação e2e deste quick, em 02/10/2026, por volta das 20h15 UTC
  (`npm run test:e2e -- --grep "agenda-lancamento|…|site-agenda"`).
- **O que houve:** a primeira tentativa de "um segundo forno em crítico aparece ANTES do primeiro…"
  (`tests/e2e/queimas-banner.spec.ts:140`) estourou o limite de 180 s esperando o clique em
  `tipo-queima-biscoito` (linha 68). As novas tentativas falharam porque os fornos `[e2e]` das
  tentativas anteriores continuavam no banner ("4 fornos…", "5 fornos…"), e o caso da linha 119 caiu
  junto. Como `vazio-historico` é dependência de `desktop` e `celular`, os 51 testes desses dois
  projetos não rodaram.
- **Por que está fora do escopo:** o quick não mexe em Queimas. O CI ficou verde com esse spec no
  run `37018095205`, em 02/10/2026. A máquina acabava de ser reiniciada, depois de uma varredura do
  antivírus, e a primeira tentativa travou num clique — o que aponta para lentidão do ambiente, não
  para defeito. Não foi investigado.
- **O que fazer:** se repetir, olhar o `error-context.md` da primeira tentativa. O spec não limpa os
  próprios fornos entre as novas tentativas, e por isso cada uma suja a seguinte.
