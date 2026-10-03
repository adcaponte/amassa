#!/bin/sh
# scripts/backup.sh — gera o dump diário do Postgres, comprime, confere a integridade, aplica
# a retenção de 14 dias com cópia mensal permanente, envia ao armazenamento externo quando
# configurado e registra o resultado em execucoes_backup, inclusive quando falha. Quem dispara
# isto é o `cron` do host (amassa-plataforma/01-ARQUITETURA.md §7) ou, com `--agora`, uma
# pessoa antes de aplicar uma migração — nunca o Docker Compose, que não tem agendador e
# encerraria um serviço declarado nele assim que ele terminasse de rodar uma vez.
set -eu

# --- Configuração: tudo por variável, com padrão apontando para o diretório de produção. É
# assim que scripts/testar-backup.mjs troca cada peça (comandos, diretórios, dia do mês) sem
# editar este arquivo. ---
AMASSA_DIR="${AMASSA_DIR:-/opt/amassa}"
AMBIENTE_ARQUIVO="${AMBIENTE_ARQUIVO:-$AMASSA_DIR/.env}"
BACKUP_DIR="${BACKUP_DIR:-$AMASSA_DIR/backups}"
BACKUP_DIR_MENSAL="${BACKUP_DIR_MENSAL:-$BACKUP_DIR/mensais}"
# Padrão: executa dentro do contêiner `postgres` pelo Compose, sem alocar terminal (-T) — é
# assim que o host alcança o banco, já que ele não tem porta publicada. `--clean --if-exists`
# é o que permite ao MESMO dump restaurar tanto num Postgres vazio (as instruções DROP não
# encontram nada e são ignoradas) quanto por cima de um banco já populado com o mesmo schema
# (as tabelas são descartadas e recriadas antes dos dados voltarem) — é o que faz o par
# "restaurar num banco limpo" e "restaurar sobre dados existentes" ser o mesmo arquivo.
PG_DUMP_CMD="${PG_DUMP_CMD:-docker compose -f $AMASSA_DIR/compose.yml exec -T postgres pg_dump --clean --if-exists}"
PG_CLIENT_CMD="${PG_CLIENT_CMD:-docker compose -f $AMASSA_DIR/compose.yml exec -T postgres psql}"
# Comando de envio ao armazenamento externo, chamado como "$BACKUP_ENVIO_CMD ARQUIVO DESTINO".
BACKUP_ENVIO_CMD="${BACKUP_ENVIO_CMD:-rclone copy}"
BACKUP_RETENCAO_DIAS="${BACKUP_RETENCAO_DIAS:-14}"
# Parametrizado de propósito: permite provar a retenção mensal sem esperar o dia 1º de verdade.
BACKUP_DIA_DO_MES="${BACKUP_DIA_DO_MES:-$(date +%d)}"

# Carrega o arquivo de ambiente do servidor só se existir — em teste as variáveis já chegam
# prontas por fora (o script roda dentro do contêiner do Postgres, que não tem esse arquivo).
if [ -f "$AMBIENTE_ARQUIVO" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$AMBIENTE_ARQUIVO"
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-amassa_owner}"
POSTGRES_DB="${POSTGRES_DB:-amassa}"
# Vazio significa não enviar — nunca sucesso silencioso (ver o passo 6, mais abaixo).
RCLONE_REMOTE="${RCLONE_REMOTE:-}"

# --- Fotos de orçamento (Fase 04.5, D-28/ORC-16): mesmo diretório do bind mount
# (docker/compose.yml), alcançado direto pelo HOST — é o motivo do bind mount ter vencido sobre
# um volume nomeado do Docker (04.5-RESEARCH.md). RCLONE_REMOTE_FOTOS, quando vazio e
# RCLONE_REMOTE existir, deriva uma pasta irmã na mesma conta do destino do dump — "%/" remove
# uma barra final antes de concatenar, para não depender de o dono ter deixado (ou não) a barra
# em RCLONE_REMOTE. ---
BACKUP_FOTOS_DIR="${BACKUP_FOTOS_DIR:-$AMASSA_DIR/dados/fotos-orcamentos}"
RCLONE_REMOTE_FOTOS="${RCLONE_REMOTE_FOTOS:-}"
if [ -z "$RCLONE_REMOTE_FOTOS" ] && [ -n "$RCLONE_REMOTE" ]; then
  RCLONE_REMOTE_FOTOS="${RCLONE_REMOTE%/}/fotos"
fi

