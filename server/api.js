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

function json(res, obj, status) {
  // دیتابیس دلیل خطا را در reason می‌گذارد؛ کلاینت message می‌خواند
  if (obj && obj.ok === false && obj.reason && !obj.message) obj.message = obj.reason;
  const body = JSON.stringify(obj);
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
    phone: u.phone,
    telegramId: u.telegram_id,
    isGuest: !!u.is_guest,
    coins: u.coins,
    energy: u.energy,
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
  codeLen: 5,
  ttlMs: 2 * 60 * 1000,
  resendMs: 60 * 1000,
  maxTries: 5,
  devReturnCode: process.env.NARD_DEV_CODE !== '0'
};

const otps = new Map();     // phone -> {code, exp, tries}
const smsRate = new Map();  // phone -> آخرین ارسال

function normalizePhone(raw) {
  let s = String(raw || '')
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/\D/g, '');
  if (s.startsWith('0098')) s = '0' + s.slice(4);
  else if (s.startsWith('98') && s.length === 12) s = '0' + s.slice(2);
  else if (s.length === 10 && s[0] === '9') s = '0' + s;
  return /^09\d{9}$/.test(s) ? s : null;
}

/**
 * ارسال پیامک — سرویس پیامک خودتان را اینجا وصل کنید.
 *
 * نمونه‌ی کاوه‌نگار:
 *   const url = `https://api.kavenegar.com/v1/${KEY}/verify/lookup.json` +
 *               `?receptor=${phone}&token=${code}&template=nard-login`;
 *   const r = await fetch(url);
 *   return r.ok;
 */
async function sendSms(phone, code) {
  console.log(`[sms] کد ورود ${phone}: ${code}`);
  return true;
}

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
      rooms: C.ROOMS, packs: C.COIN_PACKS, prizes: C.PRIZES, skins: C.SKINS,
      settings: D.allSettings(),
      maintenance: !!D.setting('MAINTENANCE')
    }), true;
  }

  /* ------------------------------------------------ درخواست کد تأیید */

  if (path === '/auth/request' && req.method === 'POST') {
    if (tooFast('sms:' + ip, 10)) return json(res, { ok: false, message: 'درخواست‌های زیاد — کمی صبر کنید' }, 429), true;
    const body = await readBody(req);
    const phone = normalizePhone(body.phone);
    if (!phone) return json(res, { ok: false, message: 'شماره‌ی موبایل درست نیست' }), true;

    const last = smsRate.get(phone) || 0;
    if (Date.now() - last < AUTH.resendMs) {
      const wait = Math.ceil((AUTH.resendMs - (Date.now() - last)) / 1000);
      return json(res, { ok: false, message: `تا ${wait} ثانیه‌ی دیگر نمی‌توانید کد جدید بگیرید`, resendIn: wait }), true;
    }

    const code = String(crypto.randomInt(10000, 100000));
    otps.set(phone, { code, exp: Date.now() + AUTH.ttlMs, tries: 0 });
    smsRate.set(phone, Date.now());
    await sendSms(phone, code);

    return json(res, {
      ok: true, ttl: AUTH.ttlMs, resendIn: AUTH.resendMs / 1000,
      devCode: AUTH.devReturnCode ? code : undefined
    }), true;
  }

  /* -------------------------------------------------- بررسی کد تأیید */

  if (path === '/auth/verify' && req.method === 'POST') {
    if (tooFast('otp:' + ip, 20)) return json(res, { ok: false, message: 'تلاش‌های زیاد' }, 429), true;
    const body = await readBody(req);
    const phone = normalizePhone(body.phone);
    const code = String(body.code || '').replace(/\D/g, '');
    if (!phone) return json(res, { ok: false, message: 'شماره‌ی موبایل درست نیست' }), true;

    const rec = otps.get(phone);
    if (!rec) return json(res, { ok: false, message: 'ابتدا کد را درخواست کنید' }), true;
    if (Date.now() > rec.exp) { otps.delete(phone); return json(res, { ok: false, message: 'کد منقضی شده' }), true; }
    if (++rec.tries > AUTH.maxTries) { otps.delete(phone); return json(res, { ok: false, message: 'تعداد تلاش زیاد' }), true; }
    if (rec.code !== code) return json(res, { ok: false, message: 'کد وارد شده درست نیست' }), true;
    otps.delete(phone);

    // اگر کاربر مهمان وارد بود، شماره را به همان حساب وصل کن تا سکه‌هایش نپرد
    const existingToken = bearer(req) || body.token;
    const current = existingToken ? D.userByToken(existingToken) : null;

    let user = D.getUserByPhone(phone);
    let isNew = false;

    if (user) {
      // شماره قبلاً حساب دارد → وارد همان می‌شویم
    } else if (current && current.is_guest && !current.phone) {
      const at = D.attachPhone(current.id, phone);
      if (!at.ok) return json(res, { ok: false, message: at.reason }), true;
      user = at.user;
    } else {
      user = D.createUser({ phone, isGuest: 0, ip });
      isNew = true;
    }

    if (user.banned) return json(res, { ok: false, message: 'این حساب مسدود است: ' + (user.ban_reason || '') }), true;

    D.touchUser(user.id, ip);
    D.checkMultiAccount(ip);
    const token = D.createSession(user.id, body.source || 'web', ip);
    return json(res, { ok: true, token, isNew, profile: publicProfile(D.getUser(user.id)) }), true;
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
    if (!user) {
      const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').slice(0, 20)
        || tgUser.username || 'بازیکن';
      user = D.createUser({ telegramId: String(tgUser.id), name, isGuest: 0, ip });
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
  const done = (r) => json(res, r.ok ? { ...r, profile: publicProfile(D.getUser(me.id)) } : r);

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

    /* ------------------------------------------------------ فروشگاه */

    case '/api/purchase/start': {
      const pack = C.packById(body.packId);
      if (!pack) return json(res, { ok: false, message: 'بسته یافت نشد' }), true;
      const id = D.createPurchase(me.id, { id: pack.id, coins: C.packTotal(pack), price: pack.price });
      // اینجا باید درگاه واقعی صدا زده شود و paymentUrl برگردد.
      return json(res, {
        ok: true, purchaseId: id, price: pack.price, coins: C.packTotal(pack),
        demo: !process.env.NARD_GATEWAY,
        message: process.env.NARD_GATEWAY ? undefined : 'درگاه پرداخت تنظیم نشده — حالت نمایشی'
      }), true;
    }

    case '/api/purchase/complete': {
      // ⚠️ در نسخه‌ی واقعی این مسیر فقط باید از سمت درگاه (callback) صدا زده شود،
      //    نه از اپ. تا وقتی NARD_GATEWAY تنظیم نشده، حالت نمایشی است.
      if (process.env.NARD_GATEWAY) {
        return json(res, { ok: false, message: 'تسویه فقط از طریق درگاه انجام می‌شود' }, 403), true;
      }
      return done(D.completePurchase(body.purchaseId, 'DEMO' + Date.now().toString(36).toUpperCase(), 'demo')), true;
    }

    case '/api/sell':
      return done(D.requestSell(me.id, body.amount, body.dest)), true;

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
  normalizePhone, verifyTelegramInitData, sendSms, AUTH, tooFast
};
