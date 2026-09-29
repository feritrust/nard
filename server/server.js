/* =========================================================================
 *  server.js — سرور بازی تخته‌نرد
 *
 *  کارها:
 *    • سرو کردن فایل‌های اپ (پوشه‌ی www) روی HTTP
 *    • مچ‌میکینگ WebSocket بین بازیکنان واقعی
 *    • اگر تا چند ثانیه حریف واقعی پیدا نشد، ربات وارد بازی می‌شود
 *    • داوری بازی سمت سرور (تاس و اعتبارسنجی حرکت‌ها)
 *
 *  اجرا:  node server.js         (پیش‌فرض روی پورت ۸۰۸۰)
 * ========================================================================= */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* ---------------------------------------------------------------------
 *  خواندن فایل .env (بدون وابستگی خارجی)
 *
 *  ⚠️ باید **قبل از** require کردن ماژول‌های پروژه اجرا شود، چون بعضی از آن‌ها
 *  (مثل api.js) مقدار متغیرها را همان لحظه‌ی بارگذاری می‌خوانند — از جمله
 *  NARD_DEV_CODE که تعیین می‌کند کد تأیید در پاسخ برگردد یا نه.
 * ------------------------------------------------------------------- */
(function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
})();

const Engine = require('../www/js/engine.js');
const AI = require('../www/js/ai.js');
const DB = require('./db.js');
const CFG = require('./config.js');
const API = require('./api.js');
const ADMIN = require('./admin.js');

const PORT = process.env.PORT || 8080;
const WWW = path.join(__dirname, '..', 'www');
const SESSION_SECRET = process.env.NARD_SECRET || crypto.randomBytes(24).toString('hex');

/* تنظیمات بازی */
const CONFIG = {
  botAfterMs: 8000,        // بعد از این مدت انتظار، ربات وارد می‌شود
  turnMs: 30000,           // مهلت هر مرحله‌ی نوبت (تاس انداختن / حرکت دادن)
  timeoutStrikes: 3,       // بعد از این تعداد تایم‌اوت پشت‌سرهم، بازی باخته می‌شود
  reconnectMs: 45000,      // مهلت بازگشت بازیکن بعد از قطع اتصال
  rakePercent: 10,
  rakeMinEntry: 1000,
  energyPerCoins: 100,
  marsEnergyBonus: 0.5
};

/* ========================================================================
 *  WebSocket بدون وابستگی خارجی (پیاده‌سازی حداقلی RFC 6455)
 * ===================================================================== */

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function acceptKey(key) {
  return crypto.createHash('sha1').update(key + GUID).digest('base64');
}

class WsConn {
  constructor(socket) {
    this.socket = socket;
    this.readyState = 1;
    this.onmessage = null;
    this.onclose = null;
    this._buf = Buffer.alloc(0);
    this._closed = false;

    socket.on('data', (chunk) => {
      this._buf = Buffer.concat([this._buf, chunk]);
      this._drain();
    });
    socket.on('error', () => this._die());
    socket.on('close', () => this._die());
  }

  _die() {
    if (this._closed) return;
    this._closed = true;
    this.readyState = 3;
    if (this.onclose) { try { this.onclose(); } catch (e) {} }
  }

  _drain() {
    while (true) {
      const b = this._buf;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0;
      const opcode = b[0] & 0x0f;
      const masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f;
      let off = 2;

      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }

      let mask = null;
      if (masked) { if (b.length < off + 4) return; mask = b.slice(off, off + 4); off += 4; }
      if (b.length < off + len) return;

      let payload = b.slice(off, off + len);
      if (mask) {
        const out = Buffer.allocUnsafe(len);
        for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3];
        payload = out;
      }
      this._buf = b.slice(off + len);

      if (opcode === 0x8) { this.close(); return; }
      if (opcode === 0x9) { this._frame(0xA, payload); continue; }   // ping → pong
      if (opcode === 0xA) continue;
      if ((opcode === 0x1 || opcode === 0x0) && fin) {
        if (this.onmessage) { try { this.onmessage({ data: payload.toString('utf8') }); } catch (e) { console.error(e); } }
      }
    }
  }

  _frame(opcode, payload) {
    if (this._closed) return;
    const len = payload.length;
    let header;
    if (len < 126) { header = Buffer.alloc(2); header[1] = len; }
    else if (len < 65536) { header = Buffer.alloc(4); header[1] = 126; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
    header[0] = 0x80 | opcode;
    try { this.socket.write(Buffer.concat([header, payload])); } catch (e) { this._die(); }
  }

  send(str) { this._frame(0x1, Buffer.from(str, 'utf8')); }

  close() {
    if (this._closed) return;
    try { this._frame(0x8, Buffer.alloc(0)); this.socket.end(); } catch (e) {}
    this._die();
  }
}

