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

const DB_FILE = path.join(DATA_DIR, 'nard.db');

/* ── نگهبان اسکیما ────────────────────────────────────────────
 * نسخه‌ی قبلی ورود با شماره‌ی موبایل داشت و ستون بالانس نداشت.
 * SQLite جدول موجود را با CREATE TABLE IF NOT EXISTS تغییر نمی‌دهد،
 * پس اگر دیتابیس قدیمی باشد سرور با خطاهای گیج‌کننده بالا می‌آید.
 * بهتر است همین اول با یک پیام روشن جلویش را بگیریم.
 */
if (fs.existsSync(DB_FILE)) {
  const probe = new DatabaseSync(DB_FILE);
  let cols = [];
  try { cols = probe.prepare('PRAGMA table_info(users)').all().map((c) => c.name); } catch (e) {}
  probe.close();
  if (cols.length && (!cols.includes('username') || !cols.includes('balance'))) {
    console.error('\n✗ دیتابیس مربوط به نسخه‌ی قدیمی (ورود با شماره) است.\n');
    console.error('  این نسخه نام کاربری و بالانس تتری دارد و اسکیمایش فرق می‌کند.');
    console.error('  برای شروع تازه:\n');
    console.error('      node server/reset-db.js\n');
    console.error('  این دستور از دیتابیس فعلی پشتیبان می‌گیرد و بعد پاکش می‌کند.\n');
    process.exit(1);
  }
}

const db = new DatabaseSync(DB_FILE);

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
  username      TEXT UNIQUE,              -- نام کاربری (حروف کوچک، یکتا)
  pass_hash     TEXT,
  pass_salt     TEXT,
  recovery_hash TEXT,                     -- هش کد بازیابی؛ خود کد ذخیره نمی‌شود
  recovery_used INTEGER NOT NULL DEFAULT 0,
  telegram_id   TEXT UNIQUE,              -- شناسه‌ی تلگرام (برای مینی‌اپ)
  -- بالانس به میکرو-تتر (۱ تتر = ۱٬۰۰۰٬۰۰۰). همان دقت USDT روی زنجیره.
  -- عمداً عدد صحیح است: اعشار شناور برای پول قابل اعتماد نیست.
  balance       INTEGER NOT NULL DEFAULT 0,
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
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- هر تغییر سکه یا انرژی، یک ردیف. هرگز حذف نمی‌شود.
CREATE TABLE IF NOT EXISTS transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL,              -- welcome/daily/stake/win/lose/buy/sell/deposit/withdraw/voucher/prize/skin/referral/admin
  coins       INTEGER NOT NULL DEFAULT 0,
  energy      INTEGER NOT NULL DEFAULT 0,
  balance     INTEGER NOT NULL DEFAULT 0,   -- میکرو-تتر
  coins_after INTEGER NOT NULL,
  energy_after INTEGER NOT NULL,
  balance_after INTEGER NOT NULL DEFAULT 0,
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

