/* =========================================================================
 *  admin.js — API پنل مدیریت
 *
 *  ورود: نام کاربری + رمز + کد دو مرحله‌ای (TOTP، سازگار با Google Authenticator)
 *  هر کاری که ادمین می‌کند در جدول admin_log ثبت می‌شود.
 * ========================================================================= */
'use strict';

const D = require('./db.js');
const C = require('./config.js');
const { json, readBody, clientIp, tooFast } = require('./api.js');

function adminFromReq(req) {
  const h = req.headers['authorization'] || '';
  const tk = h.startsWith('Bearer ') ? h.slice(7).trim() : null;
  return { token: tk, admin: D.adminByToken(tk) };
}

/** کاربر را برای نمایش در پنل آماده می‌کند */
function adminUserRow(u) {
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    telegramId: u.telegram_id,
    avatar: u.avatar,
    coins: u.coins,
    energy: u.energy,
    level: D.levelOf(u.xp).level,
    xp: u.xp,
    games: u.games,
    wins: u.wins,
    losses: u.losses,
    isGuest: !!u.is_guest,
    banned: !!u.banned,
    banReason: u.ban_reason,
    referralCode: u.referral_code,
    referredBy: u.referred_by,
    invitedCount: u.invited_count,
    note: u.note,
    lastIp: u.last_ip,
    createdAt: u.created_at,
    lastSeen: u.last_seen
  };
}

