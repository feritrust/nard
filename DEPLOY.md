# 🚀 راهنمای انتشار روی سرور

از صفر تا سایت زنده. اگر قبلاً سرور راه انداخته‌اید، مستقیم بروید سراغ [نصب](#۳-نصب).

---

## فهرست

- [۰. قبل از هر چیز](#۰-قبل-از-هر-چیز)
- [۱. انتخاب سرور](#۱-انتخاب-سرور)
- [۲. آماده‌سازی سرور](#۲-آماده‌سازی-سرور)
- [۳. نصب](#۳-نصب)
- [۴. تنظیمات و اولین ادمین](#۴-تنظیمات-و-اولین-ادمین)
- [۵. دامنه، nginx و SSL](#۵-دامنه-nginx-و-ssl)
- [۶. پشتیبان‌گیری](#۶-پشتیبان‌گیری)
- [۷. به‌روزرسانی نسخه](#۷-به‌روزرسانی-نسخه)
- [چک‌لیست قبل از باز کردن به روی کاربران](#چک‌لیست-قبل-از-باز-کردن-به-روی-کاربران)
- [عیب‌یابی](#عیب‌یابی)

---

## ۰. قبل از هر چیز

### ⚠️ درباره‌ی Vercel

قبلاً گفتم پنل را می‌شود روی Vercel گذاشت. یک نکته‌ی مهم که باید بدانید:

**Vercel و بیشتر هاست‌های آمریکایی، IP ایران را مسدود می‌کنند.** یعنی اگر سایت
را آنجا بگذارید، کاربران ایرانی بدون فیلترشکن نمی‌توانند بازی کنند — و این
برای اپ فارسی یعنی شکست.

پس توصیه‌ی درست: **همه‌چیز روی یک سرور ایرانی**. معماری پروژه هم همین را
پشتیبانی می‌کند؛ هر دو سرویس روی یک ماشین بالا می‌آیند و nginx جلویشان می‌نشیند.

### قوانین

پیش از باز کردن بخش **فروش سکه** (تبدیل سکه به تومان) با یک وکیل مشورت کنید.
بازی با سکه معمولاً مشکلی ندارد، ولی *برگرداندن سکه به پول* همان چیزی است که
می‌تواند قمار تلقی شود. تا آن زمان می‌توانید فقط بخش خرید و جایزه را فعال بگذارید.

---

## ۱. انتخاب سرور

برای شروع کافی است:

| مشخصه | حداقل | راحت |
|---|---|---|
| RAM | ۱ گیگابایت | ۲ گیگابایت |
| CPU | ۱ هسته | ۲ هسته |
| دیسک | ۲۰ گیگابایت | ۴۰ گیگابایت |
| سیستم‌عامل | اوبونتو ۲۲.۰۴ یا ۲۴.۰۴ | همان |

این پروژه سبک است: سرور بازی چند ده مگابایت رم می‌گیرد و SQLite روی دیسک است.
با ۲ گیگابایت رم راحت چند هزار کاربر همزمان را جواب می‌دهد.

**ارائه‌دهنده‌های ایرانی:** ابر آروان، پارس‌پک، ایران‌سرور، مبین‌هاست و مشابه.
هرکدام را گرفتید، یک IP ثابت (IPv4) بگیرید.

---

## ۲. آماده‌سازی سرور

اولین ورود با SSH:

```bash
ssh root@<IP سرور>
```

### کاربر غیر روت بسازید

```bash
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

از این به بعد با `ssh deploy@<IP>` وارد شوید.

### به‌روزرسانی و فایروال

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nginx sqlite3 ufw

sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

> پورت‌های ۸۰۸۰ و ۳۰۰۰ را **باز نکنید**. فقط nginx از بیرون در دسترس باشد و
> خودش به آن‌ها وصل شود.

### ورود با کلید به‌جای رمز (توصیه‌ی جدی)

روی کامپیوتر خودتان:

```bash
ssh-keygen -t ed25519 -C "deploy@nard"
ssh-copy-id deploy@<IP>
```

بعد روی سرور در `/etc/ssh/sshd_config` این دو خط را بگذارید و `sudo systemctl restart ssh`:

```
PasswordAuthentication no
PermitRootLogin no
```

---

## ۳. نصب

```bash
sudo mkdir -p /opt/nard
sudo chown deploy:deploy /opt/nard
git clone https://github.com/<نام‌کاربری>/nard.git /opt/nard
cd /opt/nard
sudo bash deploy/setup.sh
```

اسکریپت `setup.sh` این کارها را می‌کند:

1. Node.js نسخه ۲۲ را نصب می‌کند (اگر نباشد)
2. کاربر سیستمی `nard` می‌سازد
3. وابستگی‌های سایت را نصب و build می‌کند
4. دو سرویس systemd را نصب و روشن می‌کند

### اگر ترجیح می‌دهید دستی انجام دهید

```bash
# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs

# سایت
cd /opt/nard/web
npm install
npm run build

# سرویس‌ها
sudo cp /opt/nard/deploy/nard-server.service /etc/systemd/system/
sudo cp /opt/nard/deploy/nard-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nard-server nard-web
```

بررسی:

```bash
systemctl status nard-server nard-web
curl -s localhost:8080/health
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000
```

---

## ۴. تنظیمات و اولین ادمین

### فایل `.env` سرور بازی

```bash
cd /opt/nard/server
cp .env.example .env
nano .env
```

حتماً این دو را پر کنید:

```ini
# ⚠️ مهم‌ترین خط این فایل.
# اگر ۱ بماند، کد تأیید پیامک در پاسخ سرور برمی‌گردد و
# هر کسی می‌تواند با هر شماره‌ای وارد شود.
NARD_DEV_CODE=0

# اگر خالی بماند، با هر ری‌استارت همه‌ی کاربران بیرون می‌افتند.
NARD_SECRET=<خروجی دستور زیر>
```

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### فایل محیطی سایت

```bash
cd /opt/nard/web
cat > .env.production <<'EOF'
NEXT_PUBLIC_SITE_URL=https://nard.example.com
NEXT_PUBLIC_API_URL=https://nard.example.com
EOF
npm run build          # بعد از تغییر متغیرها باید دوباره build شود
sudo systemctl restart nard-web
```

### اولین ادمین

```bash
cd /opt/nard/server
sudo -u nard node create-admin.js owner '<یک رمز قوی>' owner
```

یک نشانی `otpauth://...` می‌دهد. آن را در **Google Authenticator** وارد کنید.
بار اول که وارد پنل شوید، از شما می‌خواهد کد دو مرحله‌ای را فعال کنید — حتماً فعال کنید.

```bash
sudo systemctl restart nard-server
```

---

## ۵. دامنه، nginx و SSL

### DNS

در پنل دامنه، یک رکورد A بسازید:

```
nard.example.com   A   <IP سرور>
```

چند دقیقه تا چند ساعت طول می‌کشد. با `dig nard.example.com +short` بررسی کنید.

### nginx

```bash
sudo cp /opt/nard/deploy/nginx-nard.conf /etc/nginx/sites-available/nard
sudo nano /etc/nginx/sites-available/nard      # nard.example.com را عوض کنید

# اگر proxy_params ندارید
sudo cp /opt/nard/deploy/proxy_params /etc/nginx/proxy_params

sudo ln -sf /etc/nginx/sites-available/nard /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### SSL رایگان

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d nard.example.com
```

تمدید خودکار است. برای اطمینان: `sudo certbot renew --dry-run`

### وصل کردن بازی به وب‌سوکت

بعد از SSL، نشانی وب‌سوکت می‌شود `wss://nard.example.com`. چون خود سرور بازی
فایل‌های اپ را سرو می‌کند، اپ به‌طور خودکار به همان دامنه وصل می‌شود و کاری لازم نیست.

برای **اپ اندروید** در `android/app/src/main/java/com/nard/pro/MainActivity.kt`:

```kotlin
private val defaultServerUrl = "wss://nard.example.com"
```

---

## ۶. پشتیبان‌گیری

دیتابیس یک فایل است، ولی چون در حالت WAL کار می‌کند **کپی ساده امن نیست**.
اسکریپت آماده این را درست انجام می‌دهد:

```bash
sudo mkdir -p /opt/nard/backups
sudo chown nard:nard /opt/nard/backups
sudo -u nard /opt/nard/deploy/backup.sh
```

خودکار کردن (هر ۶ ساعت):

```bash
sudo crontab -e
```

```cron
0 */6 * * * sudo -u nard /opt/nard/deploy/backup.sh >> /var/log/nard-backup.log 2>&1
```

### بیرون بردن پشتیبان از سرور

پشتیبانی که روی همان سرور بماند، در برابر خراب شدن سرور بی‌فایده است.
روی کامپیوتر خودتان:

```bash
rsync -avz deploy@<IP>:/opt/nard/backups/ ~/nard-backups/
```

### بازگرداندن

```bash
sudo systemctl stop nard-server
gunzip -c /opt/nard/backups/nard-20260929-120000.db.gz > /opt/nard/server/data/nard.db
sudo chown nard:nard /opt/nard/server/data/nard.db
sudo systemctl start nard-server
```

---

## ۷. به‌روزرسانی نسخه

```bash
cd /opt/nard
sudo -u nard /opt/nard/deploy/backup.sh     # اول پشتیبان
git pull
cd web && npm install && npm run build
sudo systemctl restart nard-server nard-web
```

دیتابیس دست‌نخورده می‌ماند؛ جدول‌ها با `CREATE TABLE IF NOT EXISTS` ساخته می‌شوند.

---

## چک‌لیست قبل از باز کردن به روی کاربران

- [ ] `NARD_DEV_CODE=0` در `server/.env` — **بدون این، هر کسی با هر شماره‌ای وارد می‌شود**
- [ ] `NARD_SECRET` یک رشته‌ی تصادفی بلند است
- [ ] سرویس پیامک واقعی وصل شده (`sendSms` در `server/api.js`)
- [ ] کد دو مرحله‌ای ادمین فعال است
- [ ] رمز ادمین حداقل ۱۲ کاراکتر و جایی امن ذخیره شده
- [ ] SSL کار می‌کند و `http` به `https` ریدایرکت می‌شود
- [ ] پورت‌های ۸۰۸۰ و ۳۰۰۰ از بیرون بسته‌اند (`sudo ufw status`)
- [ ] پشتیبان‌گیری خودکار تنظیم شده و یک‌بار دستی تست شده
- [ ] یک نسخه‌ی پشتیبان بیرون از سرور دارید
- [ ] `https://nard.example.com/admin` در گوگل ایندکس نمی‌شود (`robots.txt` را چک کنید)
- [ ] ورود، بازی، خرید و درخواست فروش را یک‌بار خودتان تست کرده‌اید
- [ ] تکلیف حقوقی بخش فروش سکه روشن است

---

## عیب‌یابی

### سرویس بالا نمی‌آید

```bash
journalctl -u nard-server -n 50 --no-pager
journalctl -u nard-web -n 50 --no-pager
```

### خطای «سکه کافی نیست» با وجود موجودی

یعنی اپ از سرور دیگری موجودی می‌گیرد. در تنظیمات اپ نشانی سرور را چک کنید،
یا `localStorage` مرورگر را پاک کنید.

### وب‌سوکت وصل نمی‌شود

معمولاً nginx هدرهای upgrade را رد نمی‌کند. مطمئن شوید بلوک `location /ws`
سه خط `proxy_set_header Upgrade / Connection / proxy_http_version 1.1` را دارد.

### دیتابیس قفل شده

```bash
sudo systemctl stop nard-server
sqlite3 /opt/nard/server/data/nard.db "PRAGMA integrity_check;"
sudo systemctl start nard-server
```

### مصرف دیسک زیاد شد

معمولاً پشتیبان‌های قدیمی‌اند:

```bash
du -sh /opt/nard/backups
find /opt/nard/backups -name '*.gz' -mtime +30 -delete
```

### فراموش کردن رمز ادمین

ادمین جدید بسازید و قبلی را از دیتابیس پاک کنید:

```bash
cd /opt/nard/server
sudo -u nard node create-admin.js owner2 '<رمز جدید>' owner
sqlite3 data/nard.db "DELETE FROM admins WHERE username='owner';"
```
