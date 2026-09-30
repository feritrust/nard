#!/usr/bin/env node
/* =========================================================================
 *  reset-db.js — پاک کردن دیتابیس و شروع از نو
 *
 *  اول یک پشتیبان کامل می‌گیرد، بعد پاک می‌کند. پشتیبان دست‌نخورده
 *  می‌ماند، پس اگر پشیمان شدید می‌توانید برگردانید.
 *
 *  اجرا:  node server/reset-db.js
 * ========================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.NARD_DATA || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'nard.db');

if (!fs.existsSync(DB_FILE)) {
  console.log('دیتابیسی وجود ندارد — سرور خودش موقع اجرا می‌سازدش.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = path.join(DATA_DIR, 'old');
fs.mkdirSync(backupDir, { recursive: true });

let moved = 0;
for (const suffix of ['', '-wal', '-shm']) {
  const src = DB_FILE + suffix;
  if (!fs.existsSync(src)) continue;
  const dst = path.join(backupDir, `nard-${stamp}.db${suffix}`);
  fs.renameSync(src, dst);
  console.log('  پشتیبان: ' + dst);
  moved++;
}

console.log(`\n✅ ${moved} فایل کنار گذاشته شد. دیتابیس تازه با اجرای بعدی سرور ساخته می‌شود.\n`);
console.log('کارهای بعدی:');
console.log('  systemctl restart nard-server');
console.log("  cd server && node create-admin.js owner '<رمز>' owner\n");
