/* =========================================================================
 *  api.js — API بازیکن‌ها (REST روی همان پورت سرور بازی)
 *
 *  همه‌چیز اینجا سمت سرور تصمیم گرفته می‌شود: موجودی، خرید، جایزه، پوسته.
 *  کلاینت فقط نمایش می‌دهد و درخواست می‌فرستد.
 * ========================================================================= */
'use strict';

const crypto = require('crypto');
const D = require('./db.js');
const C = require('./config.js');

/* ------------------------------------------------------------ ابزارها */

/* ⚠️ کلیدهایی که هرگز نباید از سرور بیرون بروند.
 *
 * چند تابع دیتابیس برای راحتی، ردیف کامل کاربر را برمی‌گردانند
 * (مثلاً claimWelcome). اگر کسی یادش برود آن را حذف کند، هش رمز و
 * کد بازیابی مستقیم به مرورگر می‌رسد. به‌جای اعتماد به یادآوری،
 * همین‌جا در تنها دروازه‌ی خروجی پاکشان می‌کنیم. */
const SECRET_KEYS = new Set([
  'pass_hash', 'pass_salt', 'recovery_hash', 'totp_secret',
  'passHash', 'passSalt', 'recoveryHash', 'totpSecret'
]);

function scrub(value, depth = 0) {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SECRET_KEYS.has(k)) continue;
    out[k] = scrub(v, depth + 1);
  }
  return out;
}

function json(res, obj, status) {
  // دیتابیس دلیل خطا را در reason می‌گذارد؛ کلاینت message می‌خواند
  if (obj && obj.ok === false && obj.reason && !obj.message) obj.message = obj.reason;
  const body = JSON.stringify(scrub(obj));
  res.writeHead(status || 200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req, limit = 16384) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > limit) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

/**
 * IP واقعیِ بازیکن.
 *
 * ⚠️ چرا مهم است: تشخیص تقلب (چند حساب از یک IP) و پاداش دعوت دوستان روی
 * همین مقدار حساب می‌کنند. اگر پشت کلادفلر یا هر CDN دیگری این را درست
 * نخوانیم، **همه‌ی کاربرها یک IP دیده می‌شوند** و هم دعوت‌های واقعی رد
 * می‌شوند و هم پرچم مولتی‌اکانت الکی بالا می‌رود.
 *
 * ترتیب اعتماد:
 *   ۱) CF-Connecting-IP  — کلادفلر همیشه این را می‌گذارد و کاربر نمی‌تواند جعلش کند
 *   ۲) X-Forwarded-For   — اولین مقدار (nginx خودمان)
 *   ۳) سوکت              — وقتی بدون پراکسی اجرا می‌شود
 *
 * امن است چون سرور بازی فقط روی 127.0.0.1 گوش می‌دهد و تنها nginx به آن
 * وصل می‌شود؛ کسی از بیرون نمی‌تواند این هدرها را مستقیم بفرستد.
 * اگر روزی سرور را مستقیم در معرض اینترنت گذاشتید، NARD_TRUST_PROXY=0 بگذارید.
 */
const TRUST_PROXY = process.env.NARD_TRUST_PROXY !== '0';