/* ========================================================================
 *  سرور HTTP (سرو کردن اپ)
 * ===================================================================== */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};

/* ========================================================================
 *  ورود با شماره موبایل (کد تأیید)
 * ===================================================================== */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // ۱) API بازیکن‌ها   ۲) API پنل ادمین   ۳) فایل‌های اپ
  try {
    if (await API.handle(req, res, url)) return;
    if (await ADMIN.handle(req, res, url)) return;
  } catch (e) {
    console.error('[api]', e);
    if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); }
    return res.end(JSON.stringify({ ok: false, message: 'خطای سرور' }));
  }

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true, online: clients.size, matches: matches.size,
      uptime: process.uptime(), ...DB.stats().users
    }));
  }

  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(WWW, path.normalize(p).replace(/^([/\\])+/, ''));
  if (!file.startsWith(WWW)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + acceptKey(key) + '\r\n\r\n'
  );
  socket.setNoDelay(true);
  const conn = new WsConn(socket);
  const fwd = req.headers['x-forwarded-for'];
  conn.ip = fwd ? String(fwd).split(',')[0].trim() : (socket.remoteAddress || null);
  handleConnection(conn);
});

/* ========================================================================
 *  مچ‌میکینگ و بازی
 * ===================================================================== */

const clients = new Set();
const queues = new Map();     // roomId -> [client]
const matches = new Map();    // matchId -> Match

const BOT_NAMES = ['علی', 'رضا', 'محمد', 'امیر', 'سعید', 'حسین', 'مهدی', 'پویا', 'آرش', 'بابک',
  'کامران', 'نیما', 'فرهاد', 'شایان', 'سینا', 'مجید', 'مریم', 'سارا', 'نگین', 'الهام', 'پریسا', 'یلدا'];
const BOT_SUFFIX = ['', '', '', '_۷۲', '۱۳۶۱', '_ایران', 'خان', '_۹۸', '_تهران', '_شیراز'];
const BOT_AVATARS = ['🦁', '🐯', '🦊', '🐺', '🦅', '🐉', '🦈', '🐻', '🐎', '🕊️'];
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

function botIdentity(entry) {
  return {
    id: 'bot_' + crypto.randomBytes(4).toString('hex'),
    name: rnd(BOT_NAMES) + rnd(BOT_SUFFIX),
    avatar: rnd(BOT_AVATARS),
    level: 1 + Math.floor(Math.random() * 12),
    isBot: true
  };
}

function botLevel(entry) {
  if (entry <= 100) return 'easy';
  if (entry <= 1000) return Math.random() < 0.4 ? 'easy' : 'normal';
  if (entry <= 25000) return Math.random() < 0.35 ? 'hard' : 'normal';
  return Math.random() < 0.7 ? 'hard' : 'normal';
}

function snapshot(st, match) {
  return {
    board: st.board, bar: { 1: st.bar[1], '-1': st.bar[-1] }, off: { 1: st.off[1], '-1': st.off[-1] },
    turn: st.turn, dice: st.dice, moves: st.moves, played: st.played,
    cube: st.cube, cubeOwner: st.cubeOwner, pendingDouble: st.pendingDouble,
    done: st.done, winner: st.winner, result: st.result,
    // زمان باقی‌مانده‌ی نوبت (میلی‌ثانیه) — کلاینت از روی این تایمر را نشان می‌دهد
    turnLeft: match && match.turnDeadline ? Math.max(0, match.turnDeadline - Date.now()) : 0
  };
}

// محاسبه‌ی فی از روی تنظیمات دیتابیس تا از پنل قابل تغییر باشد
function economy(entry) { return DB.roomEconomy(entry); }

