#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  پشتیبان‌گیری از دیتابیس بازی
#
#  چون SQLite در حالت WAL است، کپی ساده‌ی فایل می‌تواند ناقص باشد.
#  این اسکریپت از دستور .backup خود sqlite استفاده می‌کند که امن است.
#
#  اجرای خودکار هر ۶ ساعت (crontab -e):
#    0 */6 * * * /opt/nard/deploy/backup.sh >> /var/log/nard-backup.log 2>&1
# ─────────────────────────────────────────────────────────────
set -euo pipefail

DB="${NARD_DB:-/opt/nard/server/data/nard.db}"
DEST="${NARD_BACKUP_DIR:-/opt/nard/backups}"
KEEP_DAYS="${NARD_BACKUP_KEEP:-30}"

mkdir -p "$DEST"
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$DEST/nard-$STAMP.db"

if [ ! -f "$DB" ]; then
  echo "[$(date)] ✗ دیتابیس پیدا نشد: $DB"
  exit 1
fi

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" ".backup '$OUT'"
else
  # اگر sqlite3 نصب نیست، از خود Node استفاده می‌کنیم
  node -e "
    const {DatabaseSync}=require('node:sqlite');
    const db=new DatabaseSync(process.argv[1]);
    db.exec(\"VACUUM INTO '\" + process.argv[2] + \"'\");
  " "$DB" "$OUT"
fi

gzip -f "$OUT"
echo "[$(date)] ✓ پشتیبان ساخته شد: $OUT.gz ($(du -h "$OUT.gz" | cut -f1))"

# پاک کردن پشتیبان‌های قدیمی
find "$DEST" -name 'nard-*.db.gz' -mtime "+$KEEP_DAYS" -delete
echo "[$(date)]   پشتیبان‌های قدیمی‌تر از $KEEP_DAYS روز پاک شدند"
