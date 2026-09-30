/* =========================================================================
 *  store.js — اقتصاد بازی، پروفایل کاربر و ذخیره‌سازی محلی
 *  سکه / انرژی / اتاق‌ها / فروشگاه / جوایز / دعوت دوستان
 * ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root || {});
  else root.Store = factory(root);
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  root = root || {};

  /* ------------------------------------------------------------ تنظیمات */

  var CONFIG = {
    WELCOME_COINS: 500,          // هدیه‌ی خوش‌آمدگویی
    DAILY_BONUS: 100,            // هدیه‌ی روزانه
    RAKE_PERCENT: 10,            // درصد فی
    RAKE_MIN_ENTRY: 1000,        // فی فقط برای اتاق ۱۰۰۰ سکه به بالا
    ENERGY_PER_COINS: 100,       // به ازای هر ۱۰۰ سکه شرط، ۱ انرژی
    ENERGY_MARS_BONUS: 0.5,      // ۵۰٪ انرژی بیشتر در صورت مارس کردن
    REFERRAL_ENERGY: 150,        // انرژی جایزه به ازای هر دعوت موفق
    REFERRAL_COINS: 200,         // سکه‌ی جایزه برای دعوت‌کننده
    REFERRAL_BONUS_NEW: 300,     // سکه‌ی جایزه برای کاربر دعوت‌شده
    SELL_RATE: 1200,             // هر ۱۲۰۰ سکه = ۱۰۰۰ تومان
    SELL_MIN: 50000              // حداقل سکه برای فروش
  };

  /* اتاق‌های بازی — «فی» فقط از اتاق ۱۰۰۰ سکه به بالا */
  var ROOMS = [
    { id: 'r100',    name: 'اتاق مبتدی',   entry: 100,    icon: '🌱', color: '#4ade80', minLevel: 1 },
    { id: 'r500',    name: 'اتاق برنزی',   entry: 500,    icon: '🥉', color: '#d97706', minLevel: 1 },
    { id: 'r1000',   name: 'اتاق نقره‌ای',  entry: 1000,   icon: '🥈', color: '#94a3b8', minLevel: 2 },
    { id: 'r5000',   name: 'اتاق طلایی',   entry: 5000,   icon: '🥇', color: '#fbbf24', minLevel: 3, skin: 'emerald' },
    { id: 'r25000',  name: 'اتاق الماس',   entry: 25000,  icon: '💎', color: '#38bdf8', minLevel: 5, skin: 'royalgold' },
    { id: 'r100000', name: 'اتاق افسانه‌ای', entry: 100000, icon: '👑', color: '#a78bfa', minLevel: 8, skin: 'dragon' }
  ];

  /* بسته‌های خرید سکه (شبیه‌سازی‌شده — محل اتصال درگاه در payment.js) */
  var COIN_PACKS = [
    { id: 'p1', coins: 5000,    price: 19000,   bonus: 0,   icon: '💰', tag: '' },
    { id: 'p2', coins: 15000,   price: 49000,   bonus: 10,  icon: '💰', tag: '۱۰٪ هدیه' },
    { id: 'p3', coins: 50000,   price: 149000,  bonus: 20,  icon: '🪙', tag: '۲۰٪ هدیه' },
    { id: 'p4', coins: 150000,  price: 399000,  bonus: 30,  icon: '🏆', tag: 'محبوب‌ترین' },
    { id: 'p5', coins: 500000,  price: 1190000, bonus: 40,  icon: '👑', tag: '۴۰٪ هدیه' },
    { id: 'p6', coins: 1500000, price: 2990000, bonus: 50,  icon: '💎', tag: 'بهترین ارزش' }
  ];

  /* جوایز قابل دریافت با انرژی */
  var PRIZES = [
    { id: 'z1', name: '۲٬۰۰۰ سکه',        energy: 100,   type: 'coins',  value: 2000,   icon: '🪙' },
    { id: 'z2', name: '۱۰٬۰۰۰ سکه',       energy: 450,   type: 'coins',  value: 10000,  icon: '💰' },
    { id: 'z3', name: '۵۰٬۰۰۰ سکه',       energy: 2000,  type: 'coins',  value: 50000,  icon: '💎' },
    { id: 'z4', name: 'قاب پروفایل طلایی',  energy: 800,   type: 'item',   value: 'frame_gold', icon: '🖼️' },
    { id: 'z5', name: 'نشان VIP (۳۰ روز)',  energy: 3000,  type: 'item',   value: 'vip_30',     icon: '⭐' },
    { id: 'z6', name: 'شارژ ۲۰٬۰۰۰ تومانی', energy: 6000,  type: 'real',   value: 'charge_20k',  icon: '📱' },
    { id: 'z7', name: 'شارژ ۵۰٬۰۰۰ تومانی', energy: 14000, type: 'real',   value: 'charge_50k',  icon: '📲' },
    { id: 'z8', name: 'هدفون بی‌سیم',       energy: 60000, type: 'real',   value: 'headphone',   icon: '🎧' },
    { id: 'z9', name: 'گوشی هوشمند',        energy: 400000,type: 'real',   value: 'phone',       icon: '📦' }
  ];

  var AVATARS = ['🦁', '🐯', '🦊', '🐺', '🦅', '🐉', '🦈', '🐻', '🦂', '🐎', '🦖', '🕊️'];

  /* پوسته‌های تخته — رنگ‌هایشان در style.css با کلاس sk-<id> تعریف شده */
  var SKINS = [
    { id: 'classic',   name: 'کلاسیک',          desc: 'چوب گردویی و نمد سبز — همان تخته‌ی همیشگی', price: 0, currency: 'coins', free: true },
    { id: 'walnut',    name: 'گردوی شب',        desc: 'چوب تیره و نمد سرمه‌ای', price: 0, currency: 'coins', minLevel: 3 },
    { id: 'yalda',     name: 'شب یلدا',         desc: 'انار و زرشک — گرم و ایرانی', price: 5000, currency: 'coins' },
    { id: 'turquoise', name: 'فیروزه‌ی اصفهان',  desc: 'فیروزه‌ای و طلایی، الهام از کاشی‌کاری', price: 15000, currency: 'coins' },
    { id: 'marble',    name: 'مرمر سفید',        desc: 'سنگ مرمر و نمد یشمی — مینیمال و تمیز', price: 40000, currency: 'coins' },
    { id: 'emerald',   name: 'زمرد سلطنتی',      desc: 'مشکی و زمردی با مهره‌های طلایی', price: 900, currency: 'energy', room: 'r5000' },
    { id: 'royalgold', name: 'طلای ناب',         desc: 'قاب طلایی روی نمد مشکی', price: 150000, currency: 'coins', room: 'r25000' },
    { id: 'neon',      name: 'کهکشان نئون',      desc: 'فیروزه‌ای و بنفش درخشان', price: 2500, currency: 'energy' },
    { id: 'dragon',    name: 'اژدهای سرخ',       desc: 'لاکِ سرخ و طلا — نادرترین پوسته', price: 400000, currency: 'coins', room: 'r100000' }
  ];

  function skinById(id) {
    for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return SKINS[i];
    return SKINS[0];
  }

  /** آیا کاربر این پوسته را دارد؟ */
  function ownsSkin(id) {
    var sk = skinById(id);
    if (sk.free) return true;
    if (sk.minLevel && levelOf(profile.xp).level >= sk.minLevel) return true;
    return profile.skins.indexOf(id) >= 0;
  }

  /** چرا هنوز قفل است؟ */
  function skinLockReason(id) {
    var sk = skinById(id);
    if (ownsSkin(id)) return null;
    if (sk.minLevel) return 'باز می‌شود در سطح ' + fa(sk.minLevel);
    return null;
  }

  function buySkin(id) {
    var sk = skinById(id);
    if (ownsSkin(id)) return { ok: false, reason: 'این پوسته را دارید' };
    if (sk.minLevel) return { ok: false, reason: 'این پوسته در سطح ' + fa(sk.minLevel) + ' باز می‌شود' };

    if (sk.currency === 'energy') {
      if (profile.energy < sk.price) return { ok: false, reason: fa(sk.price - profile.energy) + ' انرژی کم دارید' };
      profile.energy -= sk.price;
      addTx('skin', 0, -sk.price, 'خرید پوسته: ' + sk.name);
    } else {
      if (profile.coins < sk.price) return { ok: false, reason: fa(sk.price - profile.coins) + ' سکه کم دارید' };
      profile.coins -= sk.price;
      addTx('skin', -sk.price, 0, 'خرید پوسته: ' + sk.name);
    }
    profile.skins.push(id);
    profile.skin = id;
    save();
    return { ok: true, skin: sk };
  }

  function equipSkin(id) {
    if (!ownsSkin(id)) return { ok: false, reason: 'اول باید این پوسته را بگیرید' };
    profile.skin = id;
    save();
    return { ok: true };
  }

  /** پوسته‌ای که در این اتاق استفاده می‌شود (اتاق‌های گران پوسته‌ی اختصاصی دارند) */
  function skinForRoom(room) {
    if (room && room.skin) return room.skin;
    return profile.skin || 'classic';
  }

  /* سطح‌بندی بر اساس امتیاز تجربه */
  function levelOf(xp) {
    var lvl = 1, need = 500;
    while (xp >= need && lvl < 60) { xp -= need; lvl++; need = Math.round(need * 1.25); }
    return { level: lvl, xp: xp, need: need };
  }

  /* ------------------------------------------------------- ذخیره‌سازی */

  var KEY = 'nard_profile_v1';
  var mem = null;    // در محیط بدون localStorage

  function hasLS() {
    try { return typeof localStorage !== 'undefined' && localStorage !== null; }
    catch (e) { return false; }
  }

  function randomCode() {
    var s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '';
    for (var i = 0; i < 7; i++) out += s[Math.floor(Math.random() * s.length)];
    return out;
  }

  function defaultProfile() {
    return {
      id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: '',
      phone: null,               // شماره‌ی موبایل تأییدشده
      verified: false,           // آیا شماره تأیید شده؟
      authToken: null,
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
      coins: 0,
      energy: 0,
      xp: 0,
      createdAt: Date.now(),
      welcomeTaken: false,
      lastDaily: 0,
      referralCode: randomCode(),
      referredBy: null,
      invitedCount: 0,
      stats: { games: 0, wins: 0, losses: 0, mars: 0, bestWin: 0, coinsWon: 0, coinsLost: 0 },
      inventory: [],
      skins: ['classic'],        // پوسته‌های خریداری‌شده
      skin: 'classic',           // پوسته‌ی فعال
      claims: [],       // درخواست‌های جایزه
      tx: [],           // تاریخچه‌ی تراکنش‌ها
      settings: { sound: true, vibrate: true, difficulty: 'normal', autoRoll: false }
    };
  }

  var profile = null;
  var listeners = [];

  function load() {
    var raw = null;
    if (hasLS()) { try { raw = localStorage.getItem(KEY); } catch (e) {} }
    else raw = mem;

    if (raw) {
      try {
        profile = JSON.parse(raw);
        var d = defaultProfile();
        for (var k in d) if (!(k in profile)) profile[k] = d[k];
        for (var s in d.stats) if (!(s in profile.stats)) profile.stats[s] = d.stats[s];
        for (var t in d.settings) if (!(t in profile.settings)) profile.settings[t] = d.settings[t];
      } catch (e) { profile = defaultProfile(); }
    } else {
      profile = defaultProfile();
    }
    return profile;
  }

  function save() {
    var raw = JSON.stringify(profile);
    if (hasLS()) { try { localStorage.setItem(KEY, raw); } catch (e) {} }
    else mem = raw;
    emit();
  }

  function on(fn) { listeners.push(fn); }
  function emit() { for (var i = 0; i < listeners.length; i++) { try { listeners[i](profile); } catch (e) {} } }

  function get() { return profile || load(); }

  /* -------------------------------------------------------- تراکنش‌ها */

  function addTx(type, coins, energy, note) {
    profile.tx.unshift({ t: Date.now(), type: type, coins: coins || 0, energy: energy || 0, note: note || '' });
    if (profile.tx.length > 200) profile.tx.length = 200;
  }

  function addCoins(n, note, type) {
    profile.coins = Math.max(0, Math.round(profile.coins + n));
    addTx(type || (n >= 0 ? 'credit' : 'debit'), n, 0, note);
    save();
    return profile.coins;
  }

  function addEnergy(n, note, type) {
    profile.energy = Math.max(0, Math.round(profile.energy + n));
    addTx(type || 'energy', 0, n, note);
    save();
    return profile.energy;
  }

  function addXp(n) {
    profile.xp += Math.max(0, Math.round(n));
    save();
    return levelOf(profile.xp);
  }

  /* ------------------------------------------------ هدیه‌ی خوش‌آمدگویی */

  function claimWelcome() {
    if (profile.welcomeTaken) return { ok: false, reason: 'قبلاً دریافت شده' };
    profile.welcomeTaken = true;
    profile.coins += CONFIG.WELCOME_COINS;
    addTx('welcome', CONFIG.WELCOME_COINS, 0, 'هدیه‌ی خوش‌آمدگویی');
    save();
    return { ok: true, coins: CONFIG.WELCOME_COINS };
  }

  function dailyAvailable() {
    if (isOnline()) return !!profile.serverDaily;
    var d = new Date(); d.setHours(0, 0, 0, 0);
    return profile.lastDaily < d.getTime();
  }

  function claimDaily() {
    if (!dailyAvailable()) return { ok: false, reason: 'هدیه‌ی امروز را گرفته‌اید' };
    profile.lastDaily = Date.now();
    profile.coins += CONFIG.DAILY_BONUS;
    addTx('daily', CONFIG.DAILY_BONUS, 0, 'هدیه‌ی روزانه');
    save();
    return { ok: true, coins: CONFIG.DAILY_BONUS };
  }

  /* ----------------------------------------------------------- اتاق‌ها */

  function roomById(id) {
    for (var i = 0; i < ROOMS.length; i++) if (ROOMS[i].id === id) return ROOMS[i];
    return null;
  }

  /** آیا این اتاق فی دارد؟ */
  function roomHasRake(room) { return room.entry >= CONFIG.RAKE_MIN_ENTRY; }

  /** محاسبه‌ی کامل مالی یک اتاق */
  function roomEconomy(room) {
    var pot = room.entry * 2;
    var rake = roomHasRake(room) ? Math.round(pot * CONFIG.RAKE_PERCENT / 100) : 0;
    return {
      entry: room.entry,
      pot: pot,
      rake: rake,
      rakePercent: roomHasRake(room) ? CONFIG.RAKE_PERCENT : 0,
      prize: pot - rake,               // سکه‌ای که برنده می‌گیرد
      net: pot - rake - room.entry     // سود خالص برنده
    };
  }

  /** انرژی‌ای که با بازی در این اتاق به دست می‌آید */
  function energyForEntry(entry, mars) {
    var e = Math.max(1, Math.round(entry / CONFIG.ENERGY_PER_COINS));
    if (mars) e = Math.round(e * (1 + CONFIG.ENERGY_MARS_BONUS));
    return e;
  }

  function canAfford(room) { return profile.coins >= room.entry; }

  /** کسر ورودی هنگام شروع بازی */
  function enterRoom(room) {
    if (!canAfford(room)) return { ok: false, reason: 'سکه کافی نیست' };
    var lv = levelOf(profile.xp).level;
    if (lv < room.minLevel) return { ok: false, reason: 'برای این اتاق باید سطح ' + room.minLevel + ' باشید' };
    profile.coins -= room.entry;
    addTx('stake', -room.entry, 0, 'ورود به ' + room.name);
    save();
    return { ok: true };
  }

  /** بازگرداندن ورودی (لغو مچ‌میکینگ یا قطع بازی پیش از شروع) */
  function refundRoom(room) {
    profile.coins += room.entry;
    addTx('refund', room.entry, 0, 'بازگشت ورودی ' + room.name);
    save();
  }

  /**
   * تسویه‌ی پایان بازی
   * @param room  اتاق
   * @param won   برنده شدیم؟
   * @param mars  مارس شد؟
   */
  function settleGame(room, won, mars) {
    var eco = roomEconomy(room);
    var energy = energyForEntry(room.entry, mars);
    var xp = Math.max(10, Math.round(room.entry / 20)) * (won ? 2 : 1);

    profile.stats.games++;
    if (won) {
      profile.stats.wins++;
      profile.stats.coinsWon += eco.net;
      if (mars) profile.stats.mars++;
      if (eco.prize > profile.stats.bestWin) profile.stats.bestWin = eco.prize;
      profile.coins += eco.prize;
      addTx('win', eco.prize, 0, 'برد در ' + room.name + (eco.rake ? ' (فی ' + eco.rakePercent + '٪)' : ''));
    } else {
      profile.stats.losses++;
      profile.stats.coinsLost += room.entry;
      addTx('lose', 0, 0, 'باخت در ' + room.name);
    }

    profile.energy += energy;
    addTx('energy', 0, energy, 'انرژی بازی در ' + room.name + (mars ? ' + پاداش مارس' : ''));
    profile.xp += xp;
    save();

    return { prize: won ? eco.prize : 0, rake: eco.rake, energy: energy, xp: xp, eco: eco };
  }

  /* --------------------------------------------------------- فروشگاه */

  function packTotal(pack) { return Math.round(pack.coins * (1 + pack.bonus / 100)); }

  /** خرید بسته — در نسخه‌ی واقعی، پس از تأیید درگاه صدا زده می‌شود */
  function completePurchase(pack, refId) {
    var total = packTotal(pack);
    profile.coins += total;
    addTx('purchase', total, 0, 'خرید بسته ' + total.toLocaleString('fa-IR') + ' سکه' + (refId ? ' — کد پیگیری ' + refId : ''));
    save();
    return { ok: true, coins: total };
  }

  /** فروش سکه (درخواست تسویه) */
  function sellCoins(amount, dest) {
    amount = Math.round(amount);
    if (amount < CONFIG.SELL_MIN) return { ok: false, reason: 'حداقل فروش ' + CONFIG.SELL_MIN.toLocaleString('fa-IR') + ' سکه است' };
    if (amount > profile.coins) return { ok: false, reason: 'سکه کافی ندارید' };
    var toman = Math.floor(amount / CONFIG.SELL_RATE) * 1000;
    profile.coins -= amount;
    profile.claims.unshift({
      id: 'S' + Date.now().toString(36).toUpperCase(),
      kind: 'sell', amount: amount, toman: toman, dest: dest || '',
      status: 'pending', t: Date.now()
    });
    addTx('sell', -amount, 0, 'فروش سکه — ' + toman.toLocaleString('fa-IR') + ' تومان');
    save();
    return { ok: true, toman: toman };
  }

  /* ----------------------------------------------------------- جوایز */

  function prizeById(id) {
    for (var i = 0; i < PRIZES.length; i++) if (PRIZES[i].id === id) return PRIZES[i];
    return null;
  }

  function redeemPrize(id, contact) {
    var pz = prizeById(id);
    if (!pz) return { ok: false, reason: 'جایزه یافت نشد' };
    if (profile.energy < pz.energy) {
      return { ok: false, reason: 'انرژی کافی ندارید (' + (pz.energy - profile.energy).toLocaleString('fa-IR') + ' انرژی کم دارید)' };
    }
    profile.energy -= pz.energy;

    if (pz.type === 'coins') {
      profile.coins += pz.value;
      addTx('prize', pz.value, -pz.energy, 'دریافت جایزه: ' + pz.name);
      save();
      return { ok: true, instant: true, prize: pz };
    }
    if (pz.type === 'item') {
      if (profile.inventory.indexOf(pz.value) < 0) profile.inventory.push(pz.value);
      addTx('prize', 0, -pz.energy, 'دریافت جایزه: ' + pz.name);
      save();
      return { ok: true, instant: true, prize: pz };
    }
    // جوایز واقعی → ثبت درخواست
    var claim = {
      id: 'P' + Date.now().toString(36).toUpperCase(),
      kind: 'prize', prizeId: pz.id, prizeName: pz.name,
      energy: pz.energy, contact: contact || '', status: 'pending', t: Date.now()
    };
    profile.claims.unshift(claim);
    addTx('prize', 0, -pz.energy, 'ثبت درخواست جایزه: ' + pz.name);
    save();
    return { ok: true, instant: false, prize: pz, claim: claim };
  }

  /* ------------------------------------------------------ دعوت دوستان */

  function inviteLink() {
    /* از نشانی همان جایی که اپ باز شده استفاده می‌کنیم تا با هر دامنه‌ای
     * کار کند. در اپ اندروید (file://) به دامنه‌ی پیش‌فرض برمی‌گردیم. */
    var base = 'https://farhadtest.ir';
    try {
      if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) {
        base = location.origin;
      }
    } catch (e) {}
    return base + '/i/' + profile.referralCode;
  }

  function inviteText() {
    return 'سلام! بیا تخته‌نرد آنلاین بازی کنیم 🎲\n' +
      'با کد معرف من ' + profile.referralCode + ' ثبت‌نام کن و ' +
      CONFIG.REFERRAL_BONUS_NEW.toLocaleString('fa-IR') + ' سکه هدیه بگیر:\n' + inviteLink();
  }

  /** ثبت کد معرف توسط کاربر جدید */
  function applyReferral(code) {
    code = (code || '').trim().toUpperCase();
    if (!code) return { ok: false, reason: 'کد را وارد کنید' };
    if (profile.referredBy) return { ok: false, reason: 'قبلاً کد معرف ثبت کرده‌اید' };
    if (code === profile.referralCode) return { ok: false, reason: 'نمی‌توانید کد خودتان را وارد کنید' };
    profile.referredBy = code;
    profile.coins += CONFIG.REFERRAL_BONUS_NEW;
    addTx('referral', CONFIG.REFERRAL_BONUS_NEW, 0, 'هدیه‌ی ثبت کد معرف');
    save();
    return { ok: true, coins: CONFIG.REFERRAL_BONUS_NEW };
  }

  /** وقتی سرور تأیید می‌کند یکی با کد ما ثبت‌نام کرده */
  function creditReferral(n) {
    n = n || 1;
    profile.invitedCount += n;
    profile.energy += CONFIG.REFERRAL_ENERGY * n;
    profile.coins += CONFIG.REFERRAL_COINS * n;
    addTx('referral', CONFIG.REFERRAL_COINS * n, CONFIG.REFERRAL_ENERGY * n, 'پاداش دعوت از دوستان');
    save();
    return { energy: CONFIG.REFERRAL_ENERGY * n, coins: CONFIG.REFERRAL_COINS * n };
  }

  /* ------------------------------------------------ همگام‌سازی با سرور */

  /**
   * پروفایلی که سرور فرستاده را روی نسخه‌ی محلی می‌نشاند.
   * وقتی آنلاین هستیم، سرور منبع حقیقت است و این تابع تنها راه
   * تغییر موجودی در کلاینت است.
   */
  function applyServerProfile(p) {
    if (!p) return profile;
    profile.id = p.id || profile.id;
    profile.name = p.name || profile.name;
    profile.avatar = p.avatar || profile.avatar;
    profile.phone = p.phone || null;
    profile.verified = !p.isGuest;
    profile.coins = p.coins || 0;
    profile.energy = p.energy || 0;
    profile.xp = p.xp || 0;
    profile.skin = p.skin || 'classic';
    profile.skins = p.skins || ['classic'];
    profile.inventory = p.inventory || [];
    profile.referralCode = p.referralCode || profile.referralCode;
    profile.referredBy = p.referredBy || null;
    profile.invitedCount = p.invitedCount || 0;
    profile.welcomeTaken = !!p.welcomeTaken;
    profile.serverDaily = !!p.dailyAvailable;
    profile.banned = !!p.banned;
    profile.banReason = p.banReason || null;
    if (p.stats) {
      profile.stats.games = p.stats.games || 0;
      profile.stats.wins = p.stats.wins || 0;
      profile.stats.losses = p.stats.losses || 0;
      profile.stats.mars = p.stats.mars || 0;
      profile.stats.bestWin = p.stats.bestWin || 0;
      profile.stats.coinsWon = p.stats.coinsWon || 0;
      profile.stats.coinsLost = p.stats.coinsLost || 0;
    }
    save();
    return profile;
  }

  /** آیا اپ در حالت آنلاین است؟ (سرور موجودی را نگه می‌دارد) */
  function isOnline() {
    return !!(root.API && root.API.online);
  }

  /* ---------------------------------------------------------- ابزارها */

  function fa(n) {
    return Number(n || 0).toLocaleString('fa-IR');
  }

  function faDate(ts) {
    try {
      return new Date(ts).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) { return ''; }
  }

  return {
    CONFIG: CONFIG, ROOMS: ROOMS, COIN_PACKS: COIN_PACKS, PRIZES: PRIZES, AVATARS: AVATARS, SKINS: SKINS,
    skinById: skinById, ownsSkin: ownsSkin, skinLockReason: skinLockReason,
    buySkin: buySkin, equipSkin: equipSkin, skinForRoom: skinForRoom,
    load: load, save: save, get: get, on: on,
    levelOf: levelOf,
    addCoins: addCoins, addEnergy: addEnergy, addXp: addXp,
    claimWelcome: claimWelcome, dailyAvailable: dailyAvailable, claimDaily: claimDaily,
    roomById: roomById, roomHasRake: roomHasRake, roomEconomy: roomEconomy,
    energyForEntry: energyForEntry, canAfford: canAfford,
    enterRoom: enterRoom, refundRoom: refundRoom, settleGame: settleGame,
    packTotal: packTotal, completePurchase: completePurchase, sellCoins: sellCoins,
    prizeById: prizeById, redeemPrize: redeemPrize,
    inviteLink: inviteLink, inviteText: inviteText,
    applyReferral: applyReferral, creditReferral: creditReferral,
    applyServerProfile: applyServerProfile, isOnline: isOnline,
    fa: fa, faDate: faDate
  };
});
