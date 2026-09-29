#!/usr/bin/env node
/* =========================================================================
 *  create-admin.js — ساخت اولین ادمین
 *
 *  استفاده:
 *    node create-admin.js <نام‌کاربری> <رمز> [owner|admin]
 *
 *  بعد از ساخت، یک نشانی otpauth:// می‌دهد. آن را با Google Authenticator
 *  یا هر اپ مشابهی اسکن کنید و همان بار اول که وارد پنل شدید فعالش کنید.
 * ========================================================================= */
'use strict';
const D = require('./db.js');

const [, , username, password, role] = process.argv;

if (!username || !password) {
  console.log('استفاده:  node create-admin.js <نام‌کاربری> <رمز> [owner|admin]');
  process.exit(1);
}
if (password.length < 10) {
  console.log('❌ رمز باید حداقل ۱۰ کاراکتر باشد.');
  process.exit(1);
}
if (D.getAdmin(username)) {
  console.log('❌ این نام کاربری از قبل وجود دارد.');
  process.exit(1);
}

const a = D.createAdmin(username, password, role === 'owner' ? 'owner' : 'admin');

console.log('');
console.log('✅ ادمین ساخته شد:', a.username, '(' + (role === 'owner' ? 'مالک' : 'ادمین') + ')');
console.log('');
console.log('کد دو مرحله‌ای — این نشانی را در Google Authenticator اسکن یا وارد کنید:');
console.log('');
console.log('  ' + D.totpUri(a.username, a.totpSecret));
console.log('');
console.log('یا کد دستی:  ' + a.totpSecret);
console.log('');
console.log('⚠️  بعد از اولین ورود به پنل، حتماً دو مرحله‌ای را فعال کنید.');
console.log('');
