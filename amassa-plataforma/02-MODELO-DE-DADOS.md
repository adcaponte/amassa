# 02 — Modelo de Dados

> **Versão 2.0 — Postgres próprio, sem Supabase, sem RLS.**
>
> O SQL abaixo é a especificação. Na prática o schema é declarado em `db/schema.ts` com
> **Drizzle**, e `npx drizzle-kit generate` produz as migrações. O SQL aqui existe para
> deixar a intenção inequívoca — traduza-o para Drizzle, não o copie cru.
>
> Convenções: tabelas e colunas em **português**, `snake_case`, plural nas tabelas.
> Chaves primárias `uuid` com `gen_random_uuid()`. Toda tabela tem `criado_em` e
> `atualizado_em`. Datas civis são `date`; momentos no tempo são `timestamptz`.

---

## 0. Base comum

### Fuso horário — leia antes de tudo

O container do Postgres roda em **UTC** por padrão, e o `TZ` do container da aplicação não
o afeta. Entre 21h e meia-noite, `current_date` devolveria o dia seguinte.

**Regra do projeto:** toda coluna `date` com valor padrão usa `hoje_brasilia()`.
Nunca `current_date` cru.

```sql
create or replace function hoje_brasilia()
returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;
```

`timestamptz` com `default now()` está correto e não precisa de ajuste — guarda o instante
absoluto, e a conversão para Brasília acontece na exibição.

> **Não injete `TZ` no container do Postgres.** Se a variável chegar ao `initdb`, o
> `timezone` do banco deixa de ser UTC e tudo aqui se desalinha. O `TZ=America/Sao_Paulo`
> do `.env` vale **só para o serviço `app`** — declare isso explicitamente no `compose.yml`,
> serviço a serviço, em vez de usar um `env_file` global.

### Normalização de nomes

Usada no índice de busca de alunas. Precisa ser `immutable`, e `unaccent()` **não é**:

```sql
create extension if not exists unaccent;

create or replace function nome_normalizado(t text)
returns text language sql immutable strict parallel safe as $$
  select lower(public.unaccent('public.unaccent'::regdictionary,
                               regexp_replace(trim(t), '\s+', ' ', 'g')));
$$;
```

> Sem essa função intermediária, o `create index` falha com
> `functions in index expression must be marked IMMUTABLE`. A forma de dois argumentos de
> `unaccent`, com o dicionário explícito, é o que permite marcar a função como imutável com
> segurança — é a receita padrão para esse problema. Use `nome_normalizado()` também nas
> consultas de busca, senão o índice não é aproveitado.

### `atualizado_em`

```sql
create or replace function tocar_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;
```

**Precisa de um trigger em cada tabela**, não basta definir a função:

```sql
create trigger tocar_atualizado_em_<tabela>
  before update on <tabela>
  for each row execute function tocar_atualizado_em();
```

> Checklist de toda tabela nova: (a) `criado_em`, (b) `atualizado_em`, (c) o trigger acima.
> Exceção conhecida: `movimentacoes_estoque`, que não é atualizável (seção 4).

### Dois papéis de banco, não um

O `compose.yml` cria o banco com o `POSTGRES_USER`, que é dono de tudo. **Esse papel não é
o que a aplicação usa.** A migração `0001` cria um segundo papel, sem posse:

```sql
-- amassa_owner  = POSTGRES_USER, dono das tabelas, roda as migrações
-- amassa_app    = papel da aplicação em tempo de execução
create role amassa_app login password :'senha_app';
grant connect on database amassa to amassa_app;
grant usage on schema public to amassa_app;
grant select, insert, update, delete on all tables in schema public to amassa_app;
grant usage, select on all sequences in schema public to amassa_app;
alter default privileges in schema public
  grant select, insert, update, delete on tables to amassa_app;
```

O `DATABASE_URL` da aplicação usa `amassa_app`. As migrações usam `amassa_owner`.

> **Por que isso importa aqui, e não é purismo.** Sem RLS, o `revoke` de `update`/`delete`
> em `movimentacoes_estoque` (seção 4) é a **única** garantia de imutabilidade no nível do
> banco. E um `revoke` contra o dono da tabela não vale nada — dono retém privilégio
> implícito e pode se reconceder. Separar os dois papéis é o que faz aquela garantia existir
> de verdade. São cinco linhas de SQL na primeira migração.