class Match {
  constructor(roomId, entry, a, b) {
    this.id = crypto.randomBytes(6).toString('hex');
    this.roomId = roomId;
    this.entry = entry;
    this.seats = { 1: a, '-1': b };           // b می‌تواند null باشد (ربات)
    this.botSeat = b ? 0 : -1;
    this.botLevel = botLevel(entry);
    this.botUser = b ? null : botIdentity(entry);
    this.state = Engine.newState({ cubeEnabled: false });
    this.timers = [];
    this.ended = false;
    this.turnSeq = 0;          // شماره‌ی نوبت — جلوی «رد شدن دوباره‌ی نوبت» را می‌گیرد
    this.turnDeadline = 0;
    this.strikes = { 1: 0, '-1': 0 };
    this.dropped = { 1: null, '-1': null };   // بازیکن قطع‌شده و توکنش
    this.paused = false;
    this.users = { 1: a ? a.user : null, '-1': b ? b.user : null };
    this.userIds = { 1: a ? a.userId : null, '-1': b ? b.userId : null };
    this.gameId = null;
    matches.set(this.id, this);
  }

  seatOf(client) { return this.seats[1] === client ? 1 : (this.seats[-1] === client ? -1 : 0); }

  /** شناسه‌ی کاربر روی این صندلی (ربات شناسه ندارد) */
  userIdAt(seat) {
    if (this.isBot(seat)) return null;
    const c = this.seats[seat];
    if (c && c.userId) return c.userId;
    return this.userIds ? this.userIds[seat] : null;
  }
  clientAt(seat) { return this.seats[seat]; }
  isBot(seat) { return this.botSeat === seat; }

  userAt(seat) {
    if (this.isBot(seat)) return this.botUser;
    return this.users[seat] || (this.seats[seat] && this.seats[seat].user) || { name: 'بازیکن', avatar: '🦁', level: 1 };
  }

  send(seat, obj) {
    const c = this.seats[seat];
    if (c && c.ws.readyState === 1) { try { c.ws.send(JSON.stringify(obj)); } catch (e) {} }
  }
  broadcast(obj) { this.send(1, obj); this.send(-1, obj); }

  later(fn, ms) {
    const id = setTimeout(() => { if (!this.ended) fn(); }, ms);
    this.timers.push(id);
    return id;
  }