async function handle(req, res, url) {
  /* مسیرهای API ادمین با /admin/ شروع می‌شوند، ولی صفحه‌های خود پنل
   * (Next.js) هم روی همان /admin/ هستند. پشت nginx این دو با هم تداخل
   * می‌کنند: درخواست /admin/login به‌جای JSON، صفحه‌ی HTML برمی‌گرداند.
   *
   * راه‌حل: پنل با پیشوند /adminapi/ صدا می‌زند و ما همان‌جا به /admin/
   * ترجمه‌اش می‌کنیم. هر دو شکل کار می‌کنند تا در حالت توسعه (بدون nginx)
   * هم چیزی نشکند. */
  let path = url.pathname;
  if (path.startsWith('/adminapi/')) path = '/admin/' + path.slice(10);
  if (!path.startsWith('/admin/')) return false;

  const ip = clientIp(req);

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

  /* ------------------------------------------------------------ ورود */

  if (path === '/admin/login' && req.method === 'POST') {
    if (tooFast('adminlogin:' + ip, 10)) {
      json(res, { ok: false, message: 'تلاش‌های زیاد — کمی صبر کنید' }, 429);
      return true;
    }
    const body = await readBody(req);
    const username = String(body.username || '').trim().slice(0, 40);
    const a = D.getAdmin(username);

    // پاسخ یکسان برای «کاربر نیست» و «رمز غلط» تا اسم ادمین لو نرود
    const deny = () => { json(res, { ok: false, message: 'نام کاربری یا رمز درست نیست' }, 401); return true; };

    if (!a) return deny();
    if (a.locked_until > Date.now()) {
      const m = Math.ceil((a.locked_until - Date.now()) / 60000);
      json(res, { ok: false, message: `حساب تا ${m} دقیقه قفل است` }, 429);
      return true;
    }
    if (!D.verifyPassword(a, String(body.password || ''))) {
      D.noteAdminFail(username);
      D.adminLog(null, 'login_failed', username, 'رمز اشتباه', ip);
      return deny();
    }

    // مرحله‌ی دوم
    if (a.totp_enabled) {
      if (!body.totp) { json(res, { ok: false, needTotp: true, message: 'کد دو مرحله‌ای را وارد کنید' }); return true; }
      if (!D.verifyTotp(a.totp_secret, body.totp)) {
        D.noteAdminFail(username);
        D.adminLog(null, 'login_failed', username, 'کد دو مرحله‌ای اشتباه', ip);
        json(res, { ok: false, needTotp: true, message: 'کد دو مرحله‌ای درست نیست' }, 401);
        return true;
      }
    }

    const token = D.createAdminSession(a.id, ip);
    D.adminLog(a, 'login', null, null, ip);
    json(res, {
      ok: true, token,
      admin: { username: a.username, role: a.role },
      // اگر هنوز دو مرحله‌ای فعال نکرده، همان لحظه راهنمایی‌اش می‌کنیم
      setupTotp: a.totp_enabled ? null : { secret: a.totp_secret, uri: D.totpUri(a.username, a.totp_secret) }
    });
    return true;
  }

  /* ------------------------------ از اینجا به بعد باید وارد شده باشد */

  const { token, admin } = adminFromReq(req);
  if (!admin) { json(res, { ok: false, message: 'وارد نشده‌اید' }, 401); return true; }

  const body = req.method === 'POST' ? await readBody(req) : {};
  const q = url.searchParams;
  const num = (k, d) => {
    const raw = q.get(k);
    if (raw === null || raw === '') return d;      // پارامتر نیامده → پیش‌فرض
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : d;
  };

  switch (path) {

    case '/admin/me':
      json(res, { ok: true, admin });
      return true;

    case '/admin/logout':
      D.dropAdminSession(token);
      D.adminLog(admin, 'logout', null, null, ip);
      json(res, { ok: true });
      return true;

    /* --------------------------------------- فعال کردن دو مرحله‌ای */

    case '/admin/totp/enable': {
      const a = D.getAdmin(admin.username);
      if (a.totp_enabled) { json(res, { ok: false, message: 'قبلاً فعال شده' }); return true; }
      if (!D.verifyTotp(a.totp_secret, body.code)) {
        json(res, { ok: false, message: 'کد درست نیست — دوباره امتحان کنید' });
        return true;
      }
      D.enableTotp(admin.username);
      D.adminLog(admin, 'totp_enabled', admin.username, null, ip);
      json(res, { ok: true });
      return true;
    }

    /* -------------------------------------------------------- آمار */

    case '/admin/stats':
      json(res, { ok: true, stats: D.stats(), chart: D.chartDaily(num('days', 14)) });
      return true;

    /* ----------------------------------------------------- کاربران */

    case '/admin/users': {
      const r = D.listUsers({
        q: q.get('q') || '',
        sort: q.get('sort') || 'created_at',
        dir: q.get('dir') || 'DESC',
        limit: Math.min(100, num('limit', 30)),
        offset: num('offset', 0),
        banned: q.get('banned') === '1' ? true : (q.get('banned') === '0' ? false : null)
      });
      json(res, { ok: true, rows: r.rows.map(adminUserRow), total: r.total });
      return true;
    }

    case '/admin/user': {
      const d = D.userDetail(q.get('id') || body.id);
      if (!d) { json(res, { ok: false, message: 'کاربر یافت نشد' }, 404); return true; }
      json(res, {
        ok: true,
        user: adminUserRow(d.user),
        level: d.level,
        transactions: d.transactions,
        games: d.games,
        claims: d.claims,
        sameIp: d.sameIp
      });
      return true;
    }

    case '/admin/user/ban': {
      const u = D.getUser(body.id);
      if (!u) { json(res, { ok: false, message: 'کاربر یافت نشد' }, 404); return true; }
      D.setBanned(body.id, body.banned ? 1 : 0, body.reason || null);
      D.adminLog(admin, body.banned ? 'ban' : 'unban', body.id, body.reason || '', ip);
      json(res, { ok: true, user: adminUserRow(D.getUser(body.id)) });
      return true;
    }

    /** اصلاح دستی موجودی — همیشه در تراکنش‌ها و لاگ ادمین ثبت می‌شود */
    case '/admin/user/adjust': {
      const coins = Math.round(Number(body.coins) || 0);
      const energy = Math.round(Number(body.energy) || 0);
      if (!coins && !energy) { json(res, { ok: false, message: 'مقدار را وارد کنید' }); return true; }
      if (Math.abs(coins) > 100000000 || Math.abs(energy) > 10000000) {
        json(res, { ok: false, message: 'مقدار بیش از حد مجاز' });
        return true;
      }
      const reason = String(body.reason || '').slice(0, 120);
      if (!reason) { json(res, { ok: false, message: 'دلیل را بنویسید' }); return true; }

      const r = D.wallet(body.id, {
        coins, energy, type: 'admin',
        note: `اصلاح توسط ${admin.username}: ${reason}`,
        allowNegative: false
      });
      if (!r.ok) { json(res, r); return true; }
      D.adminLog(admin, 'adjust', body.id, `سکه ${coins} انرژی ${energy} — ${reason}`, ip);
      json(res, { ok: true, user: adminUserRow(D.getUser(body.id)) });
      return true;
    }

    case '/admin/user/note': {
      D.db.prepare('UPDATE users SET note = ? WHERE id = ?').run(String(body.note || '').slice(0, 500), body.id);
      D.adminLog(admin, 'note', body.id, null, ip);
      json(res, { ok: true });
      return true;
    }

    /* ---------------------------------------------- درخواست‌ها */

    case '/admin/claims': {
      const r = D.listClaims({
        status: q.get('status') || 'pending',
        kind: q.get('kind') || null,
        limit: Math.min(100, num('limit', 50)),
        offset: num('offset', 0)
      });
      json(res, { ok: true, rows: r.rows, total: r.total });
      return true;
    }

    case '/admin/claim/resolve': {
      const action = body.action === 'approve' ? 'approve' : 'reject';
      const r = D.resolveClaim(body.id, action, admin.username, body.note);
      if (!r.ok) { json(res, r); return true; }
      D.adminLog(admin, 'claim_' + action, body.id, body.note || '', ip);
      json(res, r);
      return true;
    }

    /* --------------------------------------------------- تقلب */

    case '/admin/fraud':
      json(res, { ok: true, rows: D.listFraud({ resolved: q.get('resolved') === '1', limit: Math.min(200, num('limit', 50)) }) });
      return true;

    case '/admin/fraud/resolve':
      D.resolveFraud(body.id);
      D.adminLog(admin, 'fraud_resolved', String(body.id), null, ip);
      json(res, { ok: true });
      return true;

    /* ------------------------------------------------ تنظیمات */

    case '/admin/settings':
      json(res, { ok: true, settings: D.allSettings(), defaults: D.DEFAULT_SETTINGS, rooms: C.ROOMS });
      return true;

    case '/admin/settings/save': {
      if (admin.role !== 'owner') { json(res, { ok: false, message: 'فقط مالک می‌تواند تنظیمات را عوض کند' }, 403); return true; }
      const changed = [];
      for (const [k, v] of Object.entries(body.settings || {})) {
        if (D.setSetting(k, v)) changed.push(`${k}=${v}`);
      }
      D.adminLog(admin, 'settings', null, changed.join(', '), ip);
      json(res, { ok: true, settings: D.allSettings(), changed });
      return true;
    }

    /* ----------------------------------------------- لاگ ادمین */

    case '/admin/log':
      json(res, { ok: true, rows: D.listAdminLog(Math.min(300, num('limit', 100))) });
      return true;

    /* ------------------------------------------ بازی‌های اخیر */

    case '/admin/games': {
      const rows = D.db.prepare(`
        SELECT g.*, a.name AS p1_name, b.name AS p2_name
        FROM games g
        LEFT JOIN users a ON a.id = g.p1_id
        LEFT JOIN users b ON b.id = g.p2_id
        WHERE g.ended_at IS NOT NULL
        ORDER BY g.ended_at DESC LIMIT ?`).all(Math.min(200, num('limit', 50)));
      json(res, { ok: true, rows });
      return true;
    }
  }

  json(res, { ok: false, message: 'مسیر یافت نشد' }, 404);
  return true;
}

module.exports = { handle };