# --- Anexos dos fornecedores (Fase 06.2, D-05/A-02): o gêmeo exato das fotos, logo acima. Mesmo
# diretório do bind mount (docker/compose.yml, /opt/amassa/dados/anexos-fornecedores), alcançado
# direto pelo HOST. RCLONE_REMOTE_ANEXOS, quando vazio e RCLONE_REMOTE existir, deriva a pasta
# irmã "${RCLONE_REMOTE%/}/anexos-fornecedores" na mesma conta do destino do dump — "%/" remove
# uma barra final antes de concatenar, como nas fotos. ---
BACKUP_ANEXOS_DIR="${BACKUP_ANEXOS_DIR:-$AMASSA_DIR/dados/anexos-fornecedores}"
RCLONE_REMOTE_ANEXOS="${RCLONE_REMOTE_ANEXOS:-}"
if [ -z "$RCLONE_REMOTE_ANEXOS" ] && [ -n "$RCLONE_REMOTE" ]; then
  RCLONE_REMOTE_ANEXOS="${RCLONE_REMOTE%/}/anexos-fornecedores"
fi

# --- Estado da armadilha de saída (passo 8). REGISTRADO fica 1 assim que uma linha é
# gravada em execucoes_backup; se o script morrer antes disso, por qualquer caminho, a
# armadilha grava a falha. Um backup que falha sem registrar é indistinguível, para
# /api/health/backup, de um backup que nem tentou rodar. ---
REGISTRADO=0
MENSAGEM_ERRO=""
CODIGO_SAIDA=0

# Grava uma linha em execucoes_backup. A mensagem entra por VARIÁVEL DO PRÓPRIO psql (-v),
# referenciada como :'nome' — é o psql que aplica as aspas, nunca uma concatenação de texto em
# instrução SQL. Uma mensagem de erro do sistema pode conter aspas; interpolar isso numa string
# SQL é como este tipo de script quebra em silêncio (T-02a-34). O SQL entra pela entrada
# padrão do psql, não por "-c" — "-c" não substitui variáveis :'nome'.
#
# Oito argumentos, nesta ordem: sucesso, bytes, externo, mensagem, fotosbytes, fotosexterno,
# anexosbytes, anexosexterno (os dois últimos da Fase 06.2, D-05 — colunas da migração 0028).
registrar_execucao() {
  printf '%s\n' "insert into execucoes_backup (sucesso, bytes, destino_externo_ok, mensagem, fotos_bytes, fotos_destino_externo_ok, anexos_bytes, anexos_destino_externo_ok) values (:'sucesso'::boolean, nullif(:'bytes', '')::bigint, :'externo'::boolean, nullif(:'mensagem', ''), nullif(:'fotosbytes', '')::bigint, :'fotosexterno'::boolean, nullif(:'anexosbytes', '')::bigint, :'anexosexterno'::boolean);" |
    $PG_CLIENT_CMD -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 \
      -v sucesso="$1" -v bytes="$2" -v externo="$3" -v mensagem="$4" \
      -v fotosbytes="$5" -v fotosexterno="$6" \
      -v anexosbytes="$7" -v anexosexterno="$8" >/dev/null
  REGISTRADO=1
}

ao_sair() {
  codigo=$?
  if [ "$REGISTRADO" -eq 0 ]; then
    [ -n "$MENSAGEM_ERRO" ] || MENSAGEM_ERRO="Falha inesperada (código de saída $codigo)."
    # As fotos seguem o mesmo padrão pessimista do dump: bytes fica nulo (não houve tentativa de
    # contar), destino_externo_ok fica false — nunca nulo, porque esta É uma execução nova
    # (a coluna só é nula em linhas escritas ANTES desta fase). Os anexos (Fase 06.2, D-05)
    # seguem o mesmo padrão: bytes nulo, destino false.
    registrar_execucao "false" "" "false" "$MENSAGEM_ERRO" "" "false" "" "false" || true
  fi
  exit "$codigo"
}
trap ao_sair EXIT

# --- Passo 1: nome do arquivo. Sem --agora, o padrão do dia (AAAA-MM-DD); com --agora, o nome
# ganha hora e minuto, para não sobrescrever o dump do dia — este é o comando que se roda antes
# de toda migração, e ele não pode destruir a única cópia limpa do dia. ---
MODO_AGORA=0
for arg in "$@"; do
  case "$arg" in
    --agora)
      MODO_AGORA=1
      ;;
    *)
      MENSAGEM_ERRO="Opção desconhecida: '$arg'. Uso: $0 [--agora]"
      echo "$MENSAGEM_ERRO" >&2
      exit 2
      ;;
  esac
done
if [ "$MODO_AGORA" -eq 1 ]; then
  ARQUIVO_BASE="amassa-$(date +%Y-%m-%d-%H%M).sql.gz"