-- واریز تتر: کاربر TXID می‌فرستد، ادمین تأیید می‌کند
CREATE TABLE IF NOT EXISTS deposits (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  network    TEXT NOT NULL DEFAULT 'TRC20',
  amount     INTEGER NOT NULL,              -- میکرو-تتر، همان چیزی که کاربر ادعا کرده
  credited   INTEGER NOT NULL DEFAULT 0,    -- مبلغی که ادمین واقعاً تأیید کرد
  txid       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending',  -- pending/approved/rejected
  created_at INTEGER NOT NULL,
  handled_at INTEGER,
  handled_by TEXT,
  admin_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_dep_status ON deposits(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dep_user   ON deposits(user_id, created_at DESC);
-- یک TXID فقط یک بار. جلوی ثبت دوباره‌ی یک واریز را می‌گیرد.
CREATE UNIQUE INDEX IF NOT EXISTS idx_dep_txid ON deposits(txid);

-- برداشت تتر به کیف‌پول کاربر
CREATE TABLE IF NOT EXISTS withdrawals (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  network    TEXT NOT NULL DEFAULT 'TRC20',
  amount     INTEGER NOT NULL,              -- میکرو-تتر که از بالانس کسر شد
  fee        INTEGER NOT NULL DEFAULT 0,
  payout     INTEGER NOT NULL,              -- مبلغی که واقعاً فرستاده می‌شود
  address    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending',  -- pending/paid/rejected
  txid       TEXT,
  created_at INTEGER NOT NULL,
  handled_at INTEGER,
  handled_by TEXT,
  admin_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_wd_status ON withdrawals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wd_user   ON withdrawals(user_id, created_at DESC);

-- کد وچر: ادمین می‌سازد، کاربر وارد می‌کند، بالانسش شارژ می‌شود
CREATE TABLE IF NOT EXISTS vouchers (
  code       TEXT PRIMARY KEY,
  amount     INTEGER NOT NULL,              -- میکرو-تتر
  note       TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  used_by    TEXT REFERENCES users(id),
  used_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_vouch_used ON vouchers(used_at, created_at DESC);

-- کد موقت برای وصل کردن حساب وب به تلگرام (و برعکس)
CREATE TABLE IF NOT EXISTS link_codes (
  code       TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
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

  /* ── اقتصاد تتری ──────────────────────────────────────────
   * همه‌ی مبالغ به میکرو-تتر (۱ تتر = ۱٬۰۰۰٬۰۰۰).
   *
   * BUY_RATE  : کاربر با این نرخ سکه می‌خرد  → ۱۰٬۰۰۰ سکه برای ۱ تتر
   * SELL_RATE : کاربر با این نرخ سکه می‌فروشد → ۱۲٬۵۰۰ سکه برای ۱ تتر
   *
   * فاصله‌ی این دو (اسپرد) سود خانه است. SELL باید همیشه سکه‌ی بیشتری
   * بخواهد، وگرنه کاربر با خرید و فروش پیاپی پول می‌سازد.
   */
  BUY_RATE: 100,            // میکرو-تتر برای هر سکه هنگام خرید
  SELL_RATE: 80,            // میکرو-تتر برای هر سکه هنگام فروش
  BUY_MIN: 1000,            // حداقل سکه در هر خرید
  SELL_MIN: 10000,          // حداقل سکه در هر فروش

  DEPOSIT_MIN: 1000000,     // حداقل واریز: ۱ تتر
  WITHDRAW_MIN: 5000000,    // حداقل برداشت: ۵ تتر
  WITHDRAW_FEE: 1000000,    // کارمزد شبکه: ۱ تتر
  DEPOSIT_ADDRESS_TRC20: '',
  DEPOSIT_ADDRESS_BEP20: '',

  MAINTENANCE: 0,
  SIGNUP_OPEN: 1
};

/* ── واحد پول ─────────────────────────────────────────────────
 * همه‌جا با عدد صحیح (میکرو-تتر) کار می‌کنیم. تبدیل فقط در مرز
 * نمایش انجام می‌شود، وگرنه خطای اعشار شناور پول را آرام‌آرام می‌خورد.
 */
const USDT = 1000000;
function toMicro(usdt) { return Math.round(Number(usdt) * USDT); }
function fromMicro(micro) { return Math.round(Number(micro) || 0) / USDT; }
function fmtUsdt(micro) { return (Math.round(Number(micro) || 0) / USDT).toFixed(2); }

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

/**
 * اجرای چند کار داخل یک تراکنش — یا همه انجام می‌شوند یا هیچ‌کدام.
 *
 * تودرتو هم کار می‌کند: مثلاً resolveDeposit خودش یک tx است و داخلش
 * wallet() را صدا می‌زند که آن هم tx است. SQLite تراکنش تودرتو ندارد،
 * پس فراخوانی داخلی به همان تراکنش بیرونی می‌پیوندد و فقط بیرونی‌ترین
 * لایه COMMIT می‌کند. اگر داخلی خطا بدهد، خطا بالا می‌رود و کل تراکنش
 * برمی‌گردد — که دقیقاً همان چیزی است که برای پول می‌خواهیم.
 */
let txDepth = 0;

function tx(fn) {
  if (txDepth > 0) { txDepth++; try { return fn(); } finally { txDepth--; } }

  db.exec('BEGIN IMMEDIATE');
  txDepth = 1;
  try {
    const r = fn();
    txDepth = 0;
    db.exec('COMMIT');
    return r;
  } catch (e) {
    txDepth = 0;
    try { db.exec('ROLLBACK'); } catch (_) {}
    throw e;
  }
}

/* ========================================================================
 *  کاربران
 * ===================================================================== */

const qUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const qUserByUsername = db.prepare('SELECT * FROM users WHERE username = ?');
const qUserByTg = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
const qUserByCode = db.prepare('SELECT * FROM users WHERE referral_code = ?');

function createUser({ username = null, telegramId = null, name = '', avatar = '🦁', isGuest = 1, ip = null }) {
  const id = uid('u_');
  const t = now();
  db.prepare(`INSERT INTO users
    (id, username, telegram_id, name, avatar, referral_code, is_guest, created_at, last_seen, last_ip)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, username, telegramId, name, avatar, referralCode(), isGuest ? 1 : 0, t, t, ip);
  return qUserById.get(id);
}

function getUser(id) { return id ? qUserById.get(id) : null; }
function getUserByUsername(u) { return u ? qUserByUsername.get(normUsername(u)) : null; }
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

/* ========================================================================
 *  نام کاربری و رمز
 * ===================================================================== */

function normUsername(u) {
  return String(u || '').trim().toLowerCase();
}

/** قانون‌های نام کاربری — پیام خطا برمی‌گرداند یا null اگر درست باشد */
function usernameProblem(u) {
  const n = normUsername(u);
  if (n.length < 3) return 'نام کاربری حداقل ۳ حرف باشد';
  if (n.length > 20) return 'نام کاربری حداکثر ۲۰ حرف باشد';
  if (!/^[a-z0-9_]+$/.test(n)) return 'فقط حروف انگلیسی، عدد و زیرخط (_) مجاز است';
  if (/^[0-9_]/.test(n)) return 'نام کاربری باید با یک حرف شروع شود';
  // نام‌هایی که نباید کسی بردارد
  if (/^(admin|owner|support|root|system|nard|moderator|mod)$/.test(n)) return 'این نام کاربری رزرو شده است';
  return null;
}

function passwordProblem(p) {
  const s = String(p || '');
  if (s.length < 8) return 'رمز حداقل ۸ کاراکتر باشد';
  if (s.length > 200) return 'رمز خیلی بلند است';
  if (!/[a-zA-Z]/.test(s) || !/[0-9]/.test(s)) return 'رمز باید هم حرف داشته باشد هم عدد';
  return null;
}

/** کد بازیابی: ۶ گروه ۴ حرفی، بدون حروف گیج‌کننده (O/0، I/1) */
function makeRecoveryCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const out = [];
  for (let g = 0; g < 6; g++) {
    let part = '';
    for (let i = 0; i < 4; i++) part += A[crypto.randomBytes(1)[0] % A.length];
    out.push(part);
  }
  return out.join('-');
}
function normRecovery(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

/**
 * ثبت‌نام. اگر userId بدهید، همان حساب مهمان ارتقا می‌یابد
 * (سکه‌ها و تاریخچه‌اش حفظ می‌شود) — وگرنه حساب تازه ساخته می‌شود.
 */
function register({ username, password, name = '', avatar = '🦁', ip = null, userId = null }) {
  const up = usernameProblem(username); if (up) return { ok: false, reason: up };
  const pp = passwordProblem(password); if (pp) return { ok: false, reason: pp };
  if (!setting('SIGNUP_OPEN')) return { ok: false, reason: 'ثبت‌نام موقتاً بسته است' };

  const uname = normUsername(username);
  if (getUserByUsername(uname)) return { ok: false, reason: 'این نام کاربری گرفته شده است' };

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  const recovery = makeRecoveryCode();
  const rHash = hashPassword(normRecovery(recovery), salt);

  return tx(() => {
    let u = userId ? getUser(userId) : null;
    if (u && u.username) return { ok: false, reason: 'این حساب از قبل نام کاربری دارد' };

    if (u) {
      db.prepare(`UPDATE users SET username=?, pass_hash=?, pass_salt=?, recovery_hash=?,
                  recovery_used=0, is_guest=0, name=COALESCE(NULLIF(?,''), name) WHERE id=?`)
        .run(uname, hash, salt, rHash, String(name).slice(0, 20), u.id);
    } else {
      const id = uid('u_');
      const t = now();
      db.prepare(`INSERT INTO users
        (id, username, pass_hash, pass_salt, recovery_hash, name, avatar, referral_code,
         is_guest, created_at, last_seen, last_ip)
        VALUES (?,?,?,?,?,?,?,?,0,?,?,?)`)
        .run(id, uname, hash, salt, rHash, String(name || username).slice(0, 20),
             avatar, referralCode(), t, t, ip);
      u = qUserById.get(id);
    }
    // کد بازیابی فقط همین یک بار برمی‌گردد؛ بعد از این فقط هشش را داریم
    return { ok: true, user: getUser(u.id), recovery };
  });
}

function login(username, password) {
  const u = getUserByUsername(username);
  // پیام یکسان برای «کاربر نیست» و «رمز غلط» تا نشود فهمید کدام نام کاربری وجود دارد
  const fail = { ok: false, reason: 'نام کاربری یا رمز درست نیست' };
  if (!u || !u.pass_hash) return fail;
  if (!checkPassword(u, password)) return fail;
  if (u.banned) return { ok: false, reason: 'حساب مسدود است' + (u.ban_reason ? ' — ' + u.ban_reason : '') };
  return { ok: true, user: u };
}

function checkPassword(user, password) {
  if (!user.pass_hash || !user.pass_salt) return false;
  const h = hashPassword(String(password || ''), user.pass_salt);
  const a = Buffer.from(h, 'hex'), b = Buffer.from(user.pass_hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function changePassword(userId, oldPass, newPass) {
  const u = getUser(userId);
  if (!u) return { ok: false, reason: 'کاربر یافت نشد' };
  if (u.pass_hash && !checkPassword(u, oldPass)) return { ok: false, reason: 'رمز فعلی درست نیست' };
  const pp = passwordProblem(newPass); if (pp) return { ok: false, reason: pp };
  const salt = crypto.randomBytes(16).toString('hex');
  db.prepare('UPDATE users SET pass_hash=?, pass_salt=? WHERE id=?')
    .run(hashPassword(newPass, salt), salt, userId);
  // چون نمک عوض شد، هش کد بازیابی قدیمی دیگر معتبر نیست — باید کد تازه بگیرد
  db.prepare('UPDATE users SET recovery_hash=NULL, recovery_used=1 WHERE id=?').run(userId);
  dropAllSessions(userId);
  return { ok: true };
}

/**
 * بازیابی با کد یک‌بارمصرف. موفق که شد، رمز تازه می‌گذارد و
 * یک کد بازیابی تازه می‌دهد (کد قبلی دیگر کار نمی‌کند).
 */
function recoverWithCode(username, code, newPass) {
  const u = getUserByUsername(username);
  const fail = { ok: false, reason: 'نام کاربری یا کد بازیابی درست نیست' };
  if (!u || !u.recovery_hash || u.recovery_used) return fail;
  const pp = passwordProblem(newPass); if (pp) return { ok: false, reason: pp };

  const h = hashPassword(normRecovery(code), u.pass_salt);
  const a = Buffer.from(h, 'hex'), b = Buffer.from(u.recovery_hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return fail;

  const salt = crypto.randomBytes(16).toString('hex');
  const recovery = makeRecoveryCode();
  db.prepare('UPDATE users SET pass_hash=?, pass_salt=?, recovery_hash=?, recovery_used=0 WHERE id=?')
    .run(hashPassword(newPass, salt), salt, hashPassword(normRecovery(recovery), salt), u.id);
  dropAllSessions(u.id);
  return { ok: true, user: getUser(u.id), recovery };
}

/** کد بازیابی تازه برای کسی که وارد شده (کد قبلی باطل می‌شود) */
function regenerateRecovery(userId, password) {
  const u = getUser(userId);
  if (!u) return { ok: false, reason: 'کاربر یافت نشد' };
  if (!checkPassword(u, password)) return { ok: false, reason: 'رمز درست نیست' };
  const recovery = makeRecoveryCode();
  db.prepare('UPDATE users SET recovery_hash=?, recovery_used=0 WHERE id=?')
    .run(hashPassword(normRecovery(recovery), u.pass_salt), userId);
  return { ok: true, recovery };
}

/* ========================================================================
 *  وصل کردن حساب تلگرام و وب به هم
 *
 *  هدف: کسی که از سایت آمده و بعداً از مینی‌اپ تلگرام وارد می‌شود،
 *  نباید دو حساب جدا با دو کیف پول جدا داشته باشد.
 * ===================================================================== */

function attachTelegram(userId, tgId) {
  const existing = getUserByTelegram(tgId);
  if (existing && existing.id !== userId) {
    return { ok: false, reason: 'این حساب تلگرام قبلاً به کاربر دیگری وصل شده', other: existing };
  }
  db.prepare('UPDATE users SET telegram_id = ?, is_guest = 0 WHERE id = ?').run(String(tgId), userId);
  return { ok: true, user: getUser(userId) };
}

function detachTelegram(userId) {
  const u = getUser(userId);
  if (!u) return { ok: false, reason: 'کاربر یافت نشد' };
  // اگر تلگرام تنها راه ورودش باشد، جدا کردنش یعنی قفل شدن بیرون حساب
  if (!u.username) return { ok: false, reason: 'اول برای حساب نام کاربری و رمز بگذارید' };
  db.prepare('UPDATE users SET telegram_id = NULL WHERE id = ?').run(userId);
  return { ok: true, user: getUser(userId) };
}

/** کد ۶ رقمی موقت که کاربر در طرف دیگر وارد می‌کند */
function createLinkCode(userId, ttlMs = 10 * 60 * 1000) {
  db.prepare('DELETE FROM link_codes WHERE user_id = ? OR expires_at < ?').run(userId, now());
  let code;
  for (let i = 0; i < 20; i++) {
    code = String(crypto.randomInt(100000, 1000000));
    if (!db.prepare('SELECT 1 FROM link_codes WHERE code = ?').get(code)) break;
  }
  const t = now();
  db.prepare('INSERT INTO link_codes (code, user_id, created_at, expires_at) VALUES (?,?,?,?)')
    .run(code, userId, t, t + ttlMs);
  return { ok: true, code, expiresAt: t + ttlMs };
}

/**
 * مصرف کد لینک: حساب «مهمانِ» طرف مقابل در حساب اصلی ادغام می‌شود.
 * @param code    کدی که کاربر روی دستگاه دیگر گرفته (حساب مقصد)
 * @param fromId  حسابی که الان با آن وارد شده (ادغام می‌شود و حذف می‌شود)
 */
function consumeLinkCode(code, fromId) {
  return tx(() => {
    const row = db.prepare('SELECT * FROM link_codes WHERE code = ?').get(String(code || '').trim());
    if (!row) return { ok: false, reason: 'کد لینک درست نیست' };
    if (row.expires_at < now()) {
      db.prepare('DELETE FROM link_codes WHERE code = ?').run(row.code);
      return { ok: false, reason: 'کد منقضی شده — کد تازه بگیرید' };
    }
    if (row.user_id === fromId) return { ok: false, reason: 'همین حساب است' };

    const target = getUser(row.user_id);
    const from = getUser(fromId);
    if (!target || !from) return { ok: false, reason: 'حساب یافت نشد' };

    /* فقط حساب بدون نام کاربری (مهمان یا تلگرامی خالص) می‌تواند ادغام شود.
     * اگر هر دو حساب واقعی باشند، ادغام یعنی یکی از آن‌ها باید نابود شود —
     * آن را دستی و با نظر ادمین انجام می‌دهیم، نه خودکار. */
    if (from.username && target.username) {
      return { ok: false, reason: 'هر دو حساب نام کاربری دارند؛ برای ادغام با پشتیبانی تماس بگیرید' };
    }
    const keep = from.username ? from : target;      // حسابی که می‌ماند
    const merge = keep === from ? target : from;     // حسابی که در آن ادغام می‌شود

    if (keep.id === merge.id) return { ok: false, reason: 'همین حساب است' };

    // دارایی‌ها منتقل می‌شوند — هیچ سکه‌ای ساخته یا گم نمی‌شود
    if (merge.coins || merge.energy || merge.balance) {
      qApply.run(merge.coins, merge.energy, 0, merge.balance || 0, keep.id);
      qInsertTx.run(keep.id, 'merge', merge.coins, merge.energy, merge.balance || 0,
        keep.coins + merge.coins, keep.energy + merge.energy, (keep.balance || 0) + (merge.balance || 0),
        'ادغام حساب ' + merge.id, merge.id, now());
      qApply.run(-merge.coins, -merge.energy, 0, -(merge.balance || 0), merge.id);
      qInsertTx.run(merge.id, 'merge', -merge.coins, -merge.energy, -(merge.balance || 0),
        0, 0, 0, 'انتقال به حساب ' + keep.id, keep.id, now());
    }

    // تلگرام حساب ادغام‌شده به حساب باقی‌مانده می‌رسد
    if (merge.telegram_id && !keep.telegram_id) {
      db.prepare('UPDATE users SET telegram_id = NULL WHERE id = ?').run(merge.id);
      db.prepare('UPDATE users SET telegram_id = ? WHERE id = ?').run(merge.telegram_id, keep.id);
    }

    // پوسته‌های خریداری‌شده هم منتقل شوند
    try {
      const a = JSON.parse(keep.skins || '["classic"]');
      const b = JSON.parse(merge.skins || '["classic"]');
      const all = [...new Set([...a, ...b])];
      db.prepare('UPDATE users SET skins = ? WHERE id = ?').run(JSON.stringify(all), keep.id);
    } catch (e) {}

    db.prepare("UPDATE users SET banned = 1, ban_reason = 'ادغام‌شده در ' || ? WHERE id = ?")
      .run(keep.id, merge.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(merge.id);
    db.prepare('DELETE FROM link_codes WHERE code = ?').run(row.code);

    return { ok: true, user: getUser(keep.id), mergedFrom: merge.id };
  });
}

function setBanned(userId, banned, reason) {
  db.prepare('UPDATE users SET banned = ?, ban_reason = ? WHERE id = ?').run(banned ? 1 : 0, reason || null, userId);
  return getUser(userId);
}

/* ========================================================================
 *  کیف پول — تنها راه تغییر موجودی
 * ===================================================================== */

const qApply = db.prepare('UPDATE users SET coins = coins + ?, energy = energy + ?, xp = xp + ?, balance = balance + ? WHERE id = ?');
const qInsertTx = db.prepare(`INSERT INTO transactions
  (user_id, type, coins, energy, balance, coins_after, energy_after, balance_after, note, ref, created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)`);

/**
 * تغییر موجودی + ثبت تراکنش. همیشه داخل یک تراکنش دیتابیس.
 * اگر allowNegative نباشد و موجودی کافی نباشد، رد می‌شود.
 *
 * balance به میکرو-تتر است.
 */
function wallet(userId, { coins = 0, energy = 0, xp = 0, balance = 0, type, note = '', ref = null, allowNegative = false }) {
  return tx(() => {
    const u = qUserById.get(userId);
    if (!u) return { ok: false, reason: 'کاربر یافت نشد' };
    if (u.banned) return { ok: false, reason: 'حساب مسدود است' };

    const nc = u.coins + coins;
    const ne = u.energy + energy;
    const nb = (u.balance || 0) + balance;
    if (!allowNegative && (nc < 0 || ne < 0 || nb < 0)) {
      return {
        ok: false,
        reason: nc < 0 ? 'سکه کافی نیست' : ne < 0 ? 'انرژی کافی نیست' : 'بالانس کافی نیست'
      };
    }

    qApply.run(coins, energy, xp, balance, userId);
    qInsertTx.run(userId, type, coins, energy, balance,
      Math.max(0, nc), Math.max(0, ne), Math.max(0, nb), note, ref, now());
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
      const nb = (u.balance || 0) + (op.balance || 0);
      if (!op.allowNegative && (nc < 0 || ne < 0 || nb < 0)) throw new Error('موجودی کافی نیست: ' + op.userId);
      qApply.run(op.coins || 0, op.energy || 0, op.xp || 0, op.balance || 0, op.userId);
      qInsertTx.run(op.userId, op.type, op.coins || 0, op.energy || 0, op.balance || 0,
        Math.max(0, nc), Math.max(0, ne), Math.max(0, nb), op.note || '', op.ref || null, now());
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

/* ========================================================================
 *  اقتصاد تتری — بالانس، واریز، برداشت، خرید و فروش سکه
 *
 *  جریان پول:
 *    واریز تتر / کد وچر  →  بالانس  →  سکه  →  بازی
 *                            ↑           ↓
 *                            └─ فروش سکه ┘
 *    بالانس  →  درخواست برداشت  →  تأیید ادمین  →  تتر روی زنجیره
 *
 *  هیچ‌کدام از این‌ها مستقیم موجودی را دست نمی‌زنند — همه از wallet()
 *  رد می‌شوند تا هر حرکت پول یک ردیف تراکنش داشته باشد.
 * ===================================================================== */

/* ── خرید سکه از بالانس ─────────────────────────────────────── */

function buyCoins(userId, coins) {
  coins = Math.floor(Number(coins) || 0);
  const min = setting('BUY_MIN');
  if (coins < min) return { ok: false, reason: `حداقل خرید ${min.toLocaleString('fa-IR')} سکه است` };
  if (coins > 100000000) return { ok: false, reason: 'مقدار خیلی زیاد است' };

  const cost = coins * setting('BUY_RATE');   // میکرو-تتر
  const u = getUser(userId);
  if (!u) return { ok: false, reason: 'کاربر یافت نشد' };
  if ((u.balance || 0) < cost) {
    return { ok: false, reason: `بالانس کافی نیست — ${fmtUsdt(cost)} تتر لازم است` };
  }

  const r = wallet(userId, {
    coins, balance: -cost, type: 'buy',
    note: `خرید ${coins.toLocaleString('fa-IR')} سکه با ${fmtUsdt(cost)} تتر`
  });
  if (!r.ok) return r;
  return { ok: true, coins, cost, user: r.user };
}

/** خرید بسته‌ی آماده: پول coins داده می‌شود، coins+bonus سکه می‌رسد */
function buyPack(userId, pack) {
  const base = Math.floor(Number(pack.coins) || 0);
  const total = Math.round(base * (1 + (Number(pack.bonus) || 0) / 100));
  if (base <= 0) return { ok: false, reason: 'بسته درست نیست' };

  const cost = base * setting('BUY_RATE');
  const u = getUser(userId);
  if (!u) return { ok: false, reason: 'کاربر یافت نشد' };
  if ((u.balance || 0) < cost) {
    return { ok: false, reason: `بالانس کافی نیست — ${fmtUsdt(cost)} تتر لازم است` };
  }

  const bonus = total - base;
  const r = wallet(userId, {
    coins: total, balance: -cost, type: 'buy', ref: pack.id,
    note: `خرید بسته ${base.toLocaleString('fa-IR')} سکه` +
          (bonus > 0 ? ` + ${bonus.toLocaleString('fa-IR')} هدیه` : '') +
          ` — ${fmtUsdt(cost)} تتر`
  });
  if (!r.ok) return r;
  return { ok: true, coins: total, bonus, cost, user: r.user };
}

/* ── فروش سکه به بالانس (فوری، بدون انتظار ادمین) ───────────── */

function sellCoins(userId, coins) {
  coins = Math.floor(Number(coins) || 0);
  const min = setting('SELL_MIN');
  if (coins < min) return { ok: false, reason: `حداقل فروش ${min.toLocaleString('fa-IR')} سکه است` };

  const gain = coins * setting('SELL_RATE');  // میکرو-تتر
  if (gain <= 0) return { ok: false, reason: 'مقدار درست نیست' };

  const r = wallet(userId, {
    coins: -coins, balance: gain, type: 'sell',
    note: `فروش ${coins.toLocaleString('fa-IR')} سکه — ${fmtUsdt(gain)} تتر`
  });
  if (!r.ok) return r;
  return { ok: true, coins, gain, user: r.user };
}

/* ── واریز تتر با TXID ──────────────────────────────────────── */

function normTxid(t) { return String(t || '').trim().replace(/^0x/i, '').toLowerCase(); }

function requestDeposit(userId, { amount, txid, network = 'TRC20' }) {
  const micro = Math.round(Number(amount) || 0);
  const min = setting('DEPOSIT_MIN');
  if (micro < min) return { ok: false, reason: `حداقل واریز ${fmtUsdt(min)} تتر است` };

  const tx_ = normTxid(txid);
  if (tx_.length < 32 || tx_.length > 128 || !/^[a-f0-9]+$/.test(tx_)) {
    return { ok: false, reason: 'شناسه تراکنش (TXID) درست نیست' };
  }
  if (!['TRC20', 'BEP20'].includes(network)) return { ok: false, reason: 'شبکه پشتیبانی نمی‌شود' };

  // یک TXID فقط یک بار — جلوی ثبت دوباره‌ی یک واریز
  if (db.prepare('SELECT 1 FROM deposits WHERE txid = ?').get(tx_)) {
    return { ok: false, reason: 'این شناسه تراکنش قبلاً ثبت شده است' };
  }
  const open = db.prepare("SELECT COUNT(*) n FROM deposits WHERE user_id=? AND status='pending'").get(userId).n;
  if (open >= 5) return { ok: false, reason: 'چند درخواست در انتظار دارید — صبر کنید تا بررسی شوند' };

  const id = 'D' + crypto.randomBytes(5).toString('hex').toUpperCase();
  db.prepare(`INSERT INTO deposits (id, user_id, network, amount, txid, created_at)
              VALUES (?,?,?,?,?,?)`).run(id, userId, network, micro, tx_, now());
  return { ok: true, id, amount: micro };
}

/** ادمین واریز را تأیید می‌کند. credited اگر داده شود جای مبلغ ادعاشده می‌نشیند. */
function resolveDeposit(id, action, { credited = null, adminUser = null, note = '' } = {}) {
  return tx(() => {
    const d = db.prepare('SELECT * FROM deposits WHERE id = ?').get(id);
    if (!d) return { ok: false, reason: 'درخواست یافت نشد' };
    if (d.status !== 'pending') return { ok: false, reason: 'این درخواست قبلاً رسیدگی شده' };

    if (action === 'reject') {
      db.prepare("UPDATE deposits SET status='rejected', handled_at=?, handled_by=?, admin_note=? WHERE id=?")
        .run(now(), adminUser, note || null, id);
      return { ok: true, status: 'rejected' };
    }
    if (action !== 'approve') return { ok: false, reason: 'عملیات نامعتبر' };

    const amount = credited == null ? d.amount : Math.round(Number(credited));
    if (!(amount > 0)) return { ok: false, reason: 'مبلغ درست نیست' };

    const r = wallet(d.user_id, {
      balance: amount, type: 'deposit', ref: id,
      note: `واریز ${fmtUsdt(amount)} تتر (${d.network})`
    });
    if (!r.ok) return r;

    db.prepare("UPDATE deposits SET status='approved', credited=?, handled_at=?, handled_by=?, admin_note=? WHERE id=?")
      .run(amount, now(), adminUser, note || null, id);
    return { ok: true, status: 'approved', amount, user: r.user };
  });
}

/* ── کد وچر ─────────────────────────────────────────────────── */

function makeVoucherCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 16; i++) {
    if (i && i % 4 === 0) out += '-';
    out += A[crypto.randomBytes(1)[0] % A.length];
  }
  return out;
}
function normVoucher(c) {
  const raw = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return raw.replace(/(.{4})(?=.)/g, '$1-');
}

function createVouchers(amountMicro, count = 1, { adminUser = null, note = '' } = {}) {
  const amount = Math.round(Number(amountMicro) || 0);
  if (!(amount > 0)) return { ok: false, reason: 'مبلغ درست نیست' };
  count = Math.min(Math.max(1, Math.floor(Number(count) || 1)), 200);

  const codes = [];
  const ins = db.prepare('INSERT INTO vouchers (code, amount, note, created_by, created_at) VALUES (?,?,?,?,?)');
  tx(() => {
    for (let i = 0; i < count; i++) {
      let code;
      for (let k = 0; k < 20; k++) {
        code = makeVoucherCode();
        if (!db.prepare('SELECT 1 FROM vouchers WHERE code = ?').get(code)) break;
      }
      ins.run(code, amount, note || null, adminUser, now());
      codes.push(code);
    }
  });
  return { ok: true, codes, amount };
}

function redeemVoucher(userId, code) {
  const c = normVoucher(code);
  if (c.length < 19) return { ok: false, reason: 'کد وچر درست نیست' };

  return tx(() => {
    const v = db.prepare('SELECT * FROM vouchers WHERE code = ?').get(c);
    if (!v) return { ok: false, reason: 'کد وچر پیدا نشد' };
    if (v.used_at) return { ok: false, reason: 'این کد قبلاً استفاده شده است' };

    /* ⚠️ اول کد را مصرف‌شده علامت می‌زنیم، بعد پول می‌دهیم.
     * اگر برعکس بود، دو درخواست همزمان می‌توانستند یک کد را دو بار خرج کنند. */
    const n = db.prepare('UPDATE vouchers SET used_by=?, used_at=? WHERE code=? AND used_at IS NULL')
      .run(userId, now(), c).changes;
    if (n !== 1) return { ok: false, reason: 'این کد قبلاً استفاده شده است' };

    const r = wallet(userId, {
      balance: v.amount, type: 'voucher', ref: c,
      note: `کد وچر — ${fmtUsdt(v.amount)} تتر`
    });
    if (!r.ok) throw new Error(r.reason);   // تراکنش برمی‌گردد، کد دوباره آزاد می‌شود
    return { ok: true, amount: v.amount, user: r.user };
  });
}

/* ── برداشت تتر ─────────────────────────────────────────────── */

function validAddress(addr, network) {
  const a = String(addr || '').trim();
  if (network === 'TRC20') return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a);
  if (network === 'BEP20') return /^0x[a-fA-F0-9]{40}$/.test(a);
  return false;
}

function requestWithdraw(userId, { amount, address, network = 'TRC20' }) {
  const micro = Math.round(Number(amount) || 0);
  const min = setting('WITHDRAW_MIN');
  const fee = setting('WITHDRAW_FEE');
  if (micro < min) return { ok: false, reason: `حداقل برداشت ${fmtUsdt(min)} تتر است` };
  if (micro <= fee) return { ok: false, reason: 'مبلغ باید از کارمزد بیشتر باشد' };
  if (!validAddress(address, network)) return { ok: false, reason: 'آدرس کیف پول درست نیست' };

  const open = db.prepare("SELECT COUNT(*) n FROM withdrawals WHERE user_id=? AND status='pending'").get(userId).n;
  if (open >= 2) return { ok: false, reason: 'درخواست برداشت در انتظار دارید' };

  const id = 'W' + crypto.randomBytes(5).toString('hex').toUpperCase();
  const payout = micro - fee;

  /* پول همین حالا از بالانس کم می‌شود، نه موقع تأیید ادمین —
   * وگرنه کاربر می‌توانست چند برداشت روی یک موجودی ثبت کند. */
  const r = wallet(userId, {
    balance: -micro, type: 'withdraw', ref: id,
    note: `درخواست برداشت ${fmtUsdt(payout)} تتر (کارمزد ${fmtUsdt(fee)})`
  });
  if (!r.ok) return r;

  db.prepare(`INSERT INTO withdrawals (id, user_id, network, amount, fee, payout, address, created_at)
              VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, userId, network, micro, fee, payout, String(address).trim(), now());
  return { ok: true, id, payout, fee, user: r.user };
}

function resolveWithdraw(id, action, { txid = null, adminUser = null, note = '' } = {}) {
  return tx(() => {
    const w = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id);
    if (!w) return { ok: false, reason: 'درخواست یافت نشد' };
    if (w.status !== 'pending') return { ok: false, reason: 'این درخواست قبلاً رسیدگی شده' };

    if (action === 'reject') {
      // پول برمی‌گردد به بالانس کاربر
      const r = wallet(w.user_id, {
        balance: w.amount, type: 'withdraw', ref: id,
        note: 'برگشت درخواست برداشت' + (note ? ' — ' + note : '')
      });
      if (!r.ok) return r;
      db.prepare("UPDATE withdrawals SET status='rejected', handled_at=?, handled_by=?, admin_note=? WHERE id=?")
        .run(now(), adminUser, note || null, id);
      return { ok: true, status: 'rejected', user: r.user };
    }
    if (action !== 'paid') return { ok: false, reason: 'عملیات نامعتبر' };

    db.prepare("UPDATE withdrawals SET status='paid', txid=?, handled_at=?, handled_by=?, admin_note=? WHERE id=?")
      .run(txid ? String(txid).trim() : null, now(), adminUser, note || null, id);
    return { ok: true, status: 'paid' };
  });
}

function listDeposits({ status = null, userId = null, limit = 50, offset = 0 } = {}) {
  const w = [], p = [];
  if (status) { w.push('d.status = ?'); p.push(status); }
  if (userId) { w.push('d.user_id = ?'); p.push(userId); }
  const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
  const rows = db.prepare(`SELECT d.*, u.username, u.name FROM deposits d
    LEFT JOIN users u ON u.id = d.user_id ${where}
    ORDER BY d.created_at DESC LIMIT ? OFFSET ?`).all(...p, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) n FROM deposits d ${where}`).get(...p).n;
  return { rows, total };
}

function listWithdrawals({ status = null, userId = null, limit = 50, offset = 0 } = {}) {
  const w = [], p = [];
  if (status) { w.push('x.status = ?'); p.push(status); }
  if (userId) { w.push('x.user_id = ?'); p.push(userId); }
  const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
  const rows = db.prepare(`SELECT x.*, u.username, u.name FROM withdrawals x
    LEFT JOIN users u ON u.id = x.user_id ${where}
    ORDER BY x.created_at DESC LIMIT ? OFFSET ?`).all(...p, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) n FROM withdrawals x ${where}`).get(...p).n;
  return { rows, total };
}

function listVouchers({ used = null, limit = 100, offset = 0 } = {}) {
  let where = '';
  if (used === true) where = 'WHERE used_at IS NOT NULL';
  if (used === false) where = 'WHERE used_at IS NULL';
  const rows = db.prepare(`SELECT v.*, u.username FROM vouchers v
    LEFT JOIN users u ON u.id = v.used_by ${where}
    ORDER BY v.created_at DESC LIMIT ? OFFSET ?`).all(limit, offset);
  const total = db.prepare(`SELECT COUNT(*) n FROM vouchers v ${where}`).get().n;
  return { rows, total };
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

/** همه‌ی نشست‌های یک کاربر — بعد از عوض شدن رمز، همه‌ی دستگاه‌ها بیرون می‌روند */
function dropAllSessions(userId) { db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId); }

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
      // همه‌ی مبالغ تتری به میکرو-تتر
      balanceHeld: one('SELECT COALESCE(SUM(balance),0) n FROM users').n,
      depositedTotal: one("SELECT COALESCE(SUM(credited),0) n FROM deposits WHERE status='approved'").n,
      depositedToday: one("SELECT COALESCE(SUM(credited),0) n FROM deposits WHERE status='approved' AND handled_at > ?", day).n,
      withdrawnTotal: one("SELECT COALESCE(SUM(payout),0) n FROM withdrawals WHERE status='paid'").n,
      vouchersTotal: one('SELECT COALESCE(SUM(amount),0) n FROM vouchers WHERE used_at IS NOT NULL').n,
      coinsBoughtToday: one("SELECT COALESCE(SUM(coins),0) n FROM transactions WHERE type='buy' AND created_at > ?", day).n,
      coinsSoldToday: one("SELECT COALESCE(SUM(-coins),0) n FROM transactions WHERE type='sell' AND created_at > ?", day).n
    },
    pending: {
      claims: one("SELECT COUNT(*) n FROM claims WHERE status='pending'").n,
      prize: one("SELECT COUNT(*) n FROM claims WHERE status='pending' AND kind='prize'").n,
      deposits: one("SELECT COUNT(*) n FROM deposits WHERE status='pending'").n,
      depositsAmount: one("SELECT COALESCE(SUM(amount),0) n FROM deposits WHERE status='pending'").n,
      withdrawals: one("SELECT COUNT(*) n FROM withdrawals WHERE status='pending'").n,
      withdrawalsAmount: one("SELECT COALESCE(SUM(payout),0) n FROM withdrawals WHERE status='pending'").n,
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
      // درآمد روز به میکرو-تتر: واریزهای تأییدشده + وچرهای مصرف‌شده
      revenue: db.prepare("SELECT COALESCE(SUM(credited),0) n FROM deposits WHERE status='approved' AND handled_at >= ? AND handled_at < ?").get(from, to).n
        + db.prepare('SELECT COALESCE(SUM(amount),0) n FROM vouchers WHERE used_at >= ? AND used_at < ?').get(from, to).n
    });
  }
  return out;
}