### Sem RLS — e o que ocupa o lugar dela

O Postgres não tem porta publicada; só a aplicação Next.js o alcança. **Não há políticas de
RLS neste schema.** A autorização vive em `lib/auth`, com uma única porta:

```ts
// Toda Server Action começa por aqui. Sem exceção.
const usuario = await exigirUsuario();
```

`exigirUsuario()` lê a sessão, confirma que o usuário existe e está `ativo`, e lança se não.
Isso é verificável em revisão de código: se uma Server Action toca o banco sem chamar essa
função na primeira linha, está errada.

### `usuarios`

```sql
create type papel_usuario as enum ('gestor');

create table usuarios (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(trim(nome)) between 2 and 120),
  email         text not null,          -- unicidade pelo índice funcional abaixo
  senha_hash    text not null,
  papel         papel_usuario not null default 'gestor',
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index usuarios_email_idx on usuarios (lower(email));
```

- `senha_hash` é **argon2id**. Nunca guarde senha em texto, nem "temporariamente".
- Criação e redefinição só por linha de comando (`scripts/criar-usuario.ts`).
- Desativar é `ativo = false`. Apagar quebraria o histórico de autoria.

> Sobre adicionar papéis no futuro: `alter type ... add value` **não pode** ser usado na
> mesma transação em que o novo valor é referenciado, e migrações rodam em transação. Se um
> dia entrar 'professora', use uma migração isolada só com o `alter type` e outra para
> usá-lo. Alternativa mais flexível: trocar o enum por `text` + `check` — com 3 ou 4 valores
> a diferença de performance é nula.

---

## 1. Módulo Encomendas

```sql
create type status_encomenda as enum ('rascunho','em_producao','concluida','cancelada');
create type etapa_encomenda  as enum ('producao','secagem','queima1','esmaltacao','queima2','entrega');

create table encomendas (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(trim(nome)) between 1 and 120),
  cliente_nome  text,
  data_inicio   date not null,
  status        status_encomenda not null default 'em_producao',
  observacoes   text,
  criado_por    uuid references usuarios(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index encomendas_data_inicio_idx on encomendas (data_inicio);
create index encomendas_status_idx      on encomendas (status);

create table encomenda_itens (
  id            uuid primary key default gen_random_uuid(),
  encomenda_id  uuid not null references encomendas(id) on delete cascade,
  descricao     text not null check (length(trim(descricao)) between 1 and 200),
  quantidade    integer not null check (quantidade > 0),
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index encomenda_itens_encomenda_idx on encomenda_itens (encomenda_id);

create table encomenda_etapas (
  id            uuid primary key default gen_random_uuid(),
  encomenda_id  uuid not null references encomendas(id) on delete cascade,
  etapa         etapa_encomenda not null,
  dias          integer not null default 1 check (dias >= 0),
  ordem         integer not null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (encomenda_id, etapa),
  constraint marcos_zero_ou_um
    check (etapa not in ('queima1','queima2','entrega') or dias in (0, 1))
);
create index encomenda_etapas_encomenda_idx on encomenda_etapas (encomenda_id);
```

### Regras

- Ao criar uma encomenda, inserir as 6 etapas na ordem fixa, com os padrões
  `producao 3 · secagem 6 · queima1 1 · esmaltacao 1 · queima2 1 · entrega 1`.
- Marcos (`queima1`, `queima2`, `entrega`) valem **0 ou 1** dia. Na interface são um
  **interruptor** (a etapa acontece ou não), nunca um campo numérico — é assim que o
  protótipo se comporta. Zero é caso real: peça que só vai a biscoito, encomenda retirada
  no ateliê sem etapa de entrega.
- **As datas não são armazenadas.** São calculadas em cascata a partir de `data_inicio` pelo
  módulo puro `lib/encomendas/cronograma.ts`.

> Por que não guardar as datas: armazenadas, elas se desincronizam de `dias` na primeira
> edição, e passam a existir duas versões da verdade. Calculadas, existe uma só.

---

## 2. Módulo Agenda