else
  ARQUIVO_BASE="amassa-$(date +%Y-%m-%d).sql.gz"
fi
ARQUIVO="$BACKUP_DIR/$ARQUIVO_BASE"

# --- Passo 2: garante o diretório de backups. ---
mkdir -p "$BACKUP_DIR"

# --- Passo 3: gera o dump, comprime, e confere o resultado. O dump vai primeiro para um
# arquivo bruto, nunca direto por um cano para o gzip — `set -e` sem "pipefail" não enxerga a
# falha do lado esquerdo de um cano, e um dump truncado no meio comprimiria "com sucesso"
# aparente. Escrever em arquivo e checar o código de saída de cada comando separadamente é o
# que torna a falha visível.
BRUTO="$ARQUIVO.bruto"
if ! ERRO=$($PG_DUMP_CMD -U "$POSTGRES_USER" "$POSTGRES_DB" 2>&1 >"$BRUTO"); then
  MENSAGEM_ERRO="Falha ao gerar o dump do banco: $ERRO"
  rm -f "$BRUTO"
  exit 1
fi
if ! ERRO=$(gzip -f "$BRUTO" 2>&1); then
  MENSAGEM_ERRO="Falha ao comprimir o dump: $ERRO"
  rm -f "$BRUTO" "$BRUTO.gz"
  exit 1
fi
mv "$BRUTO.gz" "$ARQUIVO"
# Confere: o arquivo existe, tem tamanho maior que zero, e passa no teste de integridade do
# compressor. Um dump que falhou no meio produz um arquivo truncado que parece um backup — essa
# conferência é o que separa os dois. Um arquivo quebrado no diretório é pior que nenhum, porque
# a rotação vai preservá-lo e alguém vai confiar nele.
if [ ! -s "$ARQUIVO" ] || ! gzip -t "$ARQUIVO" 2>/dev/null; then
  MENSAGEM_ERRO="O dump gerado está vazio ou corrompido; o arquivo defeituoso foi removido."
  rm -f "$ARQUIVO"
  exit 1
fi
BYTES="$(stat -c%s "$ARQUIVO")"

# --- Passo 4: retenção mensal. No dia 1º, copia o arquivo para a pasta que nunca é limpa. ---
if [ "$BACKUP_DIA_DO_MES" = "01" ]; then
  mkdir -p "$BACKUP_DIR_MENSAL"
  cp "$ARQUIVO" "$BACKUP_DIR_MENSAL/$ARQUIVO_BASE"
fi

# --- Passo 5: rotação. Apenas o primeiro nível do diretório de backups — nunca desce na pasta
# mensal (-maxdepth 1 cuida disso). Esse é o detalhe que, esquecido, faz a retenção mensal
# existir por dois meses e sumir depois. ---
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'amassa-*.sql.gz' -mtime "+$BACKUP_RETENCAO_DIAS" -delete

# --- Passo 6: envio externo, se configurado. Sem destino, pula e registra a cópia externa como
# NÃO confirmada — nunca como sucesso silencioso. Uma falha aqui não descarta o dump já gerado
# (ele está íntegro em disco), mas marca a execução para sair diferente de zero, para que a
# linha do log do agendador seja legível. ---
DESTINO_OK=false
if [ -n "$RCLONE_REMOTE" ]; then
  if ERRO=$($BACKUP_ENVIO_CMD "$ARQUIVO" "$RCLONE_REMOTE" 2>&1); then
    DESTINO_OK=true
  else
    MENSAGEM_ERRO="Envio ao destino externo falhou (o dump em disco está íntegro): $ERRO"
    CODIGO_SAIDA=1
  fi
fi

# --- Passo 6b: cópia das fotos de orçamento, na MESMA execução do dump (D-28/ORC-16). Um
# diretório inexistente ou vazio NÃO é falha — um ateliê sem foto nenhuma ainda é um estado
# normal, e transformá-lo em alarme ensinaria o dono a ignorar o alarme de verdade. FOTOS_BYTES
# soma o tamanho de cada arquivo com `find ... -exec stat -c%s` (o MESMO `stat -c%s` já usado no
# Passo 3 acima) encanado para `awk` — forma POSIX, provada neste próprio arquivo, em vez de
# `du -sb` (a flag `-b` não é garantida no BusyBox do Alpine, a mesma imagem do contêiner em que
# scripts/testar-backup.mjs roda este script). Sem destino externo configurado, marca como NÃO
# confirmado, exatamente como o dump já faz no Passo 6 — nunca sucesso silencioso. ---
FOTOS_BYTES="$(find "$BACKUP_FOTOS_DIR" -type f -exec stat -c%s {} \; 2>/dev/null | awk '{s+=$1} END{print s+0}')"
FOTOS_HA_ARQUIVOS=false
if [ -d "$BACKUP_FOTOS_DIR" ] && [ -n "$(find "$BACKUP_FOTOS_DIR" -type f 2>/dev/null | head -n 1)" ]; then
  FOTOS_HA_ARQUIVOS=true
