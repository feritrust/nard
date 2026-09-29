/* =========================================================================
 *  db.js — دیتابیس بازی (SQLite داخلی Node، بدون هیچ وابستگی خارجی)
 *
 *  همه‌ی پول بازی اینجاست. قاعده‌ی طلایی:
 *  هیچ‌جای دیگری اجازه ندارد مستقیم موجودی را دست بزند — فقط توابع این فایل.
 *  هر تغییر موجودی یک ردیف در جدول تراکنش‌ها ثبت می‌کند تا همه‌چیز قابل پیگیری باشد.
 * ========================================================================= */
'use strict';

const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.NARD_DATA || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'nard.db'));

/* WAL: خواندن و نوشتن همزمان بدون قفل شدن + دوام بیشتر */
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA synchronous = NORMAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

/* ========================================================================
 *  اسکیما
 * ===================================================================== */

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  phone         TEXT UNIQUE,              -- شماره‌ی تأییدشده (می‌تواند خالی باشد)
  telegram_id   TEXT UNIQUE,              -- شناسه‌ی تلگرام (برای مینی‌اپ)
  name          TEXT NOT NULL DEFAULT '',
  avatar        TEXT NOT NULL DEFAULT '🦁',
  coins         INTEGER NOT NULL DEFAULT 0,
  energy        INTEGER NOT NULL DEFAULT 0,
  xp            INTEGER NOT NULL DEFAULT 0,
  skin          TEXT NOT NULL DEFAULT 'classic',
  skins         TEXT NOT NULL DEFAULT '["classic"]',
  inventory     TEXT NOT NULL DEFAULT '[]',
  referral_code TEXT UNIQUE NOT NULL,
  referred_by   TEXT,                     -- کد معرفی که استفاده کرده
  invited_count INTEGER NOT NULL DEFAULT 0,
  welcome_taken INTEGER NOT NULL DEFAULT 0,
  last_daily    INTEGER NOT NULL DEFAULT 0,
  games         INTEGER NOT NULL DEFAULT 0,
  wins          INTEGER NOT NULL DEFAULT 0,
  losses        INTEGER NOT NULL DEFAULT 0,
  mars          INTEGER NOT NULL DEFAULT 0,
  best_win      INTEGER NOT NULL DEFAULT 0,
  coins_won     INTEGER NOT NULL DEFAULT 0,
  coins_lost    INTEGER NOT NULL DEFAULT 0,
  is_guest      INTEGER NOT NULL DEFAULT 1,
  banned        INTEGER NOT NULL DEFAULT 0,
  ban_reason    TEXT,
  note          TEXT,                     -- یادداشت ادمین
  created_at    INTEGER NOT NULL,
  last_seen     INTEGER NOT NULL,
  last_ip       TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_created  ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_coins    ON users(coins DESC);
CREATE INDEX IF NOT EXISTS idx_users_referred ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_ip       ON users(last_ip);

-- هر تغییر سکه یا انرژی، یک ردیف. هرگز حذف نمی‌شود.
CREATE TABLE IF NOT EXISTS transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL,              -- welcome/daily/stake/win/lose/purchase/sell/prize/skin/referral/admin
  coins       INTEGER NOT NULL DEFAULT 0,
  energy      INTEGER NOT NULL DEFAULT 0,
  coins_after INTEGER NOT NULL,
  energy_after INTEGER NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  ref         TEXT,                       -- شناسه‌ی بازی/خرید/درخواست مرتبط
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type, created_at DESC);

