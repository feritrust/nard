# بردن پروژه روی سرور — با دامنه‌ی کلادفلری

راهنمای گام‌به‌گام برای `farhadtest.ir` که DNS آن روی کلادفلر است.
اگر دامنه‌ی دیگری داشتید، اول `bash deploy/set-domain.sh <دامنه>` را بزنید.

فرض: سرور اوبونتو ۲۲ یا ۲۴، دسترسی root با SSH.

---

## ۰) قبل از هر چیز — دو تنظیم کلادفلر که ۹۰٪ مشکلات از آن‌هاست

وارد داشبورد کلادفلر شوید، دامنه‌ی `farhadtest.ir` را انتخاب کنید.

### الف) SSL/TLS باید روی **Full (strict)** باشد

`SSL/TLS → Overview → Full (strict)`

| حالت | چه اتفاقی می‌افتد |
|---|---|
| **Off** | همه چیز روی HTTP لخت — رمز و توکن کاربر در راه لو می‌رود. ❌ |
| **Flexible** | کلادفلر با HTTP به سرور وصل می‌شود، nginx به HTTPS ریدایرکت می‌کند، کلادفلر دوباره HTTP می‌فرستد → **حلقه‌ی بی‌نهایت ریدایرکت (ERR_TOO_MANY_REDIRECTS)**. ❌ |
| **Full** | رمزنگاری هست ولی گواهی سرور بررسی نمی‌شود. قابل قبول ولی نه ایده‌آل. |
| **Full (strict)** | رمزنگاری کامل + بررسی گواهی. ✅ همین را بگذارید. |

> این تک تنظیم دلیل اصلی «سایتم بالا اومد ولی لوپ می‌خوره» است.

### ب) وب‌سوکت باید روشن باشد

`Network → WebSockets → On`

در پلن رایگان هم پشتیبانی می‌شود و معمولاً از قبل روشن است. بازی بدون این کار نمی‌کند.

### پ) رکورد DNS

`DNS → Records`:

```
A    farhadtest.ir      <IP سرور>     Proxied (ابر نارنجی)
A    www                <IP سرور>     Proxied
```

فعلاً **ابر را خاکستری کنید** (DNS only). بعد از گرفتن گواهی SSL دوباره نارنجی می‌کنیم — دلیلش در مرحله‌ی ۶ توضیح داده شده.

بررسی: `dig farhadtest.ir +short` باید IP سرور را بدهد.

---

## ۱) آماده‌سازی سرور

```bash
ssh root@<IP سرور>

apt update && apt upgrade -y
apt install -y git nginx curl ufw

# فایروال
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## ۲) گرفتن کد از گیت‌هاب

```bash
cd /opt
git clone https://github.com/feritrust/nard.git
cd nard
```

اگر مخزن خصوصی است، یک **Personal Access Token** از گیت‌هاب بسازید و:

```bash
git clone https://<توکن>@github.com/feritrust/nard.git
```

---

## ۳) نصب خودکار

```bash
cd /opt/nard
bash deploy/setup.sh
```

این اسکریپت: Node 22 نصب می‌کند، کاربر `nard` می‌سازد، پوشه‌ها را درست می‌کند،
`npm ci` و `npm run build` سایت را می‌زند و دو سرویس systemd را راه می‌اندازد.

> اگر سرور RAM کمی دارد (کمتر از ۲ گیگ)، مرحله‌ی build ممکن است kill شود.
> یک فایل swap بسازید:
> ```bash
> fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
> echo '/swapfile none swap sw 0 0' >> /etc/fstab
> ```

---

## ۴) فایل‌های تنظیمات (مهم‌ترین مرحله)

### سرور بازی — `/opt/nard/server/.env`

```bash
nano /opt/nard/server/.env
```

```ini
# ⚠️⚠️ حتماً 0 — وگرنه کد تأیید در پاسخ API برمی‌گردد
#       یعنی هر کسی با هر شماره‌ای وارد می‌شود
NARD_DEV_CODE=0

PORT=8080
NARD_HOST=127.0.0.1
NARD_DATA=/opt/nard/server/data

# کلید نشست‌ها — با دستور زیر یکی بسازید و اینجا بگذارید:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
NARD_SECRET=<۶۴ کاراکتر تصادفی>

# پشت nginx/کلادفلر هستیم، پس هدر IP را باور می‌کنیم
NARD_TRUST_PROXY=1