```sql
create type modalidade_aula as enum ('modelagem','torno','pintura');
create type turno_aula      as enum ('matutino','vespertino');
create type status_aula     as enum ('prevista','realizada','cancelada');
create type tipo_matricula  as enum ('matriculada','experimental');
create type status_presenca as enum ('presente','falta','falta_justificada','reposicao');

create table turmas (
  id            uuid primary key default gen_random_uuid(),
  modalidade    modalidade_aula not null,
  dia_semana    smallint not null check (dia_semana between 0 and 6),  -- 0=domingo
  turno         turno_aula not null,
  horario       text not null,                    -- livre: "9h–12h"
  vagas         integer not null default 8 check (vagas > 0 and vagas <= 50),
  ativa         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table alunas (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(trim(nome)) between 2 and 120),
  telefone      text,
  email         text,
  observacoes   text,
  ativa         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Índice de BUSCA, não único: homônimas existem e precisam poder ser cadastradas.
create index alunas_nome_normalizado_idx
  on alunas (nome_normalizado(nome));

create table matriculas (
  id            uuid primary key default gen_random_uuid(),
  turma_id      uuid not null references turmas(id) on delete cascade,
  aluna_id      uuid not null references alunas(id) on delete cascade,
  tipo          tipo_matricula not null default 'matriculada',
  nota          text,
  inicio        date not null default hoje_brasilia(),
  fim           date,                             -- null = ativa; se preenchido, é INCLUSIVO
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);
create unique index matriculas_ativa_unica_idx
  on matriculas (turma_id, aluna_id) where fim is null;

create table aulas (
  id            uuid primary key default gen_random_uuid(),
  turma_id      uuid not null references turmas(id) on delete cascade,
  data          date not null,
  status        status_aula not null default 'prevista',
  motivo_cancelamento text,
  observacoes   text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (turma_id, data)                          -- garante idempotência da geração
);
create index aulas_data_idx on aulas (data);

create table presencas (
  id             uuid primary key default gen_random_uuid(),
  aula_id        uuid not null references aulas(id) on delete cascade,
  aluna_id       uuid not null references alunas(id) on delete cascade,
  status         status_presenca not null,
  observacoes    text,
  registrado_por uuid references usuarios(id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (aula_id, aluna_id)
);
create index presencas_aluna_idx on presencas (aluna_id);

create table configuracoes (
  chave         text primary key,
  valor         jsonb not null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
insert into configuracoes (chave, valor) values ('agenda', '{"incluirDomingo": false}');
```

> A chave JSON `incluirDomingo` está em camelCase de propósito: o conteúdo de `jsonb` é
> consumido diretamente por TypeScript. A convenção `snake_case` vale para nomes de tabela e
> coluna, não para o interior de documentos JSON.

### Geração preguiçosa das aulas

Chamada pela aplicação ao abrir uma semana. Idempotente.

```sql
create or replace function garantir_aulas_da_semana(p_inicio date, p_fim date)
returns void language plpgsql as $$
declare v_domingo boolean;
begin
  select coalesce((valor->>'incluirDomingo')::boolean, false)
    into v_domingo from configuracoes where chave = 'agenda';

  insert into aulas (turma_id, data)
  select t.id, p_inicio + g
  from turmas t
  cross join generate_series(0, p_fim - p_inicio) g
  where t.ativa
    and extract(dow from p_inicio + g) = t.dia_semana
    and (coalesce(v_domingo, false) or t.dia_semana <> 0)
  on conflict (turma_id, data) do nothing;
end $$;
```

> **Por que `generate_series(0, p_fim - p_inicio)` e não `generate_series(data, data,
> interval)`.** A segunda forma não tem sobrecarga para `date` — o Postgres resolve para
> `timestamptz`, e aí `extract(dow ...)` passa a depender do fuso da sessão. Somando
> inteiros a uma `date`, a aritmética é de dia civil puro, sem fuso envolvido.

**Materialização preguiçosa, não tarefa agendada.** Isso elimina `cron`, `pg_cron` e worker
em background — menos infraestrutura para manter numa máquina que agora também hospeda o
banco.

### Quem aparece na lista de presença — definição normativa

Aparecem (a) todas as alunas com matrícula vigente na turma **na data daquela aula**, e
(b) qualquer aluna que já tenha uma `presenca` registrada nela — que é como uma **reposição**
entra.

