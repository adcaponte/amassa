# API Coverage — Fase 3 (Gestor de Encomendas)

No external API integration: toda escrita e toda leitura desta fase vão para o Postgres do próprio
projeto, via Drizzle, sem nenhuma API, SDK ou serviço de terceiro no caminho.

Registro da decisão, para não parecer omissão: o detector de cobertura de API foi avaliado
explicitamente durante o planejamento e **não se aplica**. A fase acrescenta três tabelas
(`encomendas`, `encomenda_itens`, `encomenda_etapas`), sete Server Actions e onze superfícies de
interface — nenhuma delas chama rede externa. A única dependência de rede que o projeto tem em tempo
de build (`next/font/google`, herdada da Fase 2b) não é integração de API e não muda nesta fase.

Nenhuma capacidade externa a enumerar, portanto nenhuma matriz de `INTEGRATE`/`OPT-OUT` a produzir.
