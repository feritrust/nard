#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  نصب اولیه روی سرور اوبونتو / دبیان
#  روی سرور تازه اجرا کنید:  sudo bash deploy/setup.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

echo "▸ بررسی Node.js…"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt 22 ]; then
  echo "  نصب Node.js 22…"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
echo "  Node: $(node -v)"

echo "▸ ساخت کاربر nard…"
id -u nard >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/nard --shell /usr/sbin/nologin nard

echo "▸ ساخت پوشه‌ها…"
mkdir -p /opt/nard/server/data /opt/nard/backups
chown -R nard:nard /opt/nard

echo "▸ نصب وابستگی‌های سایت…"
# نکته: --omit=dev نگذارید. Next برای build به tailwind و typescript
# نیاز دارد که در devDependencies هستند.
cd /opt/nard/web
sudo -u nard npm ci 2>/dev/null || sudo -u nard npm install

echo "▸ build سایت…"
sudo -u nard npm run build

echo "▸ نصب سرویس‌ها…"
cp /opt/nard/deploy/nard-server.service /etc/systemd/system/
cp /opt/nard/deploy/nard-web.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now nard-server nard-web

echo ""
echo "✅ نصب تمام شد."
echo ""
echo "کارهای باقی‌مانده:"
echo "  ۱) فایل /opt/nard/server/.env را بسازید (از .env.example کپی کنید)"
echo "     ⚠️ حتماً NARD_DEV_CODE=0 بگذارید"
echo "  ۲) اولین ادمین را بسازید:"
echo "     cd /opt/nard/server && sudo -u nard node create-admin.js owner '<رمز>' owner"
echo "  ۳) nginx و SSL را تنظیم کنید (deploy/nginx-nard.conf)"
echo "  ۴) پشتیبان‌گیری خودکار را به crontab اضافه کنید"
echo ""
echo "وضعیت:  systemctl status nard-server nard-web"
echo "لاگ:    journalctl -u nard-server -f"