  /** نوبت را بعد از تأخیر تمام می‌کند — فقط اگر در همین نوبت هنوز چیزی عوض نشده باشد */
  advanceLater(ms) {
    const seq = this.turnSeq;
    this.later(() => { if (this.turnSeq === seq) this.advance(); }, ms);
  }
  clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; }

  start() {
    const op = Engine.openingRoll();
    this.state.turn = op.first;
    Engine.rollDice(this.state, null, [op.d1, op.d2]);

    this.armTurnTimer();                    // اول تایمر، بعد ارسال — تا turnLeft درست برود

    [1, -1].forEach((seat) => {
      this.send(seat, {
        t: 'start', you: seat, opponent: this.userAt(-seat),
        opening: op, state: snapshot(this.state, this),
        turnMs: CONFIG.turnMs
      });
    });
    this.broadcast({ t: 'roll', player: this.state.turn, dice: this.state.dice.slice(), state: snapshot(this.state, this) });

    if (this.isBot(this.state.turn)) this.botPlay();
    this.checkStuck();
  }

  armTurnTimer() {
    clearTimeout(this._tt);
    if (this.ended || this.paused) { this.turnDeadline = 0; return; }
    this.turnDeadline = Date.now() + CONFIG.turnMs;
    const seat = this.state.turn;
    if (this.isBot(seat)) return;                 // ربات خودش سریع بازی می‌کند
    this._tt = setTimeout(() => this.onTimeout(seat), CONFIG.turnMs + 150);
  }

  clearTurnTimer() { clearTimeout(this._tt); this._tt = null; this.turnDeadline = 0; }

  /** وقت بازیکن تمام شد */
  onTimeout(seat) {
    const st = this.state;
    if (this.ended || this.paused || st.done || st.turn !== seat) return;
    this.strikes[seat]++;
    this.broadcast({ t: 'timeout', player: seat, strikes: this.strikes[seat], max: CONFIG.timeoutStrikes });

    if (this.strikes[seat] >= CONFIG.timeoutStrikes) {
      return this.finish(-seat, 1, true, 'timeout');
    }
    this.autoPlay(seat);
  }

  /** سیستم به‌جای بازیکنی که وقتش تمام شده بازی می‌کند */
  autoPlay(seat) {
    const st = this.state;
    this.clearTurnTimer();
    if (!st.dice.length) {
      Engine.rollDice(st);
      this.broadcast({ t: 'roll', player: seat, dice: st.dice.slice(), state: snapshot(st, this), auto: true });
    }
    const pick = AI.chooseTurn(st, seat, 'normal');
    if (!pick || !pick.seq.length) {
      this.later(() => { this.broadcast({ t: 'nomove', player: seat }); this.advance(); }, 500);
      return;
    }
    const seq = this.turnSeq;
    let i = 0;
    const step = () => {
      if (this.ended || st.done || this.turnSeq !== seq) return;
      if (i >= pick.seq.length) { this.advanceLater(350); return; }
      const mv = pick.seq[i++];
      Engine.applyMove(st, seat, mv);
      this.broadcast({ t: 'move', player: seat, move: mv, state: snapshot(st, this), auto: true });
      this.later(step, 340);
    };
    this.later(step, 420);
  }

  checkStuck() {
    const st = this.state;
    if (st.done || Engine.hasAnyMove(st, st.turn)) return;
    const seq = this.turnSeq;
    this.later(() => {
      if (this.turnSeq !== seq || this.ended) return;
      this.broadcast({ t: 'nomove', player: st.turn });
      this.advance();
    }, this.isBot(st.turn) ? 900 : 1200);
  }

  handle(client, m) {
    const seat = this.seatOf(client);
    if (!seat || this.ended) return;
    const st = this.state;

    switch (m.t) {
      case 'ready':
        break;

      case 'roll':
        if (st.turn !== seat || st.dice.length || st.done || this.paused) return;
        this.strikes[seat] = 0;
        Engine.rollDice(st);
        this.armTurnTimer();               // فرصت تازه برای حرکت دادن مهره
        this.broadcast({ t: 'roll', player: seat, dice: st.dice.slice(), state: snapshot(st, this) });
        this.checkStuck();
        break;

      case 'move': {
        if (st.turn !== seat || !st.dice.length || st.done || this.paused) return;
        this.strikes[seat] = 0;
        const legal = Engine.legalFirstMoves(st, seat);
        const mv = legal.find((x) =>
          String(x.from) === String(m.move.from) &&
          String(x.to) === String(m.move.to) &&
          Number(x.die) === Number(m.move.die));
        if (!mv) { this.send(seat, { t: 'error', message: 'حرکت نامعتبر', state: snapshot(st, this) }); return; }
        Engine.applyMove(st, seat, mv);
        this.armTurnTimer();
        this.send(-seat, { t: 'move', player: seat, move: mv, state: snapshot(st, this) });
        this.send(seat, { t: 'state', state: snapshot(st, this) });
        // اگر حرکتی باقی نمانده، نوبت را خودکار تمام کن
        if (!Engine.legalFirstMoves(st, seat).length) this.advanceLater(600);
        break;
      }

      case 'undo':
        if (st.turn !== seat || !st.played.length) return;
        Engine.undoMove(st, seat);
        this.send(seat, { t: 'state', state: snapshot(st, this) });
        this.send(-seat, { t: 'state', state: snapshot(st, this) });
        break;

      case 'endTurn':
        if (st.turn !== seat || st.done) return;
        if (Engine.legalFirstMoves(st, seat).length) return;   // هنوز حرکت دارد
        // اگر اصلاً نتوانست حرکتی بکند، به حریف اطلاع بده
        if (!st.played.length) this.broadcast({ t: 'nomove', player: seat });
        this.advance();
        break;

      case 'resign':
        this.finish(-seat, 1, true);
        break;

      case 'chat':
        if (typeof m.text === 'string' && m.text.length <= 120) {
          this.broadcast({ t: 'chat', from: seat, text: m.text });
          if (this.botSeat && Math.random() < 0.4) {
            const replies = ['سلام 👋', 'موفق باشی', 'ایول!', 'چه شانسی 😄', 'دمت گرم', '😅'];
            this.later(() => this.broadcast({ t: 'chat', from: this.botSeat, text: rnd(replies) }), 1500 + Math.random() * 2000);
          }
        }
        break;

      case 'leave':
        this.playerLeft(client);
        break;
    }
  }

  advance() {
    const st = this.state;
    if (this.ended || this.paused) return;
    this.turnSeq++;
    if (Engine.checkWin(st)) return this.finish(st.winner, st.result, false);
    Engine.endTurn(st);
    this.armTurnTimer();
    this.broadcast({ t: 'turn', player: st.turn, state: snapshot(st, this) });
    if (this.isBot(st.turn)) this.botPlay();
    else this.checkStuck();
  }

  botPlay() {
    const st = this.state;
    const seq = this.turnSeq;
    const stale = () => this.ended || st.done || this.paused || this.turnSeq !== seq;
    this.later(() => {
      if (stale()) return;
      if (!st.dice.length) {
        Engine.rollDice(st);
        this.broadcast({ t: 'roll', player: st.turn, dice: st.dice.slice(), state: snapshot(st, this) });
      }
      const pick = AI.chooseTurn(st, st.turn, this.botLevel);
      if (!pick || !pick.seq.length) {
        this.later(() => {
          if (stale()) return;
          this.broadcast({ t: 'nomove', player: st.turn });
          this.advance();
        }, 900);
        return;
      }
      let i = 0;
      const step = () => {
        if (stale()) return;
        if (i >= pick.seq.length) { this.advanceLater(400); return; }
        const mv = pick.seq[i++];
        Engine.applyMove(st, st.turn, mv);
        this.broadcast({ t: 'move', player: st.turn, move: mv, state: snapshot(st, this) });
        this.later(step, 430 + Math.random() * 260);
      };
      this.later(step, AI.thinkTime(this.botLevel));
    }, 600 + Math.random() * 600);
  }

  finish(winner, result, resign, reason) {
    if (this.ended) return;
    this.ended = true;
    this.clearTurnTimer();
    clearTimeout(this._grace);
    this.clearTimers();
    const st = this.state;
    st.done = true; st.winner = winner; st.result = result || 1;

    // ---- تسویه‌ی واقعی در دیتابیس ----
    const winnerId = this.userIdAt(winner);
    const loserId = this.userIdAt(-winner);
    let settle = null;
    try {
      settle = DB.settleGame({
        gameId: this.gameId, roomId: this.roomId, entry: this.entry,
        winnerId, loserId, result: result || 1, endReason: reason || 'normal'
      });
    } catch (e) {
      console.error('[settle]', e);
    }
    const eco = (settle && settle.eco) || DB.roomEconomy(this.entry);
    const energy = (settle && settle.energy) || DB.energyFor(this.entry, (result || 1) >= 2);

    [1, -1].forEach((seat) => {
      const won = seat === winner;
      const uid = this.userIdAt(seat);
      this.send(seat, {
        t: 'end', winner, result: result || 1, cube: st.cube, resign: !!resign,
        reason: reason || '',
        state: snapshot(st, this),
        settlement: { won, prize: won ? eco.prize : 0, rake: eco.rake, entry: eco.entry, pot: eco.pot, energy },
        profile: uid ? API.publicProfile(DB.getUser(uid)) : null
      });
    });

    setTimeout(() => {
      [1, -1].forEach((s) => { const c = this.seats[s]; if (c) c.match = null; });
      matches.delete(this.id);
    }, 1500);
  }

  /** بازیکن عمداً بازی را ترک کرد → باخت فوری */
  playerLeft(client) {
    const seat = this.seatOf(client);
    if (!seat || this.ended) return;
    const other = this.seats[-seat];
    if (other) { try { other.ws.send(JSON.stringify({ t: 'oppLeft' })); } catch (e) {} }
    this.finish(-seat, 1, true, 'left');
  }

  /** ارتباط بازیکن قطع شد → مهلت بازگشت می‌دهیم */
  playerDropped(client) {
    const seat = this.seatOf(client);
    if (!seat || this.ended) return;

    this.seats[seat] = null;
    this.dropped[seat] = { token: client.token, at: Date.now() };
    this.paused = true;
    this.clearTurnTimer();

    console.log(`[drop] ${this.id} ${this.userAt(seat).name} قطع شد — ${CONFIG.reconnectMs / 1000}s مهلت`);
    this.send(-seat, { t: 'oppDisconnected', graceMs: CONFIG.reconnectMs, name: this.userAt(seat).name });

    clearTimeout(this._grace);
    this._grace = setTimeout(() => {
      if (this.ended) return;
      console.log(`[drop] ${this.id} مهلت تمام شد — باخت`);
      this.finish(-seat, 1, true, 'disconnect');
    }, CONFIG.reconnectMs);
  }

  /** بازیکن با توکنش برگشت */
  resume(client, token) {
    if (this.ended) return false;
    let seat = 0;
    if (this.dropped[1] && this.dropped[1].token === token) seat = 1;
    else if (this.dropped[-1] && this.dropped[-1].token === token) seat = -1;
    if (!seat) return false;

    clearTimeout(this._grace);
    this.dropped[seat] = null;
    this.seats[seat] = client;
    client.match = this;
    client.token = token;
    client.user = this.users[seat];
    this.paused = false;

    console.log(`[resume] ${this.id} ${this.userAt(seat).name} برگشت`);
    this.armTurnTimer();
    this.send(seat, {
      t: 'resumed', you: seat, opponent: this.userAt(-seat),
      matchId: this.id, token: token,
      roomId: this.roomId, entry: this.entry,
      state: snapshot(this.state, this)
    });
    this.send(-seat, { t: 'oppReconnected', name: this.userAt(seat).name });

    if (this.isBot(this.state.turn)) this.botPlay();
    return true;
  }
}

