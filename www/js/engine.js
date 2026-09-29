/* =========================================================================
 *  engine.js — موتور قوانین تخته‌نرد (Backgammon Rules Engine)
 *  قابل استفاده هم در مرورگر (window.Engine) و هم در Node.js (require)
 *
 *  قرارداد نمایش تخته:
 *    board = آرایه‌ی ۲۴ خانه‌ای (اندیس ۰ تا ۲۳)
 *    مقدار مثبت  => مهره‌های بازیکن ۱ (سفید)
 *    مقدار منفی  => مهره‌های بازیکن ۲ (سیاه)
 *
 *    بازیکن ۱ (P1 = +1): از اندیس ۲۳ به سمت ۰ حرکت می‌کند، خانه‌ی او 0..5 است
 *    بازیکن ۲ (P2 = -1): از اندیس ۰ به سمت ۲۳ حرکت می‌کند، خانه‌ی او 18..23 است
 * ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var P1 = 1;
  var P2 = -1;
  var BAR = 'bar';
  var OFF = 'off';

  /* ---------------------------------------------------------------- کمکی */

  function dirOf(p) { return p === P1 ? -1 : 1; }

  /** آیا اندیس داده‌شده در خانه‌ی (home) بازیکن است؟ */
  function inHome(p, i) { return p === P1 ? (i >= 0 && i <= 5) : (i >= 18 && i <= 23); }

  /** فاصله‌ی یک مهره تا خروج از تخته (pip) */
  function pipOf(p, i) { return p === P1 ? (i + 1) : (24 - i); }

  /** اندیس ورود از «بار» با تاس die */
  function entryIndex(p, die) { return p === P1 ? (24 - die) : (die - 1); }

  function newBoard() {
    var b = new Array(24);
    for (var i = 0; i < 24; i++) b[i] = 0;
    // چیدمان استاندارد
    b[23] = 2;  b[12] = 5;  b[7] = 3;  b[5] = 5;    // سفید
    b[0] = -2;  b[11] = -5; b[16] = -3; b[18] = -5; // سیاه
    return b;
  }

  function newState(opts) {
    opts = opts || {};
    return {
      board: newBoard(),
      bar: { 1: 0, '-1': 0 },
      off: { 1: 0, '-1': 0 },
      turn: 0,                 // ۰ یعنی هنوز شروع نشده
      dice: [],                // تاس‌های ریخته‌شده در این نوبت
      moves: [],               // تاس‌های باقی‌مانده برای استفاده
      played: [],              // حرکت‌های انجام‌شده در نوبت جاری (برای undo)
      cube: 1,                 // مقدار دوبل
      cubeOwner: 0,            // ۰ = وسط، +1 یا -1 = مالک
      cubeEnabled: opts.cubeEnabled !== false,
      pendingDouble: 0,        // بازیکنی که دوبل پیشنهاد داده
      done: false,
      winner: 0,
      result: 0,               // ۱ ساده، ۲ مارس، ۳ توله‌مارس
      resign: false
    };
  }

  function cloneState(st) {
    return {
      board: st.board.slice(),
      bar: { 1: st.bar[1], '-1': st.bar[-1] },
      off: { 1: st.off[1], '-1': st.off[-1] },
      turn: st.turn,
      dice: st.dice.slice(),
      moves: st.moves.slice(),
      played: st.played.slice(),
      cube: st.cube,
      cubeOwner: st.cubeOwner,
      cubeEnabled: st.cubeEnabled,
      pendingDouble: st.pendingDouble,
      done: st.done,
      winner: st.winner,
      result: st.result,
      resign: st.resign
    };
  }

  /* ------------------------------------------------------- قوانین حرکت */

  /** آیا بازیکن p می‌تواند روی خانه‌ی to فرود بیاید؟ */
  function canLand(st, p, to) {
    if (to < 0 || to > 23) return false;
    var v = st.board[to];
    if (v === 0) return true;
    if (v * p > 0) return true;      // مهره‌ی خودی
    return Math.abs(v) === 1;        // فقط اگر تک‌مهره (بلوت) حریف باشد
  }

  function isBlot(st, p, to) {
    if (to < 0 || to > 23) return false;
    var v = st.board[to];
    return v * p < 0 && Math.abs(v) === 1;
  }

  /** آیا همه‌ی مهره‌های بازیکن وارد خانه شده‌اند؟ (شرط جمع‌کردن) */
  function canBearOff(st, p) {
    if (st.bar[p] > 0) return false;
    for (var i = 0; i < 24; i++) {
      if (st.board[i] * p > 0 && !inHome(p, i)) return false;
    }
    return true;
  }

  /** آیا مهره‌ای عقب‌تر (دورتر از خروج) از اندیس i وجود دارد؟ */
  function hasHigher(st, p, i) {
    if (p === P1) {
      for (var a = i + 1; a <= 5; a++) if (st.board[a] > 0) return true;
    } else {
      for (var b = i - 1; b >= 18; b--) if (st.board[b] < 0) return true;
    }
    return false;
  }

  /**
   * تمام حرکت‌های مجاز با یک تاس مشخص
   * خروجی: [{from, to, hit}]  — from می‌تواند 'bar' و to می‌تواند 'off' باشد
   */
  function movesForDie(st, p, die) {
    var res = [];
    var dir = dirOf(p);
    var i, to;

    // اگر مهره در بار داریم، فقط ورود مجاز است
    if (st.bar[p] > 0) {
      to = entryIndex(p, die);
      if (canLand(st, p, to)) res.push({ from: BAR, to: to, die: die, hit: isBlot(st, p, to) });
      return res;
    }

    var bo = canBearOff(st, p);

    for (i = 0; i < 24; i++) {
      if (st.board[i] * p <= 0) continue;
      to = i + dir * die;
      if (to >= 0 && to <= 23) {
        if (canLand(st, p, to)) res.push({ from: i, to: to, die: die, hit: isBlot(st, p, to) });
      } else if (bo) {
        var need = pipOf(p, i);
        if (die === need) {
          res.push({ from: i, to: OFF, die: die, hit: false });
        } else if (die > need && !hasHigher(st, p, i)) {
          res.push({ from: i, to: OFF, die: die, hit: false });
        }
      }
    }
    return res;
  }

  /** اعمال یک حرکت روی state (تغییر مستقیم) */
  function applyMove(st, p, mv) {
    if (mv.from === BAR) st.bar[p] -= 1;
    else st.board[mv.from] -= p;

    if (mv.to === OFF) {
      st.off[p] += 1;
    } else {
      if (st.board[mv.to] * p < 0) {          // خوردن مهره‌ی حریف
        st.board[mv.to] = 0;
        st.bar[-p] += 1;
      }
      st.board[mv.to] += p;
    }
    st.played.push({ from: mv.from, to: mv.to, die: mv.die, hit: !!mv.hit });
    var k = st.moves.indexOf(mv.die);
    if (k >= 0) st.moves.splice(k, 1);
    return st;
  }

  /** بازگرداندن آخرین حرکت (undo) */
  function undoMove(st, p) {
    if (!st.played.length) return false;
    var mv = st.played.pop();

    if (mv.to === OFF) st.off[p] -= 1;
    else {
      st.board[mv.to] -= p;
      if (mv.hit) { st.board[mv.to] = -p; st.bar[-p] -= 1; }
    }
    if (mv.from === BAR) st.bar[p] += 1;
    else st.board[mv.from] += p;

    st.moves.push(mv.die);
    st.moves.sort(function (a, b) { return b - a; });
    return true;
  }

  /* ------------------------------------------- تولید کل نوبت (قانون بیشینه) */

  function boardKey(st, p) {
    return st.board.join(',') + '|' + st.bar[1] + ',' + st.bar[-1] + '|' + st.off[1] + ',' + st.off[-1];
  }

  /**
   * تمام دنباله‌های کامل ممکن برای یک نوبت را برمی‌گرداند.
   * قانون: باید بیشترین تعداد تاس ممکن بازی شود؛ اگر فقط یک تاس قابل بازی است،
   * باید تاس بزرگ‌تر بازی شود (در صورت امکان).
   *
   * @param opts.dedupe  اگر true باشد، دنباله‌هایی که به یک وضعیت نهایی می‌رسند
   *                     یکی حساب می‌شوند (برای هوش مصنوعی خوب است چون سریع‌تر است).
   *                     اما برای رابط کاربری باید false باشد، وگرنه ترتیب‌های
   *                     مختلف بازی کردن تاس‌ها حذف می‌شوند و بازیکن نمی‌تواند
   *                     تاس بزرگ‌تر را اول بازی کند.
   */
  function allTurnSequences(state, p, opts) {
    var dedupe = !opts || opts.dedupe !== false;
    var best = [];
    var maxLen = 0;
    var seen = {};

    function dfs(st, seq) {
      var any = false;
      var uniqueDice = {};
      for (var d = 0; d < st.moves.length; d++) uniqueDice[st.moves[d]] = true;

      for (var dieStr in uniqueDice) {
        var die = parseInt(dieStr, 10);
        var mvs = movesForDie(st, p, die);
        for (var m = 0; m < mvs.length; m++) {
          any = true;
          var ns = cloneState(st);
          applyMove(ns, p, mvs[m]);
          dfs(ns, seq.concat([mvs[m]]));
        }
      }

      if (!any) {
        if (seq.length > maxLen) { maxLen = seq.length; best = []; seen = {}; }
        if (seq.length === maxLen && maxLen > 0) {
          if (!dedupe) { best.push({ seq: seq, state: st }); return; }
          var key = boardKey(st, p);
          if (!seen[key]) { seen[key] = true; best.push({ seq: seq, state: st }); }
        }
      }
    }

    var start = cloneState(state);
    start.played = [];
    dfs(start, []);

    // قانون «تاس بزرگ‌تر» وقتی فقط یکی قابل بازی است
    if (maxLen === 1 && state.dice.length === 2 && state.dice[0] !== state.dice[1]) {
      var big = Math.max(state.dice[0], state.dice[1]);
      var withBig = best.filter(function (r) { return r.seq[0].die === big; });
      if (withBig.length) best = withBig;
    }
    return best;
  }

  /** آیا بازیکن اصلاً حرکتی دارد؟ */
  function hasAnyMove(st, p) {
    var uniq = {};
    for (var i = 0; i < st.moves.length; i++) uniq[st.moves[i]] = true;
    for (var d in uniq) {
      if (movesForDie(st, p, parseInt(d, 10)).length) return true;
    }
    return false;
  }

  /**
   * حرکت‌های مجاز از یک خانه‌ی مشخص — با در نظر گرفتن قانون بیشینه.
   * برای رابط کاربری استفاده می‌شود تا مقصدهای درست هایلایت شوند.
   */
  function legalDestinations(st, p, from) {
    var seqs = allTurnSequences(st, p, { dedupe: false });
    var out = [];
    var seen = {};
    for (var i = 0; i < seqs.length; i++) {
      var first = seqs[i].seq[0];
      if (!first) continue;
      if (String(first.from) !== String(from)) continue;
      var k = String(first.to) + '_' + first.die;
      if (!seen[k]) { seen[k] = true; out.push(first); }
    }
    return out;
  }

  /** تمام حرکت‌های مجاز «اولین گام» در نوبت جاری */
  function legalFirstMoves(st, p) {
    var seqs = allTurnSequences(st, p, { dedupe: false });
    var out = [], seen = {};
    for (var i = 0; i < seqs.length; i++) {
      var f = seqs[i].seq[0];
      if (!f) continue;
      var k = String(f.from) + '>' + String(f.to) + '_' + f.die;
      if (!seen[k]) { seen[k] = true; out.push(f); }
    }
    return out;
  }

  /* ---------------------------------------------------------- تاس و نوبت */

  function rollDie(rng) { return 1 + Math.floor((rng ? rng() : Math.random()) * 6); }

  function rollDice(st, rng, forced) {
    var d1, d2;
    if (forced) { d1 = forced[0]; d2 = forced[1]; }
    else { d1 = rollDie(rng); d2 = rollDie(rng); }
    st.dice = [d1, d2];
    st.moves = (d1 === d2) ? [d1, d1, d1, d1] : [d1, d2].sort(function (a, b) { return b - a; });
    st.played = [];
    return st.dice;
  }

  /** تاس آغازین برای تعیین نوبت شروع */
  function openingRoll(rng) {
    var d1, d2;
    do { d1 = rollDie(rng); d2 = rollDie(rng); } while (d1 === d2);
    return { d1: d1, d2: d2, first: d1 > d2 ? P1 : P2 };
  }

  /** پایان نوبت و بررسی برد */
  function endTurn(st) {
    var w = checkWin(st);
    if (w) return st;
    st.turn = -st.turn;
    st.dice = [];
    st.moves = [];
    st.played = [];
    return st;
  }

  function checkWin(st) {
    var p = 0;
    if (st.off[P1] === 15) p = P1;
    else if (st.off[P2] === 15) p = P2;
    if (!p) return 0;

    st.done = true;
    st.winner = p;
    var loser = -p;

    if (st.off[loser] > 0) {
      st.result = 1;                       // برد ساده
    } else {
      // اگر مهره‌ی بازنده در بار یا در خانه‌ی برنده باشد => توله‌مارس
      var backgammon = st.bar[loser] > 0;
      if (!backgammon) {
        for (var i = 0; i < 24; i++) {
          if (st.board[i] * loser > 0 && inHome(p, i)) { backgammon = true; break; }
        }
      }
      st.result = backgammon ? 3 : 2;      // ۳ = توله‌مارس، ۲ = مارس
    }
    return p;
  }

  /* --------------------------------------------------------------- آمار */

  function pipCount(st, p) {
    var total = st.bar[p] * 25;
    for (var i = 0; i < 24; i++) {
      if (st.board[i] * p > 0) total += Math.abs(st.board[i]) * pipOf(p, i);
    }
    return total;
  }

  function checkersInHome(st, p) {
    var n = 0;
    for (var i = 0; i < 24; i++) if (st.board[i] * p > 0 && inHome(p, i)) n += Math.abs(st.board[i]);
    return n;
  }

  /** تعداد بلوت‌های (تک‌مهره‌های) بازیکن */
  function blots(st, p) {
    var out = [];
    for (var i = 0; i < 24; i++) if (st.board[i] === p) out.push(i);
    return out;
  }

  /** خانه‌هایی که بازیکن روی آن‌ها «سد» (۲ مهره یا بیشتر) دارد */
  function points(st, p) {
    var out = [];
    for (var i = 0; i < 24; i++) if (st.board[i] * p >= 2) out.push(i);
    return out;
  }

  /* ------------------------------------------------------------ دوبل */

  function canDouble(st, p) {
    if (!st.cubeEnabled) return false;
    if (st.done || st.pendingDouble) return false;
    if (st.turn !== p) return false;
    if (st.dice.length) return false;                       // فقط قبل از انداختن تاس
    if (st.cube >= 64) return false;
    return st.cubeOwner === 0 || st.cubeOwner === p;
  }

  function offerDouble(st, p) {
    if (!canDouble(st, p)) return false;
    st.pendingDouble = p;
    return true;
  }

  function acceptDouble(st) {
    if (!st.pendingDouble) return false;
    st.cube *= 2;
    st.cubeOwner = -st.pendingDouble;
    st.pendingDouble = 0;
    return true;
  }

  function declineDouble(st) {
    if (!st.pendingDouble) return false;
    st.done = true;
    st.winner = st.pendingDouble;
    st.result = 1;
    st.resign = true;
    st.pendingDouble = 0;
    return true;
  }

  /* ------------------------------------------------------------ خروجی */

  return {
    P1: P1, P2: P2, BAR: BAR, OFF: OFF,
    newState: newState,
    newBoard: newBoard,
    cloneState: cloneState,
    dirOf: dirOf,
    inHome: inHome,
    pipOf: pipOf,
    entryIndex: entryIndex,
    canLand: canLand,
    isBlot: isBlot,
    canBearOff: canBearOff,
    movesForDie: movesForDie,
    applyMove: applyMove,
    undoMove: undoMove,
    allTurnSequences: allTurnSequences,
    legalDestinations: legalDestinations,
    legalFirstMoves: legalFirstMoves,
    hasAnyMove: hasAnyMove,
    rollDie: rollDie,
    rollDice: rollDice,
    openingRoll: openingRoll,
    endTurn: endTurn,
    checkWin: checkWin,
    pipCount: pipCount,
    checkersInHome: checkersInHome,
    blots: blots,
    points: points,
    canDouble: canDouble,
    offerDouble: offerDouble,
    acceptDouble: acceptDouble,
    declineDouble: declineDouble
  };
});
