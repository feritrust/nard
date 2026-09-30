#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  به‌روزرسانی رنج‌های IP کلادفلر برای nginx
#
#  اجرا:  sudo bash deploy/update-cloudflare-ips.sh
#  ماهانه در crontab:
#    0 4 1 * * /usr/bin/env bash /opt/nard/deploy/update-cloudflare-ips.sh >/dev/null 2>&1
# ─────────────────────────────────────────────────────────────
set -euo pipefail

OUT=/etc/nginx/conf.d/cloudflare-realip.conf
TMP=$(mktemp)

echo "▸ گرفتن لیست رسمی رنج‌ها…"
V4=$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v4)
V6=$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v6)

# اگر جواب خالی یا مشکوک بود، فایل قبلی را خراب نکن
if [ "$(printf '%s\n' "$V4" | wc -l)" -lt 5 ]; then
  echo "✗ لیست ناقص آمد — تغییری داده نشد."
  rm -f "$TMP"; exit 1
fi

{
  echo "# ساخته‌شده خودکار — $(date '+%Y-%m-%d %H:%M')"
  echo "# منبع: https://www.cloudflare.com/ips/"
  printf '%s\n' "$V4" | sed 's#^#set_real_ip_from #; s#$#;#'
  printf '%s\n' "$V6" | sed 's#^#set_real_ip_from #; s#$#;#'
  echo "real_ip_header CF-Connecting-IP;"
  echo "real_ip_recursive on;"
} > "$TMP"

cp "$TMP" "$OUT"
rm -f "$TMP"

if nginx -t; then
  systemctl reload nginx
  echo "✅ به‌روزرسانی شد: $OUT"
else
  echo "✗ nginx -t خطا داد — nginx ری‌لود نشد."
  exit 1
fi
