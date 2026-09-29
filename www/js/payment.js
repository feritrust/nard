/* =========================================================================
 *  payment.js — لایه‌ی پرداخت
 *
 *  در حالت پیش‌فرض «نمایشی» است و پرداخت را شبیه‌سازی می‌کند.
 *  برای اتصال درگاه واقعی (زرین‌پال، بازار، ایدی‌پی و …) فقط کافی است
 *  تابع purchase را طبق نمونه‌های پایین تکمیل کنید.
 * ========================================================================= */
(function (root) {
  'use strict';

  var MODE = 'demo';    // 'demo' | 'zarinpal' | 'bazaar'

  var ZARINPAL = {
    merchantId: '',                                  // کد پذیرنده‌ی خود را اینجا بگذارید
    apiBase: 'https://api.zarinpal.com/pg/v4/payment',
    callbackUrl: 'https://your-domain.com/pay/callback',
    // آدرس بک‌اند خودتان که درخواست را امضا می‌کند (نباید merchantId در اپ باشد)
    backend: ''                                      // مثال: 'https://api.your-domain.com'
  };

  /* ---------------------------------------------------------- نمایشی */

  function demoPurchase(pack) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve({ ok: true, refId: 'DEMO' + Date.now().toString(36).toUpperCase() });
      }, 1200);
    });
  }

  /* -------------------------------------------------- زرین‌پال (نمونه) */

  /*
   *  جریان درست و امن:
   *   ۱) اپ به بک‌اند شما می‌گوید «کاربر X می‌خواهد بسته‌ی Y را بخرد»
   *   ۲) بک‌اند با merchantId خودش از زرین‌پال Authority می‌گیرد
   *   ۳) اپ کاربر را به صفحه‌ی پرداخت می‌برد
   *   ۴) بعد از بازگشت، بک‌اند تراکنش را verify می‌کند و سکه را واریز می‌کند
   *
   *  هرگز merchantId را داخل اپ اندروید قرار ندهید.
   */
  function zarinpalPurchase(pack) {
    if (!ZARINPAL.backend) {
      return Promise.resolve({ ok: false, message: 'آدرس بک‌اند پرداخت تنظیم نشده است' });
    }
    var profile = root.Store ? root.Store.get() : {};
    return fetch(ZARINPAL.backend + '/pay/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId: pack.id, userId: profile.id, amount: pack.price })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok || !d.paymentUrl) return { ok: false, message: d.message || 'خطا در ایجاد تراکنش' };
        // باز کردن صفحه‌ی درگاه
        if (root.AndroidBridge && root.AndroidBridge.openUrl) root.AndroidBridge.openUrl(d.paymentUrl);
        else root.open(d.paymentUrl, '_blank');
        // نتیجه‌ی نهایی از طریق پول‌کردن وضعیت یا بازگشت به اپ مشخص می‌شود
        return pollStatus(d.authority);
      })
      .catch(function () { return { ok: false, message: 'ارتباط با درگاه برقرار نشد' }; });
  }

  function pollStatus(authority) {
    var tries = 0;
    return new Promise(function (resolve) {
      var t = setInterval(function () {
        tries++;
        fetch(ZARINPAL.backend + '/pay/status?authority=' + encodeURIComponent(authority))
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.status === 'paid') { clearInterval(t); resolve({ ok: true, refId: d.refId }); }
            else if (d.status === 'failed' || tries > 60) { clearInterval(t); resolve({ ok: false, message: 'پرداخت انجام نشد' }); }
          })
          .catch(function () { if (tries > 60) { clearInterval(t); resolve({ ok: false, message: 'خطای شبکه' }); } });
      }, 3000);
    });
  }

  /* ------------------------------------------- خرید درون‌برنامه‌ای بازار */

  function bazaarPurchase(pack) {
    if (root.AndroidBridge && root.AndroidBridge.purchase) {
      return new Promise(function (resolve) {
        root.__onPurchaseResult = function (json) {
          var d = {};
          try { d = JSON.parse(json); } catch (e) {}
          resolve(d.ok ? { ok: true, refId: d.token } : { ok: false, message: d.message || 'خرید لغو شد' });
        };
        root.AndroidBridge.purchase(pack.id);
      });
    }
    return Promise.resolve({ ok: false, message: 'خرید درون‌برنامه‌ای در دسترس نیست' });
  }

  /* ------------------------------------------------------------ خروجی */

  function purchase(pack) {
    if (MODE === 'zarinpal') return zarinpalPurchase(pack);
    if (MODE === 'bazaar') return bazaarPurchase(pack);
    return demoPurchase(pack);
  }

  root.Payment = { purchase: purchase, mode: MODE, config: { ZARINPAL: ZARINPAL } };

})(typeof self !== 'undefined' ? self : this);