function listUsers({ q = '', sort = 'created_at', dir = 'DESC', limit = 30, offset = 0, banned = null }) {
  const cols = ['created_at', 'last_seen', 'coins', 'energy', 'balance', 'xp', 'games', 'wins'];
  const col = cols.includes(sort) ? sort : 'created_at';
  const d = dir === 'ASC' ? 'ASC' : 'DESC';

  const where = [];
  const args = [];
  if (q) {
    where.push('(id LIKE ? OR name LIKE ? OR username LIKE ? OR referral_code LIKE ? OR telegram_id LIKE ?)');
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
    SELECT c.*, u.name AS user_name, u.username AS user_username, u.coins AS user_coins, u.banned AS user_banned
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

  USDT, toMicro, fromMicro, fmtUsdt,
  createUser, getUser, getUserByUsername, getUserByTelegram, getUserByCode,
  touchUser, updateProfile, setBanned,
  register, login, checkPassword, changePassword, recoverWithCode, regenerateRecovery,
  usernameProblem, passwordProblem, normUsername,
  attachTelegram, detachTelegram, createLinkCode, consumeLinkCode,

  wallet, walletBatch, listTransactions,
  claimWelcome, dailyAvailable, claimDaily, applyReferral,

  roomEconomy, energyFor, stake, refund, startGame, settleGame,
  buyCoins, buyPack, sellCoins, redeemPrize, buySkin, equipSkin,
  requestDeposit, resolveDeposit, listDeposits,
  createVouchers, redeemVoucher, listVouchers, normVoucher,
  requestWithdraw, resolveWithdraw, listWithdrawals,

  createSession, userByToken, dropSession, dropAllSessions,

  flagFraud, checkCollusion, checkMultiAccount,
  stats, chartDaily, listUsers, listClaims, resolveClaim, listFraud, resolveFraud, userDetail,

  createAdmin, getAdmin, verifyPassword, verifyTotp, totpUri, enableTotp,
  createAdminSession, adminByToken, dropAdminSession, noteAdminFail,
  adminLog, listAdminLog
};
