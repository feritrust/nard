#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  راه‌اندازی nginx + SSL از صفر
#
#  مشکل مرغ و تخم‌مرغ را حل می‌کند: nginx بدون گواهی بالا نمی‌آید
#  («no ssl_certificate is defined for the listen ... ssl directive»)
#  و certbot هم بدون nginxِ بالا نمی‌تواند گواهی بگیرد.
#
#  اجرا:
#     sudo bash deploy/enable-ssl.sh                 # Let's Encrypt
#     sudo bash deploy/enable-ssl.sh --cloudflare    # Origin Certificate کلادفلر
#
#  ⚠️ برای حالت Let's Encrypt، ابر DNS در کلادفلر باید **خاکستری**
#     (DNS only) باشد، وگرنه تأیید مالکیت به سرور شما نمی‌رسد.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT=$(pwd)

MODE=letsencrypt
[ "${1:-}" = "--cloudflare" ] && MODE=cloudflare

# دامنه را از خود پیکربندی می‌خوانیم تا با set-domain.sh هماهنگ بماند
DOMAIN=$(sed -n 's/^\s*server_name \([a-z0-9.-]*\) .*/\1/p' deploy/nginx-nard.conf | head -1)
if [ -z "$DOMAIN" ]; then echo "✗ دامنه از deploy/nginx-nard.conf خوانده نشد."; exit 1; fi
echo "▸ دامنه: $DOMAIN"

# ── ۱) فایل‌های پایه ────────────────────────────────────────
echo "▸ نصب فایل‌های پایه‌ی nginx…"
cp "$ROOT/deploy/cloudflare-realip.conf" /etc/nginx/conf.d/
cp "$ROOT/deploy/proxy_params"           /etc/nginx/proxy_params
mkdir -p /var/www/html
rm -f /etc/nginx/sites-enabled/default

# ── ۲) پیکربندی موقت HTTP ───────────────────────────────────
echo "▸ بالا آوردن nginx روی HTTP…"
cp "$ROOT/deploy/nginx-bootstrap.conf" /etc/nginx/sites-available/nard
ln -sf /etc/nginx/sites-available/nard /etc/nginx/sites-enabled/nard
nginx -t
systemctl reload nginx || systemctl start nginx
echo "  ✓ سایت روی http://$DOMAIN بالاست"

# ── ۳) گواهی ────────────────────────────────────────────────
if [ "$MODE" = letsencrypt ]; then
  echo "▸ گرفتن گواهی Let's Encrypt…"
  command -v certbot >/dev/null || apt-get install -y certbot

  if certbot certonly --webroot -w /var/www/html \
       -d "$DOMAIN" -d "www.$DOMAIN" \
       --non-interactive --agree-tos --register-unsafely-without-email \
       --keep-until-expiring; then
    CERT=/etc/letsencrypt/live/$DOMAIN/fullchain.pem
    KEY=/etc/letsencrypt/live/$DOMAIN/privkey.pem
  else
    echo ""
    echo "✗ گرفتن گواهی شکست خورد. محتمل‌ترین دلایل:"
    echo "   • ابر DNS در کلادفلر نارنجی است → خاکستری کنید و دوباره اجرا کنید"
    echo "   • رکورد A هنوز به این سرور اشاره نمی‌کند → dig $DOMAIN +short"
    echo "   • پورت ۸۰ بسته است → ufw allow 'Nginx Full'"
    echo ""
    echo "   یا از گواهی خود کلادفلر استفاده کنید:"
    echo "     sudo bash deploy/enable-ssl.sh --cloudflare"
    echo ""
    echo "   فعلاً سایت روی HTTP بالاست و کار می‌کند."
    exit 1
  fi
else
  CERT=/etc/ssl/cloudflare/$DOMAIN.pem
  KEY=/etc/ssl/cloudflare/$DOMAIN.key
  if [ ! -s "$CERT" ] || [ ! -s "$KEY" ]; then
    echo ""
    echo "✗ گواهی کلادفلر پیدا نشد."
    echo "   در داشبورد کلادفلر:  SSL/TLS → Origin Server → Create Certificate"
    echo "   بعد این دو فایل را بسازید و دوباره اجرا کنید:"
    echo "     mkdir -p /etc/ssl/cloudflare"
    echo "     nano $CERT     # محتوای Origin Certificate"
    echo "     nano $KEY      # محتوای Private Key"
    echo "     chmod 600 /etc/ssl/cloudflare/*"
    exit 1
  fi
fi

# ── ۴) فعال کردن پیکربندی کامل ──────────────────────────────
echo "▸ فعال کردن HTTPS…"
cat > /etc/nginx/nard-ssl.conf <<EOF
# ساخته‌شده توسط deploy/enable-ssl.sh — $(date '+%Y-%m-%d %H:%M')
ssl_certificate     $CERT;
ssl_certificate_key $KEY;
ssl_protocols       TLSv1.2 TLSv1.3;
ssl_session_cache   shared:SSL:10m;
ssl_session_timeout 1d;
EOF

cp "$ROOT/deploy/nginx-nard.conf" /etc/nginx/sites-available/nard

if nginx -t; then
  systemctl reload nginx
  echo ""
  echo "✅ HTTPS فعال شد → https://$DOMAIN"
  echo ""
  echo "کارهای بعدی:"
  echo "  ۱) در کلادفلر SSL/TLS را روی «Full (strict)» بگذارید"
  if [ "$MODE" = letsencrypt ]; then
    echo "  ۲) حالا ابر DNS را نارنجی (Proxied) کنید"
  fi
  echo "  ۳) Network → WebSockets را روشن کنید"
  echo "  ۴) تست: curl -sI https://$DOMAIN | head -1"
else
  echo "✗ پیکربندی ایراد دارد — به نسخه‌ی HTTP برمی‌گردیم تا سایت پایین نیاید."
  cp "$ROOT/deploy/nginx-bootstrap.conf" /etc/nginx/sites-available/nard
  nginx -t && systemctl reload nginx
  exit 1
fi
