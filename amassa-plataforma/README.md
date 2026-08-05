# Plataforma AMASSA — pacote de planejamento

Planejamento completo para o Claude Code construir a plataforma de gestão do ateliê,
usando o **GSD Core** como método de execução.

**Custo recorrente adicional: ~€2/mês** (só o Auto Backup da Contabo). Todo o resto roda no
VPS já contratado.

## Os arquivos

| Arquivo | Para quem | O que é |
|---------|-----------|---------|
| **`00-BRIEFING.md`** | agente | Documento fonte. Alimenta o `/gsd-new-project`. Escopo, módulos, regras de negócio. |
| **`01-ARQUITETURA.md`** | agente | Stack, Postgres próprio, autenticação, deploy, **backups**. Cada decisão com a razão. |
| **`02-MODELO-DE-DADOS.md`** | agente | Schema completo dos cinco módulos, com as armadilhas de fuso e de sinal. |
| **`03-ROADMAP.md`** | agente + Theo | 8 milestones com fases e critérios de aceite testáveis. |
| **`04-DESIGN-SYSTEM.md`** | agente | Tokens, tipografia, navegação, adaptações para celular, voz da interface. |
| **`05-GUIA-THEO.md`** | **Theo** | Passo a passo sem jargão: contas, comandos, o que fazer em cada etapa. |

**Comece pelo `05`.** Os outros cinco são referência para o agente.

## Como entregar isto ao Claude Code

Copie esta pasta para dentro da pasta do projeto e escreva:

```
Leia todos os arquivos da pasta amassa-plataforma/. Eles são o planejamento
completo deste projeto. Depois rode /gsd-new-project usando 00-BRIEFING.md
como documento fonte.
```

## Arquitetura em uma frase

Next.js + Postgres + Caddy, os três em Docker no VPS Contabo, com HTTPS automático,
autenticação própria e backup diário para um armazenamento externo gratuito.

## Estado dos módulos

| Módulo | Situação |
|--------|----------|
| Gestor de Encomendas | Especificado (protótipo HTML) |
| Agenda de Aulas | Especificado (protótipo JSX) |
| Contador de Queima | Especificado (protótipo JSX) |
| Estoque | Especificado |
| Calculadora de Orçamento | 🔴 aguardando as planilhas de precificação |

**Ordem de execução:** M0 → M1 → M2 (Encomendas) → M4 (Fornos) → M3 (Agenda) →
M5 (Estoque) → M7 (polimento). A M6 (Orçamento) entra quando as planilhas chegarem, e a M7
não espera por ela.

## Decisões fechadas

Postgres próprio no VPS · **repositório público** (Actions sem limite; nenhum segredo nem
dado real versionado) · apenas gestores (3–5 pessoas) · autenticação com Auth.js + argon2id,
sem e-mail · Drizzle para schema e migrações · sem RLS (o banco não é exposto) · estoque com
movimentações e alertas · celular como prioridade real · encomendas ganham itens (sem cliente
cadastrado, sem valores, sem fotos) · agenda ganha datas reais e presença (sem mensalidades) ·
fornos com três tipos de queima, incluindo ouro, e sem exclusão (só desativação).

## Sete coisas que vão poupar horas

1. **O backup é fase da M1, não da M7.** Sem serviço gerenciado, ele é a rede de proteção
   que existe — disparado pelo `cron` do host, porque o Docker Compose não agenda nada.
   O Auto Backup da Contabo (M0) cobre o servidor; o dump cobre os dados. Precisa ser
   restaurado de verdade uma vez, na M7.
   **Risco aceito e documentado: até 24h de perda de dados.** Correção futura, se incomodar:
   dump de hora em hora, custo zero.
2. **Postgres sem porta publicada** no `compose.yml`, e **sem `TZ` injetado**. Nada de
   `ports: "5432:5432"`. Toda a segurança do banco depende do primeiro; toda a lógica de
   datas depende do segundo.
3. **Dois papéis de banco**, não um: o dono roda as migrações, a aplicação usa outro. É o
   que faz a imutabilidade das movimentações de estoque valer alguma coisa.
4. **A imagem `standalone` do Next.js não roda migração nem cria usuário.** Precisa de um
   estágio `ferramentas` no mesmo Dockerfile. Detalhado no arquivo `01`.
5. **Auth.js precisa de configuração dividida em dois arquivos** — o middleware roda no Edge
   e argon2 não carrega lá. Mais `AUTH_TRUST_HOST=true`, obrigatório atrás do Caddy.
6. **As variáveis `NEXT_PUBLIC_*` precisam existir no momento do build**, não só em execução.
   Falha que só aparece em produção.
7. **Mapeie os tokens de cor para os nomes que o shadcn espera antes** de instalar qualquer
   componente. Detalhado no arquivo `04`.
8. **`.gitignore` correto antes do primeiro commit.** O repositório é público — um segredo
   que entra no histórico é um segredo queimado, mesmo que o commit seja apagado depois.

Os itens 4, 5 e 6 têm em comum o modo de falha mais caro que existe: funcionam em
`localhost` e quebram em produção. O item 8 tem o segundo mais caro: não quebra nada, e
por isso ninguém percebe.

---

*Versão 2.2 — arquitetura autossuficiente, ~€2/mês, revisada duas vezes. 01/08/2026.*