fi

FOTOS_DESTINO_OK=false
if [ -n "$RCLONE_REMOTE_FOTOS" ]; then
  if [ "$FOTOS_HA_ARQUIVOS" = "true" ]; then
    if ERRO_FOTOS=$($BACKUP_ENVIO_CMD "$BACKUP_FOTOS_DIR" "$RCLONE_REMOTE_FOTOS" 2>&1); then
      FOTOS_DESTINO_OK=true
    else
      MENSAGEM_ERRO="${MENSAGEM_ERRO:+$MENSAGEM_ERRO }Envio das fotos ao destino externo falhou: $ERRO_FOTOS"
      CODIGO_SAIDA=1
    fi
  else
    # Nada para enviar (diretório ausente ou vazio) e destino configurado: confirmado por
    # vacuidade, não por sucesso de um envio que nunca aconteceu.
    FOTOS_DESTINO_OK=true
  fi
fi

# --- Passo 6c: cópia dos anexos dos fornecedores, na MESMA execução do dump e das fotos (Fase
# 06.2, D-05/A-02) — o gêmeo do Passo 6b. Diretório inexistente ou vazio NÃO é falha (nenhum
# fornecedor com anexo ainda é estado normal). ANEXOS_BYTES usa a mesma forma POSIX das fotos
# (`find ... -exec stat -c%s` para `awk`, nunca `du -b`), com UMA diferença: ignora os temporários
# `.envio-*` que o PUT do upload grava dentro da própria pasta enquanto o arquivo chega
# (06.2-RESEARCH.md, Pitfall 5) — um upload em curso não é dado do ateliê, e somá-lo faria o
# tamanho oscilar sem motivo. A CÓPIA continua sendo da pasta inteira: um temporário pendurado
# viaja junto, inofensivo (o nome nunca casa com um anexo válido). Sem destino externo
# configurado, marca como NÃO confirmado — nunca sucesso silencioso. ---
ANEXOS_BYTES="$(find "$BACKUP_ANEXOS_DIR" -type f ! -name '.envio-*' -exec stat -c%s {} \; 2>/dev/null | awk '{s+=$1} END{print s+0}')"
ANEXOS_HA_ARQUIVOS=false
if [ -d "$BACKUP_ANEXOS_DIR" ] && [ -n "$(find "$BACKUP_ANEXOS_DIR" -type f 2>/dev/null | head -n 1)" ]; then
  ANEXOS_HA_ARQUIVOS=true
fi

ANEXOS_DESTINO_OK=false
if [ -n "$RCLONE_REMOTE_ANEXOS" ]; then
  if [ "$ANEXOS_HA_ARQUIVOS" = "true" ]; then
    if ERRO_ANEXOS=$($BACKUP_ENVIO_CMD "$BACKUP_ANEXOS_DIR" "$RCLONE_REMOTE_ANEXOS" 2>&1); then
      ANEXOS_DESTINO_OK=true
    else
      MENSAGEM_ERRO="${MENSAGEM_ERRO:+$MENSAGEM_ERRO }Envio dos anexos dos fornecedores ao destino externo falhou: $ERRO_ANEXOS"
      CODIGO_SAIDA=1
    fi
  else
    # Nada para enviar (diretório ausente ou vazio) e destino configurado: confirmado por
    # vacuidade, não por sucesso de um envio que nunca aconteceu.
    ANEXOS_DESTINO_OK=true
  fi
fi

# --- Passo 7: grava a linha de sucesso. A gravação acontece aqui e, para qualquer caminho de
# falha anterior, pela armadilha de saída (ao_sair) — em toda saída, inclusive na de erro. ---
registrar_execucao "true" "$BYTES" "$DESTINO_OK" "$MENSAGEM_ERRO" "$FOTOS_BYTES" "$FOTOS_DESTINO_OK" "$ANEXOS_BYTES" "$ANEXOS_DESTINO_OK"

# --- Passo 9: sai zero no sucesso, diferente de zero em qualquer falha — inclusive envio
# externo que falhou, mesmo com o dump em disco intacto e registrado. ---
exit "$CODIGO_SAIDA"