```sql
create or replace function alunas_da_aula(p_aula_id uuid)
returns table (aluna_id uuid, nome text, tipo tipo_matricula, matriculada boolean)
language sql stable as $$
  with aula as (
    select id, turma_id, data from aulas where id = p_aula_id
  ),
  vigentes as (
    select distinct on (a.id) a.id, a.nome, m.tipo
    from aula
    join matriculas m
      on m.turma_id = aula.turma_id
     and m.inicio <= aula.data
     and (m.fim is null or m.fim >= aula.data)
    join alunas a on a.id = m.aluna_id
    order by a.id, m.inicio desc
  )
  select v.id, v.nome, v.tipo, true from vigentes v
  union all
  select a.id, a.nome, null::tipo_matricula, false
  from presencas p
  join alunas a on a.id = p.aluna_id
  where p.aula_id = p_aula_id and a.id not in (select id from vigentes);
$$;
```

**Decisões embutidas, todas deliberadas:**

- `matriculas.fim` é **inclusivo** — a aluna ainda conta na aula do próprio dia em que sai.
- `presencas` são criadas **ao marcar**, não antecipadamente. Aula sem marcação não tem
  linhas, e não há "chamada em branco" para limpar depois.
- **Reposição** = `presenca` com status `reposicao` para uma aluna não matriculada naquela
  turma. É por isso que `presencas` referencia `alunas` e não `matriculas`. Na interface:
  botão "adicionar aluna avulsa" na tela de chamada.
- O `distinct on` cobre o caso de matrículas sobrepostas — o índice único só impede duas
  **abertas**, não uma aberta somada a outra com `fim` no futuro.

### Restrição consciente

Excesso de alunas sobre as vagas é **permitido**. O protótipo trata como estado visual
("excedida", em vermelho), não como erro. Não adicione validação bloqueando — na prática do
ateliê, encaixar alguém acontece.

---

## 3. Módulo Contador de Queima ✅ especificado

Baseado no protótipo `forno-controle.jsx`. **Este módulo está desbloqueado.**

O propósito do módulo, que o nome não entrega: é um **controle de vida útil das
resistências**. Cada forno acumula queimas; ao chegar no limite, precisa de manutenção; a
manutenção **zera o contador** sem apagar o histórico.

```sql
create type tipo_queima as enum ('biscoito','esmalte','ouro');

create table fornos (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(trim(nome)) between 1 and 80),
  descricao     text,
  limite        integer not null default 100 check (limite >= 10),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table queimas (
  id            uuid primary key default gen_random_uuid(),
  forno_id      uuid not null references fornos(id) on delete cascade,
  tipo          tipo_queima not null,
  ocorrida_em   timestamptz not null default now(),
  registrado_por uuid references usuarios(id) on delete set null,
  observacoes   text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index queimas_forno_data_idx on queimas (forno_id, ocorrida_em desc);
create index queimas_data_idx       on queimas (ocorrida_em desc);

create table manutencoes (
  id                 uuid primary key default gen_random_uuid(),
  forno_id           uuid not null references fornos(id) on delete cascade,
  ocorrida_em        timestamptz not null default now(),
  responsavel        text,             -- opcional, como no protótipo
  observacoes        text,
  queimas_acumuladas integer not null check (queimas_acumuladas >= 0),
  registrado_por     uuid references usuarios(id) on delete set null,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);
create index manutencoes_forno_idx on manutencoes (forno_id, ocorrida_em desc);
```

### A regra central do contador

```
contador = número de queimas do forno com ocorrida_em > (data da última manutenção)
```

Se nunca houve manutenção, conta todas. Três níveis:

```ts
// lib/queimas/contador.ts — exatamente como no protótipo
const atencao = Math.max(1, limite - 10);
const nivel = atual >= limite ? 'critico'
            : atual >= atencao ? 'atencao'
            : 'ok';
```

| Nível | Condição | Cor da barra | Selo textual |
|-------|----------|--------------|--------------|
| **ok** | `atual < limite − 10` | `#D97706` | *(nenhum)* |
| **atenção** | `atual >= limite − 10` | `#CA8A04` | **Manutenção próxima** |
| **crítico** | `atual >= limite` | `#DC2626` | **Manutenção vencida** |

