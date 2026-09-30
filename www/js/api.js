/* =========================================================================
 *  api.js (کلاینت) — ارتباط اپ بازی با سرور
 *
 *  قاعده: وقتی سرور در دسترس است، «حقیقت» موجودی همان چیزی است که سرور
 *  می‌گوید. اپ فقط نمایش می‌دهد. اگر سرور نبود، اپ آفلاین با ربات کار
 *  می‌کند و همه‌چیز محلی است (سکه‌ها فقط روی همان گوشی معنا دارند).
 * ========================================================================= */
(function (root) {
  'use strict';

  var TOKEN_KEY = 'nard_token';

  var API = {
    online: false,        // سرور در دسترس است **و** نشست معتبر داریم
    reachable: false,     // فقط یعنی سرور جواب می‌دهد
    token: null,
    baseUrl: '',
    lastError: null
  };

  function loadToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }
  function saveToken(t) {
    API.token = t;
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }
  API.setToken = saveToken;
  API.clearToken = function () { saveToken(null); };

  /** نشانی HTTP سرور را از روی نشانی وب‌سوکت می‌سازد */
  function baseFromWs() {
    var url = (root.Net && root.Net.config && root.Net.config.serverUrl) || '';
    if (!url) return '';
    return url
      .replace(/^ws:/, 'http:')
      .replace(/^wss:/, 'https:')
      .replace(/\/+$/, '')
      // نشانی وب‌سوکت پشت nginx به /ws ختم می‌شود؛ مسیرهای REST آنجا نیستند
      .replace(/\/ws$/, '');
  }

  function req(path, opts) {
    opts = opts || {};
    var base = API.baseUrl || baseFromWs();
    if (!base) return Promise.resolve({ ok: false, offline: true, message: 'سرور تنظیم نشده' });

    var headers = { 'Content-Type': 'application/json' };
    if (API.token) headers['Authorization'] = 'Bearer ' + API.token;

    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 8000) : null;

    return fetch(base + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) {
        if (timer) clearTimeout(timer);
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (r.status === 401) { saveToken(null); API.online = false; }
          if (d.ok === undefined) d.ok = r.ok;
          return d;
        });
      })
      .catch(function (e) {
        if (timer) clearTimeout(timer);
        API.lastError = e;
        return { ok: false, offline: true, message: 'ارتباط با سرور برقرار نشد' };
      });
  }
  API.req = req;

  /* ------------------------------------------------------------ ورود */

  function keepToken(d) {
    if (d && d.ok && d.token) { saveToken(d.token); API.online = true; }
    return d;
  }

  /** ثبت‌نام. اگر الان مهمان باشیم، همان حساب ارتقا می‌یابد. */
  API.register = function (username, password, extra) {
    var body = {
      username: username, password: password,
      token: API.token, source: API.source || 'web'
    };
    if (extra) { body.name = extra.name; body.avatar = extra.avatar; }
    return req('/auth/register', { method: 'POST', body: body }).then(keepToken);
  };

  API.login = function (username, password) {
    return req('/auth/login', {
      method: 'POST',
      body: { username: username, password: password, source: API.source || 'web' }
    }).then(keepToken);
  };

  API.recover = function (username, code, password) {
    return req('/auth/recover', {
      method: 'POST', body: { username: username, code: code, password: password }
    }).then(keepToken);
  };

  API.checkUsername = function (u) {
    return req('/auth/check-username?u=' + encodeURIComponent(u));
  };

  /** ورود از داخل مینی‌اپ تلگرام */
  API.loginTelegram = function (initData) {
    return req('/auth/telegram', { method: 'POST', body: { initData: initData } }).then(function (d) {
      if (d.ok && d.token) { saveToken(d.token); API.online = true; }
      return d;
    });
  };

  API.loginGuest = function (name, avatar) {
    return req('/auth/guest', { method: 'POST', body: { name: name, avatar: avatar } }).then(function (d) {
      if (d.ok && d.token) { saveToken(d.token); API.online = true; }
      return d;
    });
  };

  API.logout = function () {
    var p = API.token ? req('/api/logout', { method: 'POST' }) : Promise.resolve({ ok: true });
    saveToken(null);
    API.online = false;
    return p;
  };

  /* ------------------------------------------------- حساب و کیف پول */

  API.me = function () { return req('/api/me'); };
  API.config = function () { return req('/api/config'); };
  API.setProfile = function (name, avatar) { return req('/api/profile', { method: 'POST', body: { name: name, avatar: avatar } }); };
  API.welcome = function () { return req('/api/welcome', { method: 'POST' }); };
  API.daily = function () { return req('/api/daily', { method: 'POST' }); };
  API.referral = function (code) { return req('/api/referral', { method: 'POST', body: { code: code } }); };
  API.transactions = function () { return req('/api/transactions?limit=40'); };
  API.claims = function () { return req('/api/claims'); };

  /* ------------------------------------------------- کیف پول تتری */

  API.wallet = function () { return req('/api/wallet'); };

  /** خرید سکه — یا بسته‌ی آماده، یا مقدار دلخواه */
  API.buyCoins = function (coinsOrPack) {
    var body = typeof coinsOrPack === 'string' ? { packId: coinsOrPack } : { coins: coinsOrPack };
    return req('/api/coins/buy', { method: 'POST', body: body });
  };
  API.sellCoins = function (coins) {
    return req('/api/coins/sell', { method: 'POST', body: { coins: coins } });
  };
  API.deposit = function (amountMicro, txid, network) {
    return req('/api/deposit', {
      method: 'POST', body: { amount: amountMicro, txid: txid, network: network || 'TRC20' }
    });
  };
  API.voucher = function (code) {
    return req('/api/voucher', { method: 'POST', body: { code: code } });
  };
  API.withdraw = function (amountMicro, address, network) {
    return req('/api/withdraw', {
      method: 'POST', body: { amount: amountMicro, address: address, network: network || 'TRC20' }
    });
  };

  /* ------------------------------------------------------- حساب */

  API.changePassword = function (oldPass, newPass) {
    return req('/api/account/password', {
      method: 'POST', body: { oldPassword: oldPass, newPassword: newPass }
    });
  };
  API.newRecovery = function (password) {
    return req('/api/account/recovery', { method: 'POST', body: { password: password } });
  };
  API.linkCode = function () { return req('/api/account/link-code', { method: 'POST' }); };
  API.linkWith = function (code) {
    return req('/api/account/link', { method: 'POST', body: { code: code } });
  };
  API.unlinkTelegram = function () { return req('/api/account/unlink-telegram', { method: 'POST' }); };
  API.prize = function (prizeId, contact) {
    return req('/api/prize', { method: 'POST', body: { prizeId: prizeId, contact: contact } });
  };
  API.buySkin = function (skinId) { return req('/api/skin/buy', { method: 'POST', body: { skinId: skinId } }); };
  API.equipSkin = function (skinId) { return req('/api/skin/equip', { method: 'POST', body: { skinId: skinId } }); };

  /* ------------------------------------------------------ راه‌اندازی */

  /**
   * تلاش می‌کند به سرور وصل شود و حساب را بگیرد.
   * @returns Promise<{online, profile?}>
   */
  API.connect = function () {
    API.baseUrl = baseFromWs();
    API.token = loadToken();

    if (!API.baseUrl) { API.online = false; API.reachable = false; return Promise.resolve({ online: false }); }

    // اگر توکن داریم، ببینیم هنوز معتبر است
    if (API.token) {
      return API.me().then(function (d) {
        API.online = !!d.ok;
        API.reachable = true;
        if (!d.ok) return req('/api/config').then(function (c) {
          API.reachable = !!c.ok;
          return { online: false, reachable: API.reachable };
        });
        return { online: true, reachable: true, profile: d.profile };
      });
    }
    // توکن نداریم — فقط ببینیم سرور بالا هست تا دکمه‌ی ورود کار کند
    return req('/api/config').then(function (d) {
      API.reachable = !!d.ok;
      API.online = false;
      return { online: false, reachable: API.reachable, config: d };
    });
  };

  root.API = API;

})(typeof self !== 'undefined' ? self : this);
