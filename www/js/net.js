/* =========================================================================
 *  net.js — لایه‌ی شبکه و مچ‌میکینگ
 *
 *  یک واسط یکسان برای دو حالت:
 *    ۱) آنلاین  — اتصال WebSocket به سرور، بازی با بازیکن واقعی
 *    ۲) ربات    — اگر سرور در دسترس نبود یا حریفی پیدا نشد، ربات وارد می‌شود
 *
 *  رابط کاربری هیچ تفاوتی بین این دو حالت نمی‌بیند.
 * ========================================================================= */
(function (root) {
  'use strict';

  var Engine = root.Engine;
  var AI = root.AI;

  /* ------------------------------------------------------------ تنظیمات */

  /**
   * نشانی پیش‌فرض سرور را از همان جایی که صفحه باز شده می‌سازد.
   *
   * بدون این، بازی روی وب با serverUrl خالی بالا می‌آمد و همیشه آفلاین
   * با ربات بازی می‌شد — بدون ورود، بدون کیف پول واقعی.
   *
   * در اپ اندروید (file://) خالی برمی‌گردد و MainActivity مقدار را می‌گذارد.
   */
  function defaultServerUrl() {
    try {
      if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) {
        return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
      }
    } catch (e) {}
    return '';
  }

  var NetConfig = {
    // نشانی سرور بازی. برای تست محلی: 'ws://10.0.2.2:8080' (شبیه‌ساز اندروید)
    serverUrl: (root.NARD_SERVER_URL || defaultServerUrl()),
    connectTimeout: 4000,      // مهلت اتصال به سرور
    searchTimeout: 9000,       // مهلت پیدا کردن حریف واقعی، بعد از آن ربات می‌آید
    botFallback: true,
    speed: 1,                  // ضریب سرعت ربات (برای تست خودکار کوچک می‌شود)
    turnMs: 30000,             // مهلت هر مرحله‌ی نوبت (انداختن تاس / حرکت دادن)
    autoRounds: 2,             // سیستم تا این تعداد نوبت به‌جای بازیکن بازی می‌کند، بعد باخت
    reconnectMs: 45000         // مهلت بازگشت بعد از قطع اتصال
  };

  /* اسم و آواتار برای حریف‌های رباتی (تا حس بازی با آدم واقعی بدهد) */
  var BOT_NAMES = [
    'علی', 'رضا', 'محمد', 'امیر', 'سعید', 'حسین', 'مهدی', 'پویا', 'آرش', 'بابک',
    'کامران', 'نیما', 'فرهاد', 'شایان', 'سینا', 'مجید', 'بهنام', 'کیوان', 'داریوش', 'سهیل',
    'مریم', 'سارا', 'نگین', 'الهام', 'پریسا', 'شیوا', 'مینا', 'ترانه', 'رؤیا', 'یلدا'
  ];
  var BOT_SUFFIX = ['', '', '', '_۷۲', '۱۳۶۱', '_ایران', 'خان', '_۹۸', 'جون', '_تهران', '_شیراز', '_مشهد'];
  var BOT_AVATARS = ['🦁', '🐯', '🦊', '🐺', '🦅', '🐉', '🦈', '🐻', '🐎', '🕊️', '🦖', '🦂'];

  function randomBotIdentity(room) {
    var name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] +
               BOT_SUFFIX[Math.floor(Math.random() * BOT_SUFFIX.length)];
    var lvl = Math.max(1, (room && room.minLevel ? room.minLevel : 1) + Math.floor(Math.random() * 9));
    return {
      id: 'bot_' + Math.random().toString(36).slice(2, 9),
      name: name,
      avatar: BOT_AVATARS[Math.floor(Math.random() * BOT_AVATARS.length)],
      level: lvl,
      isBot: true
    };
  }

  /** سطح سختی ربات بر اساس ارزش اتاق — اتاق‌های گران‌تر، حریف قوی‌تر */
  function botLevelForRoom(room) {
    if (!room) return 'normal';
    if (room.entry <= 100) return 'easy';
    if (room.entry <= 1000) return Math.random() < 0.4 ? 'easy' : 'normal';
    if (room.entry <= 25000) return Math.random() < 0.35 ? 'hard' : 'normal';
    return Math.random() < 0.7 ? 'hard' : 'normal';
  }

  /* ------------------------------------------------------- امیتر ساده */

  function Emitter() { this._h = {}; }
  Emitter.prototype.on = function (evt, fn) {
    (this._h[evt] || (this._h[evt] = [])).push(fn);
    return this;
  };
  Emitter.prototype.emit = function (evt, data) {
    var l = this._h[evt];
    if (!l) return;
    for (var i = 0; i < l.length; i++) { try { l[i](data); } catch (e) { console.error(e); } }
  };

  /* =====================================================================
   *  جلسه‌ی بازی با ربات (کاملاً محلی — بدون نیاز به اینترنت)
   * ===================================================================== */

  function BotSession(opts) {
    Emitter.call(this);
    this.room = opts.room;
    this.me = Engine.P1;                       // کاربر همیشه بازیکن ۱ (پایین تخته)
    this.level = opts.level || botLevelForRoom(opts.room);
    this.opponent = opts.opponent || randomBotIdentity(opts.room);
    this.mode = 'bot';
    this.state = null;
    this._timers = [];
    this._closed = false;
    this.turnDeadline = 0;      // زمان پایان نوبت (میلی‌ثانیه)
    this.autoPlayed = 0;        // چند نوبت پشت‌سرهم سیستم به‌جای بازیکن بازی کرده
    this._turnTimer = null;
  }
  BotSession.prototype = Object.create(Emitter.prototype);

  /** تایمر نوبت را از نو تنظیم می‌کند */
  BotSession.prototype._armTimer = function () {
    clearTimeout(this._turnTimer);
    var st = this.state, self = this;
    if (this._closed || !st || st.done) { this.turnDeadline = 0; return; }
    this.turnDeadline = Date.now() + NetConfig.turnMs;
    this.emit('timer', { deadline: this.turnDeadline, player: st.turn });
    if (st.turn !== this.me) return;                  // ربات خودش سریع بازی می‌کند
    this._turnTimer = setTimeout(function () { self._onTimeout(); }, NetConfig.turnMs + 120);
  };

  BotSession.prototype._clearTimer = function () {
    clearTimeout(this._turnTimer);
    this._turnTimer = null;
    this.turnDeadline = 0;
  };

  BotSession.prototype._onTimeout = function () {
    var st = this.state;
    if (this._closed || !st || st.done || st.turn !== this.me) return;
    this.autoPlayed++;
    this.emit('timeout', {
      player: this.me, auto: this.autoPlayed, max: NetConfig.autoRounds,
      left: Math.max(0, NetConfig.autoRounds - this.autoPlayed + 1)
    });

    if (this.autoPlayed > NetConfig.autoRounds) {
      this._clearTimer();
      st.done = true; st.winner = -this.me; st.result = 1; st.resign = true;
      this.emit('end', {
        winner: st.winner, youWon: false, result: 1, cube: st.cube,
        resign: true, timeout: true, state: st
      });
      return;
    }
    this._autoPlay();
  };

  /** وقتی وقت تمام می‌شود، سیستم به‌جای بازیکن بازی می‌کند */
  BotSession.prototype._autoPlay = function () {
    var self = this, st = this.state;
    this._clearTimer();

    if (!st.dice.length) {
      Engine.rollDice(st);
      this.emit('roll', { player: this.me, dice: st.dice.slice(), state: st, auto: true });
    }
    var pick = AI.chooseTurn(st, this.me, 'normal');
    if (!pick || !pick.seq.length) {
      this._later(function () { self.emit('nomove', { player: self.me }); self._advance(); }, 500);
      return;
    }
    var i = 0;
    function step() {
      if (self._closed || st.done) return;
      if (i >= pick.seq.length) { self._later(function () { self._advance(); }, 300); return; }
      var mv = pick.seq[i++];
      Engine.applyMove(st, self.me, mv);
      self.emit('move', { player: self.me, move: mv, state: st, auto: true });
      self._later(step, 340);
    }
    this._later(step, 420);
  };

  BotSession.prototype._later = function (fn, ms) {
    var self = this;
    var id = setTimeout(function () { if (!self._closed) fn(); }, Math.max(1, ms * NetConfig.speed));
    this._timers.push(id);
    return id;
  };

  BotSession.prototype.start = function () {
    var self = this;
    var st = Engine.newState({ cubeEnabled: !!this.room.cube });
    var op = Engine.openingRoll();
    st.turn = op.first;
    this.state = st;

    this._later(function () {
      self.emit('start', {
        you: self.me,
        opponent: self.opponent,
        opening: op,
        state: st,
        mode: 'bot'
      });
      Engine.rollDice(st, null, [op.d1, op.d2]);
      self.emit('roll', { player: st.turn, dice: st.dice.slice(), state: st });
      self._armTimer();
      if (st.turn !== self.me) self._botTurn();
      else self._checkStuck();
    }, 350);
  };

  /** اگر بازیکن هیچ حرکتی نداشته باشد، نوبت رد می‌شود */
  BotSession.prototype._checkStuck = function () {
    var self = this, st = this.state;
    if (Engine.hasAnyMove(st, st.turn)) return;
    this._later(function () {
      self.emit('nomove', { player: st.turn });
      self._advance();
    }, 900);
  };

  BotSession.prototype.roll = function () {
    var st = this.state;
    if (this._closed || st.done || st.turn !== this.me || st.dice.length) return;
    Engine.rollDice(st);
    this.autoPlayed = 0;
    this.emit('roll', { player: this.me, dice: st.dice.slice(), state: st });
    this._armTimer();                      // فرصت تازه برای حرکت دادن مهره
    this._checkStuck();
  };

  /** کاربر یک حرکت انجام داد */
  BotSession.prototype.play = function (mv) {
    var st = this.state;
    if (this._closed || st.done || st.turn !== this.me) return false;
    Engine.applyMove(st, this.me, mv);
    this.autoPlayed = 0;
    this.emit('move', { player: this.me, move: mv, state: st });
    return true;
  };

  BotSession.prototype.undo = function () {
    var st = this.state;
    if (st.turn !== this.me || !st.played.length) return false;
    Engine.undoMove(st, this.me);
    this.emit('update', { state: st });
    return true;
  };

  /** کاربر نوبتش را تمام کرد */
  BotSession.prototype.endTurn = function () {
    var st = this.state;
    if (this._closed || st.done || st.turn !== this.me) return;
    this._advance();
  };

  BotSession.prototype._advance = function () {
    var st = this.state;
    if (Engine.checkWin(st)) return this._finish();
    Engine.endTurn(st);
    this._armTimer();
    this.emit('turn', { player: st.turn, state: st });
    if (st.turn === this.me) {
      if (st.cubeEnabled) this._maybeBotDouble();
      if (this.autoRoll) this.roll();
    } else {
      this._botTurn();
    }
  };

  BotSession.prototype._maybeBotDouble = function () { /* ربات فقط در نوبت خودش دوبل می‌دهد */ };

  BotSession.prototype._botTurn = function () {
    var self = this, st = this.state;
    if (this._closed || st.done) return;

    // تصمیم دوبل
    if (st.cubeEnabled && AI.shouldDouble(st, -this.me, this.level)) {
      this._later(function () {
        Engine.offerDouble(st, -self.me);
        self.emit('double', { player: -self.me, cube: st.cube, state: st });
      }, AI.thinkTime(this.level));
      return;
    }

    this._later(function () {
      if (self._closed || st.done) return;
      Engine.rollDice(st);
      self.emit('roll', { player: st.turn, dice: st.dice.slice(), state: st });
      self._botPlaySequence();
    }, 500 + Math.random() * 500);
  };

  BotSession.prototype._botPlaySequence = function () {
    var self = this, st = this.state;
    var pick = AI.chooseTurn(st, st.turn, this.level);

    if (!pick || !pick.seq.length) {
      this._later(function () {
        self.emit('nomove', { player: st.turn });
        self._advance();
      }, 900);
      return;
    }

    var i = 0;
    function step() {
      if (self._closed || st.done) return;
      if (i >= pick.seq.length) {
        self._later(function () { self._advance(); }, 350);
        return;
      }
      var mv = pick.seq[i++];
      Engine.applyMove(st, st.turn, mv);
      self.emit('move', { player: st.turn, move: mv, state: st });
      self._later(step, 420 + Math.random() * 260);
    }
    this._later(step, AI.thinkTime(this.level));
  };

  /* دوبل از سمت کاربر */
  BotSession.prototype.double = function () {
    var self = this, st = this.state;
    if (!Engine.offerDouble(st, this.me)) return false;
    this.emit('double', { player: this.me, cube: st.cube, state: st });
    this._later(function () {
      var accept = AI.shouldAcceptDouble(st, -self.me, self.level);
      self.respondDouble(accept, true);
    }, 900 + Math.random() * 900);
    return true;
  };

  BotSession.prototype.respondDouble = function (accept, fromBot) {
    var st = this.state;
    if (!st.pendingDouble) return false;
    var by = st.pendingDouble;
    if (accept) {
      Engine.acceptDouble(st);
      this.emit('doubleResult', { accepted: true, by: by, cube: st.cube, state: st });
      if (!fromBot && st.turn !== this.me) this._botTurn();
    } else {
      Engine.declineDouble(st);
      this.emit('doubleResult', { accepted: false, by: by, cube: st.cube, state: st });
      this._finish();
    }
    return true;
  };

  BotSession.prototype.resign = function () {
    var st = this.state;
    st.done = true; st.winner = -this.me; st.result = 1; st.resign = true;
    this._finish();
  };

  BotSession.prototype._finish = function () {
    var st = this.state;
    this._clearTimer();
    this.emit('end', {
      winner: st.winner,
      youWon: st.winner === this.me,
      result: st.result,
      cube: st.cube,
      resign: st.resign,
      state: st
    });
  };

  BotSession.prototype.chat = function (text) {
    var self = this;
    this.emit('chat', { from: 'me', text: text });
    // پاسخ گاه‌به‌گاه ربات
    if (Math.random() < 0.45) {
      var replies = ['سلام 👋', 'موفق باشی', 'ایول!', 'چه شانسی داری 😄', 'خوب بازی می‌کنی', 'دمت گرم', 'یه دست دیگه؟', '😅'];
      this._later(function () {
        self.emit('chat', { from: 'opponent', text: replies[Math.floor(Math.random() * replies.length)] });
      }, 1200 + Math.random() * 2500);
    }
  };

  BotSession.prototype.leave = function () {
    this._closed = true;
    this._clearTimer();
    for (var i = 0; i < this._timers.length; i++) clearTimeout(this._timers[i]);
    this._timers = [];
  };

  /* =====================================================================
   *  جلسه‌ی آنلاین (WebSocket)
   * ===================================================================== */

  function OnlineSession(opts) {
    Emitter.call(this);
    this.room = opts.room;
    this.ws = opts.ws;
    this.me = opts.you;
    this.opponent = opts.opponent;
    this.mode = 'online';
    this.state = null;
    this._closed = false;
    this.matchId = opts.matchId || null;
    this.token = opts.token || null;
    this.graceMs = opts.graceMs || NetConfig.reconnectMs;
    this.turnDeadline = 0;
    this._reconnecting = false;
    this._reconnectTries = 0;
    this._bind();
  }
  OnlineSession.prototype = Object.create(Emitter.prototype);

  OnlineSession.prototype._send = function (obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  };

  OnlineSession.prototype._bind = function () {
    var self = this;
    this.ws.onmessage = function (ev) {
      var m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      self._handle(m);
    };
    this.ws.onclose = function () {
      if (self._closed) return;
      self._startReconnect();
    };
    this.ws.onerror = function () { };
  };

  /* ------------------------------------------------ اتصال دوباره پس از قطعی */

  OnlineSession.prototype._startReconnect = function () {
    var self = this;
    if (this._closed || this._reconnecting) return;
    if (!this.matchId || !this.token) { this.emit('disconnect', {}); return; }

    this._reconnecting = true;
    this._reconnectTries = 0;
    this._reconnectUntil = Date.now() + this.graceMs;
    this.emit('reconnecting', { until: this._reconnectUntil, graceMs: this.graceMs });
    this._tryReconnect();
  };

  OnlineSession.prototype._tryReconnect = function () {
    var self = this;
    if (this._closed) return;

    if (Date.now() >= this._reconnectUntil) {
      this._reconnecting = false;
      this.emit('reconnectFailed', {});
      return;
    }

    this._reconnectTries++;
    var ws;
    try { ws = new WebSocket(NetConfig.serverUrl); }
    catch (e) { return setTimeout(function () { self._tryReconnect(); }, 2000); }

    var settled = false;
    var giveUp = setTimeout(function () {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch (e) {}
      setTimeout(function () { self._tryReconnect(); }, 1200);
    }, 3500);

    ws.onopen = function () {
      ws.send(JSON.stringify({ t: 'resume', matchId: self.matchId, token: self.token }));
    };

    ws.onmessage = function (ev) {
      var m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }

      if (m.t === 'resumed') {
        if (settled) return;
        settled = true; clearTimeout(giveUp);
        self._reconnecting = false;
        self.ws = ws;
        self.me = m.you;
        if (m.opponent) self.opponent = m.opponent;
        self._bind();                      // شنونده‌های اصلی را روی سوکت تازه بگذار
        self._sync(m.state);
        self.emit('reconnected', { state: self.state, you: self.me, opponent: self.opponent });
        return;
      }
      if (m.t === 'resumeFailed') {
        if (settled) return;
        settled = true; clearTimeout(giveUp);
        self._reconnecting = false;
        try { ws.close(); } catch (e) {}
        self.emit('reconnectFailed', {});
      }
    };

    ws.onerror = function () {};
    ws.onclose = function () {
      if (settled) return;
      settled = true; clearTimeout(giveUp);
      setTimeout(function () { self._tryReconnect(); }, 1500);
    };
  };

  /** بازسازی state از روی پیام سرور */
  OnlineSession.prototype._sync = function (snap) {
    if (!snap) return;
    var st = this.state || Engine.newState({ cubeEnabled: !!this.room.cube });
    st.board = snap.board.slice();
    st.bar = { 1: snap.bar[1] || snap.bar['1'] || 0, '-1': snap.bar[-1] || snap.bar['-1'] || 0 };
    st.off = { 1: snap.off[1] || snap.off['1'] || 0, '-1': snap.off[-1] || snap.off['-1'] || 0 };
    st.turn = snap.turn;
    st.dice = (snap.dice || []).slice();
    st.moves = (snap.moves || []).slice();
    st.played = (snap.played || []).slice();
    st.cube = snap.cube || 1;
    st.cubeOwner = snap.cubeOwner || 0;
    st.pendingDouble = snap.pendingDouble || 0;
    st.done = !!snap.done;
    st.winner = snap.winner || 0;
    st.result = snap.result || 0;
    this.state = st;
    // تایمر نوبت: سرور «زمان باقی‌مانده» می‌فرستد تا اختلاف ساعت مشکلی ایجاد نکند
    if (typeof snap.turnLeft === 'number') {
      this.turnDeadline = snap.turnLeft > 0 ? Date.now() + snap.turnLeft : 0;
    }
    return st;
  };

  OnlineSession.prototype._handle = function (m) {
    switch (m.t) {
      case 'start':
        this.me = m.you;
        this.opponent = m.opponent;
        this._sync(m.state);
        this.emit('start', { you: this.me, opponent: this.opponent, opening: m.opening, state: this.state, mode: 'online' });
        break;
      case 'roll':
        this._sync(m.state);
        this.emit('roll', { player: m.player, dice: m.dice, state: this.state });
        break;
      case 'move':
        this._sync(m.state);
        this.emit('move', { player: m.player, move: m.move, state: this.state });
        break;
      case 'turn':
        this._sync(m.state);
        this.emit('turn', { player: m.player, state: this.state });
        break;
      case 'state':          // فقط همگام‌سازی، بدون اعلام نوبت جدید
        this._sync(m.state);
        this.emit('update', { state: this.state });
        break;
      case 'nomove':
        this.emit('nomove', { player: m.player });
        break;
      case 'double':
        this._sync(m.state);
        this.emit('double', { player: m.player, cube: m.cube, state: this.state });
        break;
      case 'doubleResult':
        this._sync(m.state);
        this.emit('doubleResult', { accepted: m.accepted, by: m.by, cube: m.cube, state: this.state });
        break;
      case 'end':
        this._sync(m.state);
        // سرور تسویه را انجام داده و موجودی تازه را فرستاده
        if (m.profile && root.Store) root.Store.applyServerProfile(m.profile);
        this.emit('end', {
          winner: m.winner, youWon: m.winner === this.me, result: m.result,
          cube: m.cube, resign: m.resign, settlement: m.settlement,
          profile: m.profile, state: this.state
        });
        break;
      case 'chat':
        this.emit('chat', { from: m.from === this.me ? 'me' : 'opponent', text: m.text });
        break;
      case 'wallet':
        if (m.profile && root.Store) root.Store.applyServerProfile(m.profile);
        this.emit('wallet', m);
        break;
      case 'oppLeft':
        this.emit('oppLeft', m);
        break;
      case 'oppDisconnected':
        this.emit('oppDisconnected', m);
        break;
      case 'oppReconnected':
        this.emit('oppReconnected', m);
        break;
      case 'timeout':
        this.emit('timeout', { player: m.player, auto: m.auto, max: m.max, left: m.left, away: m.away });
        break;
      case 'error':
        this.emit('error', m);
        break;
    }
  };

  OnlineSession.prototype.start = function () { this._send({ t: 'ready' }); };
  OnlineSession.prototype.roll = function () { this._send({ t: 'roll' }); };
  OnlineSession.prototype.play = function (mv) {
    // حرکت را محلی هم اعمال می‌کنیم تا رابط کاربری فوراً پاسخ بدهد
    if (this.state && this.state.turn === this.me) {
      Engine.applyMove(this.state, this.me, mv);
      this.emit('move', { player: this.me, move: mv, state: this.state, local: true });
    }
    this._send({ t: 'move', move: { from: mv.from, to: mv.to, die: mv.die } });
    return true;
  };
  OnlineSession.prototype.undo = function () { this._send({ t: 'undo' }); return true; };
  OnlineSession.prototype.endTurn = function () { this._send({ t: 'endTurn' }); };
  OnlineSession.prototype.double = function () { this._send({ t: 'double' }); return true; };
  OnlineSession.prototype.respondDouble = function (accept) { this._send({ t: 'doubleResp', accept: !!accept }); return true; };
  OnlineSession.prototype.resign = function () { this._send({ t: 'resign' }); };
  OnlineSession.prototype.chat = function (text) { this._send({ t: 'chat', text: text }); };
  OnlineSession.prototype.leave = function () {
    this._closed = true;
    this._send({ t: 'leave' });
    try { this.ws.close(); } catch (e) {}
  };

  /* =====================================================================
   *  مچ‌میکینگ: اول دنبال حریف واقعی، در نبود آن ربات
   * ===================================================================== */

  /**
   * @param opts {room, profile, onStatus(text), onSession(session), onFail(msg)}
   * @returns {cancel()}
   */
  function findMatch(opts) {
    var room = opts.room;
    var cancelled = false;
    var ws = null;
    var settled = false;
    var timers = [];

    function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
    function clearAll() { for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]); timers = []; }

    function status(txt) { if (!cancelled && opts.onStatus) opts.onStatus(txt); }

    function fallbackToBot(reason) {
      if (settled || cancelled) return;
      settled = true;
      clearAll();
      try { if (ws) ws.close(); } catch (e) {}
      status('حریف پیدا شد!');
      var s = new BotSession({ room: room, level: botLevelForRoom(room) });
      later(function () {
        if (cancelled) { s.leave(); return; }
        if (opts.onSession) opts.onSession(s, { mode: 'bot', reason: reason });
      }, 500);
    }

    status('در حال اتصال به سرور…');

    // اگر نشانی سرور تنظیم نشده یا WebSocket در دسترس نیست → مستقیم ربات
    if (!NetConfig.serverUrl || typeof WebSocket === 'undefined') {
      status('جست‌وجوی حریف…');
      later(function () { fallbackToBot('no-server'); }, 1400 + Math.random() * 1800);
      return { cancel: function () { cancelled = true; clearAll(); } };
    }

    try {
      ws = new WebSocket(NetConfig.serverUrl);
    } catch (e) {
      later(function () { fallbackToBot('ws-error'); }, 1200);
      return { cancel: function () { cancelled = true; clearAll(); } };
    }

    var connectTimer = later(function () {
      fallbackToBot('connect-timeout');
    }, NetConfig.connectTimeout);

    ws.onopen = function () {
      clearTimeout(connectTimer);
      if (cancelled) { try { ws.close(); } catch (e) {} return; }
      status('جست‌وجوی حریف…');
      ws.send(JSON.stringify({
        t: 'queue',
        roomId: room.id,
        token: (root.API && root.API.token) || null
      }));
      // اگر تا این زمان حریف واقعی نیامد، ربات وارد می‌شود
      later(function () { fallbackToBot('search-timeout'); }, NetConfig.searchTimeout);
    };

    ws.onerror = function () { fallbackToBot('ws-error'); };
    ws.onclose = function () { if (!settled) fallbackToBot('ws-closed'); };

    ws.onmessage = function (ev) {
      var m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }

      if (m.t === 'searching') { status(m.text || 'جست‌وجوی حریف…'); return; }

      // سرور اجازه نداد (سکه کم، سطح کم، مسدود، تعمیرات…)
      if (m.t === 'queueError') {
        if (settled || cancelled) return;
        settled = true;
        clearAll();
        try { ws.close(); } catch (e) {}
        if (opts.onFail) opts.onFail(m.message || 'ورود به اتاق ممکن نشد');
        return;
      }

      // سرور موجودی تازه را فرستاد (بعد از کسر ورودی)
      if (m.t === 'wallet') {
        if (m.profile && root.Store) root.Store.applyServerProfile(m.profile);
        if (opts.onWallet) opts.onWallet(m.profile);
        return;
      }

      if (m.t === 'matched') {
        if (settled || cancelled) return;
        settled = true;
        clearAll();
        status('حریف پیدا شد!');
        var s = new OnlineSession({
          room: room, ws: ws, you: m.you, opponent: m.opponent,
          matchId: m.matchId, token: m.token, graceMs: m.graceMs
        });
        if (m.turnMs) NetConfig.turnMs = m.turnMs;
        if (opts.onSession) opts.onSession(s, { mode: 'online' });
      }
    };

    return {
      cancel: function () {
        cancelled = true;
        clearAll();
        try { if (ws && ws.readyState <= 1) { ws.send(JSON.stringify({ t: 'cancel' })); ws.close(); } } catch (e) {}
      }
    };
  }

  root.Net = {
    config: NetConfig,
    findMatch: findMatch,
    BotSession: BotSession,
    OnlineSession: OnlineSession,
    randomBotIdentity: randomBotIdentity,
    botLevelForRoom: botLevelForRoom
  };

})(typeof self !== 'undefined' ? self : this);