A margem de atenção é **10 queimas**, fixa. O limite padrão é **100**, mínimo **10**
(o formulário do protótipo já força `min=10`) — daí o `check (limite >= 10)`. O
`Math.max(1, ...)` é a rede de proteção do módulo puro e deve ser preservado mesmo assim.

> **A manutenção não apaga nada.** Ela grava uma linha em `manutencoes` com
> `queimas_acumuladas` = o valor que o contador tinha naquele instante, e o contador volta a
> zero *por consequência do corte de data*, não por exclusão. Isso preserva o histórico
> completo de cada forno e permite responder "quantas queimas o Forno 01 já fez na vida" —
> que é uma pergunta diferente de "quantas desde a última troca de resistência".

### View de apoio

```sql
create view fornos_medidos as
select
  f.id, f.nome, f.descricao, f.limite, f.ativo,
  ult.ocorrida_em                                   as ultima_manutencao_em,
  count(q.id) filter (
    where q.ocorrida_em > coalesce(ult.ocorrida_em, '-infinity'::timestamptz)
  )                                                 as contador,
  count(q.id)                                       as total_historico,
  max(q.ocorrida_em)                                as ultima_queima_em
from fornos f
left join lateral (
  select ocorrida_em from manutencoes m
  where m.forno_id = f.id order by m.ocorrida_em desc limit 1
) ult on true
left join queimas q on q.forno_id = f.id
group by f.id, ult.ocorrida_em;
```

O cálculo de nível (ok/atenção/crítico) fica no módulo puro `lib/queimas/contador.ts`, não
no banco — assim ele é testável sem subir Postgres, e a mesma função serve a UI e ao painel
inicial.

### O que o protótipo faz e deve ser preservado

- **Cartão por forno**: medidor visual, contador `atual / limite`, nível colorido, selo
  textual quando em atenção ou crítico, e a linha de rodapé — *"Última manutenção em
  {data} · {responsável}"* ou *"Sem manutenção registrada"*, seguida de *"· {total} no
  total"* (total histórico do forno).
- **Medidor** com entalhes a cada 10 queimas, uma marca vertical no limiar de atenção, e
  rótulos `0 / atenção N / limite N` sob a barra. Não simplifique para uma barra lisa.
- **Banner agregado no topo da aba Fornos**, listando os que precisam de atenção:
  *"2 fornos precisam de atenção: Forno 01 (95/100) · Forno 02 (103/100)"*. Inclui nível
  **atenção**, não só crítico.
- **Registrar queima em dois toques**: abre a janela, escolhe o tipo. Sem formulário.
  Este é o fluxo mais usado do módulo inteiro — no ateliê, com a mão suja. Não acrescente
  campos obrigatórios aqui.
- Três tipos: **Biscoito** `#9A3412` · **Esmalte** `#155E75` · **Ouro** `#CA8A04`.
  (A versão anterior deste plano só previa dois. **Ouro** é a terceira queima, de douração.)
- **Registrar manutenção** mostrando explicitamente "o contador vai de N para 0", com
  responsável e observações — ambos opcionais, como no protótipo.
- **Detalhe do forno**: histórico de manutenções e das **últimas 25 queimas**, com opção de
  remover uma queima lançada por engano.
- **Relatórios** com Recharts: barras empilhadas por tipo, alternando entre **8 semanas** e
  **6 meses**; barras horizontais por forno; e quatro estatísticas — total, últimos 30 dias,
  e a contagem dos dois primeiros tipos.
- **Aviso com "Desfazer"** por **7 segundos** ao registrar uma queima. É a proteção certa
  para um botão de dois toques — e é por isso que este toast dura mais que os outros do
  sistema (que são de 5 s).
- Abas: **Fornos** · **Relatórios** · **Ajustes**.

### Regras de agregação — o módulo puro precisa reproduzir exatamente

- **Semana começa na segunda-feira**: `(getDay() + 6) % 7`.
- **"8 semanas"** = 8 baldes de 7 dias, a partir do início da semana de `hoje − 49 dias`.
- **"6 meses"** = meses civis: o mês atual mais os 5 anteriores.
- Uma queima entra no balde quando `inicio <= ocorrida_em < fim`.

