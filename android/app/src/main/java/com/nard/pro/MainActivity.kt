package com.nard.pro

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

/**
 * پوسته‌ی اندروید برای اپ تخته‌نرد.
 * تمام بازی داخل WebView و از روی فایل‌های assets/www اجرا می‌شود.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView

    /** اگر می‌خواهید اپ به سرور آنلاین وصل شود، اینجا نشانی را بگذارید. */
    private val defaultServerUrl = ""      // مثال: "wss://nard.example.com"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setTheme(R.style.Theme_Nard)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#0b1220"))
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        web = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#0b1220"))
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
            )
            overScrollMode = View.OVER_SCROLL_NEVER
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
        }

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true                 // برای localStorage (کیف پول و پروفایل)
            databaseEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = true
            allowContentAccess = true
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                android.util.Log.d("NardWeb", "${m.message()} @${m.lineNumber()}")
                return true
            }
        }

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(v: WebView, req: WebResourceRequest): Boolean {
                val u = req.url.toString()
                // لینک‌های بیرونی در مرورگر باز شوند، نه داخل اپ
                return if (u.startsWith("http://") || u.startsWith("https://")) {
                    openExternal(u); true
                } else false
            }

            override fun onPageFinished(view: WebView, url: String) {
                if (defaultServerUrl.isNotEmpty()) {
                    view.evaluateJavascript(
                        """(function(){
                             try {
                               if (!localStorage.getItem('nard_server')) {
                                 localStorage.setItem('nard_server', '$defaultServerUrl');
                                 if (window.Net) Net.config.serverUrl = '$defaultServerUrl';
                               }
                             } catch(e) {}
                           })();""".trimIndent(), null
                    )
                }
                handleDeepLink(intent)
            }
        }

        web.addJavascriptInterface(Bridge(), "AndroidBridge")

        root.addView(web)
        setContentView(root)

        // فاصله‌ی امن بالا و پایین صفحه (notch و نوار ناوبری)
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(0, 0, 0, 0)
            web.evaluateJavascript(
                "document.documentElement.style.setProperty('--safe-top','${px2dp(bars.top)}px');" +
                "document.documentElement.style.setProperty('--safe-bottom','${px2dp(bars.bottom)}px');",
                null
            )
            insets
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                web.evaluateJavascript("(window.onAndroidBack && window.onAndroidBack()) ? '1' : '0'") { r ->
                    if (r == null || r.trim('"') != "1") finish()
                }
            }
        })

        web.loadUrl("file:///android_asset/www/index.html")
    }

    private fun px2dp(px: Int): Int = (px / resources.displayMetrics.density).toInt()

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    /** اگر اپ از طریق لینک دعوت باز شده باشد، کد معرف را به صفحه می‌فرستیم. */
    private fun handleDeepLink(intent: Intent?) {
        val data = intent?.data ?: return
        val code = data.lastPathSegment ?: return
        if (code.isBlank()) return
        web.evaluateJavascript(
            "(function(){ try { var i=document.getElementById('in-ref'); if(i && !i.value) i.value='$code';" +
            "var j=document.getElementById('in-ref2'); if(j && !j.value) j.value='$code'; } catch(e){} })();",
            null
        )
    }

    private fun openExternal(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (_: Exception) { }
    }

    override fun onPause() { super.onPause(); web.onPause() }
    override fun onResume() { super.onResume(); web.onResume() }
    override fun onDestroy() { web.destroy(); super.onDestroy() }

    /** پلی که از داخل جاوااسکریپت صدا زده می‌شود: window.AndroidBridge */
    inner class Bridge {

        @JavascriptInterface
        fun share(text: String) {
            runOnUiThread {
                val i = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                }
                startActivity(Intent.createChooser(i, "دعوت از دوستان"))
            }
        }

        @JavascriptInterface
        fun openUrl(url: String) { runOnUiThread { openExternal(url) } }

        @JavascriptInterface
        fun exitApp() { runOnUiThread { finish() } }

        @JavascriptInterface
        fun appVersion(): String = try {
            packageManager.getPackageInfo(packageName, 0).versionName ?: "1.0.0"
        } catch (e: Exception) { "1.0.0" }

        /**
         * محل اتصال خرید درون‌برنامه‌ای (کافه‌بازار / مایکت / گوگل‌پلی).
         * پس از اتمام خرید، نتیجه را به جاوااسکریپت برگردانید:
         *   web.evaluateJavascript("window.__onPurchaseResult('{\"ok\":true,\"token\":\"...\"}')", null)
         */
        @JavascriptInterface
        fun purchase(packId: String) {
            runOnUiThread {
                val json = """{"ok":false,"message":"خرید درون‌برنامه‌ای هنوز پیکربندی نشده است"}"""
                web.evaluateJavascript("window.__onPurchaseResult && window.__onPurchaseResult('$json')", null)
            }
        }
    }
}
