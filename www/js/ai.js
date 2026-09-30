/* =========================================================================
 *  ai.js — هوش مصنوعی حریف (ربات)
 *  سه سطح: مبتدی (easy) — حرفه‌ای (normal) — استاد (hard)
 *  روش: تولید تمام دنباله‌های مجاز نوبت، ارزیابی موقعیت حاصل، انتخاب بهترین
 * ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./engine.js'));
  } else {
    root.AI = factory(root.Engine);
  }
})(typeof self !== 'undefined' ? self : this, function (Engine) {
  'use strict';

  /* احتمال خورده‌شدن بر حسب فاصله (تعداد حالت از ۳۶) — تقریبی و بدون درنظرگرفتن سد */
  var SHOTS = {
    1: 11, 2: 12, 3: 14, 4: 15, 5: 15, 6: 17,
    7: 6, 8: 6, 9: 5, 10: 3, 11: 2, 12: 3,
    15: 1, 16: 1, 18: 1, 20: 1, 24: 1
  };

  function shotsFor(dist) { return SHOTS[dist] || 0; }

  /** وزن خانه‌ها: نقاط طلایی (۵ و بار-پوینت) ارزش بیشتری دارند */
  function pointValue(p, i) {
    // فاصله از خروج: ۱ تا ۲۴
    var pip = Engine.pipOf(p, i);
    if (pip === 5) return 3.2;       // نقطه‌ی طلایی
    if (pip === 4) return 2.6;
    if (pip === 7) return 2.8;       // بار-پوینت
    if (pip === 3) return 2.2;
    if (pip === 6) return 2.4;
    if (pip === 2) return 1.4;
    if (pip === 1) return 0.6;
    if (pip >= 8 && pip <= 11) return 1.2;
    return 0.5;
  }

  /** طول بلندترین «سد» پیوسته (prime) برای بازیکن */
  function longestPrime(st, p) {
    var best = 0, cur = 0;
    for (var i = 0; i < 24; i++) {
      if (st.board[i] * p >= 2) { cur++; if (cur > best) best = cur; }
      else cur = 0;
    }
    return best;
  }

  /** بررسی اینکه آیا حریف با فاصله d می‌تواند به این بلوت برسد (تقریبی) */
  function exposure(st, p) {
    var risk = 0;
    var opp = -p;
    for (var i = 0; i < 24; i++) {
      if (st.board[i] !== p) continue;               // فقط بلوت‌ها (تک‌مهره)
      var minDist = 99;

      if (st.bar[opp] > 0) {
        var entry = Engine.entryIndex(opp, 1);       // مبدأ تقریبی از بار
        var barPip = (opp === Engine.P1) ? (25 - Engine.pipOf(opp, i)) : (25 - Engine.pipOf(opp, i));
        if (barPip > 0 && barPip < minDist) minDist = barPip;
      } else {
        for (var j = 0; j < 24; j++) {
          if (st.board[j] * opp <= 0) continue;
          var d = (opp === Engine.P1) ? (j - i) : (i - j);
          if (d > 0 && d < minDist) minDist = d;
        }
      }
      if (minDist < 99) {
        var sh = shotsFor(minDist) / 36;
        // اگر مهره خورده شود، به بار می‌رود: یعنی (۲۵ − pip) خانه عقب می‌افتد
        var lost = 25 - Engine.pipOf(p, i);
        var cost = lost + 6;                 // ۶ امتیاز بابت از دست دادن تمپو
        risk += sh * cost;
      }
    }
    return risk;
  }

  /**
   * ارزیابی موقعیت از دید بازیکن p. عدد بزرگ‌تر = بهتر.
   */
  function evaluate(st, p) {
    var opp = -p;
    var score = 0;

    // ۱) اختلاف pip (پیشروی)
    var myPip = Engine.pipCount(st, p);
    var opPip = Engine.pipCount(st, opp);
    score += (opPip - myPip) * 1.0;

    // ۲) مهره‌های جمع‌شده
    score += st.off[p] * 9;
    score -= st.off[opp] * 9;

    // ۳) مهره‌های حریف در بار — بخش عمده‌ی سودش قبلاً در pip حساب شده،
    //    این فقط ارزش اضافه‌ی «گیر افتادن» است
    score += st.bar[opp] * 3;
    score -= st.bar[p] * 5;

    // ۴) سدها و کیفیت آن‌ها
    var i;
    for (i = 0; i < 24; i++) {
      if (st.board[i] * p >= 2) score += pointValue(p, i) * 2.0;
      if (st.board[i] * opp <= -2) score -= pointValue(opp, i) * 2.0;
    }

    // ۵) prime
    score += Math.pow(longestPrime(st, p), 1.7) * 1.6;
    score -= Math.pow(longestPrime(st, opp), 1.7) * 1.6;

    // ۶) خانه‌ی قوی (تعداد نقاط بسته در home) — برای زندانی‌کردن حریف
    var myHomePts = 0, opHomePts = 0;
    for (i = 0; i < 24; i++) {
      if (Engine.inHome(p, i) && st.board[i] * p >= 2) myHomePts++;
      if (Engine.inHome(opp, i) && st.board[i] * opp <= -2) opHomePts++;
    }
    score += myHomePts * myHomePts * 1.1;
    score -= opHomePts * opHomePts * 1.1;
    if (st.bar[opp] > 0) score += myHomePts * 4;    // زندانی‌کردن مؤثر

    // ۷) ریسک بلوت‌ها
    score -= exposure(st, p) * 1.15;
    score += exposure(st, opp) * 0.55;

    // ۸) مهره‌های گیرافتاده در خانه‌ی حریف — هرچه بیشتر، بدتر
    var deepMe = 0, deepOp = 0, stackPen = 0;
    for (i = 0; i < 24; i++) {
      var n = st.board[i];
      if (n * p > 0) {
        if (Engine.pipOf(p, i) >= 20) deepMe += Math.abs(n);
        if (Math.abs(n) > 3) stackPen += (Math.abs(n) - 3) * 1.2;   // تلنبار شدن مهره بد است
      } else if (n * opp > 0) {
        if (Engine.pipOf(opp, i) >= 20) deepOp += Math.abs(n);
      }
    }
    score -= deepMe * 2.2;
    score += deepOp * 2.2;
    if (deepMe > 2) score -= (deepMe - 2) * 3.0;
    score -= stackPen;

    // ۹) در فاز مسابقه‌ای (بدون تماس) فقط pip اهمیت دارد
    if (isRace(st)) {
      score = (opPip - myPip) * 2.2 + st.off[p] * 6 - st.off[opp] * 6;
    }

    return score;
  }

  /** آیا بازی به مرحله‌ی «مسابقه» رسیده (تماسی بین مهره‌ها نیست)؟ */
  function isRace(st) {
    if (st.bar[1] || st.bar[-1]) return false;
    var maxP2 = -1, minP1 = 99;
    for (var i = 0; i < 24; i++) {
      if (st.board[i] > 0 && i < minP1) minP1 = i;   // جلوترین مهره‌ی سفید
      if (st.board[i] < 0 && i > maxP2) maxP2 = i;   // جلوترین مهره‌ی سیاه
    }
    // اگر عقب‌ترین سیاه از عقب‌ترین سفید گذشته باشد => race
    var lastP1 = -1, firstP2 = 99;
    for (i = 0; i < 24; i++) {
      if (st.board[i] > 0) lastP1 = Math.max(lastP1, i);
      if (st.board[i] < 0) firstP2 = Math.min(firstP2, i);
    }
    return lastP1 < firstP2;
  }

  /* --------------------------------------------------- انتخاب بهترین نوبت */

  /* thinkMs بازه‌ی پایه‌ی «فکر کردن» است. مقدار واقعی در thinkTime()
   * بر اساس تعداد گزینه‌های پیش رو حساب می‌شود — چون چیزی که ربات را
   * لو می‌دهد سرعتش نیست، یکنواختی‌اش است. */
  var LEVELS = {
    easy:   { noise: 26, topK: 6, thinkMs: [1400, 3200] },
    normal: { noise: 8,  topK: 3, thinkMs: [1600, 3600] },
    hard:   { noise: 0,  topK: 1, thinkMs: [1800, 4200] }
  };

  /**
   * بهترین دنباله‌ی حرکت را برمی‌گرداند.
   * @returns {seq: [...], state: {...}} یا null اگر حرکتی نباشد
   */
  function chooseTurn(st, p, level) {
    var cfg = LEVELS[level] || LEVELS.normal;
    var options = Engine.allTurnSequences(st, p);
    if (!options.length) return null;

    var scored = options.map(function (o) {
      var s = evaluate(o.state, p);
      if (cfg.noise) s += (Math.random() - 0.5) * cfg.noise;
      return { opt: o, score: s };
    });
    scored.sort(function (a, b) { return b.score - a.score; });

    var k = Math.min(cfg.topK, scored.length);
    var pick = scored[Math.floor(Math.random() * k)];

    /* تعداد گزینه‌ها را همراه انتخاب برمی‌گردانیم تا صداکننده بتواند
     * زمان فکر کردن را متناسب با سختی تصمیم تنظیم کند. */
    return { seq: pick.opt.seq, state: pick.opt.state, options: options.length };
  }

  /** آیا ربات دوبل بدهد؟ (تصمیم ساده بر پایه‌ی برتری pip) */
  function shouldDouble(st, p, level) {
    if (!Engine.canDouble(st, p)) return false;
    if (level === 'easy') return Math.random() < 0.05;
    var my = Engine.pipCount(st, p);
    var op = Engine.pipCount(st, -p);
    var lead = (op - my) / Math.max(op, 1);
    if (st.cube >= 8) return false;
    if (lead > 0.16 && lead < 0.55) return Math.random() < (level === 'hard' ? 0.55 : 0.3);
    return false;
  }

  /** آیا ربات دوبل حریف را قبول کند؟ */
  function shouldAcceptDouble(st, p, level) {
    var my = Engine.pipCount(st, p);
    var op = Engine.pipCount(st, -p);
    var deficit = (my - op) / Math.max(op, 1);
    if (level === 'easy') return deficit < 0.30;
    if (level === 'normal') return deficit < 0.22;
    return deficit < 0.18;
  }

  /**
   * زمان «فکر کردن» ربات.
   *
   * یک ربات که همیشه دقیقاً ۱ ثانیه مکث می‌کند — چه حرکت اجباری باشد
   * چه ۱۵ گزینه داشته باشد — از روی همین یکنواختی لو می‌رود. آدم‌ها:
   *   • حرکت اجباری را تقریباً فوری می‌زنند
   *   • وقتی گزینه زیاد است بیشتر مکث می‌کنند
   *   • گاهی بی‌دلیل طولانی فکر می‌کنند (حواس‌پرتی، چای، پیام)
   *
   * @param level    سطح ربات
   * @param options  تعداد دنباله‌های ممکن (اختیاری)
   */
  function thinkTime(level, options) {
    var cfg = LEVELS[level] || LEVELS.normal;
    var a = cfg.thinkMs[0], b = cfg.thinkMs[1];
    var n = typeof options === 'number' ? options : 4;

    // حرکت اجباری: آدم هم معطل نمی‌کند
    if (n <= 1) return 450 + Math.random() * 550;

    /* هرچه گزینه بیشتر، مکث بیشتر — ولی لگاریتمی، نه خطی؛
     * کسی برای ۲۰ گزینه ۲۰ برابر ۱ گزینه فکر نمی‌کند. */
    var weight = Math.min(1.35, 0.45 + Math.log(n) / 3.2);
    var base = (a + Math.random() * (b - a)) * weight;

    // گاهی یک مکث طولانی، مثل آدمی که حواسش پرت شده
    if (Math.random() < 0.09) base += 1800 + Math.random() * 3200;

    // و گاهی یک حرکت سریع و بی‌فکر
    else if (Math.random() < 0.14) base *= 0.45;

    return Math.max(400, Math.min(11000, base));
  }

  /** مکث بین جابه‌جا کردن دو مهره در یک نوبت */
  function moveDelay() {
    // حرکت دوم معمولاً سریع‌تر است چون تصمیم قبلاً گرفته شده
    var d = 320 + Math.random() * 520;
    if (Math.random() < 0.12) d += 700 + Math.random() * 1100;  // تردید
    return d;
  }

  /** مکث قبل از انداختن تاس — کسی دکمه را فوری نمی‌زند */
  function rollDelay() {
    var d = 500 + Math.random() * 1100;
    if (Math.random() < 0.08) d += 1500 + Math.random() * 2500;
    return d;
  }

  return {
    evaluate: evaluate,
    isRace: isRace,
    chooseTurn: chooseTurn,
    shouldDouble: shouldDouble,
    shouldAcceptDouble: shouldAcceptDouble,
    thinkTime: thinkTime,
    moveDelay: moveDelay,
    rollDelay: rollDelay,
    LEVELS: LEVELS
  };
});