### O que muda em relação ao protótipo

- `usuario` deixa de ser um nome digitado em Ajustes e passa a ser o **usuário logado**
  (`registrado_por`). O campo "Responsável" da manutenção continua texto livre, porque quem
  faz a manutenção pode ser um técnico de fora.
- Timestamps deixam de ser `Date.now()` em milissegundos e viram `timestamptz`.
- A aba Ajustes perde "definir seu nome" e "limpar dados"; mantém o cadastro de fornos.
- **Excluir queima passa a pedir confirmação.** No protótipo a exclusão é imediata; aqui ela
  contraria a regra 10 do briefing. O "Desfazer" do toast cobre o engano recém-cometido; a
  exclusão no histórico é outra coisa — remove um registro antigo e desloca o contador.
- **Fornos não são apagados, são desativados** (`ativo = false`). O protótipo apaga em
  cascata, junto com todas as queimas e manutenções — o que destrói o histórico de vida útil
  do equipamento, que é justamente o propósito do módulo. O `on delete cascade` continua no
  schema como rede de segurança para exclusão manual no banco, mas **a aplicação não expõe
  exclusão de forno**.

---

## 4. Módulo Estoque

```sql
create type categoria_material as enum ('ceramica','pintura','bordado');
create type unidade_material   as enum ('kg','g','l','ml','un','m');
create type tipo_movimentacao  as enum ('entrada','saida_consumo','saida_venda','ajuste','perda');

create table materiais (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null check (length(trim(nome)) between 2 and 120),
  categoria       categoria_material not null,
  unidade         unidade_material not null,
  estoque_minimo  numeric(12,3) not null default 0 check (estoque_minimo >= 0),
  custo_unitario  numeric(12,2) check (custo_unitario >= 0),
  fornecedor      text,
  observacoes     text,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index materiais_categoria_idx on materiais (categoria) where ativo;

create table movimentacoes_estoque (
  id              uuid primary key default gen_random_uuid(),
  material_id     uuid not null references materiais(id) on delete restrict,
  tipo            tipo_movimentacao not null,
  quantidade      numeric(12,3) not null check (quantidade <> 0),
  custo_unitario  numeric(12,2) check (custo_unitario >= 0),
  motivo          text,
  referencia_tipo text check (referencia_tipo in ('aula','fornada','encomenda')),
  referencia_id   uuid,
  registrado_por  uuid references usuarios(id) on delete set null,
  criado_em       timestamptz not null default now(),
  constraint sinal_coerente check (
    (tipo = 'entrada' and quantidade > 0) or
    (tipo in ('saida_consumo','saida_venda','perda') and quantidade < 0) or
    (tipo = 'ajuste')
  )
);
create index movimentacoes_material_idx on movimentacoes_estoque (material_id, criado_em desc);
```

**Toda movimentação está na unidade do material.** Não há coluna de unidade e não há
conversão — cadastrar argila em `kg` significa que toda entrada e saída dela é em `kg`.
Simples de propósito: conversão de unidade é fonte clássica de erro silencioso de fator mil.

### Convenção de sinal

`quantidade` é gravada **com o sinal já aplicado**. Na interface:

- Nos quatro tipos determinados, o campo aceita um número positivo e o servidor aplica o
  sinal.
- Em **`ajuste`**, a tela pede **o saldo real contado na prateleira**, não a diferença.
  O servidor calcula `quantidade = saldo_contado − saldo_atual`. **Se der zero, não grave
  nada** — o `check` rejeitaria, e "a contagem bateu" não é erro. Responda com
  *"Conferido. O saldo já estava correto."*

> Por que o ajuste é especial: ninguém que acabou de contar 3,2 kg de argila sabe de cabeça
> que a diferença é −0,8. Pedir a diferença é pedir uma conta mental sujeita a erro, e erro
> de sinal aqui é invisível. Pedir o que foi contado é pedir o que a pessoa tem na mão.

### Movimentações não são editáveis nem apagáveis

Não existe Server Action de `update` ou `delete` para esta tabela. Errou? Registra um
`ajuste`. Mesmo princípio de um livro-caixa: rasurar destrói a auditabilidade.

Isso é garantido **no banco**, revogando o privilégio do papel da aplicação:

```sql
revoke update, delete on movimentacoes_estoque from amassa_app;
```

> Isso só funciona por causa da separação de papéis da seção 0. Se a aplicação conectasse
> como dono da tabela, o `revoke` seria decorativo — dono retém privilégio implícito e pode
> se reconceder. É o caso concreto que justifica os dois papéis.

Migrações rodam como `amassa_owner` e continuam podendo corrigir dados se um dia for
necessário — o que é o comportamento certo: correção excepcional, feita à mão, com backup
antes, e não pela interface.

### Saldo — derivado, nunca armazenado

```sql
create view saldos_materiais as
select
  m.id as material_id, m.nome, m.categoria, m.unidade,
  m.estoque_minimo, m.custo_unitario, m.ativo,
  coalesce(sum(mov.quantidade), 0) as saldo,
  case when m.estoque_minimo <= 0 then false
       else coalesce(sum(mov.quantidade), 0) <= m.estoque_minimo end as em_alerta,
  max(mov.criado_em) as ultima_movimentacao
from materiais m
left join movimentacoes_estoque mov on mov.material_id = m.id
group by m.id;
```

> **Por que derivar:** saldo armazenado e saldo real divergem — é questão de tempo, e quando
> divergem ninguém sabe qual está certo. Derivado do histórico, o número é sempre
> reconstruível e auditável. No volume de um ateliê, o custo de performance é zero.

> **Sobre o `em_alerta`:** materiais com `estoque_minimo = 0` (o padrão) nunca entram em
> alerta. Sem isso, todo material recém-cadastrado, com saldo zero, apareceria no painel
> como urgente — e alerta que nasce ruidoso é alerta que ninguém lê. Um material só vigia o
> próprio estoque depois que alguém definir o mínimo dele.

---

## 5. Módulo Orçamento — reservado, não implementar

```
parametros_precificacao
orcamentos
orcamento_itens
```

Aguardando as planilhas do Theo. Nada além dos nomes está definido.

---

## 6. Ordem das migrações

| Conteúdo | Milestone |
|----------|-----------|
| extensão `unaccent`, `nome_normalizado`, `hoje_brasilia`, `tocar_atualizado_em`, papel `amassa_app`, `usuarios` | M1 |
| encomendas, itens, etapas | M2 |
| fornos, queimas, manutenções, `fornos_medidos` | M4 |
| turmas, alunas, matrículas, aulas, presenças, configurações, `garantir_aulas_da_semana`, `alunas_da_aula` | M3 |
| materiais, movimentações, `saldos_materiais`, `revoke` | M5 |
| — | M6 — **bloqueado** |

> **Sem numeração fixa nesta tabela, de propósito.** O `drizzle-kit generate` numera as
> migrações na ordem em que você as gera, e a ordem recomendada de execução é
> M2 → **M4** → M3. Amarrar "queimas = `0004`" aqui criaria uma contradição com o journal do
> Drizzle no primeiro `generate`. A tabela lista o conteúdo por milestone; o número sai da
> ferramenta.

Nenhuma migração depende de outra fora de ordem. A de estoque não depende da de queimas,
apesar da referência a `'fornada'`: `referencia_tipo`/`referencia_id` é polimórfica e sem
chave estrangeira, deliberadamente.

### Fluxo de trabalho com Drizzle

```bash
# 1. editar db/schema.ts
npx drizzle-kit generate          # gera o SQL da migração
git add db/migrations && git commit

# no servidor, DEPOIS do backup e do deploy:
./scripts/backup.sh --agora
docker compose exec app npm run db:migrate
```

Funções, views, papéis e `grant`/`revoke` o Drizzle **não** gera — `hoje_brasilia`,
`nome_normalizado`, `tocar_atualizado_em` e seus triggers, `garantir_aulas_da_semana`,
`alunas_da_aula`, `fornos_medidos`, `saldos_materiais`, o papel `amassa_app` e o `revoke`.
Escreva tudo isso à mão, em arquivos de migração customizados (`drizzle-kit generate
--custom`), versionados junto.

> **Nunca aplique migração pelo pipeline automático.** Uma migração ruim aplicada por um
> `git push` acidental não tem desfazer, e agora o banco é seu. Sempre: backup → migração →
> conferir.
