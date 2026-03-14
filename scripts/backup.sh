#!/bin/bash
# Бэкап базы данных LawAI
# Запускается через cron: 0 3 * * * /path/to/backup.sh

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB_FILE="$PROJECT_DIR/database/law_database.db"
BACKUP_DIR="$PROJECT_DIR/database/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/law_database_$TIMESTAMP.db"

mkdir -p "$BACKUP_DIR"

# SQLite online backup (безопасно во время работы)
sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"

if [ $? -eq 0 ]; then
    echo "[$TIMESTAMP] Бэкап создан: $BACKUP_FILE"
    # Удаляем бэкапы старше 30 дней
    find "$BACKUP_DIR" -name "*.db" -mtime +30 -delete
    echo "[$TIMESTAMP] Старые бэкапы очищены"
else
    echo "[$TIMESTAMP] ОШИБКА: не удалось создать бэкап" >&2
    exit 1
fi