# ربات تلگرام (برای مینی‌اپ، بعداً)
NARD_BOT_TOKEN=
```

```bash
chown nard:nard /opt/nard/server/.env
chmod 600 /opt/nard/server/.env
```

### سایت — `/opt/nard/web/.env.production`

```bash
cat > /opt/nard/web/.env.production <<'EOF'
NEXT_PUBLIC_SITE_URL=https://farhadtest.ir
NEXT_PUBLIC_API_URL=https://farhadtest.ir
EOF
chown nard:nard /opt/nard/web/.env.production
```

بعد از ساختن این فایل، سایت را دوباره build کنید:

```bash
cd /opt/nard/web && sudo -u nard npm run build
systemctl restart nard-web
```

### اولین ادمین

```bash
cd /opt/nard/server
sudo -u nard node create-admin.js owner '<یک رمز قوی>' owner
```

> پیامک هنوز به هیچ سرویسی وصل نیست — کد ورود در لاگ سرور چاپ می‌شود:
> `journalctl -u nard-server -f | grep sms`
> برای تست خودتان کافی است؛ قبل از باز کردن روی کاربر واقعی باید یک سرویس
> پیامک ایرانی (کاوه‌نگار، ملی‌پیامک و…) در `sendSms` داخل `server/api.js` وصل شود.

خروجی یک **QR / کلید TOTP** می‌دهد — همان لحظه در Google Authenticator یا
Authy اسکن کنید. بدون آن نمی‌توانید وارد پنل شوید.

---

## ۵) nginx و SSL — با یک دستور

nginx و گواهی SSL یک مشکل مرغ و تخم‌مرغ دارند: nginx بدون گواهی بالا
نمی‌آید (`no "ssl_certificate" is defined for the "listen ... ssl" directive`)
و certbot هم بدون nginxِ بالا گواهی نمی‌گیرد. این اسکریپت هر دو را
به ترتیب درست انجام می‌دهد:

```bash
cd /opt/nard
sudo bash deploy/enable-ssl.sh
```

چه می‌کند:

1. `cloudflare-realip.conf` و `proxy_params` را نصب می‌کند
2. یک پیکربندی موقتِ **فقط HTTP** می‌گذارد و nginx را بالا می‌آورد —
   از همین‌جا سایت روی `http://farhadtest.ir` کار می‌کند
3. با certbot گواهی می‌گیرد
4. پیکربندی کامل HTTPS را فعال می‌کند
5. اگر جایی ایراد داشت، خودش به نسخه‌ی HTTP برمی‌گردد تا سایت پایین نیاید

> **⚠️ قبل از اجرا، ابر DNS در کلادفلر باید خاکستری (DNS only) باشد.**
> certbot برای اثبات مالکیت دامنه یک فایل روی سرور می‌گذارد و لتس‌انکریپت
> باید آن را از اینترنت بخواند. با ابر نارنجی، درخواست به کلادفلر می‌رسد
> نه سرور شما، و تأیید شکست می‌خورد.
>
> بعد از موفقیت، ابر را نارنجی کنید و SSL را روی **Full (strict)** بگذارید.

### اگر certbot جواب نداد — گواهی خود کلادفلر

مثلاً وقتی IP سرور ایران است و لتس‌انکریپت به مشکل می‌خورد. این راه اصلاً
نیازی به خاکستری کردن ابر ندارد و گواهی‌اش ۱۵ ساله است:

`SSL/TLS → Origin Server → Create Certificate` → دو فایل را بگیرید:

```bash
mkdir -p /etc/ssl/cloudflare
nano /etc/ssl/cloudflare/farhadtest.ir.pem   # محتوای Origin Certificate
nano /etc/ssl/cloudflare/farhadtest.ir.key   # محتوای Private Key
chmod 600 /etc/ssl/cloudflare/*

sudo bash deploy/enable-ssl.sh --cloudflare
```

این گواهی فقط برای کلادفلر معتبر است — اگر کسی مستقیم به IP سرور وصل شود
هشدار می‌گیرد، که اشکالی ندارد (اصلاً نباید مستقیم وصل شود).

### چرا `cloudflare-realip.conf` مهم است

بدون آن nginx همه‌ی بازیکن‌ها را با IP سرورهای کلادفلر می‌بیند:

- محدودیت نرخ پیامک روی یک IP مشترک اعمال می‌شود؛ یک نفر ورود کل سایت را قفل می‌کند
- تشخیص مولتی‌اکانت همه را متقلب می‌بیند
- پاداش دعوت دوستان برای هیچ‌کس فعال نمی‌شود

رنج‌های کلادفلر گاهی عوض می‌شوند؛ ماهی یک بار به‌روزرسانی کنید (مرحله‌ی ۸).

---

## ۶) تمدید خودکار گواهی

```bash
certbot renew --dry-run
```

certbot خودش یک تایمر systemd نصب می‌کند. اگر ابر نارنجی باشد، تمدید
خودکار هم به همان مشکل مرحله‌ی ۵ می‌خورد — یا موقع تمدید ابر را خاکستری
کنید، یا از همان اول Origin Certificate کلادفلر را بگذارید که تمدید ندارد.

---

## ۷) تست

```bash
systemctl status nard-server nard-web --no-pager
journalctl -u nard-server -n 50 --no-pager
```

از مرورگر:

| نشانی | باید ببینید |
|---|---|
| `https://farhadtest.ir` | صفحه‌ی لندینگ |
| `https://farhadtest.ir/play` | خود بازی |
| `https://farhadtest.ir/admin` | ورود پنل مدیریت |
| `https://farhadtest.ir/adminapi/me` | `{"ok":false,...}` — یعنی API ادمین جواب می‌دهد |
| `https://farhadtest.ir/health` | `{"ok":true,...}` |

**تست وب‌سوکت** — در کنسول مرورگر:

```js
const w = new WebSocket('wss://farhadtest.ir/ws');
w.onopen  = () => console.log('✅ وصل شد');
w.onerror = () => console.log('❌ وصل نشد');
```

اگر «وصل نشد» دیدید: کلادفلر → `Network → WebSockets` روشن است؟

**تست IP واقعی** — یک ثبت‌نام انجام دهید و بعد:

```bash
cd /opt/nard/server && sudo -u nard node -e "
const D = require('./db.js');
console.log(D.db.prepare('SELECT name, phone, last_ip FROM users ORDER BY created_at DESC LIMIT 5').all());
"
```

اگر ستون `last_ip` عدد `172.x` یا `104.x` (رنج کلادفلر) بود، `cloudflare-realip.conf`
نصب نشده. باید IP واقعی خودتان باشد.

---

## ۸) پشتیبان‌گیری

```bash
crontab -e
```

```
0 3 * * * /usr/bin/env bash /opt/nard/deploy/backup.sh >> /var/log/nard-backup.log 2>&1
0 4 1 * * /usr/bin/env bash /opt/nard/deploy/update-cloudflare-ips.sh >/dev/null 2>&1
```

دیتابیس پول کاربرهاست. هفته‌ای یک بار یک نسخه را جای دیگری هم کپی کنید.

---

## ۹) به‌روزرسانی بعدی

```bash
cd /opt/nard
git pull
cd web && sudo -u nard npm ci && sudo -u nard npm run build
systemctl restart nard-server nard-web
```

---

## مشکلات رایج

| نشانه | علت | راه‌حل |
|---|---|---|
| `ERR_TOO_MANY_REDIRECTS` | SSL کلادفلر روی Flexible | بگذارید Full (strict) |
| خطای ۵۲۱ کلادفلر | nginx بالا نیست یا فایروال ۴۴۳ را بسته | `systemctl status nginx` و `ufw status` |
| خطای ۵۲۶ | گواهی سرور نامعتبر و SSL روی Full (strict) | certbot را کامل کنید یا Origin Certificate بگذارید |
| خطای ۵۲۴ (timeout) | سرور بازی جواب نمی‌دهد | `journalctl -u nard-server -f` |
| وب‌سوکت وصل نمی‌شود | WebSockets خاموش یا مسیر `/ws` اشتباه | Network → WebSockets = On |
| بازی بعد از ~۲ دقیقه سکوت قطع می‌شود | ping سرور کار نمی‌کند | سرور هر ۳۰ ثانیه ping می‌فرستد؛ نسخه‌ی به‌روز را deploy کنید |
| همه‌ی کاربرها «مولتی‌اکانت» علامت می‌خورند | `cloudflare-realip.conf` نصب نشده | مرحله‌ی ۵ |
| با هر شماره‌ای می‌شود وارد شد | `NARD_DEV_CODE` صفر نیست | `.env` را درست کنید و `systemctl restart nard-server` |
| build سایت kill می‌شود | RAM کم | swap بسازید (مرحله‌ی ۳) |
| `no "ssl_certificate" is defined` | پیکربندی SSL قبل از گرفتن گواهی نصب شده | `sudo bash deploy/enable-ssl.sh` |
| پنل ادمین لاگین نمی‌شود / خطای JSON | nginx مسیر API ادمین را به Next.js می‌دهد | نسخه‌ی به‌روز را pull کنید (API حالا `/adminapi/` است) |
| `/health` خطای ۴۰۴ می‌دهد | مسیر در nginx تعریف نشده | نسخه‌ی به‌روز را pull کنید |
| `cannot stat cloudflare-realip.conf` | کد سرور قدیمی است | `cd /opt/nard && git pull` |

---

## چک‌لیست قبل از اینکه به کسی لینک بدهید

- [ ] `NARD_DEV_CODE=0` و سرویس ری‌استارت شده
- [ ] `NARD_SECRET` مقدار تصادفی گرفته (پیش‌فرض نمانده)
- [ ] SSL کلادفلر روی **Full (strict)**
- [ ] `cloudflare-realip.conf` نصب و IP کاربرها در دیتابیس واقعی است
- [ ] ادمین ساخته شده و TOTP در گوشی ذخیره شده
- [ ] `https://farhadtest.ir/admin` در `robots.txt` مسدود است
- [ ] پشتیبان‌گیری خودکار در crontab
- [ ] مجوز فایل `.env` روی ۶۰۰ و مالک `nard`
