#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  جایگزینی دامنه در همه‌ی فایل‌های پروژه
#
#  اجرا (از ریشه‌ی پروژه):
#     bash deploy/set-domain.sh farhadtest.ir
#     bash deploy/set-domain.sh nard.ir            # بعداً دامنه‌ی اصلی
#
#  بعد از اجرا:
#     cd web && npm run build && sudo systemctl restart nard-web
#     sudo cp deploy/nginx-nard.conf /etc/nginx/sites-available/nard
#     sudo nginx -t && sudo systemctl reload nginx
# ─────────────────────────────────────────────────────────────
set -euo pipefail

NEW="${1:-}"
if [ -z "$NEW" ]; then
  echo "استفاده:  bash deploy/set-domain.sh <دامنه>"
  echo "مثال:     bash deploy/set-domain.sh farhadtest.ir"
  exit 1
fi

# اعتبارسنجی ساده — جلوی اشتباه تایپی و حذف کاراکترهای خطرناک
if ! printf '%s' "$NEW" | grep -Eq '^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$'; then
  echo "✗ «$NEW» شبیه یک دامنه‌ی معتبر نیست (بدون https:// و بدون / بنویسید)."
  exit 1
fi

cd "$(dirname "$0")/.."

# دامنه‌ی فعلی را از site.ts می‌خوانیم
OLD=$(sed -n "s#.*NEXT_PUBLIC_SITE_URL || 'https://\([^']*\)'.*#\1#p" web/lib/site.ts)
if [ -z "$OLD" ]; then echo "✗ دامنه‌ی فعلی پیدا نشد."; exit 1; fi

if [ "$OLD" = "$NEW" ]; then echo "دامنه از قبل $NEW است — کاری لازم نیست."; exit 0; fi

echo "▸ $OLD  →  $NEW"

FILES=(
  deploy/nginx-nard.conf
  web/lib/site.ts
  web/.env.example
  www/js/store.js
  android/app/src/main/assets/www/js/store.js
  android/app/src/main/java/com/nard/pro/MainActivity.kt
)
[ -f web/.env.production ] && FILES+=(web/.env.production)

for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  sed -i "s/${OLD//./\\.}/${NEW}/g" "$f"
  echo "  ✓ $f"
done

echo ""
echo "✅ تمام شد. کارهای بعدی:"
echo "   cd web && npm run build && sudo systemctl restart nard-web"
echo "   sudo cp deploy/nginx-nard.conf /etc/nginx/sites-available/nard"
echo "   sudo nginx -t && sudo systemctl reload nginx"
echo "   sudo certbot --nginx -d $NEW -d www.$NEW"
