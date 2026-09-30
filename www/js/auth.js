/* =========================================================================
 *  auth.js — ثبت‌نام، ورود و بازیابی با نام کاربری و رمز
 *
 *  همه‌ی اعتبارسنجی واقعی سمت سرور است؛ اینجا فقط همان قانون‌ها را
 *  تکرار می‌کنیم تا کاربر قبل از رفت‌وبرگشت شبکه بازخورد بگیرد.
 *
 *  بدون سرور (بازی آفلاین با ربات) ثبت‌نام معنا ندارد — در آن حالت
 *  کاربر به‌عنوان مهمان بازی می‌کند و همه چیز روی همین دستگاه می‌ماند.
 * ========================================================================= */
(function (root) {
  'use strict';

  /* ------------------------------------------------------- اعتبارسنجی */

  function normUsername(u) {
    return String(u || '').trim().toLowerCase();
  }

  var RESERVED = /^(admin|owner|support|root|system|nard|moderator|mod)$/;

  /** @returns پیام خطا، یا null اگر درست باشد */
  function usernameProblem(u) {
    var n = normUsername(u);
    if (!n) return 'نام کاربری را وارد کنید';
    if (n.length < 3) return 'نام کاربری حداقل ۳ حرف باشد';
    if (n.length > 20) return 'نام کاربری حداکثر ۲۰ حرف باشد';
    if (!/^[a-z0-9_]+$/.test(n)) return 'فقط حروف انگلیسی، عدد و زیرخط (_) مجاز است';
    if (/^[0-9_]/.test(n)) return 'نام کاربری باید با یک حرف شروع شود';
    if (RESERVED.test(n)) return 'این نام کاربری رزرو شده است';
    return null;
  }

  function passwordProblem(p) {
    var s = String(p || '');
    if (!s) return 'رمز عبور را وارد کنید';
    if (s.length < 8) return 'رمز حداقل ۸ کاراکتر باشد';
    if (s.length > 200) return 'رمز خیلی بلند است';
    if (!/[a-zA-Z]/.test(s) || !/[0-9]/.test(s)) return 'رمز باید هم حرف داشته باشد هم عدد';
    return null;
  }

  /** قدرت رمز، برای نوار راهنما: ۰ تا ۴ */
  function passwordStrength(p) {
    var s = String(p || ''), score = 0;
    if (s.length >= 8) score++;
    if (s.length >= 12) score++;
    if (/[a-z]/.test(s) && /[A-Z]/.test(s)) score++;
    if (/[^a-zA-Z0-9]/.test(s)) score++;
    return Math.min(4, score);
  }

  /** کد بازیابی را به شکل XXXX-XXXX-… مرتب می‌کند */
  function normRecovery(c) {
    var raw = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return raw.replace(/(.{4})(?=.)/g, '$1-');
  }

  /* ----------------------------------------------------------- شبکه */

  function serverBase() {
    var url = (root.Net && root.Net.config && root.Net.config.serverUrl) || '';
    if (!url) return '';
    return url
      .replace(/^ws:/, 'http:')
      .replace(/^wss:/, 'https:')
      .replace(/\/+$/, '')
      // نشانی وب‌سوکت پشت nginx به /ws ختم می‌شود؛ مسیرهای REST آنجا نیستند
      .replace(/\/ws$/, '');
  }

  function offline() {
    return Promise.resolve({
      ok: false,
      message: 'برای ساخت حساب باید به سرور وصل باشید. فعلاً می‌توانید مهمان بازی کنید.'
    });
  }

  function post(path, body) {
    var base = serverBase();
    if (!base) return offline();

    var headers = { 'Content-Type': 'application/json' };
    // اگر مهمان وارد است، توکنش را می‌فرستیم تا همان حساب ارتقا یابد
    var tk = root.API && root.API.token;
    if (tk) headers['Authorization'] = 'Bearer ' + tk;

    return fetch(base + path, {
      method: 'POST', headers: headers, body: JSON.stringify(body)
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d) return { ok: false, message: 'پاسخ سرور خوانده نشد' };
        if (!d.ok && !d.message) d.message = d.reason || 'انجام نشد';
        return d;
      })
      .catch(function () {
        return { ok: false, message: 'به سرور وصل نشدیم — اینترنت را بررسی کنید' };
      });
  }

  /* ---------------------------------------------------------- خروجی */

  /** آیا این نام کاربری آزاد است؟ برای بازخورد زنده‌ی فرم */
  function checkUsername(u) {
    var problem = usernameProblem(u);
    if (problem) return Promise.resolve({ ok: true, available: false, message: problem });

    var base = serverBase();
    if (!base) return Promise.resolve({ ok: true, available: true, message: '' });

    return fetch(base + '/auth/check-username?u=' + encodeURIComponent(normUsername(u)))
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: true, available: true, message: '' } });
  }

  function register(username, password, extra) {
    var p = usernameProblem(username) || passwordProblem(password);
    if (p) return Promise.resolve({ ok: false, message: p });

    var body = { username: normUsername(username), password: String(password) };
    if (extra) {
      if (extra.name) body.name = extra.name;
      if (extra.avatar) body.avatar = extra.avatar;
      if (extra.source) body.source = extra.source;
    }
    return post('/auth/register', body);
  }

  function login(username, password) {
    if (!normUsername(username)) return Promise.resolve({ ok: false, message: 'نام کاربری را وارد کنید' });
    if (!password) return Promise.resolve({ ok: false, message: 'رمز عبور را وارد کنید' });
    return post('/auth/login', { username: normUsername(username), password: String(password) });
  }

  function recover(username, code, newPassword) {
    if (!normUsername(username)) return Promise.resolve({ ok: false, message: 'نام کاربری را وارد کنید' });
    var clean = normRecovery(code);
    if (clean.replace(/-/g, '').length < 20) {
      return Promise.resolve({ ok: false, message: 'کد بازیابی کامل نیست' });
    }
    var pp = passwordProblem(newPassword);
    if (pp) return Promise.resolve({ ok: false, message: pp });

    return post('/auth/recover', {
      username: normUsername(username), code: clean, password: String(newPassword)
    });
  }

  root.Auth = {
    normUsername: normUsername,
    normRecovery: normRecovery,
    usernameProblem: usernameProblem,
    passwordProblem: passwordProblem,
    passwordStrength: passwordStrength,
    checkUsername: checkUsername,
    register: register,
    login: login,
    recover: recover,
    serverBase: serverBase
  };

})(typeof self !== 'undefined' ? self : this);