CREATE TABLE IF NOT EXISTS games (
  id         TEXT PRIMARY KEY,
  room_id    TEXT NOT NULL,
  entry      INTEGER NOT NULL,
  p1_id      TEXT,
  p2_id      TEXT,
  winner_id  TEXT,
  result     INTEGER NOT NULL DEFAULT 1,  -- ۱ تک، ۲ مارس، ۳ توله‌مارس
  rake       INTEGER NOT NULL DEFAULT 0,
  prize      INTEGER NOT NULL DEFAULT 0,
  vs_bot     INTEGER NOT NULL DEFAULT 0,
  end_reason TEXT,                        -- normal/resign/timeout/disconnect/left
  started_at INTEGER NOT NULL,
  ended_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_games_time ON games(ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_p1   ON games(p1_id, ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_p2   ON games(p2_id, ended_at DESC);

-- درخواست فروش سکه و جوایز واقعی که ادمین باید رسیدگی کند
CREATE TABLE IF NOT EXISTS claims (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  kind       TEXT NOT NULL,               -- sell | prize
  status     TEXT NOT NULL DEFAULT 'pending',   -- pending/approved/rejected/paid
  amount     INTEGER NOT NULL DEFAULT 0,  -- سکه‌ی کسرشده
  toman      INTEGER NOT NULL DEFAULT 0,
  energy     INTEGER NOT NULL DEFAULT 0,
  dest       TEXT,                        -- شماره کارت/شبا
  prize_id   TEXT,
  prize_name TEXT,
  contact    TEXT,
  created_at INTEGER NOT NULL,
  handled_at INTEGER,
  handled_by TEXT,
  admin_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claims_user   ON claims(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS purchases (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  pack_id    TEXT NOT NULL,
  coins      INTEGER NOT NULL,
  price      INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending',  -- pending/paid/failed
  gateway    TEXT,
  ref_id     TEXT,
  created_at INTEGER NOT NULL,
  paid_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_purch_status ON purchases(status, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  source     TEXT NOT NULL DEFAULT 'web',  -- web/telegram/android/guest
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_ip    TEXT
);
CREATE INDEX IF NOT EXISTS idx_sess_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS admins (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT UNIQUE NOT NULL,
  pass_hash    TEXT NOT NULL,
  pass_salt    TEXT NOT NULL,
  totp_secret  TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  role         TEXT NOT NULL DEFAULT 'admin',   -- admin | owner
  created_at   INTEGER NOT NULL,
  last_login   INTEGER,
  fails        INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token      TEXT PRIMARY KEY,
  admin_id   INTEGER NOT NULL REFERENCES admins(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  ip         TEXT
);

-- هر کاری که ادمین می‌کند ثبت می‌شود
CREATE TABLE IF NOT EXISTS admin_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id   INTEGER,
  username   TEXT,
  action     TEXT NOT NULL,
  target     TEXT,
  detail     TEXT,
  ip         TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alog_time ON admin_log(created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- موارد مشکوک که ادمین باید ببیند
CREATE TABLE IF NOT EXISTS fraud_flags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,     -- collusion | multi_account | referral_abuse | fast_drain
  user_id    TEXT,
  other_id   TEXT,
  score      INTEGER NOT NULL DEFAULT 1,
  detail     TEXT,
  resolved   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fraud ON fraud_flags(resolved, score DESC, created_at DESC);
`);

/* ========================================================================
 *  تنظیمات قابل تغییر از پنل
 * ===================================================================== */

const DEFAULT_SETTINGS = {
  WELCOME_COINS: 500,
  DAILY_BONUS: 100,
  RAKE_PERCENT: 10,
  RAKE_MIN_ENTRY: 1000,
  ENERGY_PER_COINS: 100,
  ENERGY_MARS_BONUS: 0.5,
  REFERRAL_ENERGY: 150,
  REFERRAL_COINS: 200,
  REFERRAL_BONUS_NEW: 300,
  SELL_RATE: 1200,
  SELL_MIN: 50000,
  MAINTENANCE: 0,
  SIGNUP_OPEN: 1
};

const qGetSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const qSetSetting = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');

function initSettings() {
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    if (!qGetSetting.get(k)) qSetSetting.run(k, String(v));
  }
}
initSettings();

function setting(key) {
  const row = qGetSetting.get(key);
  const raw = row ? row.value : DEFAULT_SETTINGS[key];
  const n = Number(raw);
  return Number.isFinite(n) && raw !== '' ? n : raw;
}
function allSettings() {
  const out = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) out[k] = setting(k);
  return out;
}
function setSetting(key, value) {
  if (!(key in DEFAULT_SETTINGS)) return false;
  qSetSetting.run(key, String(value));
  return true;
}

/* ========================================================================
 *  کمکی
 * ===================================================================== */

const now = () => Date.now();
const uid = (p) => p + crypto.randomBytes(9).toString('hex');
const token = () => crypto.randomBytes(24).toString('hex');

function referralCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let t = 0; t < 40; t++) {
    let c = '';
    for (let i = 0; i < 7; i++) c += A[crypto.randomInt(A.length)];
    if (!db.prepare('SELECT 1 FROM users WHERE referral_code = ?').get(c)) return c;
  }
  return 'R' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

/** سطح از روی امتیاز تجربه — دقیقاً مثل سمت کلاینت */
function levelOf(xp) {
  let lvl = 1, need = 500;
  while (xp >= need && lvl < 60) { xp -= need; lvl++; need = Math.round(need * 1.25); }
  return { level: lvl, xp, need };
}

/** اجرای چند کار داخل یک تراکنش — یا همه انجام می‌شوند یا هیچ‌کدام */
function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    throw e;
  }
}

/* ========================================================================
 *  کاربران
 * ===================================================================== */

const qUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const qUserByPhone = db.prepare('SELECT * FROM users WHERE phone = ?');
const qUserByTg = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
const qUserByCode = db.prepare('SELECT * FROM users WHERE referral_code = ?');

function createUser({ phone = null, telegramId = null, name = '', avatar = '🦁', isGuest = 1, ip = null }) {
  const id = uid('u_');
  const t = now();
  db.prepare(`INSERT INTO users
    (id, phone, telegram_id, name, avatar, referral_code, is_guest, created_at, last_seen, last_ip)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, phone, telegramId, name, avatar, referralCode(), isGuest ? 1 : 0, t, t, ip);
  return qUserById.get(id);
}

function getUser(id) { return id ? qUserById.get(id) : null; }
function getUserByPhone(phone) { return phone ? qUserByPhone.get(phone) : null; }
function getUserByTelegram(tgId) { return tgId ? qUserByTg.get(String(tgId)) : null; }
function getUserByCode(code) { return code ? qUserByCode.get(String(code).toUpperCase()) : null; }

function touchUser(id, ip) {
  db.prepare('UPDATE users SET last_seen = ?, last_ip = COALESCE(?, last_ip) WHERE id = ?').run(now(), ip || null, id);
}

function updateProfile(id, { name, avatar }) {
  const u = getUser(id);
  if (!u) return null;
  db.prepare('UPDATE users SET name = COALESCE(?,name), avatar = COALESCE(?,avatar) WHERE id = ?')
    .run(name != null ? String(name).slice(0, 20) : null, avatar != null ? String(avatar).slice(0, 8) : null, id);
  return getUser(id);
}

/** وصل کردن شماره به حسابی که با تلگرام یا مهمان ساخته شده */
function attachPhone(userId, phone) {
  const existing = getUserByPhone(phone);
  if (existing && existing.id !== userId) return { ok: false, reason: 'این شماره قبلاً به حساب دیگری وصل شده', other: existing };
  db.prepare('UPDATE users SET phone = ?, is_guest = 0 WHERE id = ?').run(phone, userId);
  return { ok: true, user: getUser(userId) };
}

function attachTelegram(userId, tgId) {
  const existing = getUserByTelegram(tgId);
  if (existing && existing.id !== userId) return { ok: false, reason: 'این حساب تلگرام قبلاً وصل شده', other: existing };
  db.prepare('UPDATE users SET telegram_id = ?, is_guest = 0 WHERE id = ?').run(String(tgId), userId);
  return { ok: true, user: getUser(userId) };
}

function setBanned(userId, banned, reason) {
  db.prepare('UPDATE users SET banned = ?, ban_reason = ? WHERE id = ?').run(banned ? 1 : 0, reason || null, userId);
  return getUser(userId);
}

/* ========================================================================
 *  کیف پول — تنها راه تغییر موجودی
 * ===================================================================== */

const qApply = db.prepare('UPDATE users SET coins = coins + ?, energy = energy + ?, xp = xp + ? WHERE id = ?');
const qInsertTx = db.prepare(`INSERT INTO transactions
  (user_id, type, coins, energy, coins_after, energy_after, note, ref, created_at)
  VALUES (?,?,?,?,?,?,?,?,?)`);

/**
 * تغییر موجودی + ثبت تراکنش. همیشه داخل یک تراکنش دیتابیس.
 * اگر allowNegative نباشد و موجودی کافی نباشد، رد می‌شود.
 */
function wallet(userId, { coins = 0, energy = 0, xp = 0, type, note = '', ref = null, allowNegative = false }) {
  return tx(() => {
    const u = qUserById.get(userId);
    if (!u) return { ok: false, reason: 'کاربر یافت نشد' };
    if (u.banned) return { ok: false, reason: 'حساب مسدود است' };

    const nc = u.coins + coins;
    const ne = u.energy + energy;
    if (!allowNegative && (nc < 0 || ne < 0)) {
      return { ok: false, reason: nc < 0 ? 'سکه کافی نیست' : 'انرژی کافی نیست' };
    }

    qApply.run(coins, energy, xp, userId);
    qInsertTx.run(userId, type, coins, energy, Math.max(0, nc), Math.max(0, ne), note, ref, now());
    return { ok: true, user: qUserById.get(userId) };
  });
}

/** چند تغییر روی چند کاربر، همه با هم — برای تسویه‌ی بازی */
function walletBatch(ops) {
  return tx(() => {
    const results = [];
    for (const op of ops) {
      const u = qUserById.get(op.userId);
      if (!u) throw new Error('کاربر یافت نشد: ' + op.userId);
      const nc = u.coins + (op.coins || 0);
      const ne = u.energy + (op.energy || 0);
      if (!op.allowNegative && (nc < 0 || ne < 0)) throw new Error('موجودی کافی نیست: ' + op.userId);
      qApply.run(op.coins || 0, op.energy || 0, op.xp || 0, op.userId);
      qInsertTx.run(op.userId, op.type, op.coins || 0, op.energy || 0,
        Math.max(0, nc), Math.max(0, ne), op.note || '', op.ref || null, now());
      results.push(qUserById.get(op.userId));
    }
    return { ok: true, users: results };
  });
}

function listTransactions(userId, limit = 50, offset = 0) {
  return db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?')
    .all(userId, limit, offset);
}

/* ========================================================================
 *  هدیه‌ها و دعوت
 * ===================================================================== */

function claimWelcome(userId) {
  const u = getUser(userId);
  if (!u) return { ok: false, reason: 'کاربر یافت نشد' };
  if (u.welcome_taken) return { ok: false, reason: 'قبلاً دریافت شده' };
  const amount = setting('WELCOME_COINS');
  const r = wallet(userId, { coins: amount, type: 'welcome', note: 'هدیه‌ی خوش‌آمدگویی' });
  if (!r.ok) return r;
  db.prepare('UPDATE users SET welcome_taken = 1 WHERE id = ?').run(userId);
  return { ok: true, coins: amount, user: getUser(userId) };
}

function dailyAvailable(u) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return u.last_daily < d.getTime();
}

function claimDaily(userId) {
  const u = getUser(userId);
  if (!u) return { ok: false, reason: 'کاربر یافت نشد' };
  if (!dailyAvailable(u)) return { ok: false, reason: 'هدیه‌ی امروز را گرفته‌اید' };
  const amount = setting('DAILY_BONUS');
  const r = wallet(userId, { coins: amount, type: 'daily', note: 'هدیه‌ی روزانه' });
  if (!r.ok) return r;
  db.prepare('UPDATE users SET last_daily = ? WHERE id = ?').run(now(), userId);
  return { ok: true, coins: amount, user: getUser(userId) };
}

/** کاربر جدید کد معرف وارد می‌کند */
function applyReferral(userId, code) {
  const u = getUser(userId);
  if (!u) return { ok: false, reason: 'کاربر یافت نشد' };
  if (u.referred_by) return { ok: false, reason: 'قبلاً کد معرف ثبت کرده‌اید' };

  code = String(code || '').trim().toUpperCase();
  const inviter = getUserByCode(code);
  if (!inviter) return { ok: false, reason: 'کد معرف پیدا نشد' };
  if (inviter.id === userId) return { ok: false, reason: 'نمی‌توانید کد خودتان را وارد کنید' };

  // ضد تقلب: اگر هر دو از یک IP آمده‌اند، جایزه را نده ولی علامت بزن
  const sameIp = u.last_ip && inviter.last_ip && u.last_ip === inviter.last_ip;
  if (sameIp) {
    flagFraud('referral_abuse', userId, inviter.id, 'کد معرف از همان IP: ' + u.last_ip, 3);
    return { ok: false, reason: 'این کد معرف قابل استفاده نیست' };
  }

  const bonusNew = setting('REFERRAL_BONUS_NEW');
  const bonusInv = setting('REFERRAL_COINS');
  const energyInv = setting('REFERRAL_ENERGY');

  walletBatch([
    { userId, coins: bonusNew, type: 'referral', note: 'هدیه‌ی ثبت کد معرف' },
    { userId: inviter.id, coins: bonusInv, energy: energyInv, type: 'referral', note: 'پاداش دعوت از ' + (u.name || 'کاربر') }
  ]);
  db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(code, userId);
  db.prepare('UPDATE users SET invited_count = invited_count + 1 WHERE id = ?').run(inviter.id);

  return { ok: true, coins: bonusNew, user: getUser(userId) };
}

/* ========================================================================
 *  بازی و تسویه
 * ===================================================================== */

function roomEconomy(entry) {
  const pot = entry * 2;
  const rake = entry >= setting('RAKE_MIN_ENTRY') ? Math.round(pot * setting('RAKE_PERCENT') / 100) : 0;
  return { entry, pot, rake, prize: pot - rake };
}

function energyFor(entry, mars) {
  let e = Math.max(1, Math.round(entry / setting('ENERGY_PER_COINS')));
  if (mars) e = Math.round(e * (1 + setting('ENERGY_MARS_BONUS')));
  return e;
}

/** کسر ورودی هنگام شروع بازی */
function stake(userId, entry, roomId, gameId) {
  return wallet(userId, { coins: -entry, type: 'stake', note: 'ورود به اتاق ' + roomId, ref: gameId });
}

function refund(userId, entry, roomId, gameId) {
  return wallet(userId, { coins: entry, type: 'refund', note: 'بازگشت ورودی ' + roomId, ref: gameId });
}

function startGame({ roomId, entry, p1Id, p2Id, vsBot }) {
  const id = uid('g_');
  db.prepare(`INSERT INTO games (id, room_id, entry, p1_id, p2_id, vs_bot, started_at)
              VALUES (?,?,?,?,?,?,?)`)
    .run(id, roomId, entry, p1Id || null, p2Id || null, vsBot ? 1 : 0, now());
  return id;
}

/**
 * تسویه‌ی پایان بازی — منبع حقیقت برای موجودی.
 * برنده جایزه را می‌گیرد، هر دو انرژی و امتیاز می‌گیرند، فی ثبت می‌شود.
 */
function settleGame({ gameId, roomId, entry, winnerId, loserId, result, endReason }) {
  const eco = roomEconomy(entry);
  const mars = (result || 1) >= 2;
  const t = now();

  const ops = [];
  if (winnerId) {
    ops.push({
      userId: winnerId, coins: eco.prize, energy: energyFor(entry, mars),
      xp: Math.max(10, Math.round(entry / 20)) * 2,
      type: 'win', ref: gameId,
      note: 'برد در ' + roomId + (eco.rake ? ` (فی ${setting('RAKE_PERCENT')}٪)` : '')
    });
  }
  if (loserId) {
    ops.push({
      userId: loserId, coins: 0, energy: energyFor(entry, mars),
      xp: Math.max(10, Math.round(entry / 20)),
      type: 'lose', ref: gameId, note: 'باخت در ' + roomId
    });
  }

  let users = [];
  if (ops.length) {
    try { users = walletBatch(ops).users; } catch (e) { return { ok: false, reason: e.message }; }
  }

  if (winnerId) {
    db.prepare(`UPDATE users SET games = games + 1, wins = wins + 1,
      mars = mars + ?, coins_won = coins_won + ?, best_win = MAX(best_win, ?) WHERE id = ?`)
      .run(mars ? 1 : 0, eco.prize - entry, eco.prize, winnerId);
  }
  if (loserId) {
    db.prepare('UPDATE users SET games = games + 1, losses = losses + 1, coins_lost = coins_lost + ? WHERE id = ?')
      .run(entry, loserId);
  }

  db.prepare(`UPDATE games SET winner_id = ?, result = ?, rake = ?, prize = ?, end_reason = ?, ended_at = ?
              WHERE id = ?`)
    .run(winnerId || null, result || 1, eco.rake, eco.prize, endReason || 'normal', t, gameId);

  if (winnerId && loserId) checkCollusion(winnerId, loserId, entry);

  return { ok: true, eco, energy: energyFor(entry, mars), users };
}

/* ========================================================================
 *  فروشگاه، جوایز، پوسته‌ها
 * ===================================================================== */

function createPurchase(userId, pack) {
  const id = uid('p_');
  db.prepare(`INSERT INTO purchases (id, user_id, pack_id, coins, price, status, created_at)
              VALUES (?,?,?,?,?, 'pending', ?)`)
    .run(id, userId, pack.id, pack.coins, pack.price, now());
  return id;
}

/** بعد از تأیید درگاه صدا زده می‌شود */
function completePurchase(purchaseId, refId, gateway) {
  const p = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
  if (!p) return { ok: false, reason: 'تراکنش یافت نشد' };
  if (p.status === 'paid') return { ok: false, reason: 'این تراکنش قبلاً تسویه شده' };

  const r = wallet(p.user_id, {
    coins: p.coins, type: 'purchase', ref: purchaseId,
    note: `خرید ${p.coins.toLocaleString('fa-IR')} سکه` + (refId ? ' — پیگیری ' + refId : '')
  });
  if (!r.ok) return r;

  db.prepare("UPDATE purchases SET status='paid', ref_id=?, gateway=?, paid_at=? WHERE id=?")
    .run(refId || null, gateway || null, now(), purchaseId);
  return { ok: true, coins: p.coins, user: r.user };
}

function requestSell(userId, amount, dest) {
  amount = Math.round(Number(amount) || 0);
  const min = setting('SELL_MIN');
  if (amount < min) return { ok: false, reason: `حداقل فروش ${min.toLocaleString('fa-IR')} سکه است` };
  if (!dest || String(dest).replace(/\D/g, '').length < 16) return { ok: false, reason: 'شماره کارت یا شبا درست نیست' };

  const toman = Math.floor(amount / setting('SELL_RATE')) * 1000;
  const id = 'S' + crypto.randomBytes(5).toString('hex').toUpperCase();

  const r = wallet(userId, {
    coins: -amount, type: 'sell', ref: id,
    note: `فروش سکه — ${toman.toLocaleString('fa-IR')} تومان`
  });
  if (!r.ok) return r;

  db.prepare(`INSERT INTO claims (id, user_id, kind, amount, toman, dest, created_at)
              VALUES (?,?, 'sell', ?,?,?,?)`)
    .run(id, userId, amount, toman, String(dest).slice(0, 40), now());
  return { ok: true, id, toman, user: r.user };
}

function redeemPrize(userId, prize, contact) {
  const u = getUser(userId);
  if (!u) return { ok: false, reason: 'کاربر یافت نشد' };
  if (u.energy < prize.energy) {
    return { ok: false, reason: `${(prize.energy - u.energy).toLocaleString('fa-IR')} انرژی کم دارید` };
  }

  // جوایز سکه‌ای و آیتمی فوری‌اند
  if (prize.type === 'coins') {
    const r = wallet(userId, { coins: prize.value, energy: -prize.energy, type: 'prize', note: 'جایزه: ' + prize.name });
    return r.ok ? { ok: true, instant: true, user: r.user } : r;
  }
  if (prize.type === 'item') {
    const r = wallet(userId, { energy: -prize.energy, type: 'prize', note: 'جایزه: ' + prize.name });
    if (!r.ok) return r;
    const inv = JSON.parse(u.inventory || '[]');
    if (!inv.includes(prize.value)) inv.push(prize.value);
    db.prepare('UPDATE users SET inventory = ? WHERE id = ?').run(JSON.stringify(inv), userId);
    return { ok: true, instant: true, user: getUser(userId) };
  }

  // جوایز واقعی → درخواست برای ادمین
  if (!contact || String(contact).replace(/\D/g, '').length < 10) {
    return { ok: false, reason: 'شماره تماس را درست وارد کنید' };
  }
  const id = 'P' + crypto.randomBytes(5).toString('hex').toUpperCase();
  const r = wallet(userId, { energy: -prize.energy, type: 'prize', ref: id, note: 'درخواست جایزه: ' + prize.name });
  if (!r.ok) return r;

  db.prepare(`INSERT INTO claims (id, user_id, kind, energy, prize_id, prize_name, contact, created_at)
              VALUES (?,?, 'prize', ?,?,?,?,?)`)
    .run(id, userId, prize.energy, prize.id, prize.name, String(contact).slice(0, 30), now());
  return { ok: true, instant: false, id, user: r.user };
}

function buySkin(userId, skin) {
  const u = getUser(userId);
  if (!u) return { ok: false, reason: 'کاربر یافت نشد' };
  const owned = JSON.parse(u.skins || '["classic"]');
  if (owned.includes(skin.id)) return { ok: false, reason: 'این پوسته را دارید' };
  if (skin.minLevel && levelOf(u.xp).level < skin.minLevel) {
    return { ok: false, reason: `این پوسته در سطح ${skin.minLevel} باز می‌شود` };
  }

  const delta = skin.currency === 'energy' ? { energy: -skin.price } : { coins: -skin.price };
  const r = wallet(userId, { ...delta, type: 'skin', note: 'خرید پوسته: ' + skin.name });
  if (!r.ok) return r;

  owned.push(skin.id);
  db.prepare('UPDATE users SET skins = ?, skin = ? WHERE id = ?').run(JSON.stringify(owned), skin.id, userId);
  return { ok: true, user: getUser(userId) };
}

function equipSkin(userId, skinId) {
  const u = getUser(userId);
  if (!u) return { ok: false, reason: 'کاربر یافت نشد' };
  const owned = JSON.parse(u.skins || '["classic"]');
  if (!owned.includes(skinId)) return { ok: false, reason: 'اول باید این پوسته را بگیرید' };
  db.prepare('UPDATE users SET skin = ? WHERE id = ?').run(skinId, userId);
  return { ok: true, user: getUser(userId) };
}

/* ========================================================================
 *  نشست‌ها
 * ===================================================================== */

function createSession(userId, source, ip) {
  const tk = token();
  const t = now();
  db.prepare('INSERT INTO sessions (token, user_id, source, created_at, expires_at, last_ip) VALUES (?,?,?,?,?,?)')
    .run(tk, userId, source || 'web', t, t + 180 * 24 * 3600 * 1000, ip || null);
  return tk;
}

function userByToken(tk) {
  if (!tk) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE token = ?').get(tk);
  if (!s || s.expires_at < now()) return null;
  return getUser(s.user_id);
}

function dropSession(tk) { db.prepare('DELETE FROM sessions WHERE token = ?').run(tk); }

/* ========================================================================
 *  تشخیص تقلب
 * ===================================================================== */

function flagFraud(kind, userId, otherId, detail, score) {
  db.prepare('INSERT INTO fraud_flags (kind, user_id, other_id, score, detail, created_at) VALUES (?,?,?,?,?,?)')
    .run(kind, userId || null, otherId || null, score || 1, detail || '', now());
}

/**
 * تبانی: اگر دو نفر بارها با هم بازی کنند و نتیجه یک‌طرفه باشد،
 * یعنی احتمالاً دارند سکه جابه‌جا می‌کنند.
 */
function checkCollusion(winnerId, loserId, entry) {
  const since = now() - 24 * 3600 * 1000;
  const pair = db.prepare(`
    SELECT COUNT(*) AS n,
           SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) AS won_by_a,
           SUM(entry) AS volume
    FROM games
    WHERE ended_at > ?
      AND ((p1_id = ? AND p2_id = ?) OR (p1_id = ? AND p2_id = ?))
  `).get(winnerId, since, winnerId, loserId, loserId, winnerId);

  if (!pair || pair.n < 6) return;
  const ratio = pair.won_by_a / pair.n;
  // یک‌طرفه بودن شدید + حجم بالا = مشکوک
  if ((ratio > 0.85 || ratio < 0.15) && pair.volume >= entry * 6) {
    const already = db.prepare(`SELECT 1 FROM fraud_flags WHERE kind='collusion' AND resolved=0
      AND ((user_id=? AND other_id=?) OR (user_id=? AND other_id=?))`).get(winnerId, loserId, loserId, winnerId);
    if (already) return;
    flagFraud('collusion', winnerId, loserId,
      `${pair.n} بازی در ۲۴ ساعت، ${Math.round(ratio * 100)}٪ یک‌طرفه، حجم ${pair.volume.toLocaleString('fa-IR')} سکه`,
      Math.min(10, Math.round(pair.n / 2)));
  }
}

/** چند حساب از یک IP */
function checkMultiAccount(ip) {
  if (!ip) return;
  const row = db.prepare('SELECT COUNT(*) AS n FROM users WHERE last_ip = ?').get(ip);
  if (row && row.n >= 5) {
    const already = db.prepare("SELECT 1 FROM fraud_flags WHERE kind='multi_account' AND detail LIKE ? AND resolved=0")
      .get('%' + ip + '%');
    if (!already) flagFraud('multi_account', null, null, `${row.n} حساب از IP ${ip}`, Math.min(10, row.n));
  }
}

/* ========================================================================
 *  آمار برای پنل
 * ===================================================================== */

function stats() {
  const day = now() - 24 * 3600 * 1000;
  const week = now() - 7 * 24 * 3600 * 1000;
  const one = (sql, ...a) => db.prepare(sql).get(...a);

  return {
    users: {
      total: one('SELECT COUNT(*) n FROM users').n,
      today: one('SELECT COUNT(*) n FROM users WHERE created_at > ?', day).n,
      week: one('SELECT COUNT(*) n FROM users WHERE created_at > ?', week).n,
      active24h: one('SELECT COUNT(*) n FROM users WHERE last_seen > ?', day).n,
      verified: one('SELECT COUNT(*) n FROM users WHERE is_guest = 0').n,
      banned: one('SELECT COUNT(*) n FROM users WHERE banned = 1').n
    },
    games: {
      total: one('SELECT COUNT(*) n FROM games WHERE ended_at IS NOT NULL').n,
      today: one('SELECT COUNT(*) n FROM games WHERE ended_at > ?', day).n,
      vsBot: one('SELECT COUNT(*) n FROM games WHERE ended_at > ? AND vs_bot = 1', day).n,
      live: one('SELECT COUNT(*) n FROM games WHERE ended_at IS NULL').n
    },
    economy: {
      coinsInCirculation: one('SELECT COALESCE(SUM(coins),0) n FROM users').n,
      energyInCirculation: one('SELECT COALESCE(SUM(energy),0) n FROM users').n,
      rakeToday: one('SELECT COALESCE(SUM(rake),0) n FROM games WHERE ended_at > ?', day).n,
      rakeTotal: one('SELECT COALESCE(SUM(rake),0) n FROM games').n,
      rakeWeek: one('SELECT COALESCE(SUM(rake),0) n FROM games WHERE ended_at > ?', week).n,
      purchasedToday: one("SELECT COALESCE(SUM(price),0) n FROM purchases WHERE status='paid' AND paid_at > ?", day).n,
      purchasedTotal: one("SELECT COALESCE(SUM(price),0) n FROM purchases WHERE status='paid'").n
    },
    pending: {
      claims: one("SELECT COUNT(*) n FROM claims WHERE status='pending'").n,
      sell: one("SELECT COUNT(*) n FROM claims WHERE status='pending' AND kind='sell'").n,
      prize: one("SELECT COUNT(*) n FROM claims WHERE status='pending' AND kind='prize'").n,
      sellToman: one("SELECT COALESCE(SUM(toman),0) n FROM claims WHERE status='pending' AND kind='sell'").n,
      fraud: one('SELECT COUNT(*) n FROM fraud_flags WHERE resolved = 0').n
    }
  };
}

/** نمودار ۱۴ روز اخیر */
function chartDaily(days = 14) {
  const out = [];
  const dayMs = 24 * 3600 * 1000;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const from = start.getTime() - i * dayMs;
    const to = from + dayMs;
    out.push({
      date: new Date(from).toISOString().slice(0, 10),
      users: db.prepare('SELECT COUNT(*) n FROM users WHERE created_at >= ? AND created_at < ?').get(from, to).n,
      games: db.prepare('SELECT COUNT(*) n FROM games WHERE ended_at >= ? AND ended_at < ?').get(from, to).n,
      rake: db.prepare('SELECT COALESCE(SUM(rake),0) n FROM games WHERE ended_at >= ? AND ended_at < ?').get(from, to).n,
      revenue: db.prepare("SELECT COALESCE(SUM(price),0) n FROM purchases WHERE status='paid' AND paid_at >= ? AND paid_at < ?").get(from, to).n
    });
  }
  return out;
}

function listUsers({ q = '', sort = 'created_at', dir = 'DESC', limit = 30, offset = 0, banned = null }) {
  const cols = ['created_at', 'last_seen', 'coins', 'energy', 'xp', 'games', 'wins'];
  const col = cols.includes(sort) ? sort : 'created_at';
  const d = dir === 'ASC' ? 'ASC' : 'DESC';

  const where = [];
  const args = [];
  if (q) {
    where.push('(id LIKE ? OR name LIKE ? OR phone LIKE ? OR referral_code LIKE ? OR telegram_id LIKE ?)');
    const like = '%' + q + '%';
    args.push(like, like, like, like, like);
  }
  if (banned !== null) { where.push('banned = ?'); args.push(banned ? 1 : 0); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const rows = db.prepare(`SELECT * FROM users ${w} ORDER BY ${col} ${d} LIMIT ? OFFSET ?`).all(...args, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) n FROM users ${w}`).get(...args).n;
  return { rows, total };
}

function listClaims({ status = 'pending', kind = null, limit = 50, offset = 0 }) {
  const where = [];
  const args = [];
  if (status && status !== 'all') { where.push('c.status = ?'); args.push(status); }
  if (kind) { where.push('c.kind = ?'); args.push(kind); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT c.*, u.name AS user_name, u.phone AS user_phone, u.coins AS user_coins, u.banned AS user_banned
    FROM claims c LEFT JOIN users u ON u.id = c.user_id
    ${w} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) n FROM claims c ${w}`).get(...args).n;
  return { rows, total };
}

function resolveClaim(id, action, adminName, note) {
  const c = db.prepare('SELECT * FROM claims WHERE id = ?').get(id);
  if (!c) return { ok: false, reason: 'درخواست یافت نشد' };
  if (c.status !== 'pending') return { ok: false, reason: 'این درخواست قبلاً رسیدگی شده' };

  if (action === 'reject') {
    // پول یا انرژی برمی‌گردد
    if (c.kind === 'sell' && c.amount) {
      wallet(c.user_id, { coins: c.amount, type: 'sell', ref: id, note: 'بازگشت سکه — درخواست فروش رد شد' });
    } else if (c.kind === 'prize' && c.energy) {
      wallet(c.user_id, { energy: c.energy, type: 'prize', ref: id, note: 'بازگشت انرژی — درخواست جایزه رد شد' });
    }
  }
  db.prepare('UPDATE claims SET status = ?, handled_at = ?, handled_by = ?, admin_note = ? WHERE id = ?')
    .run(action === 'approve' ? 'approved' : 'rejected', now(), adminName || null, note || null, id);
  return { ok: true, claim: db.prepare('SELECT * FROM claims WHERE id = ?').get(id) };
}

function listFraud({ resolved = 0, limit = 50 }) {
  return db.prepare(`
    SELECT f.*, a.name AS user_name, b.name AS other_name
    FROM fraud_flags f
    LEFT JOIN users a ON a.id = f.user_id
    LEFT JOIN users b ON b.id = f.other_id
    WHERE f.resolved = ? ORDER BY f.score DESC, f.created_at DESC LIMIT ?`).all(resolved ? 1 : 0, limit);
}

function resolveFraud(id) {
  db.prepare('UPDATE fraud_flags SET resolved = 1 WHERE id = ?').run(id);
  return { ok: true };
}

function userDetail(id) {
  const u = getUser(id);
  if (!u) return null;
  return {
    user: u,
    level: levelOf(u.xp),
    transactions: listTransactions(id, 40),
    games: db.prepare(`SELECT * FROM games WHERE (p1_id = ? OR p2_id = ?) AND ended_at IS NOT NULL
                       ORDER BY ended_at DESC LIMIT 20`).all(id, id),
    claims: db.prepare('SELECT * FROM claims WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(id),
    sameIp: u.last_ip
      ? db.prepare('SELECT id, name, coins, created_at FROM users WHERE last_ip = ? AND id != ? LIMIT 10').all(u.last_ip, id)
      : []
  };
}

/* ========================================================================
 *  ادمین‌ها
 * ===================================================================== */

function hashPassword(pass, salt) {
  return crypto.scryptSync(pass, salt, 64).toString('hex');
}

function createAdmin(username, password, role = 'admin') {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  const secret = base32(crypto.randomBytes(20));
  db.prepare(`INSERT INTO admins (username, pass_hash, pass_salt, totp_secret, totp_enabled, role, created_at)
              VALUES (?,?,?,?,0,?,?)`)
    .run(username, hash, salt, secret, role, now());
  return { username, totpSecret: secret };
}

function getAdmin(username) {
  return db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
}

function verifyPassword(admin, password) {
  const h = hashPassword(password, admin.pass_salt);
  const a = Buffer.from(h, 'hex'), b = Buffer.from(admin.pass_hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* --- TOTP (سازگار با Google Authenticator) --- */

function base32(buf) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += A[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += A[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const out = [];
  for (const ch of String(str).toUpperCase().replace(/=+$/, '')) {
    const i = A.indexOf(ch);
    if (i < 0) continue;
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

function totpAt(secret, counter) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[off] & 0x7f) << 24 | hmac[off + 1] << 16 | hmac[off + 2] << 8 | hmac[off + 3]) % 1000000;
  return String(code).padStart(6, '0');
}

/** کد را با یک بازه‌ی ±۱ (۳۰ ثانیه) قبول می‌کند تا اختلاف ساعت مشکل نسازد */
function verifyTotp(secret, code) {
  if (!secret || !code) return false;
  code = String(code).replace(/\D/g, '');
  if (code.length !== 6) return false;
  const c = Math.floor(Date.now() / 30000);
  for (let d = -1; d <= 1; d++) {
    const expect = totpAt(secret, c + d);
    if (crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(code))) return true;
  }
  return false;
}

function totpUri(username, secret, issuer = 'Nard Admin') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}` +
         `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

function enableTotp(username) {
  db.prepare('UPDATE admins SET totp_enabled = 1 WHERE username = ?').run(username);
}

function createAdminSession(adminId, ip) {
  const tk = token();
  const t = now();
  db.prepare('INSERT INTO admin_sessions (token, admin_id, created_at, expires_at, ip) VALUES (?,?,?,?,?)')
    .run(tk, adminId, t, t + 12 * 3600 * 1000, ip || null);   // ۱۲ ساعت
  db.prepare('UPDATE admins SET last_login = ?, fails = 0, locked_until = 0 WHERE id = ?').run(t, adminId);
  return tk;
}

function adminByToken(tk) {
  if (!tk) return null;
  const s = db.prepare('SELECT * FROM admin_sessions WHERE token = ?').get(tk);
  if (!s || s.expires_at < now()) return null;
  return db.prepare('SELECT id, username, role FROM admins WHERE id = ?').get(s.admin_id);
}

function dropAdminSession(tk) { db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(tk); }

function noteAdminFail(username) {
  const a = getAdmin(username);
  if (!a) return;
  const fails = a.fails + 1;
  const lock = fails >= 5 ? now() + 15 * 60 * 1000 : 0;   // ۵ تلاش ناموفق → ۱۵ دقیقه قفل
  db.prepare('UPDATE admins SET fails = ?, locked_until = ? WHERE id = ?').run(fails, lock, a.id);
}

function adminLog(admin, action, target, detail, ip) {
  db.prepare('INSERT INTO admin_log (admin_id, username, action, target, detail, ip, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(admin ? admin.id : null, admin ? admin.username : null, action, target || null, detail || null, ip || null, now());
}

function listAdminLog(limit = 100) {
  return db.prepare('SELECT * FROM admin_log ORDER BY id DESC LIMIT ?').all(limit);
}

/* ========================================================================
 *  خروجی
 * ===================================================================== */

module.exports = {
  db, tx, now, uid, levelOf,
  setting, allSettings, setSetting, DEFAULT_SETTINGS,

  createUser, getUser, getUserByPhone, getUserByTelegram, getUserByCode,
  touchUser, updateProfile, attachPhone, attachTelegram, setBanned,

  wallet, walletBatch, listTransactions,
  claimWelcome, dailyAvailable, claimDaily, applyReferral,

  roomEconomy, energyFor, stake, refund, startGame, settleGame,
  createPurchase, completePurchase, requestSell, redeemPrize, buySkin, equipSkin,

  createSession, userByToken, dropSession,

  flagFraud, checkCollusion, checkMultiAccount,
  stats, chartDaily, listUsers, listClaims, resolveClaim, listFraud, resolveFraud, userDetail,

  createAdmin, getAdmin, verifyPassword, verifyTotp, totpUri, enableTotp,
  createAdminSession, adminByToken, dropAdminSession, noteAdminFail,
  adminLog, listAdminLog
};