/* --------------------------------------------------------- صف انتظار */

function enqueue(client, roomId, entry) {
  if (!queues.has(roomId)) queues.set(roomId, []);
  const q = queues.get(roomId);

  // اگر کسی منتظر است، همان لحظه جفت کن
  const idx = q.findIndex((c) => c !== client && c.ws.readyState === 1);
  if (idx >= 0) {
    const other = q.splice(idx, 1)[0];
    clearTimeout(other.botTimer);
    startMatch(roomId, entry, other, client);
    return;
  }

  client.queuedRoom = roomId;
  client.queuedEntry = entry;
  q.push(client);
  client.ws.send(JSON.stringify({ t: 'searching', text: 'جست‌وجوی حریف…' }));

  // اگر تا مهلت مقرر کسی نیامد، ربات وارد می‌شود
  client.botTimer = setTimeout(() => {
    const list = queues.get(roomId) || [];
    const i = list.indexOf(client);
    if (i >= 0) list.splice(i, 1);
    if (client.ws.readyState === 1) startMatch(roomId, entry, client, null);
  }, CONFIG.botAfterMs);
}

function dequeue(client) {
  clearTimeout(client.botTimer);
  if (client.queuedRoom && queues.has(client.queuedRoom)) {
    const q = queues.get(client.queuedRoom);
    const i = q.indexOf(client);
    if (i >= 0) q.splice(i, 1);
  }
  client.queuedRoom = null;
}

