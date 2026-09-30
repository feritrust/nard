/* =========================================================================
 *  ui.js — رابط کاربری و منطق صفحه‌ها
 * ========================================================================= */
(function () {
  'use strict';

  var E = window.Engine, AI = window.AI, S = window.Store, Net = window.Net;
  var fa = S.fa;

  /* ------------------------------------------------------------ ابزارها */

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  var P = null;   // پروفایل

  /* ---------------------------------------------------------- صدا و لرزش */

  var actx = null;
  function beep(freq, dur, type, vol) {
    if (!P || !P.settings.sound) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.07, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + (dur || 0.1));
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + (dur || 0.1));
    } catch (e) {}
  }
  var SFX = {
    tap:  function () { beep(520, 0.05, 'triangle', 0.05); },
    move: function () { beep(300, 0.07, 'square', 0.045); },
    hit:  function () { beep(160, 0.16, 'sawtooth', 0.08); },
    dice: function () { beep(700, 0.05, 'square', 0.05); setTimeout(function () { beep(480, 0.08, 'square', 0.05); }, 70); },
    win:  function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { beep(f, 0.18, 'sine', 0.09); }, i * 110); }); },
    lose: function () { [392, 330, 262].forEach(function (f, i) { setTimeout(function () { beep(f, 0.24, 'sine', 0.08); }, i * 140); }); },
    coin: function () { beep(900, 0.06, 'sine', 0.07); setTimeout(function () { beep(1200, 0.1, 'sine', 0.06); }, 60); }
  };
  function vibrate(ms) {
    if (P && P.settings.vibrate && navigator.vibrate) { try { navigator.vibrate(ms || 18); } catch (e) {} }
  }

  /* ------------------------------------------------------------ توست */

  function toast(msg, kind, ms) {
    var host = $('#toast-host');
    var t = el('div', 'toast' + (kind ? ' ' + kind : ''), msg);
    host.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .25s, transform .25s';
      t.style.opacity = '0'; t.style.transform = 'translateY(-10px)';
      setTimeout(function () { t.remove(); }, 260);
    }, ms || 2100);
  }

  /* ------------------------------------------------------------ مودال */

  function modal(html, opts) {
    opts = opts || {};
    var bg = $('#modal-bg'), m = $('#modal');
    m.innerHTML = html;
    bg.classList.add('show');
    bg.onclick = function (e) { if (e.target === bg && opts.dismissible !== false) closeModal(); };
    return m;
  }
  function closeModal() { $('#modal-bg').classList.remove('show'); }

  /** باران کاغذرنگی برای لحظه‌ی برد */
  function confetti(host, n) {
    if (!host) return;
    var colors = ['#f5c451', '#22c98a', '#4aa8ff', '#a78bfa', '#f2555a', '#ffffff', '#ffd98a'];
    var wrap = el('div', 'confetti-host');
    host.appendChild(wrap);
    for (var i = 0; i < n; i++) {
      var c = el('div', 'confetti');
      c.style.left = (Math.random() * 100) + '%';
      c.style.background = colors[Math.floor(Math.random() * colors.length)];
      c.style.animationDuration = (1.1 + Math.random() * 1.2) + 's';
      c.style.animationDelay = (Math.random() * 0.55) + 's';
      c.style.width = (5 + Math.random() * 6) + 'px';
      c.style.height = (9 + Math.random() * 9) + 'px';
      if (Math.random() < 0.35) c.style.borderRadius = '50%';
      wrap.appendChild(c);
    }
    setTimeout(function () { wrap.remove(); }, 3400);
  }

  function confirmDialog(title, text, okText, onOk, kind) {
    var m = modal(
      '<div class="m-ic">❓</div><h2>' + title + '</h2><p>' + text + '</p>' +
      '<div class="row"><button class="btn ghost" id="cd-no">انصراف</button>' +
      '<button class="btn ' + (kind || 'primary') + '" id="cd-yes">' + okText + '</button></div>'
    );
    $('#cd-no', m).onclick = closeModal;
    $('#cd-yes', m).onclick = function () { closeModal(); onOk(); };
  }

  /* -------------------------------------------------------- ناوبری صفحه */

  var stack = [];
  function go(id, replace) {
    var cur = $('.screen.active');
    if (cur) {
      if (cur.id === id) return;
      if (!replace) stack.push(cur.id);
      cur.classList.remove('active');
    }
    var next = document.getElementById(id);
    if (!next) return;
    next.classList.add('active');
    if (SCREEN_ENTER[id]) SCREEN_ENTER[id]();
    window.scrollTo(0, 0);
  }
  function back() {
    var prev = stack.pop() || 'screen-home';
    var cur = $('.screen.active');
    if (cur) cur.classList.remove('active');
    var next = document.getElementById(prev);
    next.classList.add('active');
    if (SCREEN_ENTER[prev]) SCREEN_ENTER[prev]();
  }

  /* ------------------------------------------------------- کیف پول UI */

  var lastWallet = { coins: null, energy: null };

  /** عدد شناور +۱٬۸۰۰ 🪙 بالای چیپ کیف پول */
  function floatGain(host, diff, kind) {
    var r = host.getBoundingClientRect();
    if (!r.width) return;
    var n = el('div', 'float-gain', (diff > 0 ? '+' : '−') + fa(Math.abs(diff)) + (kind === 'coins' ? ' 🪙' : ' ⚡'));
    n.style.color = diff < 0 ? '#f2555a' : (kind === 'coins' ? '#f5c451' : '#7be3ff');
    n.style.left = (r.left + r.width / 2 - 45) + 'px';
    n.style.top = (r.top + 2) + 'px';
    n.style.width = '90px';
    n.style.textAlign = 'center';
    document.body.appendChild(n);
    setTimeout(function () { n.remove(); }, 1150);
  }

  function bumpWallet(kind, val) {
    var prev = lastWallet[kind];
    lastWallet[kind] = val;
    if (prev == null || prev === val) return;
    $$('.chip.' + kind).forEach(function (chip) {
      if (!chip.offsetParent) return;              // فقط چیپ صفحه‌ی باز
      chip.classList.remove('bump');
      void chip.offsetWidth;                        // ری‌استارت انیمیشن
      chip.classList.add('bump');
      floatGain(chip, val - prev, kind);
    });
  }

  function refreshWallet() {
    P = S.get();
    $$('.w-coins, #w-coins').forEach(function (n) { n.textContent = fa(P.coins); });
    $$('.w-energy, #w-energy').forEach(function (n) { n.textContent = fa(P.energy); });
    bumpWallet('coins', P.coins);
    bumpWallet('energy', P.energy);

    var lv = S.levelOf(P.xp);
    var av = $('#home-avatar'); if (av) av.textContent = P.avatar;
    var nm = $('#home-name'); if (nm) nm.textContent = P.name || 'بازیکن';
    var lvl = $('#home-level'); if (lvl) lvl.textContent = 'سطح ' + fa(lv.level);
    var xb = $('#home-xp'); if (xb) xb.style.width = Math.min(100, Math.round(lv.xp / lv.need * 100)) + '%';

    var db = $('#daily-sub');
    if (db) db.textContent = S.dailyAvailable()
      ? 'همین حالا ' + fa(S.CONFIG.DAILY_BONUS) + ' سکه رایگان بگیرید'
      : 'هدیه‌ی امروز را گرفته‌اید — فردا دوباره سر بزنید';

    var skSub = $('#skin-sub');
    if (skSub) {
      var owned = S.SKINS.filter(function (k) { return S.ownsSkin(k.id); }).length;
      skSub.textContent = 'فعال: ' + S.skinById(P.skin).name + ' • ' + fa(owned) + ' از ' + fa(S.SKINS.length) + ' پوسته';
    }

    // نشان جایزه‌ی قابل دریافت
    var badge = $('#prize-badge');
    if (badge) {
      var can = S.PRIZES.some(function (z) { return P.energy >= z.energy; });
      badge.style.display = can ? 'grid' : 'none';
      badge.textContent = '✓';
    }
  }

  /* =====================================================================
   *  صفحه‌ی ورود
   * ===================================================================== */

  var chosenAvatar = null;

  function buildLogin() {
    var wrap = $('#avatar-pick');
    wrap.innerHTML = '';
    S.AVATARS.forEach(function (a, i) {
      var b = el('button', i === 0 ? 'sel' : '', a);
      b.onclick = function () {
        $$('#avatar-pick button').forEach(function (x) { x.classList.remove('sel'); });
        b.classList.add('sel'); chosenAvatar = a; SFX.tap();
      };
      wrap.appendChild(b);
    });
    chosenAvatar = S.AVATARS[0];

    $('#btn-signup').onclick = function () {
      var name = $('#in-name').value.trim();
      if (name.length < 2) { toast('لطفاً نام خود را وارد کنید', 'err'); return; }
      P.name = name;
      P.avatar = chosenAvatar || P.avatar;
      S.save();

      var ref = $('#in-ref').value.trim();

      if (S.isOnline()) window.API.setProfile(P.name, P.avatar);

      doAction(function () { return window.API.welcome(); }, function () { return S.claimWelcome(); })
        .then(function (r) {
          var got = r && r.ok ? (r.coins || S.CONFIG.WELCOME_COINS) : 0;
          if (!ref) return { got: got, extra: 0 };
          return doAction(
            function () { return window.API.referral(ref); },
            function () { return S.applyReferral(ref); }
          ).then(function (rr) {
            return { got: got, extra: rr && rr.ok ? (rr.coins || S.CONFIG.REFERRAL_BONUS_NEW) : 0 };
          });
        })
        .then(function (res) { showWelcome(res.got, res.extra); });
    };
  }

  function showWelcome(base, extra) {
      SFX.coin();
      refreshWallet();
      var total = base + extra;
      modal(
        '<div class="m-ic">🎉</div><h2>خوش آمدید ' + esc(P.name) + '!</h2>' +
        '<div class="result-amount win">+' + fa(total) + ' 🪙</div>' +
        '<p>' + (extra ? 'هدیه‌ی خوش‌آمدگویی ' + fa(S.CONFIG.WELCOME_COINS) + ' سکه + ' + fa(extra) + ' سکه بابت کد معرف' : 'هدیه‌ی خوش‌آمدگویی شما به کیف پول اضافه شد') + '</p>' +
        '<button class="btn primary" id="wg-ok">شروع بازی</button>'
      );
      $('#wg-ok').onclick = function () { closeModal(); go('screen-home', true); };
  }

  /* =====================================================================
   *  ثبت‌نام، ورود و بازیابی با نام کاربری و رمز
   * ===================================================================== */

  var pendingRecovery = null;     // کد بازیابی که باید یک بار نشان داده شود
  var userCheckTimer = null;

  function buildAuth() {
    $('#btn-go-signup').onclick = function () { SFX.tap(); go('screen-signup'); };
    $('#btn-go-login').onclick  = function () { SFX.tap(); go('screen-signin'); };
    $('#btn-signin-to-signup').onclick = function () { SFX.tap(); go('screen-signup', true); };
    $('#btn-signup-to-signin').onclick = function () { SFX.tap(); go('screen-signin', true); };
    $('#btn-go-recover').onclick = function () { SFX.tap(); go('screen-recover'); };

    $('#btn-guest').onclick = function () {
      SFX.tap();
      confirmDialog('بازی به‌عنوان مهمان',
        'بدون حساب می‌توانید بازی کنید، اما اگر مرورگر را پاک کنید یا دستگاه عوض کنید ' +
        '<b>سکه‌ها و جوایزتان از بین می‌رود</b>.<br>هر وقت خواستید می‌توانید از تنظیمات حساب بسازید.',
        'ادامه به‌عنوان مهمان', function () {
          if (window.API && window.API.reachable && !window.API.token) {
            window.API.loginGuest(P.name || '', P.avatar).then(function (d) {
              if (d.ok && d.profile) { S.applyServerProfile(d.profile); refreshWallet(); }
              go('screen-login', true);
            });
            return;
          }
          go('screen-login', true);
        });
    };

    /* ── فرم ثبت‌نام ─────────────────────────────────────── */

    var uIn = $('#in-reg-user'), pIn = $('#in-reg-pass'), p2In = $('#in-reg-pass2');

    uIn.oninput = function () {
      // نام کاربری همیشه حروف کوچک انگلیسی
      this.value = this.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
      var hint = $('#user-hint');
      var problem = Auth.usernameProblem(this.value);
      if (!this.value) { setHint(hint, '', ''); return; }
      if (problem) { setHint(hint, problem, 'bad'); return; }

      setHint(hint, 'در حال بررسی…', '');
      clearTimeout(userCheckTimer);
      var want = this.value;
      userCheckTimer = setTimeout(function () {
        Auth.checkUsername(want).then(function (r) {
          if (uIn.value !== want) return;    // کاربر در این فاصله تایپ کرده
          setHint(hint, r.available ? '✓ آزاد است' : (r.message || 'گرفته شده'),
            r.available ? 'ok' : 'bad');
        });
      }, 420);
    };

    pIn.oninput = function () {
      var hint = $('#pass-hint');
      if (!this.value) { setHint(hint, '', ''); return; }
      var problem = Auth.passwordProblem(this.value);
      if (problem) { setHint(hint, problem, 'bad'); return; }
      var lvl = Auth.passwordStrength(this.value);
      var label = ['خیلی ضعیف', 'ضعیف', 'متوسط', 'خوب', 'عالی'][lvl];
      setHint(hint, 'قدرت رمز: ' + label, lvl >= 2 ? 'ok' : '');
    };

    $('#btn-do-signup').onclick = doSignup;
    p2In.onkeydown = function (e) { if (e.key === 'Enter') doSignup(); };

    /* ── فرم ورود ────────────────────────────────────────── */

    $('#in-login-user').oninput = function () {
      this.value = this.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    };
    $('#btn-do-login').onclick = doLogin;
    $('#in-login-pass').onkeydown = function (e) { if (e.key === 'Enter') doLogin(); };

    /* ── کد بازیابی ──────────────────────────────────────── */

    $('#chk-saved-recovery').onchange = function () {
      $('#btn-recovery-done').disabled = !this.checked;
    };
    $('#btn-copy-recovery').onclick = function () {
      copyText($('#recovery-code').textContent.trim(), 'کد بازیابی کپی شد');
    };
    $('#btn-recovery-done').onclick = function () {
      SFX.tap();
      pendingRecovery = null;
      go(S.get().name ? 'screen-home' : 'screen-login', true);
    };

    /* ── بازیابی حساب ────────────────────────────────────── */

    $('#in-rec-user').oninput = function () {
      this.value = this.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    };
    $('#in-rec-code').oninput = function () {
      var pos = this.selectionStart === this.value.length;
      this.value = Auth.normRecovery(this.value);
      if (pos) this.selectionStart = this.selectionEnd = this.value.length;
    };
    $('#btn-do-recover').onclick = doRecover;
  }

  function setHint(el, text, cls) {
    if (!el) return;
    el.textContent = text || '';
    el.className = 'hint' + (cls ? ' ' + cls : '');
  }

  function copyText(text, okMsg) {
    var done = function () { toast(okMsg || 'کپی شد', 'ok'); SFX.tap(); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();

    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
      } catch (e) { toast('کپی نشد — دستی انتخاب کنید', 'err'); }
    }
  }

  /** بعد از ورود موفق: پروفایل را از سرور بگیر و به صفحه‌ی درست برو */
  function afterAuth(r, nextScreen) {
    window.API.setToken(r.token);
    window.API.online = true;
    return window.API.me().then(function (d) {
      if (d.ok && d.profile) { S.applyServerProfile(d.profile); refreshWallet(); }
      var P2 = S.get();
      P2.verified = true;
      P2.authToken = r.token;
      S.save();
      go(nextScreen || (P2.name ? 'screen-home' : 'screen-login'), true);
    });
  }

  var authBusy = false;

  function doSignup() {
    if (authBusy) return;
    var u = $('#in-reg-user').value.trim();
    var p = $('#in-reg-pass').value;
    var p2 = $('#in-reg-pass2').value;

    var problem = Auth.usernameProblem(u) || Auth.passwordProblem(p);
    if (problem) return toast(problem, 'err', 2600);
    if (p !== p2) return toast('دو رمز یکی نیستند', 'err');

    authBusy = true;
    var btn = $('#btn-do-signup');
    btn.disabled = true; btn.textContent = 'در حال ساخت…';

    Auth.register(u, p, { name: S.get().name || u, avatar: S.get().avatar }).then(function (r) {
      authBusy = false;
      btn.disabled = false; btn.textContent = 'ساخت حساب';
      if (!r.ok) { toast(r.message || 'ثبت‌نام نشد', 'err', 3000); vibrate([30, 50, 30]); return; }

      SFX.coin();
      /* کد بازیابی فقط همین یک بار می‌آید — قبل از هر چیز نشانش می‌دهیم */
      if (r.recovery) {
        pendingRecovery = r.recovery;
        $('#recovery-code').textContent = r.recovery;
        $('#chk-saved-recovery').checked = false;
        $('#btn-recovery-done').disabled = true;
        afterAuth(r, 'screen-recovery-show');
      } else {
        afterAuth(r);
      }
    });
  }

  function doLogin() {
    if (authBusy) return;
    var u = $('#in-login-user').value.trim();
    var p = $('#in-login-pass').value;
    if (!u || !p) return toast('نام کاربری و رمز را وارد کنید', 'err');

    authBusy = true;
    var btn = $('#btn-do-login');
    btn.disabled = true; btn.textContent = 'در حال ورود…';

    Auth.login(u, p).then(function (r) {
      authBusy = false;
      btn.disabled = false; btn.textContent = 'ورود';
      if (!r.ok) { toast(r.message || 'ورود نشد', 'err', 3000); vibrate([30, 50, 30]); return; }
      $('#in-login-pass').value = '';
      toast('خوش آمدید 👋', 'ok');
      afterAuth(r);
    });
  }

  function doRecover() {
    if (authBusy) return;
    var u = $('#in-rec-user').value.trim();
    var c = $('#in-rec-code').value;
    var p = $('#in-rec-pass').value;

    authBusy = true;
    var btn = $('#btn-do-recover');
    btn.disabled = true; btn.textContent = 'در حال بررسی…';

    Auth.recover(u, c, p).then(function (r) {
      authBusy = false;
      btn.disabled = false; btn.textContent = 'بازیابی حساب';
      if (!r.ok) { toast(r.message || 'بازیابی نشد', 'err', 3000); vibrate([30, 50, 30]); return; }

      $('#in-rec-pass').value = ''; $('#in-rec-code').value = '';
      toast('حساب بازیابی شد ✅', 'ok');
      // کد تازه — کد قبلی دیگر کار نمی‌کند، پس باید ببیندش
      if (r.recovery) {
        $('#recovery-code').textContent = r.recovery;
        $('#chk-saved-recovery').checked = false;
        $('#btn-recovery-done').disabled = true;
        afterAuth(r, 'screen-recovery-show');
      } else {
        afterAuth(r);
      }
    });
  }

  /**
   * یک کار را روی سرور انجام می‌دهد؛ اگر آفلاین بودیم، همان کار را محلی می‌کند.
   * @param remote تابعی که Promise برمی‌گرداند (سمت سرور)
   * @param local  تابعی که {ok, reason} برمی‌گرداند (سمت گوشی)
   */
  function doAction(remote, local) {
    if (!S.isOnline()) {
      var r = local();
      if (r && r.ok) refreshWallet();
      return Promise.resolve(r);
    }
    return remote().then(function (d) {
      if (d && d.profile) S.applyServerProfile(d.profile);
      refreshWallet();
      if (d && !d.ok && d.offline) {
        // سرور وسط کار قطع شد → به حالت محلی برگرد
        window.API.online = false;
        var r2 = local();
        if (r2 && r2.ok) refreshWallet();
        return r2;
      }
      return d;
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* =====================================================================
   *  اتاق‌ها
   * ===================================================================== */

  function buildRooms() {
    var list = $('#rooms-list');
    list.innerHTML = '';
    var lv = S.levelOf(P.xp).level;

    S.ROOMS.forEach(function (room) {
      var eco = S.roomEconomy(room);
      var energy = S.energyForEntry(room.entry);
      var locked = lv < room.minLevel;
      var poor = P.coins < room.entry;

      var d = el('div', 'room' + (locked ? ' locked' : ''));
      var rskin = room.skin ? S.skinById(room.skin) : null;
      d.innerHTML =
        '<div class="r-ic" style="color:' + room.color + '">' + room.icon + '</div>' +
        '<div class="r-body">' +
          '<div class="r-name">' + room.name +
            (eco.rake ? '<span class="tag fee">فی ' + fa(eco.rakePercent) + '٪</span>'
                      : '<span class="tag free">بدون فی</span>') +
            '<span class="tag energy">⚡ ' + fa(energy) + '</span>' +
          '</div>' +
          '<div class="r-sub">' +
            'جایزه‌ی برنده: <b style="color:var(--gold)">' + fa(eco.prize) + '</b> سکه' +
            (eco.rake ? ' (از ' + fa(eco.pot) + ' سکه میز، ' + fa(eco.rake) + ' سکه فی)' : '') +
            (rskin ? '<br><span style="color:var(--purple)">🎨 پوسته‌ی اختصاصی: ' + rskin.name + '</span>' : '') +
            (locked ? '<br><span style="color:var(--red)">نیاز به سطح ' + fa(room.minLevel) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="r-entry"><div class="n">' + fa(room.entry) + '</div><div class="u">ورودی</div></div>';

      d.onclick = function () {
        SFX.tap();
        if (locked) { toast('برای این اتاق باید سطح ' + fa(room.minLevel) + ' باشید', 'err'); return; }
        if (poor) {
          confirmDialog('سکه کافی نیست',
            'برای ورود به ' + room.name + ' به ' + fa(room.entry) + ' سکه نیاز دارید.<br>الان ' + fa(P.coins) + ' سکه دارید.',
            'رفتن به فروشگاه', function () { go('screen-shop'); });
          return;
        }
        startMatch(room);
      };
      list.appendChild(d);
    });
  }

  /* =====================================================================
   *  مچ‌میکینگ
   * ===================================================================== */

  var searchHandle = null;
  var currentRoom = null;

  function startMatch(room) {
    // آفلاین: خودمان کسر می‌کنیم. آنلاین: سرور کسر می‌کند و موجودی تازه را می‌فرستد.
    if (!S.isOnline()) {
      var r = S.enterRoom(room);
      if (!r.ok) { toast(r.reason, 'err'); return; }
    } else {
      if (P.coins < room.entry) { toast('سکه کافی نیست', 'err'); return; }
    }
    currentRoom = room;
    refreshWallet();

    $('#search-room-name').textContent = room.icon + ' ' + room.name;
    $('#search-me-av').textContent = P.avatar;
    $('#search-me-nm').textContent = P.name || 'شما';
    $('#search-me-lv').textContent = 'سطح ' + fa(S.levelOf(P.xp).level);
    $('#search-opp-av').textContent = '❓';
    $('#search-opp-av').classList.add('searching');
    $('#search-opp-nm').textContent = 'در انتظار…';
    $('#search-opp-lv').textContent = '—';
    $('#search-stake').textContent = fa(room.entry);
    $('#search-status').textContent = 'در حال اتصال به سرور…';
    go('screen-search');

    searchHandle = Net.findMatch({
      room: room,
      profile: { id: P.id, name: P.name, avatar: P.avatar, level: S.levelOf(P.xp).level },
      onStatus: function (t) { var n = $('#search-status'); if (n) n.textContent = t; },
      onWallet: function () { refreshWallet(); },
      onFail: function (msg) {
        // سرور اجازه نداد — چیزی کسر نشده، فقط برمی‌گردیم
        searchHandle = null;
        currentRoom = null;
        toast(msg, 'err', 2800);
        go('screen-home', true);
      },
      onSession: function (session) {
        $('#search-opp-av').classList.remove('searching');
        $('#search-opp-av').textContent = session.opponent ? session.opponent.avatar : '🐯';
        $('#search-opp-nm').textContent = session.opponent ? session.opponent.name : 'حریف';
        $('#search-opp-lv').textContent = 'سطح ' + fa(session.opponent ? session.opponent.level : 1);
        SFX.tap();
        setTimeout(function () { openGame(session, room); }, 800);
      }
    });
  }

  $('#btn-cancel-search').onclick = function () {
    if (searchHandle) searchHandle.cancel();
    searchHandle = null;
    if (currentRoom && !S.isOnline()) {
      S.refundRoom(currentRoom); refreshWallet(); toast('ورودی به کیف پول برگشت');
    }
    currentRoom = null;
    go('screen-home', true);
  };

  /* =====================================================================
   *  تخته‌ی بازی
   * ===================================================================== */

  var G = {
    session: null, room: null, state: null, me: 1,
    selected: null, legal: [], pointEls: {}, ended: false, endingTimer: null,
    d: 24, ptH: 120,            // اندازه‌ی مهره و ارتفاع خانه
    drag: null,                 // وضعیت درگ جاری
    dragDropRect: null,         // محل رها شدن مهره (برای ادامه‌ی نرم انیمیشن)
    suppressTap: 0,             // بعد از درگ، تپ را نادیده بگیر
    flying: 0,                  // تعداد مهره‌های در حال پرواز
    diceIv: null
  };

  /* --- ساخت ساختار تخته یک‌بار برای همیشه --- */
  function buildBoard() {
    var left = $('#quad-left'), right = $('#quad-right');
    left.innerHTML = ''; right.innerHTML = '';
    G.pointEls = {};

    function makePoint(idx, isTop, pos) {
      var p = el('div', 'point ' + (isTop ? 'top ' : 'bottom ') + ((pos % 2 === (isTop ? 0 : 1)) ? 'light' : 'dark'));
      p.dataset.idx = idx;
      p.appendChild(el('div', 'tri'));
      p.onclick = function () { onPointTap(idx); };
      G.pointEls[idx] = p;
      return p;
    }

    for (var j = 0; j < 6; j++) {
      var c = el('div', 'pcol');
      c.appendChild(makePoint(12 + j, true, j));
      c.appendChild(makePoint(11 - j, false, j));
      left.appendChild(c);
    }
    for (var k = 0; k < 6; k++) {
      var c2 = el('div', 'pcol');
      c2.appendChild(makePoint(18 + k, true, 6 + k));
      c2.appendChild(makePoint(5 - k, false, 6 + k));
      right.appendChild(c2);
    }

    $('#bar-bottom').onclick = function () { onPointTap('bar'); };
    $('#bar-top').onclick = function () { onPointTap('bar'); };
    $('#off-p1').onclick = function () { onOffTap(); };

    initDrag();
  }

  /* --- اندازه‌ی تخته را با فضای موجود تنظیم می‌کند --- */
  function sizeBoard() {
    var wrap = $('.board-wrap'), board = $('#board');
    if (!wrap || !board) return;
    var availW = wrap.clientWidth - 16;
    var availH = wrap.clientHeight - 16;
    if (availW < 40 || availH < 40) return;
    var maxW = Math.min(availW, 620);
    // نسبت ارتفاع به عرض بین ۰٫۹۵ و ۱٫۲۸ نگه داشته می‌شود
    var ratio = Math.min(1.28, Math.max(0.95, availH / maxW));
    var w = Math.min(maxW, availH / ratio);
    board.style.width = Math.floor(w) + 'px';
    board.style.height = Math.floor(w * ratio) + 'px';
  }

  /* --- فاصله‌ی عمودی بین مهره‌های روی هم --- */
  function stepFor(n, d, maxH) {
    var s = d * 0.94;
    if (n > 1) s = Math.min(s, Math.max(d * 0.26, (maxH - d) / (n - 1)));
    return s;
  }

  /** ظرف مربوط به یک موقعیت روی تخته */
  function hostFor(loc, player) {
    if (loc === 'bar') return player === G.me ? $('#bar-bottom') : $('#bar-top');
    if (loc === 'off') return player === G.me ? $('#off-p1') : $('#off-p2');
    return G.pointEls[loc];
  }

  function lastCheckerIn(host) {
    if (!host) return null;
    var cs = host.querySelectorAll('.checker');
    return cs.length ? cs[cs.length - 1] : null;
  }

  /** مستطیل مهره‌ی رویی یک موقعیت — پیش از رسم دوباره خوانده می‌شود */
  function captureRect(loc, player) {
    var host = hostFor(loc, player);
    if (!host) return null;
    var e = lastCheckerIn(host);
    return (e || host).getBoundingClientRect();
  }

  /** جای فرود مهره پس از رسم دوباره */
  function destAnchor(loc, player) {
    var host = hostFor(loc, player);
    if (!host) return { rect: null, el: null };
    if (loc === 'off') {
      var bars = host.querySelectorAll('.stackbar');
      var b = bars.length ? bars[bars.length - 1] : null;
      return { rect: (b || host).getBoundingClientRect(), el: b };
    }
    var e = lastCheckerIn(host);
    return { rect: (e || host).getBoundingClientRect(), el: e };
  }

  /* --- کشیدن مهره‌ها --- */
  function drawCheckers() {
    var st = G.state;
    if (!st) return;
    sizeBoard();

    $$('.checker', $('#board')).forEach(function (n) { n.remove(); });
    $$('.drop-hint', $('#board')).forEach(function (n) { n.remove(); });

    var anyPoint = G.pointEls[0];
    if (!anyPoint) return;
    var colW = anyPoint.clientWidth || 26;
    var ptH = anyPoint.clientHeight || 120;
    var d = Math.max(12, Math.min(colW * 0.9, ptH / 5.15));
    G.d = d; G.ptH = ptH;

    function stack(container, n, player, fromTop, maxH) {
      if (!n) return;
      var step = stepFor(n, d, maxH);
      for (var i = 0; i < n; i++) {
        var c = el('div', 'checker ' + (player > 0 ? 'p1' : 'p2'));
        c.style.width = d + 'px'; c.style.height = d + 'px';
        c.style.zIndex = 2 + i;
        if (fromTop) c.style.top = (i * step) + 'px';
        else c.style.bottom = (i * step) + 'px';
        if (i === n - 1 && n > 5) {
          var b = el('div', 'cnt', fa(n));
          b.style.fontSize = Math.round(d * 0.42) + 'px';
          c.appendChild(b);
        }
        container.appendChild(c);
      }
    }

    for (var i = 0; i < 24; i++) {
      var v = st.board[i];
      if (!v) continue;
      var p = G.pointEls[i];
      stack(p, Math.abs(v), v > 0 ? 1 : -1, p.classList.contains('top'), ptH);
    }

    // مهره‌های روی بار
    var barW = $('#bar-strip').clientWidth || 26;
    var bd = Math.max(12, Math.min(barW * 0.82, d));
    function barStack(container, n, player, fromTop) {
      if (!n) return;
      var h = container.clientHeight || 100;
      var step = Math.min(bd * 0.9, Math.max(bd * 0.3, (h - bd - 12) / Math.max(1, n - 1)));
      for (var i = 0; i < n; i++) {
        var c = el('div', 'checker onbar ' + (player > 0 ? 'p1' : 'p2'));
        c.style.width = bd + 'px'; c.style.height = bd + 'px';
        c.style.zIndex = 2 + i;
        if (fromTop) c.style.top = (6 + i * step) + 'px'; else c.style.bottom = (6 + i * step) + 'px';
        container.appendChild(c);
      }
    }
    barStack($('#bar-bottom'), st.bar[G.me], G.me, false);
    barStack($('#bar-top'), st.bar[-G.me], -G.me, true);

    drawOff($('#off-p1'), st.off[G.me], G.me, false);
    drawOff($('#off-p2'), st.off[-G.me], -G.me, true);
  }

  function drawOff(container, n, player, fromTop) {
    $$('.stackbar', container).forEach(function (x) { x.remove(); });
    var h = container.clientHeight || 100;
    var step = Math.min(7, (h - 18) / 15);
    for (var i = 0; i < n; i++) {
      var b = el('div', 'stackbar ' + (player > 0 ? 'p1' : 'p2'));
      if (fromTop) b.style.top = (16 + i * step) + 'px'; else b.style.bottom = (16 + i * step) + 'px';
      container.appendChild(b);
    }
    var lbl = $('.lbl', container);
    if (lbl) lbl.textContent = fa(n);
  }

  /* =====================================================================
   *  انیمیشن حرکت مهره
   * ===================================================================== */

  function flyLayer() {
    var l = $('#fly-layer');
    if (!l) { l = el('div', 'fx-layer'); l.id = 'fly-layer'; document.body.appendChild(l); }
    return l;
  }

  /** یک مهره‌ی شناور را از نقطه‌ای به نقطه‌ی دیگر پرواز می‌دهد */
  function fly(from, to, player, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      if (!from || !to) return resolve();
      var size = opts.size || from.width || G.d || 24;
      var dur = opts.dur || 300;
      var g = el('div', 'checker flying ' + (player > 0 ? 'p1' : 'p2'));
      g.style.width = size + 'px'; g.style.height = size + 'px';
      flyLayer().appendChild(g);

      var x0 = from.left + from.width / 2, y0 = from.top + from.height / 2;
      var x1 = to.left + to.width / 2, y1 = to.top + to.height / 2;
      var dist = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
      var lift = opts.lift == null ? Math.min(52, dist * 0.24) : opts.lift;

      function T(x, y, s) {
        return 'translate(' + (x - size / 2) + 'px,' + (y - size / 2) + 'px) scale(' + s + ')';
      }
      function done() { g.remove(); resolve(); }

      if (g.animate) {
        var a = g.animate([
          { transform: T(x0, y0, 1), offset: 0 },
          { transform: T((x0 + x1) / 2, (y0 + y1) / 2 - lift, 1.16), offset: 0.5 },
          { transform: T(x1, y1, 1), offset: 1 }
        ], { duration: dur, easing: 'cubic-bezier(.33,.7,.32,1)', fill: 'forwards' });
        a.onfinish = done;
        setTimeout(function () { if (g.parentNode) done(); }, dur + 220);
      } else {
        g.style.transform = T(x0, y0, 1);
        g.style.transition = 'transform ' + dur + 'ms cubic-bezier(.33,.7,.32,1)';
        requestAnimationFrame(function () { g.style.transform = T(x1, y1, 1); });
        setTimeout(done, dur + 40);
      }
    });
  }

  /** پاک کردن هر چیزی که از انیمیشن‌ها باقی مانده */
  function resetBoardFx() {
    clearInterval(G.diceIv);
    G.flying = 0;
    var l = $('#fly-layer');
    if (l) l.innerHTML = '';
    if (G.drag) {
      if (G.drag.ghost) G.drag.ghost.remove();
      if (G.drag.srcEl) G.drag.srcEl.classList.remove('dragging');
      G.drag = null;
    }
    G.dragDropRect = null;
    var board = $('#board');
    if (board) {
      board.classList.remove('dragging-now');
      $$('.drop-hint', board).forEach(function (n) { n.remove(); });
      $$('.dest-hover', board).forEach(function (n) { n.classList.remove('dest-hover'); });
      $$('.checker.dragging', board).forEach(function (n) { n.classList.remove('dragging'); });
      $$('.checker', board).forEach(function (n) { n.style.visibility = ''; });
    }
  }

  /** موج کوچک روی خانه‌ی مقصد بعد از فرود مهره */
  function landPulse(loc, player) {
    var host = hostFor(loc, player);
    if (!host) return;
    host.classList.add('landed');
    setTimeout(function () { host.classList.remove('landed'); }, 420);
  }

  /** رسم دوباره‌ی تخته همراه با پرواز مهره‌ی حرکت‌کرده */
  function animateMove(d) {
    var mv = d.move, player = d.player;
    if (!mv) { renderAll(false); return; }

    var fromRect = G.dragDropRect || captureRect(mv.from, player);
    var dur = G.dragDropRect ? 170 : (player === G.me ? 260 : 320);
    var lift = G.dragDropRect ? 8 : null;
    G.dragDropRect = null;

    var hitRect = mv.hit ? captureRect(mv.to, -player) : null;

    renderAll(false);

    var da = destAnchor(mv.to, player);
    if (fromRect && da.rect) {
      if (da.el) da.el.style.visibility = 'hidden';
      G.flying++;
      fly(fromRect, da.rect, player, { size: G.d, dur: dur, lift: lift }).then(function () {
        G.flying = Math.max(0, G.flying - 1);
        if (da.el) da.el.style.visibility = '';
        landPulse(mv.to, player);
      });
    }

    if (hitRect) {
      var ba = destAnchor('bar', -player);
      if (ba.el) ba.el.style.visibility = 'hidden';
      G.flying++;
      setTimeout(function () {
        fly(hitRect, ba.rect, -player, { size: G.d, dur: 430, lift: 70 }).then(function () {
          G.flying = Math.max(0, G.flying - 1);
          if (ba.el) ba.el.style.visibility = '';
        });
      }, 90);
    }
  }

  /* =====================================================================
   *  درگ کردن مهره با انگشت
   * ===================================================================== */

  var dragInited = false;
  function initDrag() {
    if (dragInited) return;
    dragInited = true;
    var board = $('#board');
    board.addEventListener('pointerdown', onDragStart, { passive: false });
    window.addEventListener('pointermove', onDragMove, { passive: false });
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragEnd);
  }

  function locFromEvent(e) {
    var n = e.target;
    while (n && n !== document.body) {
      if (n.classList) {
        if (n.classList.contains('point')) return Number(n.dataset.idx);
        if (n.id === 'bar-bottom') return 'bar';
      }
      n = n.parentNode;
    }
    return null;
  }

  function onDragStart(e) {
    var st = G.state;
    if (!st || st.done || st.turn !== G.me || !st.dice.length) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    var loc = locFromEvent(e);
    if (loc === null) return;
    var moves = G.legal.filter(function (m) { return String(m.from) === String(loc); });
    if (!moves.length) return;

    G.drag = { loc: loc, moves: moves, x0: e.clientX, y0: e.clientY, active: false };
  }

  function beginDrag(e) {
    var drag = G.drag;
    var host = hostFor(drag.loc, G.me);
    var src = lastCheckerIn(host);
    if (!src) { G.drag = null; return; }

    var r = src.getBoundingClientRect();
    drag.size = r.width;
    drag.srcRect = r;
    drag.srcEl = src;
    src.classList.add('dragging');

    var g = el('div', 'checker drag-ghost ' + (G.me > 0 ? 'p1' : 'p2'));
    g.style.width = r.width + 'px'; g.style.height = r.width + 'px';
    flyLayer().appendChild(g);
    drag.ghost = g;
    drag.active = true;

    // مقصدهای مجاز را مشخص کن
    var seen = {};
    drag.targets = [];
    drag.moves.forEach(function (m) {
      var k = String(m.to);
      if (seen[k]) return;
      seen[k] = true;
      var t = hostFor(m.to, G.me);
      if (t) drag.targets.push({ mv: m, el: t });
    });

    G.selected = drag.loc;
    refreshHighlights();
    showDropHints(drag.targets);
    $('#board').classList.add('dragging-now');
    SFX.tap(); vibrate(14);
  }

  /** دایره‌ی کم‌رنگ روی جای فرود مهره */
  function showDropHints(targets) {
    var st = G.state;
    targets.forEach(function (t) {
      if (t.mv.to === 'off') return;
      var host = t.el;
      var v = st.board[t.mv.to] || 0;
      var mine = v * G.me > 0 ? Math.abs(v) : 0;
      var step = stepFor(mine + 1, G.d, G.ptH);
      var h = el('div', 'drop-hint');
      h.style.width = G.d + 'px'; h.style.height = G.d + 'px';
      if (host.classList.contains('top')) h.style.top = (mine * step) + 'px';
      else h.style.bottom = (mine * step) + 'px';
      host.appendChild(h);
    });
  }

  function onDragMove(e) {
    var drag = G.drag;
    if (!drag) return;
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.active) {
      if (Math.sqrt(dx * dx + dy * dy) < 7) return;
      beginDrag(e);
      if (!G.drag) return;
    }
    e.preventDefault();
    var s = drag.size;
    drag.ghost.style.transform =
      'translate(' + (e.clientX - s / 2) + 'px,' + (e.clientY - s / 2 - s * 0.55) + 'px) scale(1.14)';

    var hit = findTarget(drag, e.clientX, e.clientY - s * 0.55);
    if (hit !== drag.hover) {
      if (drag.hover) drag.hover.el.classList.remove('dest-hover');
      drag.hover = hit;
      if (hit) { hit.el.classList.add('dest-hover'); vibrate(8); }
    }
  }

  function findTarget(drag, x, y) {
    var best = null, bestD = 1e9;
    for (var i = 0; i < drag.targets.length; i++) {
      var r = drag.targets[i].el.getBoundingClientRect();
      var pad = 6;
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) {
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var dd = Math.abs(x - cx) + Math.abs(y - cy) * 0.15;
        if (dd < bestD) { bestD = dd; best = drag.targets[i]; }
      }
    }
    return best;
  }

  function onDragEnd(e) {
    var drag = G.drag;
    if (!drag) return;
    G.drag = null;
    if (!drag.active) return;      // فقط یک تپ بود — onPointTap کارش را می‌کند

    $('#board').classList.remove('dragging-now');
    if (drag.hover) drag.hover.el.classList.remove('dest-hover');
    $$('.drop-hint', $('#board')).forEach(function (n) { n.remove(); });

    var ghostRect = drag.ghost.getBoundingClientRect();
    drag.ghost.remove();
    G.suppressTap = Date.now();

    if (drag.hover) {
      if (drag.srcEl) drag.srcEl.classList.remove('dragging');
      G.dragDropRect = ghostRect;
      doMove(drag.hover.mv);
    } else {
      // برگرداندن مهره سر جایش
      fly(ghostRect, drag.srcRect, G.me, { size: drag.size, dur: 240, lift: 12 }).then(function () {
        if (drag.srcEl) drag.srcEl.classList.remove('dragging');
      });
      G.selected = null;
      refreshHighlights();
      SFX.tap();
    }
  }

  /* --- تاس‌ها --- */
  var PIPS = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
  };

  function setFace(dEl, v) {
    dEl.innerHTML = '';
    for (var i = 0; i < 9; i++) dEl.appendChild(PIPS[v].indexOf(i) >= 0 ? el('i') : el('span'));
  }

  function drawDice(animate) {
    clearInterval(G.diceIv);
    var area = $('#dice-area');
    area.innerHTML = '';
    var st = G.state;
    if (!st || !st.dice.length) return;

    var isMine = st.turn === G.me;
    var remaining = st.moves.slice();
    var vals = st.dice[0] === st.dice[1] ? [st.dice[0], st.dice[0], st.dice[0], st.dice[0]] : st.dice.slice();

    var list = vals.map(function (v, i) {
      var used = remaining.indexOf(v) < 0;
      if (!used) remaining.splice(remaining.indexOf(v), 1);
      var dEl = el('div', 'die ' + (isMine ? 'p1' : 'p2') + (used ? ' used' : ''));
      setFace(dEl, v);
      // چرخش کوچک تصادفی تا تاس‌ها «پرتاب‌شده» به نظر برسند
      dEl.dataset.tilt = (Math.random() * 16 - 8).toFixed(1);
      if (animate) {
        dEl.classList.add('throwing');
        dEl.style.animationDelay = (i * 60) + 'ms';
      } else if (!used) {
        dEl.style.transform = 'rotate(' + dEl.dataset.tilt + 'deg)';
      }
      area.appendChild(dEl);
      return { el: dEl, v: v };
    });

    if (!animate) return;

    // چرخیدن عدد تاس تا لحظه‌ی نشستن
    var t0 = Date.now(), dur = 560;
    G.diceIv = setInterval(function () {
      if (Date.now() - t0 >= dur) {
        clearInterval(G.diceIv);
        list.forEach(function (o) {
          setFace(o.el, o.v);
          o.el.classList.remove('throwing');
          o.el.classList.add('settled');
          setTimeout(function () {
            o.el.classList.remove('settled');
            if (!o.el.classList.contains('used')) o.el.style.transform = 'rotate(' + o.el.dataset.tilt + 'deg)';
          }, 340);
        });
        return;
      }
      list.forEach(function (o) { setFace(o.el, 1 + Math.floor(Math.random() * 6)); });
    }, 65);
  }

  /* --- هایلایت حرکت‌های مجاز --- */
  function refreshHighlights() {
    var st = G.state;
    $$('.point').forEach(function (p) { p.classList.remove('sel', 'dest', 'dest-hover'); });
    $('#off-p1').classList.remove('dest', 'dest-hover');
    $$('.checker.movable').forEach(function (c) { c.classList.remove('movable'); });
    if (!st || st.done || st.turn !== G.me || !st.dice.length) { G.legal = []; return; }

    G.legal = E.legalFirstMoves(st, G.me);

    if (G.selected == null) {
      var froms = {};
      G.legal.forEach(function (m) { froms[String(m.from)] = true; });
      Object.keys(froms).forEach(function (f) {
        var host = hostFor(f === 'bar' ? 'bar' : Number(f), G.me);
        var target = lastCheckerIn(host);
        if (target) target.classList.add('movable');
      });
    } else {
      var srcEl = hostFor(G.selected === 'bar' ? 'bar' : Number(G.selected), G.me);
      if (srcEl && srcEl.classList.contains('point')) srcEl.classList.add('sel');
      G.legal.forEach(function (m) {
        if (String(m.from) !== String(G.selected)) return;
        if (m.to === 'off') $('#off-p1').classList.add('dest');
        else if (G.pointEls[m.to]) G.pointEls[m.to].classList.add('dest');
      });
    }
  }

  function onPointTap(idx) {
    var st = G.state;
    if (!st || st.done || st.turn !== G.me || !st.dice.length) return;
    if (G.suppressTap && Date.now() - G.suppressTap < 350) return;

    if (G.selected != null) {
      var mv = G.legal.filter(function (m) {
        return String(m.from) === String(G.selected) && String(m.to) === String(idx);
      })[0];
      if (mv) { doMove(mv); return; }
    }

    var fromMoves = G.legal.filter(function (m) { return String(m.from) === String(idx); });
    if (!fromMoves.length) {
      if (st.bar[G.me] > 0) toast('اول باید مهره‌ی روی بار را وارد کنید', 'err', 1400);
      G.selected = null; refreshHighlights(); return;
    }

    var dests = {};
    fromMoves.forEach(function (m) { dests[String(m.to)] = m; });
    var keys = Object.keys(dests);
    if (keys.length === 1) { doMove(dests[keys[0]]); return; }

    G.selected = idx;
    SFX.tap();
    refreshHighlights();
  }

  function onOffTap() {
    if (G.selected == null) return;
    if (G.suppressTap && Date.now() - G.suppressTap < 350) return;
    var mv = G.legal.filter(function (m) {
      return String(m.from) === String(G.selected) && m.to === 'off';
    })[0];
    if (mv) doMove(mv);
  }

  function doMove(mv) {
    G.selected = null;
    if (mv.hit) { SFX.hit(); vibrate(35); } else { SFX.move(); vibrate(12); }
    G.session.play(mv);
  }

  /* =====================================================================
   *  تایمر نوبت
   * ===================================================================== */

  var tickIv = null, lastTickSec = -1;

  function startTurnClock() {
    stopTurnClock();
    tickIv = setInterval(paintClock, 200);
    paintClock();
  }
  function stopTurnClock() {
    clearInterval(tickIv); tickIv = null; lastTickSec = -1;
    $$('.turn-bar').forEach(function (b) { b.classList.remove('warn', 'danger'); });
  }

  function paintClock() {
    var st = G.state, sess = G.session;
    if (!st || !sess || st.done) { stopTurnClock(); return; }

    var total = Net.config.turnMs;
    var left = sess.turnDeadline ? Math.max(0, sess.turnDeadline - Date.now()) : 0;
    var pct = total ? Math.max(0, Math.min(100, left / total * 100)) : 0;
    var secs = Math.ceil(left / 1000);

    var mine = st.turn === G.me;
    var tag = mine ? $('#tag-me') : $('#tag-opp');
    var other = mine ? $('#tag-opp') : $('#tag-me');

    // فقط نوار بازیکنی که نوبتش است پر می‌شود
    var bar = $('.turn-bar', tag), fill = bar ? $('i', bar) : null;
    if (fill) fill.style.width = pct + '%';
    if (bar) {
      bar.classList.toggle('warn', left <= 12000 && left > 6000);
      bar.classList.toggle('danger', left <= 6000);
    }
    var ob = $('.turn-bar', other);
    if (ob) { $('i', ob).style.width = '100%'; ob.classList.remove('warn', 'danger'); }

    // شمارش معکوس کنار نام
    var clk = $('.clock', tag);
    if (!clk) { clk = el('div', 'clock'); $('.pip', tag).parentNode.appendChild(clk); }
    clk.textContent = '⏱ ' + fa(secs) + ' ثانیه';
    clk.className = 'clock' + (left <= 6000 ? ' danger' : (left <= 12000 ? ' warn' : ''));
    var oclk = $('.clock', other);
    if (oclk) oclk.textContent = '';

    // تیک‌تاک ۵ ثانیه‌ی آخر (فقط برای نوبت خودمان)
    if (mine && secs <= 5 && secs > 0 && secs !== lastTickSec) {
      lastTickSec = secs;
      beep(880, 0.05, 'square', 0.05);
      if (secs <= 3) vibrate(20);
    }
    if (secs > 5) lastTickSec = -1;
  }

  /* --- به‌روزرسانی نوار بالای بازی --- */
  function refreshGameTop() {
    var st = G.state;
    if (!st) return;
    var opp = G.session.opponent || { name: 'حریف', avatar: '🐯', level: 1 };
    var tagOpp = $('#tag-opp'), tagMe = $('#tag-me');

    $('.av', tagOpp).textContent = opp.avatar;
    $('.nm', tagOpp).textContent = opp.name;
    $('.pip', tagOpp).textContent = 'پیپ ' + fa(E.pipCount(st, -G.me));

    $('.av', tagMe).textContent = P.avatar;
    $('.nm', tagMe).textContent = P.name || 'شما';
    $('.pip', tagMe).textContent = 'پیپ ' + fa(E.pipCount(st, G.me));

    tagOpp.classList.toggle('turn', st.turn === -G.me && !st.done);
    tagMe.classList.toggle('turn', st.turn === G.me && !st.done);

    var eco = S.roomEconomy(G.room);
    $('#game-stake').textContent = fa(eco.prize);
  }

  function refreshAction() {
    var st = G.state, btn = $('#btn-action'), undo = $('#btn-undo');
    if (!st || st.done) { btn.disabled = true; btn.textContent = 'پایان بازی'; undo.disabled = true; return; }

    var mine = st.turn === G.me;
    undo.disabled = !(mine && st.played.length);

    if (!mine) {
      btn.disabled = true;
      btn.className = 'btn ghost';
      btn.textContent = '⏳ نوبت حریف…';
      return;
    }
    if (!st.dice.length) {
      btn.disabled = false; btn.className = 'btn primary'; btn.textContent = '🎲 تاس بریز';
      return;
    }
    var can = E.legalFirstMoves(st, G.me).length;
    if (!can) {
      btn.disabled = false; btn.className = 'btn green'; btn.textContent = '✓ پایان نوبت';
    } else {
      btn.disabled = true; btn.className = 'btn ghost';
      btn.textContent = 'حرکت کن (' + fa(st.moves.length) + ' تاس مانده)';
    }
  }

  function renderAll(animateDice) {
    drawCheckers();
    drawDice(animateDice);
    refreshHighlights();
    refreshGameTop();
    refreshAction();
  }

  function hint(text, ms) {
    var old = $('.turn-hint'); if (old) old.remove();
    var h = el('div', 'turn-hint', text);
    var host = $('.board-wrap');
    if (!host) return;
    host.style.position = 'relative';
    host.appendChild(h);
    setTimeout(function () { if (h.parentNode) h.remove(); }, ms || 1300);
  }

  function bubble(text, who) {
    var host = $('#screen-game');
    var b = el('div', 'bubble ' + (who === 'me' ? 'me' : 'opp'), esc(text));
    host.appendChild(b);
    setTimeout(function () { b.remove(); }, 3200);
  }

  /* --- باز کردن بازی --- */
  function openGame(session, room) {
    G.session = session;
    G.room = room;
    G.skin = S.skinForRoom(room);
    applySkin(G.skin);
    G.ended = false;
    G.selected = null;
    G.state = null;
    resetBoardFx();
    stopTurnClock();
    hideConn();
    buildChatStrip();
    go('screen-game', true);

    session.on('start', function (d) {
      G.me = d.you;
      G.state = d.state;
      buildBoard();
      setTimeout(function () {
        renderAll(true);
        hint(d.state.turn === G.me ? 'نوبت شماست' : 'نوبت حریف');
        startTurnClock();
      }, 60);
    });

    session.on('roll', function (d) {
      G.state = d.state; G.selected = null;
      SFX.dice(); vibrate(20);
      renderAll(true);
    });

    session.on('move', function (d) {
      G.state = d.state;
      if (d.player !== G.me) {
        if (d.move && d.move.hit) { SFX.hit(); vibrate(28); } else SFX.move();
      }
      animateMove(d);
      maybeAutoEnd();
    });

    session.on('update', function (d) {
      G.state = d.state;
      // اگر مهره‌ای در حال پرواز است، رسم دوباره را عقب می‌اندازیم تا پرش نداشته باشیم
      if (G.flying > 0) { refreshGameTop(); refreshAction(); return; }
      renderAll(false);
    });

    session.on('turn', function (d) {
      G.state = d.state; G.selected = null;
      renderAll(false);
      if (d.player === G.me) {
        hint('نوبت شماست');
        if (P.settings.autoRoll) setTimeout(function () { if (G.state && G.state.turn === G.me && !G.state.dice.length) G.session.roll(); }, 450);
      }
    });

    session.on('nomove', function (d) {
      hint(d.player === G.me ? 'حرکتی نداری — نوبت رد شد' : 'حریف حرکتی نداشت', 1500);
    });

    session.on('chat', function (d) { bubble(d.text, d.from); });

    session.on('timer', function () { paintClock(); });

    session.on('timeout', function (d) {
      var left = typeof d.left === 'number' ? d.left : Math.max(0, (d.max || 2) - (d.auto || 1));
      if (d.player === G.me) {
        toast(left > 0
          ? 'وقتت تمام شد! سیستم به‌جای تو بازی کرد — ' + fa(left) + ' نوبت دیگر فرصت داری'
          : 'وقتت تمام شد — نوبت بعدی بازی را می‌بازی', 'err', 3000);
        vibrate([40, 60, 40]);
      } else {
        toast(d.away
          ? 'حریف قطع است — سیستم به‌جایش بازی کرد'
          : 'وقت حریف تمام شد — سیستم به‌جایش بازی کرد', null, 2200);
      }
    });

    /* ---- قطع اتصال ---- */
    session.on('reconnecting', function (d) {
      showConn('me', d.until || (Date.now() + (d.graceMs || 45000)));
    });
    session.on('reconnected', function () {
      hideConn();
      toast('دوباره وصل شدی ✅', 'ok');
      renderAll(false);
      startTurnClock();
    });
    session.on('reconnectFailed', function () {
      hideConn();
      if (!G.ended) {
        toast('نتوانستیم دوباره وصل شویم', 'err');
        finishGame({ youWon: false, result: 1, disconnected: true });
      }
    });
    session.on('oppDisconnected', function (d) {
      /* بازی متوقف نمی‌شود — سیستم به‌جای حریف بازی می‌کند.
       * پس ساعت نوبت باید بچرخد، وگرنه کاربر فکر می‌کند بازی قفل شده. */
      showConn('opp', Date.now() + (d.graceMs || 45000), d.name);
      toast('حریف قطع شد — سیستم تا ' + fa(d.autoRounds || 2) + ' نوبت به‌جایش بازی می‌کند', null, 3000);
    });
    session.on('oppReconnected', function () {
      hideConn();
      toast('حریف برگشت', 'ok');
      startTurnClock();
    });

    session.on('oppLeft', function () {
      toast('حریف بازی را ترک کرد', 'err');
      finishGame({ youWon: true, result: 1, walkover: true });
    });

    session.on('disconnect', function () {
      if (!G.ended) toast('ارتباط با سرور قطع شد', 'err');
    });

    session.on('end', function (d) { finishGame(d); });

    session.start();
  }

  function maybeAutoEnd() {
    var st = G.state;
    if (!st || st.done || st.turn !== G.me) return;
    if (E.legalFirstMoves(st, G.me).length) return;
    clearTimeout(G.endingTimer);
    G.endingTimer = setTimeout(function () {
      if (G.state && G.state.turn === G.me && !G.state.done && !E.legalFirstMoves(G.state, G.me).length) {
        G.session.endTurn();
      }
    }, 550);
  }

  $('#btn-action').onclick = function () {
    var st = G.state;
    if (!st || st.done || st.turn !== G.me) return;
    if (!st.dice.length) { G.session.roll(); return; }
    if (!E.legalFirstMoves(st, G.me).length) { G.session.endTurn(); }
  };

  $('#btn-undo').onclick = function () {
    if (G.session && G.session.undo()) { G.selected = null; SFX.tap(); renderAll(false); }
  };

  $('#conn-quit').onclick = function () {
    hideConn();
    if (G.session) G.session.leave();
    if (!G.ended) finishGame({ youWon: false, result: 1, disconnected: true });
  };

  $('#btn-game-menu').onclick = function () {
    var m = modal(
      '<h2>منوی بازی</h2><p>در حال بازی در ' + esc(G.room.name) + '</p>' +
      '<button class="btn ghost" id="gm-close" style="margin-bottom:9px">ادامه‌ی بازی</button>' +
      '<button class="btn red" id="gm-resign">تسلیم شدن (باخت)</button>'
    );
    $('#gm-close').onclick = closeModal;
    $('#gm-resign').onclick = function () {
      closeModal();
      confirmDialog('تسلیم می‌شوید؟',
        'ورودی ' + fa(G.room.entry) + ' سکه از دست می‌رود، اما انرژی بازی را می‌گیرید.',
        'بله، تسلیم', function () { G.session.resign(); }, 'red');
    };
  };

  /* --- چت سریع --- */
  var QUICK = ['سلام 👋', 'موفق باشی', 'ایول!', 'چه شانسی 😄', 'عجله نکن', 'دمت گرم', 'یه دست دیگه؟', '😅', '👏'];
  function buildChatStrip() {
    var s = $('#chat-strip'); s.innerHTML = '';
    QUICK.forEach(function (q) {
      var b = el('button', '', q);
      b.onclick = function () { G.session.chat(q); };
      s.appendChild(b);
    });
  }

  /* --- پرده‌ی قطع اتصال --- */
  var connIv = null;
  function showConn(kind, until, name) {
    var ov = $('#conn-overlay');
    ov.classList.add('show');
    ov.classList.toggle('waiting', kind === 'opp');
    $('#conn-title').textContent = kind === 'me' ? 'اتصال قطع شد' : 'حریف قطع شد';
    $('#conn-sub').innerHTML = kind === 'me'
      ? 'در حال برگشتن به بازی…<br>اگر تا پایان شمارش برنگردی، بازی را می‌بازی.'
      : esc(name || 'حریف') + ' از بازی خارج شد.<br>اگر برنگردد، برنده شما هستید.';
    $('#conn-quit').style.display = kind === 'me' ? '' : 'none';

    clearInterval(connIv);
    function tick() {
      var left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      $('#conn-count').textContent = fa(left);
      if (left <= 0) clearInterval(connIv);
    }
    tick();
    connIv = setInterval(tick, 300);
  }
  function hideConn() {
    clearInterval(connIv); connIv = null;
    var ov = $('#conn-overlay');
    if (ov) ov.classList.remove('show');
  }

  /* --- پایان بازی و تسویه --- */
  function finishGame(d) {
    if (G.ended) return;
    G.ended = true;
    clearTimeout(G.endingTimer);
    stopTurnClock();
    hideConn();
    setTimeout(resetBoardFx, 420);       // بعد از تمام شدن پرواز مهره‌ها

    var won = !!d.youWon;
    var mars = (d.result || 1) >= 2;

    // آنلاین: سرور از قبل تسویه کرده و رقم‌ها را در settlement فرستاده.
    // آفلاین: خودمان حساب می‌کنیم.
    var r;
    if (S.isOnline() && d.settlement) {
      var eco = S.roomEconomy(G.room);
      r = {
        prize: d.settlement.prize || 0,
        rake: d.settlement.rake != null ? d.settlement.rake : eco.rake,
        energy: d.settlement.energy || S.energyForEntry(G.room.entry, mars),
        xp: Math.max(10, Math.round(G.room.entry / 20)) * (won ? 2 : 1),
        eco: {
          entry: d.settlement.entry != null ? d.settlement.entry : eco.entry,
          pot: d.settlement.pot != null ? d.settlement.pot : eco.pot,
          rake: d.settlement.rake != null ? d.settlement.rake : eco.rake,
          rakePercent: eco.rakePercent,
          prize: d.settlement.prize || eco.prize
        }
      };
      if (d.profile) S.applyServerProfile(d.profile);
    } else {
      r = S.settleGame(G.room, won, mars);
    }
    refreshWallet();

    if (won) { SFX.win(); vibrate([40, 60, 40]); } else { SFX.lose(); vibrate(60); }

    var title = won
      ? (d.result === 3 ? 'توله‌مارس! 🏆' : d.result === 2 ? 'مارس کردی! 🥇' : 'بردی! 🎉')
      : (d.result === 3 ? 'توله‌مارس شدی 😔' : d.result === 2 ? 'مارس شدی 😕' : 'باختی');

    var lines =
      '<div class="result-lines">' +
        '<div><span>ورودی اتاق</span><span style="color:var(--red)">−' + fa(G.room.entry) + ' 🪙</span></div>' +
        (won
          ? '<div><span>مبلغ میز</span><span>' + fa(r.eco.pot) + ' 🪙</span></div>' +
            (r.eco.rake ? '<div><span>فی اتاق (' + fa(r.eco.rakePercent) + '٪)</span><span style="color:var(--red)">−' + fa(r.eco.rake) + ' 🪙</span></div>' : '') +
            '<div><span>جایزه‌ی شما</span><span style="color:var(--gold)">+' + fa(r.prize) + ' 🪙</span></div>'
          : '') +
        '<div><span>انرژی دریافتی' + (mars ? ' (+۵۰٪ مارس)' : '') + '</span><span style="color:var(--energy)">+' + fa(r.energy) + ' ⚡</span></div>' +
        '<div><span>امتیاز تجربه</span><span style="color:var(--blue)">+' + fa(r.xp) + ' XP</span></div>' +
      '</div>';

    var net = won ? (r.prize - G.room.entry) : -G.room.entry;

    var mEl = modal(
      '<div class="m-ic' + (won ? ' pop' : '') + '">' + (won ? '🏆' : '💔') + '</div>' +
      '<h2>' + title + '</h2>' +
      '<div class="result-amount ' + (won ? 'win' : 'lose') + '">' + (net >= 0 ? '+' : '−') + fa(Math.abs(net)) + ' 🪙</div>' +
      lines +
      '<div class="row"><button class="btn ghost" id="rg-home">بازگشت</button>' +
      '<button class="btn primary" id="rg-again">🎲 بازی دوباره</button></div>',
      { dismissible: false }
    );

    if (won) setTimeout(function () { confetti(mEl, 46); }, 180);

    $('#rg-home').onclick = function () {
      closeModal(); if (G.session) G.session.leave(); go('screen-home', true);
    };
    $('#rg-again').onclick = function () {
      closeModal();
      if (G.session) G.session.leave();
      if (P.coins < G.room.entry) { toast('سکه کافی برای بازی دوباره ندارید', 'err'); go('screen-home', true); return; }
      startMatch(G.room);
    };
  }

  /* =====================================================================
   *  فروشگاه
   * ===================================================================== */

  /* =====================================================================
   *  کیف پول تتری
   *
   *  همه‌ی مبالغ از سرور به «میکرو-تتر» (عدد صحیح) می‌آیند و فقط
   *  همین‌جا برای نمایش به اعشار تبدیل می‌شوند.
   * ===================================================================== */

  var USDT = 1000000;
  var walletData = null;

  function usdt(micro) { return (Math.round(Number(micro) || 0) / USDT).toFixed(2); }

  /* ⚠️ عمداً از toLocaleString استفاده نمی‌کنیم:
   * برای ۵٫۰۰ خروجی «۵» می‌دهد و صفرهای اعشار را می‌اندازد.
   * برای پول، «۵» و «۵٫۰۰» یکی نیستند — همیشه دو رقم اعشار نشان می‌دهیم. */
  function faDigits(str) {
    return String(str).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; });
  }
  function faUsdt(micro) {
    var v = usdt(micro);                     // مثل "1234.50"
    var parts = v.split('.');
    var whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
    return faDigits(whole) + '٫' + faDigits(parts[1]);
  }
  function toMicro(v) { return Math.round((parseFloat(String(v).replace(/[^\d.]/g, '')) || 0) * USDT); }

  function intVal(sel) {
    var el2 = $(sel);
    return el2 ? (parseInt(String(el2.value).replace(/\D/g, ''), 10) || 0) : 0;
  }

  function buildShop() {
    var tabs = $$('#wallet-tabs .tab');
    tabs.forEach(function (t) {
      t.onclick = function () {
        SFX.tap();
        tabs.forEach(function (x) { x.classList.toggle('active', x === t); });
        ['buy', 'sell', 'deposit', 'withdraw'].forEach(function (name) {
          $('#pane-' + name).style.display = (name === t.dataset.tab) ? '' : 'none';
        });
      };
    });
    refreshWalletScreen();
  }

  /** کیف پول را از سرور می‌گیرد و هر چهار تب را از نو می‌سازد */
  function refreshWalletScreen() {
    if (!S.isOnline()) {
      var msg = '<div class="card"><h3>کیف پول</h3><div class="muted">' +
        'برای خرید و فروش سکه باید وارد حساب شوید.</div></div>';
      ['buy', 'sell', 'deposit', 'withdraw'].forEach(function (n) { $('#pane-' + n).innerHTML = msg; });
      $('#bal-usdt').innerHTML = '—';
      return;
    }

    window.API.wallet().then(function (d) {
      if (!d || !d.ok) { toast((d && d.message) || 'کیف پول خوانده نشد', 'err'); return; }
      walletData = d;
      $('#bal-usdt').innerHTML = faUsdt(d.balance) + ' <span>USDT</span>';
      paneBuy(d); paneSell(d); paneDeposit(d); paneWithdraw(d);
    });
  }

  /* ------------------------------------------------------- تب خرید */

  function paneBuy(w) {
    var rate = w.rates.buy;                       // میکرو-تتر برای هر سکه
    var perUsdt = Math.floor(USDT / rate);        // چند سکه برای ۱ تتر

    var html =
      '<div class="warn-box">نرخ امروز: با <b>۱ تتر</b> می‌توانید <b>' + fa(perUsdt) + ' سکه</b> بخرید.</div>';

    (S.COIN_PACKS || []).forEach(function (pk) {
      var total = pk.total || S.packTotal(pk);
      var cost = pk.cost != null ? pk.cost : pk.coins * rate;
      html +=
        '<div class="pack' + (pk.tag === 'محبوب‌ترین' ? ' best' : '') + '" data-pack="' + pk.id + '">' +
          (pk.tag ? '<div class="ribbon">' + pk.tag + '</div>' : '') +
          '<div class="p-ic">' + pk.icon + '</div>' +
          '<div class="p-body">' +
            '<div class="p-coins">' + fa(total) + ' سکه</div>' +
            (pk.bonus
              ? '<div class="p-bonus">' + fa(pk.coins) + ' + ' + fa(pk.bonus) + '٪ هدیه</div>'
              : '<div class="p-bonus">&nbsp;</div>') +
          '</div>' +
          '<div class="p-price">' + faUsdt(cost) + ' USDT</div>' +
        '</div>';
    });

    html +=
      '<div class="card" style="margin-top:14px">' +
        '<h3>مقدار دلخواه</h3>' +
        '<label class="fld"><span>چند سکه می‌خواهید؟</span>' +
          '<input class="input" id="buy-amount" type="tel" inputmode="numeric" ' +
          'placeholder="' + w.rates.buyMin + '" style="direction:ltr;text-align:left"></label>' +
        '<div class="card" style="margin:0 0 12px;background:#0d1526">' +
          '<div style="display:flex;justify-content:space-between">' +
            '<span class="muted">هزینه</span><b id="buy-preview" style="color:var(--gold)">۰٫۰۰ USDT</b>' +
          '</div>' +
        '</div>' +
        '<button class="btn primary" id="btn-buy-custom">خرید سکه</button>' +
      '</div>';

    var pane = $('#pane-buy');
    pane.innerHTML = html;

    $$('.pack', pane).forEach(function (card) {
      card.onclick = function () {
        var pk = (S.COIN_PACKS || []).filter(function (x) { return x.id === card.dataset.pack; })[0];
        if (pk) buyPackFlow(pk, w);
      };
    });

    $('#buy-amount').oninput = function () {
      $('#buy-preview').textContent = faUsdt(intVal('#buy-amount') * rate) + ' USDT';
    };
    $('#btn-buy-custom').onclick = function () {
      var coins = intVal('#buy-amount');
      if (coins < w.rates.buyMin) return toast('حداقل خرید ' + fa(w.rates.buyMin) + ' سکه است', 'err');
      if (coins * rate > w.balance) return toast('بالانس کافی نیست', 'err');
      doBuy(coins, null);
    };
  }

  function buyPackFlow(pk, w) {
    var total = pk.total || S.packTotal(pk);
    var cost = pk.cost != null ? pk.cost : pk.coins * w.rates.buy;
    var m = modal(
      '<div class="m-ic">' + pk.icon + '</div><h2>خرید ' + fa(total) + ' سکه</h2>' +
      '<div class="result-lines">' +
        '<div><span>سکه‌ی پایه</span><span>' + fa(pk.coins) + '</span></div>' +
        (pk.bonus ? '<div><span>هدیه (' + fa(pk.bonus) + '٪)</span><span style="color:var(--green)">+' + fa(total - pk.coins) + '</span></div>' : '') +
        '<div><span>هزینه</span><span style="color:var(--gold)">' + faUsdt(cost) + ' USDT</span></div>' +
        '<div><span>بالانس بعد از خرید</span><span>' + faUsdt(w.balance - cost) + ' USDT</span></div>' +
      '</div>' +
      (cost > w.balance ? '<div class="warn-box" style="margin-top:10px">بالانس کافی نیست — اول از تب «شارژ» حساب را شارژ کنید.</div>' : '') +
      '<div class="row"><button class="btn ghost" id="pf-no">انصراف</button>' +
      '<button class="btn primary" id="pf-yes"' + (cost > w.balance ? ' disabled' : '') + '>خرید</button></div>'
    );
    $('#pf-no', m).onclick = closeModal;
    $('#pf-yes', m).onclick = function () { closeModal(); doBuy(null, pk.id); };
  }

  function doBuy(coins, packId) {
    window.API.buyCoins(packId || coins).then(function (r) {
      if (!r || !r.ok) { toast((r && r.message) || 'خرید نشد', 'err', 2800); return; }
      if (r.profile) S.applyServerProfile(r.profile);
      SFX.coin(); refreshWallet(); refreshWalletScreen();
      var bonus = r.bonus ? '<div><span>هدیه</span><span style="color:var(--green)">+' + fa(r.bonus) + '</span></div>' : '';
      modal('<div class="m-ic">🎉</div><h2>سکه‌ها اضافه شد</h2>' +
        '<div class="result-amount win">+' + fa(r.coins) + ' 🪙</div>' +
        '<div class="result-lines">' + bonus +
        '<div><span>پرداختی</span><span>' + faUsdt(r.cost) + ' USDT</span></div></div>' +
        '<button class="btn primary" id="ps-ok">عالی</button>');
      $('#ps-ok').onclick = closeModal;
    });
  }

  /* ------------------------------------------------------- تب فروش */

  function paneSell(w) {
    var rate = w.rates.sell;
    var perUsdt = Math.ceil(USDT / rate);

    $('#pane-sell').innerHTML =
      '<div class="card">' +
        '<h3>فروش سکه</h3>' +
        '<div class="muted" style="margin-bottom:12px">' +
          'نرخ امروز: هر <b>' + fa(perUsdt) + ' سکه</b> = <b>۱ تتر</b><br>' +
          'حداقل فروش: <b>' + fa(w.rates.sellMin) + ' سکه</b><br>' +
          'تتر <b>فوری</b> به بالانس شما اضافه می‌شود — بدون انتظار.' +
        '</div>' +
        '<label class="fld"><span>مقدار سکه</span>' +
          '<input class="input" id="sell-amount" type="tel" inputmode="numeric" ' +
          'placeholder="' + w.rates.sellMin + '" style="direction:ltr;text-align:left"></label>' +
        '<div class="card" style="margin:0 0 12px;background:#0d1526">' +
          '<div style="display:flex;justify-content:space-between">' +
            '<span class="muted">دریافتی</span><b id="sell-preview" style="color:var(--green)">۰٫۰۰ USDT</b>' +
          '</div>' +
        '</div>' +
        '<button class="btn green" id="btn-sell">فروش سکه</button>' +
      '</div>';

    $('#sell-amount').oninput = function () {
      $('#sell-preview').textContent = faUsdt(intVal('#sell-amount') * rate) + ' USDT';
    };
    $('#btn-sell').onclick = function () {
      var coins = intVal('#sell-amount');
      if (coins < w.rates.sellMin) return toast('حداقل فروش ' + fa(w.rates.sellMin) + ' سکه است', 'err');
      if (coins > S.get().coins) return toast('این‌قدر سکه ندارید', 'err');

      confirmDialog('فروش سکه',
        fa(coins) + ' سکه می‌فروشید و <b>' + faUsdt(coins * rate) + ' تتر</b> می‌گیرید.<br>مطمئنید؟',
        'بله، بفروش', function () {
          window.API.sellCoins(coins).then(function (r) {
            if (!r || !r.ok) { toast((r && r.message) || 'فروش نشد', 'err'); return; }
            if (r.profile) S.applyServerProfile(r.profile);
            SFX.coin(); refreshWallet(); refreshWalletScreen();
            toast('فروخته شد — ' + faUsdt(r.gain) + ' تتر به بالانس اضافه شد', 'ok', 3000);
          });
        });
    };
  }

  /* ------------------------------------------------------- تب شارژ */

  function paneDeposit(w) {
    var addr = w.addresses || {};
    var hasAddr = addr.TRC20 || addr.BEP20;

    var netOptions = '';
    if (addr.TRC20) netOptions += '<option value="TRC20">TRC20 (ترون)</option>';
    if (addr.BEP20) netOptions += '<option value="BEP20">BEP20 (بایننس اسمارت چین)</option>';

    var html =
      '<div class="card">' +
        '<h3>کد وچر</h3>' +
        '<div class="muted" style="margin-bottom:10px">اگر کد وچر دارید، همین‌جا وارد کنید — فوری شارژ می‌شود.</div>' +
        '<label class="fld"><span>کد وچر</span>' +
          '<input class="input" id="voucher-code" placeholder="XXXX-XXXX-XXXX-XXXX" ' +
          'style="direction:ltr;text-align:center;letter-spacing:1px;text-transform:uppercase"></label>' +
        '<button class="btn primary" id="btn-voucher">استفاده از کد</button>' +
      '</div>';

    if (!hasAddr) {
      html +=
        '<div class="card"><h3>واریز تتر</h3>' +
        '<div class="muted">آدرس واریز هنوز تنظیم نشده است. از پنل مدیریت ' +
        '<b>DEPOSIT_ADDRESS_TRC20</b> را وارد کنید.</div></div>';
    } else {
      html +=
        '<div class="card">' +
          '<h3>واریز تتر</h3>' +
          '<div class="warn-box">' +
            '⚠️ فقط <b>USDT</b> و فقط روی شبکه‌ی انتخاب‌شده بفرستید.<br>' +
            'ارسال ارز دیگر یا شبکه‌ی اشتباه یعنی <b>از دست رفتن دائمی پول</b>.' +
          '</div>' +
          '<label class="fld"><span>شبکه</span>' +
            '<select class="input" id="dep-network" style="direction:ltr">' + netOptions + '</select></label>' +
          '<div class="muted" style="margin-bottom:2px">آدرس واریز:</div>' +
          '<div class="addr-box" id="dep-address">' + esc(addr.TRC20 || addr.BEP20) + '</div>' +
          '<button class="btn" id="btn-copy-addr" style="margin-bottom:14px">📋 کپی آدرس</button>' +
          '<div class="muted" style="margin-bottom:10px">' +
            'بعد از واریز، مبلغ و شناسه‌ی تراکنش (TXID) را اینجا ثبت کنید. ' +
            'حداقل واریز <b>' + faUsdt(w.rates.depositMin) + ' تتر</b> است.' +
          '</div>' +
          '<label class="fld"><span>مبلغ واریزی (تتر)</span>' +
            '<input class="input" id="dep-amount" type="tel" inputmode="decimal" placeholder="10.00" ' +
            'style="direction:ltr;text-align:left"></label>' +
          '<label class="fld"><span>شناسه تراکنش (TXID)</span>' +
            '<input class="input" id="dep-txid" placeholder="شناسه تراکنش از کیف پول یا صرافی" ' +
            'style="direction:ltr;text-align:left"></label>' +
          '<button class="btn primary" id="btn-deposit">ثبت واریز</button>' +
        '</div>';
    }

    // تاریخچه‌ی واریزها
    if (w.deposits && w.deposits.length) {
      html += '<div class="card"><h3>واریزهای شما</h3>';
      w.deposits.forEach(function (d) {
        html +=
          '<div class="tx-row">' +
            '<div class="tx-main">' +
              '<div class="tx-title">' + faUsdt(d.status === 'approved' ? d.credited : d.amount) + ' USDT</div>' +
              '<div class="tx-sub">' + esc(d.network) + ' · ' + esc(String(d.txid).slice(0, 18)) + '…</div>' +
            '</div>' +
            '<span class="pill ' + d.status + '">' + statusText(d.status) + '</span>' +
          '</div>' +
          (d.note ? '<div class="muted" style="margin:-4px 0 10px 4px;font-size:11.5px">' + esc(d.note) + '</div>' : '');
      });
      html += '</div>';
    }

    var pane = $('#pane-deposit');
    pane.innerHTML = html;

    $('#btn-voucher').onclick = function () {
      var code = $('#voucher-code').value.trim();
      if (!code) return toast('کد وچر را وارد کنید', 'err');
      window.API.voucher(code).then(function (r) {
        if (!r || !r.ok) { toast((r && r.message) || 'کد کار نکرد', 'err', 2800); return; }
        if (r.profile) S.applyServerProfile(r.profile);
        $('#voucher-code').value = '';
        SFX.coin(); refreshWallet(); refreshWalletScreen();
        toast(faUsdt(r.amount) + ' تتر به بالانس اضافه شد ✅', 'ok', 3000);
      });
    };

    if (!hasAddr) return;

    $('#dep-network').onchange = function () {
      $('#dep-address').textContent = addr[this.value] || '';
    };
    $('#btn-copy-addr').onclick = function () {
      copyText($('#dep-address').textContent.trim(), 'آدرس کپی شد');
    };
    $('#btn-deposit').onclick = function () {
      var micro = toMicro($('#dep-amount').value);
      var txid = $('#dep-txid').value.trim();
      if (micro < w.rates.depositMin) return toast('حداقل واریز ' + faUsdt(w.rates.depositMin) + ' تتر است', 'err');
      if (txid.length < 32) return toast('شناسه تراکنش (TXID) درست نیست', 'err');

      window.API.deposit(micro, txid, $('#dep-network').value).then(function (r) {
        if (!r || !r.ok) { toast((r && r.message) || 'ثبت نشد', 'err', 2800); return; }
        $('#dep-amount').value = ''; $('#dep-txid').value = '';
        refreshWalletScreen();
        modal('<div class="m-ic">⏳</div><h2>واریز ثبت شد</h2>' +
          '<p>بعد از بررسی، <b style="color:var(--green)">' + faUsdt(micro) + ' تتر</b> به بالانس شما اضافه می‌شود.<br>' +
          'کد پیگیری: <span style="direction:ltr;display:inline-block">' + esc(r.id) + '</span></p>' +
          '<button class="btn primary" id="dp-ok">باشه</button>');
        $('#dp-ok').onclick = closeModal;
      });
    };
  }

  function statusText(s2) {
    return s2 === 'pending' ? 'در انتظار'
         : s2 === 'approved' ? 'تأیید شد'
         : s2 === 'paid' ? 'پرداخت شد'
         : s2 === 'rejected' ? 'رد شد' : s2;
  }

  /* ----------------------------------------------------- تب برداشت */

  function paneWithdraw(w) {
    var html =
      '<div class="card">' +
        '<h3>برداشت تتر</h3>' +
        '<div class="muted" style="margin-bottom:10px">' +
          'حداقل برداشت: <b>' + faUsdt(w.rates.withdrawMin) + ' تتر</b><br>' +
          'کارمزد شبکه: <b>' + faUsdt(w.rates.withdrawFee) + ' تتر</b><br>' +
          'بعد از بررسی (معمولاً کمتر از ۲۴ ساعت) به آدرس شما واریز می‌شود.' +
        '</div>' +
        '<div class="warn-box">آدرس را با دقت وارد کنید. تتر ارسال‌شده به آدرس اشتباه برگشت‌پذیر نیست.</div>' +
        '<label class="fld"><span>شبکه</span>' +
          '<select class="input" id="wd-network" style="direction:ltr">' +
            '<option value="TRC20">TRC20 (ترون)</option>' +
            '<option value="BEP20">BEP20 (بایننس اسمارت چین)</option>' +
          '</select></label>' +
        '<label class="fld"><span>مبلغ (تتر)</span>' +
          '<input class="input" id="wd-amount" type="tel" inputmode="decimal" ' +
          'placeholder="' + usdt(w.rates.withdrawMin) + '" style="direction:ltr;text-align:left"></label>' +
        '<label class="fld"><span>آدرس کیف پول</span>' +
          '<input class="input" id="wd-address" placeholder="T..." style="direction:ltr;text-align:left"></label>' +
        '<div class="card" style="margin:0 0 12px;background:#0d1526">' +
          '<div style="display:flex;justify-content:space-between">' +
            '<span class="muted">دریافتی خالص</span><b id="wd-preview" style="color:var(--green)">۰٫۰۰ USDT</b>' +
          '</div>' +
        '</div>' +
        '<button class="btn green" id="btn-withdraw">ثبت درخواست برداشت</button>' +
      '</div>';

    if (w.withdrawals && w.withdrawals.length) {
      html += '<div class="card"><h3>برداشت‌های شما</h3>';
      w.withdrawals.forEach(function (x) {
        html +=
          '<div class="tx-row">' +
            '<div class="tx-main">' +
              '<div class="tx-title">' + faUsdt(x.payout) + ' USDT</div>' +
              '<div class="tx-sub">' + esc(x.network) + ' · ' + esc(String(x.address).slice(0, 14)) + '…</div>' +
            '</div>' +
            '<span class="pill ' + x.status + '">' + statusText(x.status) + '</span>' +
          '</div>' +
          (x.note ? '<div class="muted" style="margin:-4px 0 10px 4px;font-size:11.5px">' + esc(x.note) + '</div>' : '');
      });
      html += '</div>';
    }

    var pane = $('#pane-withdraw');
    pane.innerHTML = html;

    function preview() {
      var micro = toMicro($('#wd-amount').value);
      var net = Math.max(0, micro - w.rates.withdrawFee);
      $('#wd-preview').textContent = faUsdt(net) + ' USDT';
    }
    $('#wd-amount').oninput = preview;

    $('#btn-withdraw').onclick = function () {
      var micro = toMicro($('#wd-amount').value);
      var address = $('#wd-address').value.trim();
      var net = $('#wd-network').value;

      if (micro < w.rates.withdrawMin) return toast('حداقل برداشت ' + faUsdt(w.rates.withdrawMin) + ' تتر است', 'err');
      if (micro > w.balance) return toast('بالانس کافی نیست', 'err');
      if (!address) return toast('آدرس کیف پول را وارد کنید', 'err');

      confirmDialog('برداشت تتر',
        '<b>' + faUsdt(micro - w.rates.withdrawFee) + ' تتر</b> به این آدرس فرستاده می‌شود:<br>' +
        '<span style="direction:ltr;display:inline-block;word-break:break-all;font-size:12px">' + esc(address) + '</span><br><br>' +
        'شبکه: <b>' + esc(net) + '</b> — آدرس را دوباره چک کنید.',
        'ثبت درخواست', function () {
          window.API.withdraw(micro, address, net).then(function (r) {
            if (!r || !r.ok) { toast((r && r.message) || 'ثبت نشد', 'err', 2800); return; }
            if (r.profile) S.applyServerProfile(r.profile);
            $('#wd-amount').value = ''; $('#wd-address').value = '';
            refreshWallet(); refreshWalletScreen();
            toast('درخواست برداشت ثبت شد', 'ok', 3000);
          });
        });
    };
  }

  /* =====================================================================
   *  جایزه‌ها
   * ===================================================================== */

  function buildPrizes() {
    var list = $('#prizes-list');
    list.innerHTML = '';
    S.PRIZES.forEach(function (z) {
      var can = P.energy >= z.energy;
      var pct = Math.min(100, Math.round(P.energy / z.energy * 100));
      var typeTxt = z.type === 'coins' ? 'واریز فوری سکه'
                  : z.type === 'item' ? 'آیتم داخل بازی' : 'جایزه‌ی واقعی — ارسال پس از تأیید';
      var d = el('div', 'prize' + (can ? '' : ' cant'));
      d.innerHTML =
        '<div class="z-ic">' + z.icon + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="z-name">' + z.name + '</div>' +
          '<div class="z-type">' + typeTxt + '</div>' +
          (can ? '' : '<div class="z-prog"><i style="width:' + pct + '%"></i></div>') +
        '</div>' +
        '<div class="z-cost">⚡ ' + fa(z.energy) + '</div>';
      d.onclick = function () { redeemFlow(z); };
      list.appendChild(d);
    });

    var cl = $('#claims-list');
    if (!P.claims.length) {
      cl.innerHTML = '<div class="muted" style="text-align:center;padding:14px">هنوز درخواستی ثبت نشده</div>';
    } else {
      cl.innerHTML = '';
      var card = el('div', 'card');
      P.claims.slice(0, 20).forEach(function (c) {
        var row = el('div', 'tx-row');
        row.innerHTML =
          '<div class="tx-n"><div>' + (c.kind === 'sell'
            ? 'فروش ' + fa(c.amount) + ' سکه — ' + fa(c.toman) + ' تومان'
            : esc(c.prizeName)) + '</div>' +
          '<div class="tx-d">کد ' + esc(c.id) + ' • ' + S.faDate(c.t) + '</div></div>' +
          '<div class="tx-v" style="color:var(--gold)">در انتظار بررسی</div>';
        card.appendChild(row);
      });
      cl.appendChild(card);
    }
  }

  function redeemFlow(z) {
    if (P.energy < z.energy) {
      toast('برای این جایزه ' + fa(z.energy - P.energy) + ' انرژی دیگر لازم دارید', 'err');
      return;
    }
    var needsContact = z.type === 'real';
    var m = modal(
      '<div class="m-ic">' + z.icon + '</div><h2>' + z.name + '</h2>' +
      '<p>هزینه: <b style="color:var(--energy)">' + fa(z.energy) + ' انرژی</b><br>' +
      'انرژی فعلی شما: ' + fa(P.energy) + '</p>' +
      (needsContact
        ? '<label class="fld"><span>شماره تماس برای هماهنگی</span>' +
          '<input class="input" id="rd-contact" type="tel" inputmode="numeric" placeholder="09xxxxxxxxx" style="direction:ltr;text-align:left"></label>'
        : '') +
      '<div class="row"><button class="btn ghost" id="rd-no">انصراف</button>' +
      '<button class="btn primary" id="rd-yes">دریافت جایزه</button></div>'
    );
    $('#rd-no', m).onclick = closeModal;
    $('#rd-yes', m).onclick = function () {
      var contact = needsContact ? ($('#rd-contact').value || '').trim() : '';
      if (needsContact && contact.replace(/\D/g, '').length < 10) { toast('شماره تماس را درست وارد کنید', 'err'); return; }
      doAction(function () { return window.API.prize(z.id, contact); }, function () { return S.redeemPrize(z.id, contact); })
        .then(function (r) {
      if (!r || !r.ok) { toast((r && (r.message || r.reason)) || 'امکان‌پذیر نیست', 'err'); return; }
      SFX.coin(); buildPrizes();
      closeModal();
      setTimeout(function () {
        modal('<div class="m-ic">🎁</div><h2>' + (r.instant ? 'جایزه دریافت شد!' : 'درخواست ثبت شد') + '</h2>' +
          '<p>' + (r.instant
            ? (z.type === 'coins' ? fa(z.value) + ' سکه به کیف پول شما اضافه شد.' : '«' + z.name + '» به آیتم‌های شما اضافه شد.')
            : 'درخواست شما با کد <b style="direction:ltr;display:inline-block">' + esc(r.claim.id) + '</b> ثبت شد.<br>پس از بررسی با شما تماس گرفته می‌شود.') +
          '</p><button class="btn primary" id="rz-ok">باشه</button>');
        $('#rz-ok').onclick = closeModal;
      }, 120);
        });
    };
  }

  /* =====================================================================
   *  دعوت دوستان
   * ===================================================================== */

  function buildInvite() {
    $('#my-code').textContent = P.referralCode;
    $('#inv-count').textContent = fa(P.invitedCount);
    $('#inv-energy').textContent = fa(P.invitedCount * S.CONFIG.REFERRAL_ENERGY);
    $('#ref-input-card').style.display = P.referredBy ? 'none' : '';
  }

  $('#btn-copy-code').onclick = function () {
    var txt = S.inviteText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { toast('کد و لینک کپی شد ✅', 'ok'); }, fallbackCopy);
    } else fallbackCopy();
    function fallbackCopy() {
      var ta = document.createElement('textarea');
      ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('کد و لینک کپی شد ✅', 'ok'); }
      catch (e) { toast('کپی نشد — کد: ' + P.referralCode, 'err'); }
      ta.remove();
    }
  };

  $('#btn-share').onclick = function () {
    var txt = S.inviteText();
    if (navigator.share) {
      navigator.share({ title: 'تخته‌نرد حرفه‌ای', text: txt }).catch(function () {});
    } else if (window.AndroidBridge && window.AndroidBridge.share) {
      window.AndroidBridge.share(txt);
    } else {
      $('#btn-copy-code').click();
    }
  };

  $('#btn-apply-ref').onclick = function () {
    var code = $('#in-ref2').value.trim();
    doAction(function () { return window.API.referral(code); }, function () { return S.applyReferral(code); })
      .then(function (r) {
        if (!r || !r.ok) { toast((r && (r.message || r.reason)) || 'کد معتبر نیست', 'err'); return; }
        SFX.coin(); buildInvite();
        toast(fa(r.coins || S.CONFIG.REFERRAL_BONUS_NEW) + ' سکه هدیه گرفتید 🎉', 'ok');
      });
  };

  /* =====================================================================
   *  پوسته‌های تخته
   * ===================================================================== */

  /** پوسته را روی تخته (و لایه‌ی انیمیشن) اعمال می‌کند */
  function applySkin(id) {
    var board = $('#board'), layer = $('#fly-layer');
    [board, layer].forEach(function (n) {
      if (!n) return;
      S.SKINS.forEach(function (sk) { n.classList.remove('sk-' + sk.id); });
      if (id && id !== 'classic') n.classList.add('sk-' + id);
    });
  }

  function skinPreview(id) {
    return '<div class="skin-prev' + (id !== 'classic' ? ' sk-' + id : '') + '">' +
             '<div class="sp-felt">' +
               '<i class="sp-t l"></i><i class="sp-t d"></i><i class="sp-t l"></i>' +
               '<i class="sp-t d"></i><i class="sp-t l"></i><i class="sp-t d"></i>' +
               '<span class="sp-c a"></span><span class="sp-c b"></span>' +
             '</div>' +
           '</div>';
  }

  function buildSkins() {
    var list = $('#skins-list');
    list.innerHTML = '';

    S.SKINS.forEach(function (sk) {
      var owned = S.ownsSkin(sk.id);
      var equipped = owned && P.skin === sk.id;
      var lock = S.skinLockReason(sk.id);
      var roomSkin = sk.room ? S.roomById(sk.room) : null;

      var act;
      if (equipped) act = '<div class="sk-owned">✓ فعال</div>';
      else if (owned) act = '<button class="btn sm blue">انتخاب</button>';
      else if (lock) act = '<div class="sk-price free" style="background:rgba(148,163,184,.12);border-color:var(--line);color:var(--muted)">🔒</div>';
      else act = '<div class="sk-price' + (sk.currency === 'energy' ? ' energy' : '') + '">' +
                 fa(sk.price) + (sk.currency === 'energy' ? ' ⚡' : ' 🪙') + '</div>';

      var d = el('div', 'skin-card' + (equipped ? ' equipped' : '') + (owned ? '' : ' locked'));
      d.innerHTML =
        (roomSkin ? '<div class="sk-badge">' + roomSkin.icon + ' اختصاصی ' + roomSkin.name + '</div>' : '') +
        skinPreview(sk.id) +
        '<div style="flex:1;min-width:0">' +
          '<div class="sk-name">' + sk.name + '</div>' +
          '<div class="sk-desc">' + sk.desc +
            (lock ? '<br><span style="color:var(--red)">' + lock + '</span>' : '') +
            (roomSkin ? '<br><span style="color:var(--purple)">در ' + roomSkin.name + ' رایگان استفاده می‌شود</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="sk-act">' + act + '</div>';

      d.onclick = function () {
        SFX.tap();
        if (equipped) return;
        if (owned) {
          doAction(function () { return window.API.equipSkin(sk.id); }, function () { return S.equipSkin(sk.id); })
            .then(function (r) {
              if (!r || !r.ok) { toast((r && (r.message || r.reason)) || 'انتخاب نشد', 'err'); return; }
              buildSkins();
              toast('پوسته‌ی «' + sk.name + '» فعال شد ✅', 'ok');
            });
          return;
        }
        if (lock) { toast(lock, 'err'); return; }
        buySkinFlow(sk);
      };
      list.appendChild(d);
    });
  }

  function buySkinFlow(sk) {
    var isEnergy = sk.currency === 'energy';
    var have = isEnergy ? P.energy : P.coins;
    var unit = isEnergy ? '⚡ انرژی' : '🪙 سکه';
    var m = modal(
      '<div style="display:flex;justify-content:center;margin-bottom:12px">' + skinPreview(sk.id) + '</div>' +
      '<h2>' + sk.name + '</h2><p>' + sk.desc + '</p>' +
      '<div class="result-lines">' +
        '<div><span>قیمت</span><span>' + fa(sk.price) + ' ' + unit + '</span></div>' +
        '<div><span>موجودی شما</span><span style="color:' + (have >= sk.price ? 'var(--green)' : 'var(--red)') + '">' + fa(have) + ' ' + unit + '</span></div>' +
      '</div>' +
      '<div class="row"><button class="btn ghost" id="sb-no">انصراف</button>' +
      '<button class="btn primary" id="sb-yes">خرید و فعال‌سازی</button></div>'
    );
    $('#sb-no', m).onclick = closeModal;
    $('#sb-yes', m).onclick = function () {
      doAction(function () { return window.API.buySkin(sk.id); }, function () { return S.buySkin(sk.id); })
        .then(function (r) {
      if (!r || !r.ok) { toast((r && (r.message || r.reason)) || 'خرید نشد', 'err', 2400); return; }
      closeModal();
      SFX.coin(); buildSkins();
      setTimeout(function () {
        var mm = modal('<div class="m-ic pop">🎨</div><h2>پوسته‌ی جدید فعال شد!</h2>' +
          '<div style="display:flex;justify-content:center;margin:10px 0 14px">' + skinPreview(sk.id) + '</div>' +
          '<p>«' + sk.name + '» حالا روی تخته‌ی شماست.</p>' +
          '<button class="btn primary" id="sk-ok">عالی</button>');
        confetti(mm, 30);
        $('#sk-ok').onclick = closeModal;
      }, 120);
        });
    };
  }

  /* =====================================================================
   *  پروفایل
   * ===================================================================== */

  function buildProfile() {
    var lv = S.levelOf(P.xp);
    $('#pf-avatar').textContent = P.avatar;
    $('#pf-name').textContent = P.name || 'بازیکن';
    $('#pf-level').textContent = 'سطح ' + fa(lv.level);
    $('#pf-xp').style.width = Math.min(100, Math.round(lv.xp / lv.need * 100)) + '%';
    $('#pf-xp-txt').textContent = fa(lv.xp) + ' از ' + fa(lv.need) + ' امتیاز تا سطح بعد';

    var s = P.stats;
    $('#st-games').textContent = fa(s.games);
    $('#st-wins').textContent = fa(s.wins);
    $('#st-losses').textContent = fa(s.losses);
    $('#st-mars').textContent = fa(s.mars);
    $('#st-rate').textContent = fa(s.games ? Math.round(s.wins / s.games * 100) : 0) + '٪';
    $('#st-best').textContent = fa(s.bestWin);

    var tx = $('#tx-list');
    tx.innerHTML = '';
    if (!P.tx.length) { tx.innerHTML = '<div class="muted" style="text-align:center;padding:8px">تراکنشی ثبت نشده</div>'; return; }
    P.tx.slice(0, 40).forEach(function (t) {
      var row = el('div', 'tx-row');
      var parts = [];
      if (t.coins) parts.push('<span class="tx-v ' + (t.coins > 0 ? 'pos' : 'neg') + '">' + (t.coins > 0 ? '+' : '−') + fa(Math.abs(t.coins)) + ' 🪙</span>');
      if (t.energy) parts.push('<span class="tx-v ' + (t.energy > 0 ? 'pos' : 'neg') + '">' + (t.energy > 0 ? '+' : '−') + fa(Math.abs(t.energy)) + ' ⚡</span>');
      row.innerHTML = '<div class="tx-n"><div>' + esc(t.note || t.type) + '</div><div class="tx-d">' + S.faDate(t.t) + '</div></div>' +
        '<div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start">' + parts.join('') + '</div>';
      tx.appendChild(row);
    });
  }

  /* =====================================================================
   *  تنظیمات
   * ===================================================================== */

  function toggleBtn(id, key) {
    var b = $(id);
    function paint() {
      b.textContent = P.settings[key] ? 'روشن' : 'خاموش';
      b.className = 'btn sm ' + (P.settings[key] ? 'green' : 'ghost');
    }
    b.onclick = function () { P.settings[key] = !P.settings[key]; S.save(); paint(); SFX.tap(); };
    paint();
  }

  function buildSettings() {
    toggleBtn('#set-sound', 'sound');
    toggleBtn('#set-vibrate', 'vibrate');
    toggleBtn('#set-autoroll', 'autoRoll');
    $('#set-server').value = localStorage.getItem('nard_server') || '';

    $('#rules-text').innerHTML =
      '• هدیه‌ی خوش‌آمدگویی: <b>' + fa(S.CONFIG.WELCOME_COINS) + ' سکه</b><br>' +
      '• هدیه‌ی روزانه: <b>' + fa(S.CONFIG.DAILY_BONUS) + ' سکه</b><br>' +
      '• فی اتاق: <b>' + fa(S.CONFIG.RAKE_PERCENT) + '٪</b> از مبلغ میز، فقط برای اتاق‌های <b>' + fa(S.CONFIG.RAKE_MIN_ENTRY) + ' سکه به بالا</b><br>' +
      '• انرژی: به ازای هر <b>' + fa(S.CONFIG.ENERGY_PER_COINS) + ' سکه</b> شرط، <b>۱ انرژی</b> (چه برد چه باخت)<br>' +
      '• پاداش مارس: <b>+' + fa(S.CONFIG.ENERGY_MARS_BONUS * 100) + '٪</b> انرژی<br>' +
      '• دعوت دوستان: <b>' + fa(S.CONFIG.REFERRAL_ENERGY) + ' انرژی</b> + <b>' + fa(S.CONFIG.REFERRAL_COINS) + ' سکه</b> برای هر دعوت<br>' +
      '• خرید سکه: هر <b>۱ تتر</b> ≈ <b>' + fa(Math.floor(1000000 / (S.CONFIG.BUY_RATE || 100))) + ' سکه</b><br>' +
      '• فروش سکه: هر <b>' + fa(Math.ceil(1000000 / (S.CONFIG.SELL_RATE || 80))) + ' سکه</b> = <b>۱ تتر</b>';

    buildAccountCard();
  }

  /* --------------------------------------------------- کارت حساب */

  function buildAccountCard() {
    var P2 = S.get();
    var online = S.isOnline();

    $('#acc-username').textContent = P2.username || (online ? 'مهمان' : '—');

    var tg = $('#acc-telegram');
    tg.textContent = P2.telegramLinked ? '✓ وصل است' : 'وصل نیست';
    tg.className = P2.telegramLinked ? '' : 'muted';

    // مهمان اول باید حساب بسازد
    var isGuest = online && !P2.username;
    $('#btn-change-pass').style.display = isGuest ? 'none' : '';
    $('#btn-new-recovery').style.display = isGuest ? 'none' : '';
    $('#btn-link-telegram').textContent = P2.telegramLinked ? '🔗 مدیریت اتصال تلگرام' : '🔗 وصل کردن به تلگرام';

    if (isGuest) {
      $('#btn-link-telegram').textContent = '✨ ساخت حساب (تا سکه‌ها نپرند)';
      $('#btn-link-telegram').onclick = function () { SFX.tap(); go('screen-signup'); };
    } else {
      $('#btn-link-telegram').onclick = linkTelegramFlow;
    }

    $('#btn-change-pass').onclick = changePasswordFlow;
    $('#btn-new-recovery').onclick = newRecoveryFlow;

    $('#btn-logout').onclick = function () {
      confirmDialog('خروج از حساب',
        online && !P2.username
          ? 'شما حساب مهمان دارید. با خروج، <b>سکه‌ها و جوایزتان از بین می‌رود</b>. مطمئنید؟'
          : 'از حساب خارج می‌شوید. هر وقت خواستید با نام کاربری و رمز برمی‌گردید.',
        'خروج', function () {
          window.API.logout().then(function () {
            try { localStorage.removeItem('nard_profile_v1'); } catch (e) {}
            location.reload();
          });
        }, 'red');
    };
  }

  function changePasswordFlow() {
    SFX.tap();
    var m = modal(
      '<div class="m-ic">🔒</div><h2>تغییر رمز عبور</h2>' +
      '<label class="fld"><span>رمز فعلی</span>' +
        '<input class="input" id="cp-old" type="password" style="direction:ltr;text-align:left"></label>' +
      '<label class="fld"><span>رمز جدید</span>' +
        '<input class="input" id="cp-new" type="password" placeholder="حداقل ۸ کاراکتر، حرف و عدد" style="direction:ltr;text-align:left"></label>' +
      '<label class="fld"><span>تکرار رمز جدید</span>' +
        '<input class="input" id="cp-new2" type="password" style="direction:ltr;text-align:left"></label>' +
      '<div class="warn-box">با تغییر رمز، از همه‌ی دستگاه‌ها خارج می‌شوید و ' +
      '<b>کد بازیابی تازه</b> می‌گیرید (کد قبلی باطل می‌شود).</div>' +
      '<div class="row"><button class="btn ghost" id="cp-no">انصراف</button>' +
      '<button class="btn primary" id="cp-yes">تغییر رمز</button></div>'
    );
    $('#cp-no', m).onclick = closeModal;
    $('#cp-yes', m).onclick = function () {
      var o = $('#cp-old').value, n = $('#cp-new').value, n2 = $('#cp-new2').value;
      var problem = Auth.passwordProblem(n);
      if (problem) return toast(problem, 'err');
      if (n !== n2) return toast('دو رمز یکی نیستند', 'err');

      window.API.changePassword(o, n).then(function (r) {
        if (!r || !r.ok) { toast((r && r.message) || 'تغییر نکرد', 'err', 2800); return; }
        closeModal();
        toast('رمز عوض شد — دوباره وارد شوید', 'ok', 3000);
        setTimeout(function () {
          try { localStorage.removeItem('nard_profile_v1'); } catch (e) {}
          window.API.setToken(null);
          location.reload();
        }, 1800);
      });
    };
  }

  function newRecoveryFlow() {
    SFX.tap();
    var m = modal(
      '<div class="m-ic">🗝️</div><h2>کد بازیابی تازه</h2>' +
      '<p>کد بازیابی فعلی شما باطل می‌شود و یک کد تازه می‌گیرید.</p>' +
      '<label class="fld"><span>رمز عبور</span>' +
        '<input class="input" id="nr-pass" type="password" style="direction:ltr;text-align:left"></label>' +
      '<div class="row"><button class="btn ghost" id="nr-no">انصراف</button>' +
      '<button class="btn primary" id="nr-yes">ساخت کد</button></div>'
    );
    $('#nr-no', m).onclick = closeModal;
    $('#nr-yes', m).onclick = function () {
      window.API.newRecovery($('#nr-pass').value).then(function (r) {
        if (!r || !r.ok) { toast((r && r.message) || 'انجام نشد', 'err', 2800); return; }
        closeModal();
        $('#recovery-code').textContent = r.recovery;
        $('#chk-saved-recovery').checked = false;
        $('#btn-recovery-done').disabled = true;
        go('screen-recovery-show');
      });
    };
  }

  /**
   * وصل کردن حساب وب و تلگرام.
   *
   * کاربر روی یک طرف کد ۶ رقمی می‌گیرد و در طرف دیگر واردش می‌کند.
   * حسابی که نام کاربری دارد می‌ماند و آن یکی در آن ادغام می‌شود —
   * سکه‌ها، انرژی، بالانس و پوسته‌ها همه منتقل می‌شوند.
   */
  function linkTelegramFlow() {
    SFX.tap();
    var P2 = S.get();

    if (P2.telegramLinked) {
      var m2 = modal(
        '<div class="m-ic">🔗</div><h2>تلگرام وصل است</h2>' +
        '<p>می‌توانید از مینی‌اپ تلگرام هم با همین حساب وارد شوید.</p>' +
        '<div class="row"><button class="btn ghost" id="lt-close">بستن</button>' +
        '<button class="btn red" id="lt-unlink">جدا کردن</button></div>'
      );
      $('#lt-close', m2).onclick = closeModal;
      $('#lt-unlink', m2).onclick = function () {
        window.API.unlinkTelegram().then(function (r) {
          if (!r || !r.ok) { toast((r && r.message) || 'جدا نشد', 'err'); return; }
          if (r.profile) S.applyServerProfile(r.profile);
          closeModal(); buildAccountCard();
          toast('تلگرام جدا شد', 'ok');
        });
      };
      return;
    }

    var m = modal(
      '<div class="m-ic">🔗</div><h2>وصل کردن به تلگرام</h2>' +
      '<p class="muted" style="text-align:start;line-height:1.9">' +
        '<b>۱.</b> این کد را کپی کنید<br>' +
        '<b>۲.</b> بازی را در تلگرام باز کنید<br>' +
        '<b>۳.</b> آنجا از تنظیمات، «وصل کردن حساب» را بزنید و کد را وارد کنید' +
      '</p>' +
      '<div class="recovery-box" id="lt-code">…</div>' +
      '<div class="muted" style="text-align:center;font-size:11.5px" id="lt-exp">کد تا ۱۰ دقیقه معتبر است</div>' +
      '<button class="btn" id="lt-copy" style="margin:10px 0">📋 کپی کد</button>' +
      '<div class="muted" style="margin:14px 0 6px">یا اگر کد را از طرف دیگر گرفته‌اید:</div>' +
      '<label class="fld"><span>کد اتصال</span>' +
        '<input class="input" id="lt-input" type="tel" inputmode="numeric" maxlength="6" ' +
        'placeholder="۶ رقم" style="direction:ltr;text-align:center;letter-spacing:6px"></label>' +
      '<div class="row"><button class="btn ghost" id="lt-no">بستن</button>' +
      '<button class="btn primary" id="lt-join">وصل کن</button></div>'
    );

    window.API.linkCode().then(function (r) {
      if (r && r.ok) $('#lt-code').textContent = r.code;
      else $('#lt-code').textContent = '—';
    });

    $('#lt-copy', m).onclick = function () { copyText($('#lt-code').textContent.trim(), 'کد کپی شد'); };
    $('#lt-no', m).onclick = closeModal;
    $('#lt-join', m).onclick = function () {
      var code = $('#lt-input').value.replace(/\D/g, '');
      if (code.length !== 6) return toast('کد ۶ رقمی را وارد کنید', 'err');
      window.API.linkWith(code).then(function (r) {
        if (!r || !r.ok) { toast((r && r.message) || 'وصل نشد', 'err', 2800); return; }
        closeModal();
        window.API.me().then(function (d) {
          if (d.ok && d.profile) { S.applyServerProfile(d.profile); refreshWallet(); buildAccountCard(); }
          toast('حساب‌ها وصل شدند ✅', 'ok', 3000);
        });
      });
    };
  }

  $('#btn-save-server').onclick = function () {
    var v = $('#set-server').value.trim();
    localStorage.setItem('nard_server', v);
    Net.config.serverUrl = v;
    toast(v ? 'نشانی سرور ذخیره شد' : 'حالت آفلاین (بازی با ربات)', 'ok');
  };

  $('#btn-reset').onclick = function () {
    confirmDialog('همه‌چیز پاک شود؟',
      'سکه‌ها، انرژی و آمار شما برای همیشه حذف می‌شود. این کار برگشت‌پذیر نیست.',
      'پاک کن', function () {
        try { localStorage.removeItem('nard_profile_v1'); } catch (e) {}
        location.reload();
      }, 'red');
  };

  /* =====================================================================
   *  اتصال رویدادها و راه‌اندازی
   * ===================================================================== */

  var SCREEN_ENTER = {
    'screen-home': function () { refreshWallet(); },
    'screen-rooms': function () { refreshWallet(); buildRooms(); },
    'screen-shop': function () { refreshWallet(); buildShop(); },
    'screen-prizes': function () { refreshWallet(); buildPrizes(); },
    'screen-invite': function () { refreshWallet(); buildInvite(); },
    'screen-skins': function () { refreshWallet(); buildSkins(); },
    'screen-profile': function () { refreshWallet(); buildProfile(); },
    'screen-settings': function () { buildSettings(); }
  };

  function bindGlobal() {
    $$('[data-go]').forEach(function (n) {
      n.onclick = function (e) { e.stopPropagation(); SFX.tap(); go(n.dataset.go); };
    });
    $$('[data-back]').forEach(function (n) { n.onclick = function () { SFX.tap(); back(); }; });

    $('#tile-quick').onclick = function () {
      SFX.tap();
      // ارزان‌ترین اتاقی که توانش را داریم
      var lv = S.levelOf(P.xp).level;
      var pick = null;
      for (var i = S.ROOMS.length - 1; i >= 0; i--) {
        var r = S.ROOMS[i];
        if (lv >= r.minLevel && P.coins >= r.entry) { pick = r; break; }
      }
      if (!pick) {
        confirmDialog('سکه کافی نیست', 'برای بازی به حداقل ' + fa(S.ROOMS[0].entry) + ' سکه نیاز دارید.',
          'رفتن به فروشگاه', function () { go('screen-shop'); });
        return;
      }
      startMatch(pick);
    };

    $('#tile-daily').onclick = function () {
      SFX.tap();
      doAction(function () { return window.API.daily(); }, function () { return S.claimDaily(); })
        .then(function (r) {
          if (!r || !r.ok) { toast((r && (r.message || r.reason)) || 'امکان‌پذیر نیست', 'err'); return; }
          SFX.coin();
          toast('+' + fa(r.coins || S.CONFIG.DAILY_BONUS) + ' سکه هدیه‌ی روزانه 🎁', 'ok');
        });
    };

    window.addEventListener('resize', function () {
      if ($('.screen.active') && $('.screen.active').id === 'screen-game') drawCheckers();
    });

    // دکمه‌ی بازگشت اندروید — از MainActivity صدا زده می‌شود
    window.onAndroidBack = function () {
      if ($('#modal-bg').classList.contains('show')) { closeModal(); return true; }
      var cur = $('.screen.active');
      if (!cur) return false;
      if (cur.id === 'screen-game') { $('#btn-game-menu').click(); return true; }
      if (cur.id === 'screen-search') { $('#btn-cancel-search').click(); return true; }
      if (cur.id !== 'screen-home' && cur.id !== 'screen-login' && cur.id !== 'screen-welcome') { back(); return true; }
      return false;   // false یعنی از برنامه خارج شو
    };
    document.addEventListener('backbutton', function () { window.onAndroidBack(); }, false);
  }

  function boot() {
    P = S.load();
    var saved = null;
    try { saved = localStorage.getItem('nard_server'); } catch (e) {}
    if (saved) Net.config.serverUrl = saved;

    bindGlobal();
    buildLogin();
    buildAuth();
    refreshWallet();

    function route() {
      if (P.name && P.welcomeTaken) go('screen-home', true);
      else if (P.verified) go('screen-login', true);
      else go('screen-welcome', true);
    }

    // اگر سرور تنظیم شده، وصل می‌شویم و کیف پول را از آن می‌گیریم
    if (window.API) {
      window.API.connect().then(function (res) {
        if (res.online && res.profile) {
          S.applyServerProfile(res.profile);
          P = S.get();
          refreshWallet();
        }
        if (res.online && res.profile && res.profile.banned) {
          modal('<div class="m-ic">🚫</div><h2>حساب شما مسدود است</h2>' +
            '<p>' + esc(res.profile.banReason || 'برای پیگیری با پشتیبانی تماس بگیرید.') + '</p>',
            { dismissible: false });
          return;
        }
        route();
      }).catch(route);
    } else {
      route();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.NardUI = { go: go, toast: toast, refreshWallet: refreshWallet, _state: function () { return G.state; }, _g: G };
})();