function clientIp(req) {
  if (TRUST_PROXY) {
    const cf = req.headers['cf-connecting-ip'];
    if (cf) return String(cf).trim();
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return String(fwd).split(',')[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || null;
}

function bearer(req) {
  const h = req.headers['authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

/** پروفایلی که به کلاینت می‌دهیم — فقط چیزهایی که باید ببیند */
function publicProfile(u) {
  if (!u) return null;
  const lvl = D.levelOf(u.xp);
  return {
    id: u.id,
    name: u.name,
    avatar: u.avatar,
    username: u.username,
    telegramId: u.telegram_id,
    telegramLinked: !!u.telegram_id,
    hasRecovery: !!u.recovery_hash && !u.recovery_used,
    isGuest: !!u.is_guest,
    coins: u.coins,
    energy: u.energy,
    balance: u.balance || 0,          // میکرو-تتر
    balanceUsdt: D.fmtUsdt(u.balance || 0),
    xp: u.xp,
    level: lvl.level,
    levelXp: lvl.xp,
    levelNeed: lvl.need,
    skin: u.skin,
    skins: JSON.parse(u.skins || '["classic"]'),
    inventory: JSON.parse(u.inventory || '[]'),
    referralCode: u.referral_code,
    referredBy: u.referred_by,
    invitedCount: u.invited_count,
    welcomeTaken: !!u.welcome_taken,
    dailyAvailable: D.dailyAvailable(u),
    banned: !!u.banned,
    banReason: u.ban_reason,
    stats: {
      games: u.games, wins: u.wins, losses: u.losses, mars: u.mars,
      bestWin: u.best_win, coinsWon: u.coins_won, coinsLost: u.coins_lost
    }
  };
}

/* ------------------------------------------------- محدودیت نرخ درخواست */

const rate = new Map();
function tooFast(key, maxPerMin) {
  const t = Date.now();
  const win = 60000;
  let arr = rate.get(key);
  if (!arr) { arr = []; rate.set(key, arr); }
  while (arr.length && arr[0] < t - win) arr.shift();
  if (arr.length >= maxPerMin) return true;
  arr.push(t);
  return false;
}
setInterval(() => {
  const cut = Date.now() - 120000;
  for (const [k, arr] of rate) { if (!arr.length || arr[arr.length - 1] < cut) rate.delete(k); }
}, 60000).unref();

/* ========================================================================
 *  ورود با شماره موبایل
 * ===================================================================== */

const AUTH = {
  /* در نسخه‌ی قبلی این مقدار تعیین می‌کرد کد پیامک در پاسخ برگردد یا نه.
   * حالا ورود با نام کاربری و رمز است و چنین دری وجود ندارد. */
  loginMaxPerMin: 10,
  signupMaxPerHour: 5
};

/* ضد brute-force روی نام کاربری، جدا از محدودیت IP */
const loginFails = new Map();   // username -> {n, until}

function loginLocked(uname) {
  const r = loginFails.get(uname);
  if (!r) return 0;
  if (r.until < Date.now()) { loginFails.delete(uname); return 0; }
  return Math.ceil((r.until - Date.now()) / 1000);
}
function noteLoginFail(uname) {
  const r = loginFails.get(uname) || { n: 0, until: 0 };
  r.n++;
  // بعد از ۵ تلاش ناموفق، قفل پله‌ای: ۱، ۲، ۴، ۸… دقیقه (حداکثر ۳۰)
  if (r.n >= 5) {
    const mins = Math.min(30, Math.pow(2, r.n - 5));
    r.until = Date.now() + mins * 60000;
  }
  loginFails.set(uname, r);
}
function clearLoginFails(uname) { loginFails.delete(uname); }

setInterval(() => {
  const t = Date.now();
  for (const [k, v] of loginFails) if (v.until && v.until < t - 3600000) loginFails.delete(k);
}, 600000).unref?.();

/* ========================================================================
 *  ورود از تلگرام (مینی‌اپ)
 * ===================================================================== */

/**
 * initData تلگرام را تأیید می‌کند. تلگرام داده را با توکن ربات امضا می‌کند،
 * پس اگر امضا درست باشد یعنی کاربر واقعاً همان کسی است که می‌گوید.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const pairs = [];
  for (const [k, v] of params) pairs.push(`${k}=${v}`);
  pairs.sort();
  const dataCheck = pairs.join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calc = crypto.createHmac('sha256', secret).update(dataCheck).digest('hex');
  if (calc.length !== hash.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;

  // داده نباید خیلی قدیمی باشد (جلوگیری از replay)
  const authDate = Number(params.get('auth_date') || 0) * 1000;
  if (!authDate || Date.now() - authDate > 24 * 3600 * 1000) return null;

  try { return JSON.parse(params.get('user') || 'null'); } catch (e) { return null; }
}

/* ========================================================================
 *  مسیرها
 * ===================================================================== */

/**
 * @returns true اگر این درخواست را ما پاسخ دادیم
 */
async function handle(req, res, url) {
  const ip = clientIp(req);
  const path = url.pathname;

  if (!path.startsWith('/api/') && !path.startsWith('/auth/')) return false;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return true;
  }

  /* --------------------------------------------------------- تنظیمات */

  if (path === '/api/config') {
    return json(res, {
      ok: true,
      rooms: C.ROOMS,
      // قیمت هر بسته از نرخ روز حساب می‌شود، نه از فایل config
      packs: C.COIN_PACKS.map((p) => ({
        ...p,
        total: C.packTotal(p),
        cost: p.coins * D.setting('BUY_RATE'),
        costUsdt: D.fmtUsdt(p.coins * D.setting('BUY_RATE'))
      })),
      prizes: C.PRIZES, skins: C.SKINS,
      settings: D.allSettings(),
      maintenance: !!D.setting('MAINTENANCE')
    }), true;
  }

  /* ========================================================================
   *  ثبت‌نام و ورود با نام کاربری و رمز
   * ===================================================================== */

  if (path === '/auth/register' && req.method === 'POST') {
    if (tooFast('signup:' + ip, AUTH.signupMaxPerHour)) {
      return json(res, { ok: false, message: 'ثبت‌نام‌های زیاد از این شبکه — کمی صبر کنید' }, 429), true;
    }
    const body = await readBody(req);

    /* اگر با حساب مهمان وارد است، همان حساب ارتقا می‌یابد تا
     * سکه‌ها و تاریخچه‌اش از بین نرود. */
    const cur = D.userByToken(bearer(req) || body.token);
    const upgrade = cur && cur.is_guest && !cur.username ? cur.id : null;

    const r = D.register({
      username: body.username,
      password: body.password,
      name: body.name,
      avatar: body.avatar,
      ip,
      userId: upgrade
    });
    if (!r.ok) return json(res, r), true;

    D.checkMultiAccount(ip);
    const token = D.createSession(r.user.id, body.source || 'web', ip);
    return json(res, {
      ok: true, token, isNew: !upgrade,
      // ⚠️ کد بازیابی فقط همین یک بار برمی‌گردد
      recovery: r.recovery,
      profile: publicProfile(D.getUser(r.user.id))
    }), true;
  }

  if (path === '/auth/login' && req.method === 'POST') {
    if (tooFast('login:' + ip, AUTH.loginMaxPerMin)) {
      return json(res, { ok: false, message: 'تلاش‌های زیاد — کمی صبر کنید' }, 429), true;
    }
    const body = await readBody(req);
    const uname = D.normUsername(body.username);

    const wait = loginLocked(uname);
    if (wait) {
      return json(res, { ok: false, message: `تلاش‌های ناموفق زیاد — ${wait} ثانیه صبر کنید` }, 429), true;
    }

    const r = D.login(uname, body.password);
    if (!r.ok) { noteLoginFail(uname); return json(res, r), true; }
    clearLoginFails(uname);

    D.touchUser(r.user.id, ip);
    D.checkMultiAccount(ip);
    const token = D.createSession(r.user.id, body.source || 'web', ip);
    return json(res, { ok: true, token, profile: publicProfile(D.getUser(r.user.id)) }), true;
  }

  /* بازیابی با کد یک‌بارمصرف */
  if (path === '/auth/recover' && req.method === 'POST') {
    if (tooFast('recover:' + ip, 5)) {
      return json(res, { ok: false, message: 'تلاش‌های زیاد — کمی صبر کنید' }, 429), true;
    }
    const body = await readBody(req);
    const r = D.recoverWithCode(body.username, body.code, body.password);
    if (!r.ok) return json(res, r), true;

    const token = D.createSession(r.user.id, 'web', ip);
    return json(res, {
      ok: true, token,
      recovery: r.recovery,        // کد تازه — کد قبلی دیگر کار نمی‌کند
      profile: publicProfile(D.getUser(r.user.id))
    }), true;
  }

  /* آیا این نام کاربری آزاد است؟ برای بازخورد زنده‌ی فرم ثبت‌نام */
  if (path === '/auth/check-username') {
    const want = url.searchParams.get('u') || '';
    const problem = D.usernameProblem(want);
    if (problem) return json(res, { ok: true, available: false, message: problem }), true;
    const taken = !!D.getUserByUsername(want);
    return json(res, {
      ok: true, available: !taken,
      message: taken ? 'این نام کاربری گرفته شده است' : 'آزاد است'
    }), true;
  }

  /* ------------------------------------------------------ ورود تلگرام */

  if (path === '/auth/telegram' && req.method === 'POST') {
    const body = await readBody(req);
    const botToken = process.env.NARD_BOT_TOKEN || '';
    if (!botToken) return json(res, { ok: false, message: 'ورود تلگرام روی سرور فعال نشده است' }), true;

    const tgUser = verifyTelegramInitData(body.initData, botToken);
    if (!tgUser || !tgUser.id) return json(res, { ok: false, message: 'داده‌ی تلگرام معتبر نیست' }, 401), true;

    let user = D.getUserByTelegram(tgUser.id);
    let isNew = false;

    /* اگر کاربر همین حالا با حساب وبش وارد است و آن حساب هنوز تلگرام
     * ندارد، همان را وصل می‌کنیم — تا دو حساب جدا با دو کیف پول نسازد. */
    if (!user) {
      const cur = D.userByToken(bearer(req) || body.token);
      if (cur && !cur.telegram_id && !cur.banned) {
        const at = D.attachTelegram(cur.id, tgUser.id);
        if (at.ok) user = at.user;
      }
    }

    if (!user) {
      const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').slice(0, 20)
        || tgUser.username || 'بازیکن';
      user = D.createUser({ telegramId: String(tgUser.id), name, isGuest: 1, ip });
      isNew = true;
    }
    if (user.banned) return json(res, { ok: false, message: 'این حساب مسدود است' }), true;

    D.touchUser(user.id, ip);
    const token = D.createSession(user.id, 'telegram', ip);
    return json(res, { ok: true, token, isNew, profile: publicProfile(D.getUser(user.id)) }), true;
  }

  /* -------------------------------------------------------- ورود مهمان */

  if (path === '/auth/guest' && req.method === 'POST') {
    if (tooFast('guest:' + ip, 5)) return json(res, { ok: false, message: 'درخواست‌های زیاد' }, 429), true;
    const body = await readBody(req);
    const user = D.createUser({
      name: String(body.name || '').slice(0, 20),
      avatar: String(body.avatar || '🦁').slice(0, 8),
      isGuest: 1, ip
    });
    D.checkMultiAccount(ip);
    const token = D.createSession(user.id, 'guest', ip);
    return json(res, { ok: true, token, profile: publicProfile(user) }), true;
  }

  /* ================================================================ */
  /*  از اینجا به بعد، همه‌ی مسیرها نیاز به ورود دارند                */
  /* ================================================================ */

  const token = bearer(req);
  const me = D.userByToken(token);

  if (path === '/api/me') {
    if (!me) return json(res, { ok: false, message: 'وارد نشده‌اید' }, 401), true;
    D.touchUser(me.id, ip);
    return json(res, { ok: true, profile: publicProfile(D.getUser(me.id)) }), true;
  }

  if (!me) return json(res, { ok: false, message: 'وارد نشده‌اید' }, 401), true;
  if (me.banned) return json(res, { ok: false, message: 'حساب شما مسدود است: ' + (me.ban_reason || '') }, 403), true;
  if (D.setting('MAINTENANCE') && path !== '/api/logout') {
    return json(res, { ok: false, message: 'بازی موقتاً در حال به‌روزرسانی است' }, 503), true;
  }

  const body = req.method === 'POST' ? await readBody(req) : {};
  /* profile همان چیزی است که کلاینت لازم دارد؛ ردیف خام user را
   * دور می‌ریزیم تا ستون‌های داخلی بی‌دلیل بیرون نروند. */
  const done = (r) => {
    if (!r.ok) return json(res, r);
    const { user, ...rest } = r;
    return json(res, { ...rest, profile: publicProfile(D.getUser(me.id)) });
  };

  switch (path) {
    case '/api/logout':
      D.dropSession(token);
      return json(res, { ok: true }), true;

    case '/api/profile':
      D.updateProfile(me.id, { name: body.name, avatar: body.avatar });
      return done({ ok: true }), true;

    case '/api/welcome':
      return done(D.claimWelcome(me.id)), true;

    case '/api/daily':
      return done(D.claimDaily(me.id)), true;

    case '/api/referral':
      return done(D.applyReferral(me.id, body.code)), true;

    case '/api/transactions':
      return json(res, {
        ok: true,
        rows: D.listTransactions(me.id, Math.min(100, Number(url.searchParams.get('limit')) || 40))
      }), true;

    case '/api/claims':
      return json(res, {
        ok: true,
        rows: D.db.prepare('SELECT id, kind, status, amount, toman, prize_name, created_at FROM claims WHERE user_id = ? ORDER BY created_at DESC LIMIT 30').all(me.id)
      }), true;

    /* ================================================================
     *  کیف پول تتری
     * ============================================================= */

    /* آدرس واریز و نرخ‌های روز */
    case '/api/wallet': {
      const d = D.listDeposits({ userId: me.id, limit: 20 });
      const w = D.listWithdrawals({ userId: me.id, limit: 20 });
      return json(res, {
        ok: true,
        balance: me.balance || 0,
        balanceUsdt: D.fmtUsdt(me.balance || 0),
        rates: {
          buy: D.setting('BUY_RATE'),          // میکرو-تتر برای هر سکه
          sell: D.setting('SELL_RATE'),
          buyMin: D.setting('BUY_MIN'),
          sellMin: D.setting('SELL_MIN'),
          depositMin: D.setting('DEPOSIT_MIN'),
          withdrawMin: D.setting('WITHDRAW_MIN'),
          withdrawFee: D.setting('WITHDRAW_FEE')
        },
        addresses: {
          TRC20: D.setting('DEPOSIT_ADDRESS_TRC20') || '',
          BEP20: D.setting('DEPOSIT_ADDRESS_BEP20') || ''
        },
        deposits: d.rows.map((r) => ({
          id: r.id, network: r.network, amount: r.amount, credited: r.credited,
          status: r.status, txid: r.txid, createdAt: r.created_at, note: r.admin_note
        })),
        withdrawals: w.rows.map((r) => ({
          id: r.id, network: r.network, amount: r.amount, fee: r.fee, payout: r.payout,
          address: r.address, status: r.status, txid: r.txid,
          createdAt: r.created_at, note: r.admin_note
        }))
      }), true;
    }

    /* خرید سکه از بالانس — فوری */
    case '/api/coins/buy': {
      if (body.packId) {
        const pack = C.packById(body.packId);
        if (!pack) return json(res, { ok: false, message: 'بسته یافت نشد' }), true;
        return done(D.buyPack(me.id, pack)), true;
      }
      return done(D.buyCoins(me.id, body.coins)), true;
    }

    /* فروش سکه به بالانس — فوری */
    case '/api/coins/sell':
      return done(D.sellCoins(me.id, body.coins)), true;

    /* ثبت واریز تتر؛ ادمین تأیید می‌کند */
    case '/api/deposit': {
      if (tooFast('dep:' + me.id, 5)) {
        return json(res, { ok: false, message: 'درخواست‌های زیاد — کمی صبر کنید' }, 429), true;
      }
      const r = D.requestDeposit(me.id, {
        amount: body.amount, txid: body.txid, network: body.network
      });
      return json(res, r.ok ? { ...r, message: 'ثبت شد — بعد از تأیید به بالانس اضافه می‌شود' } : r), true;
    }

    /* استفاده از کد وچر — فوری */
    case '/api/voucher': {
      if (tooFast('vouch:' + me.id, 10)) {
        return json(res, { ok: false, message: 'تلاش‌های زیاد — کمی صبر کنید' }, 429), true;
      }
      return done(D.redeemVoucher(me.id, body.code)), true;
    }

    /* درخواست برداشت تتر */
    case '/api/withdraw': {
      if (tooFast('wd:' + me.id, 3)) {
        return json(res, { ok: false, message: 'درخواست‌های زیاد — کمی صبر کنید' }, 429), true;
      }
      const r = D.requestWithdraw(me.id, {
        amount: body.amount, address: body.address, network: body.network
      });
      return json(res, r.ok
        ? { ...r, message: 'ثبت شد — بعد از بررسی واریز می‌شود', profile: publicProfile(D.getUser(me.id)) }
        : r), true;
    }

    /* ================================================================
     *  حساب کاربری
     * ============================================================= */

    case '/api/account/password':
      return json(res, D.changePassword(me.id, body.oldPassword, body.newPassword)), true;

    case '/api/account/recovery':
      return json(res, D.regenerateRecovery(me.id, body.password)), true;

    /* کد ۶ رقمی برای وصل کردن این حساب از دستگاه/تلگرام دیگر */
    case '/api/account/link-code':
      return json(res, D.createLinkCode(me.id)), true;

    /* این حساب را در حسابی که کد را داده ادغام کن */
    case '/api/account/link':
      return json(res, D.consumeLinkCode(body.code, me.id)), true;

    case '/api/account/unlink-telegram':
      return done(D.detachTelegram(me.id)), true;

    /* -------------------------------------------------------- جوایز */

    case '/api/prize': {
      const prize = C.prizeById(body.prizeId);
      if (!prize) return json(res, { ok: false, message: 'جایزه یافت نشد' }), true;
      return done(D.redeemPrize(me.id, prize, body.contact)), true;
    }

    /* ------------------------------------------------------ پوسته‌ها */

    case '/api/skin/buy': {
      const skin = C.skinById(body.skinId);
      if (!skin) return json(res, { ok: false, message: 'پوسته یافت نشد' }), true;
      return done(D.buySkin(me.id, skin)), true;
    }

    case '/api/skin/equip':
      return done(D.equipSkin(me.id, body.skinId)), true;
  }

  return json(res, { ok: false, message: 'مسیر یافت نشد' }, 404), true;
}

module.exports = {
  handle, json, readBody, clientIp, bearer, publicProfile,
  verifyTelegramInitData, AUTH, tooFast
};