function startMatch(roomId, entry, a, b) {
  // جای بازیکن‌ها را تصادفی تعیین می‌کنیم
  let p1 = a, p2 = b;
  if (b && Math.random() < 0.5) { p1 = b; p2 = a; }

  // ---- کسر ورودی از کیف پول، پیش از هر چیز ----
  const gameId = DB.startGame({
    roomId, entry,
    p1Id: p1 ? p1.userId : null,
    p2Id: p2 ? p2.userId : null,
    vsBot: !b
  });

  const staked = [];
  for (const c of [p1, p2]) {
    if (!c || !c.userId) continue;
    const r = DB.stake(c.userId, entry, roomId, gameId);
    if (!r.ok) {
      // یکی پول نداشت → ورودی دیگری را برگردان و هر دو را برگردان به صف
      for (const s of staked) DB.refund(s.userId, entry, roomId, gameId);
      DB.db.prepare("UPDATE games SET end_reason='aborted', ended_at=? WHERE id=?").run(Date.now(), gameId);
      send(c, { t: 'queueError', message: r.reason });
      const other = c === p1 ? p2 : p1;
      if (other) send(other, { t: 'queueError', message: 'حریف از بازی خارج شد — دوباره تلاش کنید' });
      if (p1) dequeue(p1);
      if (p2) dequeue(p2);
      return;
    }
    staked.push(c);
    send(c, { t: 'wallet', profile: API.publicProfile(DB.getUser(c.userId)) });
  }

  const match = new Match(roomId, entry, p1, p2);
  match.gameId = gameId;
  if (p1) { p1.match = match; dequeue(p1); }
  if (p2) { p2.match = match; dequeue(p2); }

  [1, -1].forEach((seat) => {
    const c = match.seats[seat];
    if (!c) return;
    if (!c.token) c.token = crypto.randomBytes(9).toString('hex');
    match.send(seat, {
      t: 'matched', you: seat, opponent: match.userAt(-seat),
      matchId: match.id, token: c.token,          // برای برگشتن بعد از قطعی
      graceMs: CONFIG.reconnectMs, turnMs: CONFIG.turnMs
    });
  });

  setTimeout(() => { if (!match.ended) match.start(); }, 900);
  console.log(`[match] ${match.id} room=${roomId} ${match.userAt(1).name} vs ${match.userAt(-1).name}${match.botSeat ? ' (ربات)' : ''}`);
}

