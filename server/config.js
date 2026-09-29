/* =========================================================================
 *  config.js — منبع حقیقت اتاق‌ها، بسته‌ها، جوایز و پوسته‌ها
 *
 *  سرور این را به کلاینت می‌دهد (‎/api/config‎) تا اگر قیمتی را از پنل
 *  عوض کردید، لازم نباشد نسخه‌ی جدید اپ منتشر کنید.
 * ========================================================================= */
'use strict';

const ROOMS = [
  { id: 'r100',    name: 'اتاق مبتدی',   entry: 100,    icon: '🌱', color: '#4ade80', minLevel: 1 },
  { id: 'r500',    name: 'اتاق برنزی',   entry: 500,    icon: '🥉', color: '#d97706', minLevel: 1 },
  { id: 'r1000',   name: 'اتاق نقره‌ای',  entry: 1000,   icon: '🥈', color: '#94a3b8', minLevel: 2 },
  { id: 'r5000',   name: 'اتاق طلایی',   entry: 5000,   icon: '🥇', color: '#fbbf24', minLevel: 3, skin: 'emerald' },
  { id: 'r25000',  name: 'اتاق الماس',   entry: 25000,  icon: '💎', color: '#38bdf8', minLevel: 5, skin: 'royalgold' },
  { id: 'r100000', name: 'اتاق افسانه‌ای', entry: 100000, icon: '👑', color: '#a78bfa', minLevel: 8, skin: 'dragon' }
];

const COIN_PACKS = [
  { id: 'p1', coins: 5000,    price: 19000,   bonus: 0,   icon: '💰', tag: '' },
  { id: 'p2', coins: 15000,   price: 49000,   bonus: 10,  icon: '💰', tag: '۱۰٪ هدیه' },
  { id: 'p3', coins: 50000,   price: 149000,  bonus: 20,  icon: '🪙', tag: '۲۰٪ هدیه' },
  { id: 'p4', coins: 150000,  price: 399000,  bonus: 30,  icon: '🏆', tag: 'محبوب‌ترین' },
  { id: 'p5', coins: 500000,  price: 1190000, bonus: 40,  icon: '👑', tag: '۴۰٪ هدیه' },
  { id: 'p6', coins: 1500000, price: 2990000, bonus: 50,  icon: '💎', tag: 'بهترین ارزش' }
];

const PRIZES = [
  { id: 'z1', name: '۲٬۰۰۰ سکه',        energy: 100,    type: 'coins', value: 2000,  icon: '🪙' },
  { id: 'z2', name: '۱۰٬۰۰۰ سکه',       energy: 450,    type: 'coins', value: 10000, icon: '💰' },
  { id: 'z3', name: '۵۰٬۰۰۰ سکه',       energy: 2000,   type: 'coins', value: 50000, icon: '💎' },
  { id: 'z4', name: 'قاب پروفایل طلایی',  energy: 800,    type: 'item',  value: 'frame_gold', icon: '🖼️' },
  { id: 'z5', name: 'نشان VIP (۳۰ روز)',  energy: 3000,   type: 'item',  value: 'vip_30',     icon: '⭐' },
  { id: 'z6', name: 'شارژ ۲۰٬۰۰۰ تومانی', energy: 6000,   type: 'real',  value: 'charge_20k', icon: '📱' },
  { id: 'z7', name: 'شارژ ۵۰٬۰۰۰ تومانی', energy: 14000,  type: 'real',  value: 'charge_50k', icon: '📲' },
  { id: 'z8', name: 'هدفون بی‌سیم',       energy: 60000,  type: 'real',  value: 'headphone',  icon: '🎧' },
  { id: 'z9', name: 'گوشی هوشمند',        energy: 400000, type: 'real',  value: 'phone',      icon: '📦' }
];

const SKINS = [
  { id: 'classic',   name: 'کلاسیک',         desc: 'چوب گردویی و نمد سبز — همان تخته‌ی همیشگی', price: 0, currency: 'coins', free: true },
  { id: 'walnut',    name: 'گردوی شب',       desc: 'چوب تیره و نمد سرمه‌ای', price: 0, currency: 'coins', minLevel: 3 },
  { id: 'yalda',     name: 'شب یلدا',        desc: 'انار و زرشک — گرم و ایرانی', price: 5000, currency: 'coins' },
  { id: 'turquoise', name: 'فیروزه‌ی اصفهان', desc: 'فیروزه‌ای و طلایی، الهام از کاشی‌کاری', price: 15000, currency: 'coins' },
  { id: 'marble',    name: 'مرمر سفید',       desc: 'سنگ مرمر و نمد یشمی — مینیمال و تمیز', price: 40000, currency: 'coins' },
  { id: 'emerald',   name: 'زمرد سلطنتی',     desc: 'مشکی و زمردی با مهره‌های طلایی', price: 900, currency: 'energy', room: 'r5000' },
  { id: 'royalgold', name: 'طلای ناب',        desc: 'قاب طلایی روی نمد مشکی', price: 150000, currency: 'coins', room: 'r25000' },
  { id: 'neon',      name: 'کهکشان نئون',     desc: 'فیروزه‌ای و بنفش درخشان', price: 2500, currency: 'energy' },
  { id: 'dragon',    name: 'اژدهای سرخ',      desc: 'لاکِ سرخ و طلا — نادرترین پوسته', price: 400000, currency: 'coins', room: 'r100000' }
];

const byId = (list) => (id) => list.find((x) => x.id === id) || null;

module.exports = {
  ROOMS, COIN_PACKS, PRIZES, SKINS,
  roomById: byId(ROOMS),
  packById: byId(COIN_PACKS),
  prizeById: byId(PRIZES),
  skinById: byId(SKINS),
  packTotal: (pack) => Math.round(pack.coins * (1 + pack.bonus / 100))
};
