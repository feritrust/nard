/* =========================================================================
 *  auth.js — ورود و ثبت‌نام با شماره‌ی موبایل
 *
 *  دو حالت دارد:
 *    • server  → کد تأیید را از سرور می‌گیرد (سرور خودش پیامک می‌فرستد)
 *    • local   → وقتی سرور در دسترس نیست، کد را همان‌جا می‌سازد و نشان می‌دهد
 *                (فقط برای تست و بازی آفلاین)
 *
 *  برای اتصال سرویس پیامک واقعی (کاوه‌نگار، ملی‌پیامک، فراز اس‌ام‌اس و …)
 *  فایل server/server.js بخش sendSms را ببینید — نیازی به تغییر این فایل نیست.
 * ========================================================================= */
(function (root) {
  'use strict';

  var CODE_LEN = 5;
  var RESEND_SECONDS = 60;
  var CODE_TTL_MS = 2 * 60 * 1000;

  /* ------------------------------------------------------- اعتبارسنجی */

  /** شماره‌ی موبایل ایران را به شکل استاندارد 09xxxxxxxxx برمی‌گرداند */
  function normalizePhone(raw) {
    if (!raw) return null;
    // تبدیل ارقام فارسی و عربی به انگلیسی
    var s = String(raw).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
                       .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
    s = s.replace(/\D/g, '');
    if (s.indexOf('0098') === 0) s = '0' + s.slice(4);
    else if (s.indexOf('98') === 0 && s.length === 12) s = '0' + s.slice(2);
    else if (s.length === 10 && s[0] === '9') s = '0' + s;
    if (!/^09\d{9}$/.test(s)) return null;
    return s;
  }

  function prettyPhone(p) {
    if (!p) return '';
    return p.slice(0, 4) + ' ' + p.slice(4, 7) + ' ' + p.slice(7);
  }

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

  /* ------------------------------------------------- حالت محلی (آفلاین) */

  var local = { phone: null, code: null, expires: 0, tries: 0 };

  function localRequest(phone) {
    local.phone = phone;
    local.code = String(Math.floor(Math.random() * 90000) + 10000);
    local.expires = Date.now() + CODE_TTL_MS;
    local.tries = 0;
    return Promise.resolve({
      ok: true, mode: 'local', ttl: CODE_TTL_MS,
      devCode: local.code,          // چون سرور نداریم، کد را به کاربر نشان می‌دهیم
      resendIn: RESEND_SECONDS
    });
  }

  function localVerify(phone, code) {
    if (local.phone !== phone) return Promise.resolve({ ok: false, message: 'ابتدا کد را درخواست کنید' });
    if (Date.now() > local.expires) return Promise.resolve({ ok: false, message: 'کد منقضی شده — دوباره درخواست دهید' });
    if (++local.tries > 5) return Promise.resolve({ ok: false, message: 'تعداد تلاش زیاد — دوباره کد بگیرید' });
    if (String(code) !== local.code) return Promise.resolve({ ok: false, message: 'کد وارد شده درست نیست' });
    return Promise.resolve({
      ok: true, mode: 'local',
      userId: 'u_' + phone.slice(-8),
      token: 'local_' + phone
    });
  }

  /* ------------------------------------------------------- حالت سرور */

  function post(path, body) {
    var base = serverBase();
    return fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }

  /* ------------------------------------------------------------ خروجی */

  /** درخواست کد تأیید */
  function requestCode(rawPhone) {
    var phone = normalizePhone(rawPhone);
    if (!phone) return Promise.resolve({ ok: false, message: 'شماره‌ی موبایل درست نیست (مثال: ۰۹۱۲۱۲۳۴۵۶۷)' });

    if (!serverBase()) return localRequest(phone);

    return post('/auth/request', { phone: phone })
      .then(function (d) {
        if (!d || !d.ok) return { ok: false, message: (d && d.message) || 'ارسال کد ناموفق بود' };
        d.mode = 'server';
        return d;
      })
      .catch(function () {
        // سرور در دسترس نیست → می‌رویم روی حالت محلی
        return localRequest(phone);
      });
  }

  /** بررسی کد تأیید */
  function verifyCode(rawPhone, code) {
    var phone = normalizePhone(rawPhone);
    if (!phone) return Promise.resolve({ ok: false, message: 'شماره‌ی موبایل درست نیست' });
    code = String(code || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/\D/g, '');
    if (code.length !== CODE_LEN) return Promise.resolve({ ok: false, message: 'کد ' + CODE_LEN + ' رقمی را کامل وارد کنید' });

    if (!serverBase()) return localVerify(phone, code);

    return post('/auth/verify', { phone: phone, code: code })
      .then(function (d) {
        if (!d || !d.ok) return { ok: false, message: (d && d.message) || 'کد درست نیست' };
        d.mode = 'server';
        return d;
      })
      .catch(function () { return localVerify(phone, code); });
  }

  root.Auth = {
    CODE_LEN: CODE_LEN,
    RESEND_SECONDS: RESEND_SECONDS,
    normalizePhone: normalizePhone,
    prettyPhone: prettyPhone,
    requestCode: requestCode,
    verifyCode: verifyCode
  };

})(typeof self !== 'undefined' ? self : this);