/* ------------------------------------------------------- اتصال کلاینت */

function send(client, obj) {
  if (client && client.ws && client.ws.readyState === 1) {
    try { client.ws.send(JSON.stringify(obj)); } catch (e) {}
  }
}

function handleConnection(ws) {
  const client = { ws, user: null, userId: null, match: null, queuedRoom: null, botTimer: null, token: null, ip: ws.ip || null };
  clients.add(client);

  ws.onmessage = (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch (e) { return; }

    // بازگشت به بازی بعد از قطع اتصال
    if (m.t === 'resume') {
      const match = matches.get(String(m.matchId || ''));
      if (match && match.resume(client, String(m.token || ''))) return;
      try { ws.send(JSON.stringify({ t: 'resumeFailed' })); } catch (e) {}
      return;
    }

    if (m.t === 'queue') {
      if (client.match) return;

      // هویت از روی توکن نشست — دیگر به چیزی که کلاینت می‌گوید اعتماد نمی‌کنیم
      const u = DB.userByToken(String(m.token || ''));
      if (!u) return send(client, { t: 'queueError', message: 'ابتدا وارد شوید' });
      if (u.banned) return send(client, { t: 'queueError', message: 'حساب شما مسدود است' });
      if (DB.setting('MAINTENANCE')) return send(client, { t: 'queueError', message: 'بازی در حال به‌روزرسانی است' });

      const room = CFG.roomById(String(m.roomId || ''));
      if (!room) return send(client, { t: 'queueError', message: 'اتاق یافت نشد' });

      const lvl = DB.levelOf(u.xp).level;
      if (lvl < room.minLevel) {
        return send(client, { t: 'queueError', message: `برای این اتاق باید سطح ${room.minLevel} باشید` });
      }
      if (u.coins < room.entry) {
        return send(client, { t: 'queueError', message: 'سکه کافی ندارید' });
      }

      client.userId = u.id;
      client.user = { id: u.id, name: u.name || 'بازیکن', avatar: u.avatar, level: lvl };
      DB.touchUser(u.id, client.ip);
      enqueue(client, room.id, room.entry);
      return;
    }
    if (m.t === 'cancel') { dequeue(client); return; }
    if (client.match) client.match.handle(client, m);
  };

  ws.onclose = () => {
    dequeue(client);
    // قطع ناگهانی ≠ ترک عمدی: به بازیکن مهلت بازگشت می‌دهیم
    if (client.match) client.match.playerDropped(client);
    clients.delete(client);
  };
}

/* ------------------------------------------------------------- اجرا */

server.listen(PORT, () => {
  console.log('╭──────────────────────────────────────────────╮');
  console.log('│  سرور تخته‌نرد در حال اجراست                  │');
  console.log('╰──────────────────────────────────────────────╯');
  console.log('  اپ:      http://localhost:' + PORT);
  console.log('  وب‌سوکت: ws://localhost:' + PORT);
  console.log('  سلامت:   http://localhost:' + PORT + '/health');
  console.log('  ربات بعد از ' + (CONFIG.botAfterMs / 1000) + ' ثانیه انتظار وارد بازی می‌شود.');
  console.log('  مهلت هر نوبت: ' + (CONFIG.turnMs / 1000) + ' ثانیه • مهلت بازگشت بعد از قطعی: ' + (CONFIG.reconnectMs / 1000) + ' ثانیه');
  console.log('  ورود با شماره موبایل فعال است. کد تأیید در همین کنسول چاپ می‌شود.');
  if (API.AUTH.devReturnCode) console.log('  ⚠️  حالت توسعه: کد تأیید در پاسخ سرور هم برمی‌گردد. برای انتشار NARD_DEV_CODE=0 بگذارید.');
  console.log('  پنل ادمین: اول یک ادمین بسازید →  node create-admin.js <نام‌کاربری> <رمز> owner');
});

// پاک کردن کدهای منقضی و محدودیت‌های قدیمی
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of otps) if (now > v.exp) otps.delete(k);
  for (const [k, t] of smsRate) if (now - t > 10 * 60 * 1000) smsRate.delete(k);
}, 60 * 1000).unref();

process.on('uncaughtException', (e) => console.error('[uncaught]', e));
