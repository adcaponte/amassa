#!/bin/sh
# scripts/restaurar.sh — devolve um dump comprimido (gerado por scripts/backup.sh) a um banco
# Postgres. Restaurar substitui dados; a pessoa que roda isto pode estar tendo um dia ruim, e
# este script existe para ser o adulto da conversa: sem confirmação explícita, ele só mostra o
# que seria perdido e não escreve nada.
set -eu

# --- Configuração: as mesmas variáveis injetáveis de scripts/backup.sh, com o mesmo padrão
# apontando para o diretório de produção. ---
AMASSA_DIR="${AMASSA_DIR:-/opt/amassa}"
AMBIENTE_ARQUIVO="${AMBIENTE_ARQUIVO:-$AMASSA_DIR/.env}"
PG_CLIENT_CMD="${PG_CLIENT_CMD:-docker compose -f $AMASSA_DIR/compose.yml exec -T postgres psql}"

# Carrega o arquivo de ambiente do servidor só se existir — em teste as variáveis já chegam
# prontas por fora.
if [ -f "$AMBIENTE_ARQUIVO" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$AMBIENTE_ARQUIVO"
  set +a
fi
POSTGRES_USER="${POSTGRES_USER:-amassa_owner}"

mostrar_uso() {
  echo "Uso: $0 --arquivo CAMINHO_DO_DUMP --banco NOME_DO_BANCO [--confirmar]" >&2
  echo "Sem --confirmar, apenas mostra o que seria perdido e não altera nada." >&2
}

# --- Argumentos: arquivo, banco de destino e a confirmação explícita. ---
ARQUIVO=""
BANCO=""
CONFIRMAR=0
while [ $# -gt 0 ]; do
  case "$1" in
    --arquivo)
      ARQUIVO="${2:-}"
      shift 2
      ;;
    --banco)
      BANCO="${2:-}"
      shift 2
      ;;
    --confirmar)
      CONFIRMAR=1
      shift
      ;;
    *)
      echo "Opção desconhecida: '$1'." >&2
      mostrar_uso
      exit 2
      ;;
  esac
done

if [ -z "$ARQUIVO" ] || [ -z "$BANCO" ]; then
  mostrar_uso
  exit 2
fi

if [ ! -f "$ARQUIVO" ]; then
  echo "Arquivo não encontrado: '$ARQUIVO'." >&2
  exit 1
fi

# Lista as tabelas do schema público dinamicamente, em vez de um nome fixo — a conferência
# continua valendo à medida que módulos novos acrescentam tabelas (db/schema.ts), sem exigir
# edição deste script.
listar_tabelas() {
  $PG_CLIENT_CMD -U "$POSTGRES_USER" -d "$BANCO" -t -A -c \
    "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name;"
}

mostrar_contagens() {
  titulo="$1"
  echo "$titulo"
  tabelas="$(listar_tabelas)"
  if [ -z "$tabelas" ]; then
    echo "  (o banco '$BANCO' não tem nenhuma tabela ainda)"
    return 0
  fi
  echo "$tabelas" | while IFS= read -r tabela; do
    [ -n "$tabela" ] || continue
    # `< /dev/null` é obrigatório, não estilo. $PG_CLIENT_CMD é um `docker compose exec`/`docker
    # exec`, e o cliente do Docker lê o stdin mesmo com -T. Dentro deste laço o stdin é a lista de
    # tabelas ainda não consumida: sem o redirecionamento, a primeira volta engole o resto e o
    # laço termina depois de UMA tabela. O sintoma é silencioso e perigoso — o aviso "será
    # perdido" mostraria só a primeira tabela do banco, escondendo tudo o mais que a restauração
    # vai substituir, que é justamente o que este aviso existe para impedir.
    quantidade="$($PG_CLIENT_CMD -U "$POSTGRES_USER" -d "$BANCO" -t -A -c "select count(*) from \"$tabela\";" < /dev/null)"
    printf '  %-40s %s linha(s)\n' "$tabela" "$quantidade"
  done
}

# --- Sem confirmação: mostra o que seria perdido e sai diferente de zero, sem escrever nada.
# Restaurar substitui dados; ninguém deveria descobrir isso depois de já ter acontecido. ---
if [ "$CONFIRMAR" -ne 1 ]; then
  echo "ATENÇÃO: isto vai SUBSTITUIR os dados do banco '$BANCO' pelo conteúdo de '$ARQUIVO'."
  echo
  mostrar_contagens "O que existe hoje em '$BANCO' (será perdido):"
  echo
  echo "Nada foi alterado. Para restaurar de verdade, repita o mesmo comando com --confirmar:"
  echo "  $0 --arquivo \"$ARQUIVO\" --banco \"$BANCO\" --confirmar"
  exit 1
fi

# --- Com confirmação: confere a integridade do arquivo ANTES de tocar no banco. Recusar cedo
# um arquivo truncado evita destruir o banco atual para descobrir depois que o substituto
# estava quebrado. ---
echo "Conferindo a integridade de '$ARQUIVO' antes de tocar no banco..."
if ! gzip -t "$ARQUIVO" 2>/dev/null; then
  echo "O arquivo '$ARQUIVO' está corrompido ou incompleto — nada foi restaurado." >&2
  exit 1
fi

# --- Restaura. ON_ERROR_STOP=1 faz o cliente parar no primeiro erro — sem essa opção o
# psql engole erros de instruções individuais e devolve código zero, e comemora-se uma
# restauração que não aconteceu de verdade. ---
echo "Restaurando '$ARQUIVO' no banco '$BANCO'..."
if ! ERRO=$(gzip -dc "$ARQUIVO" | $PG_CLIENT_CMD -U "$POSTGRES_USER" -d "$BANCO" -v ON_ERROR_STOP=1 2>&1 >/dev/null); then
  echo "Falha ao restaurar: $ERRO" >&2
  exit 1
fi

echo
mostrar_contagens "Restauração concluída. Contagens finais em '$BANCO':"
echo
echo "Arquivo restaurado: $ARQUIVO"
echo "Banco de destino:   $BANCO"
