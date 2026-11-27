package com.fundb.mining

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.os.Bundle
import android.view.View
import android.webkit.SslErrorHandler
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.gms.ads.FullScreenContentCallback

/**
 * Thin Android host for the existing FundB PWA.
 *
 * The preview build includes a native Google test rewarded-ad control only.
 * It deliberately does not credit points or start mining. A production reward
 * flow requires server-side verification and an approved, policy-compliant
 * reward programme before any user balance can be changed.
 *
 * Security boundaries:
 * - Only the configured HTTPS FundB Pages host is rendered in this WebView.
 * - No JavaScript bridge is exposed to the web page.
 * - External links are handed to Android's browser.
 * - SSL certificate errors are always cancelled.
 * - Wallet keys and signing are deliberately not implemented in this host.
 */
class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    private lateinit var status: TextView
    private var rewardedAd: RewardedAd? = null
    private var adStatus: TextView? = null
    private var testAdButton: Button? = null

    private val appHost = "fundb-production-hardening.fundb-mining-website.pages.dev"
    private val appUrl = "https://$appHost/"

    // Google's official sample rewarded-ad unit. Never replace with a live unit for testing.
    private val testRewardedAdUnitId = "ca-app-pub-3940256099942544/5224354917"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(android.graphics.Color.rgb(12, 12, 12))
        }
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal)
        status = TextView(this).apply {
            text = "Connecting securely to FundB Mining…"
            setTextColor(android.graphics.Color.WHITE)
            setPadding(24, 18, 24, 18)
            visibility = View.GONE
        }
        webView = WebView(this)
        root.addView(progress, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 4
        ))
        root.addView(status)
        // Test-only UI is present in debug APKs, never in release builds.
        if (BuildConfig.DEBUG) {
            val testPanel = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(16, 8, 16, 10)
                setBackgroundColor(android.graphics.Color.rgb(24, 24, 24))
            }
            adStatus = TextView(this).apply {
                text = "FUNDB ADMOB TEST — DEBUG BUILD"
                setTextColor(android.graphics.Color.LTGRAY)
                textSize = 12f
                setPadding(4, 2, 4, 8)
            }
            testAdButton = Button(this).apply {
                text = "Load Google test rewarded ad"
                isEnabled = false
                setOnClickListener { showTestRewardedAd() }
            }
            testPanel.addView(adStatus)
            testPanel.addView(testAdButton)
            root.addView(testPanel, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ))
        }

        root.addView(webView, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
        ))




        setContentView(root)

        webView.settings.apply {
            javaScriptEnabled = true // Required by the existing PWA UI.
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val uri = request.url
                if (uri.scheme == "https" && uri.host == appHost) return false
                if (uri.scheme == "https" || uri.scheme == "http") {
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                }
                return true
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                progress.visibility = View.VISIBLE
                status.visibility = View.GONE
            }

            override fun onPageFinished(view: WebView, url: String?) {
                progress.visibility = View.GONE
            }

            override fun onReceivedSslError(
                view: WebView,
                handler: SslErrorHandler,
                error: android.net.http.SslError
            ) {
                handler.cancel()
                showConnectionError("Secure connection could not be verified. Please try again later.")
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                if (request.isForMainFrame) {
                    showConnectionError("FundB could not load. Check your internet connection and retry.")
                }
            }
        }

        if (savedInstanceState == null) {
            webView.loadUrl(appUrl)
        } else {
            webView.restoreState(savedInstanceState)
        }

        MobileAds.initialize(this) {
            if (BuildConfig.DEBUG) {
                runOnUiThread {
                    adStatus?.text = "AdMob SDK initialized. Loading Google's test rewarded ad…"
                    loadTestRewardedAd()
                }
            }
        }
    }

    private fun loadTestRewardedAd() {
        if (!BuildConfig.DEBUG) return
        testAdButton?.isEnabled = false
        adStatus?.text = "Loading Google's test rewarded ad…"
        RewardedAd.load(
            this,
            testRewardedAdUnitId,
            AdRequest.Builder().build(),
            object : RewardedAdLoadCallback() {
                override fun onAdLoaded(ad: RewardedAd) {
                    rewardedAd = ad
                    adStatus?.text = "Test ad ready. Watching it will NOT add FundB points."
                    testAdButton?.text = "Show test rewarded ad"
                    testAdButton?.isEnabled = true
                    ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                        override fun onAdDismissedFullScreenContent() {
                            rewardedAd = null
                            testAdButton?.isEnabled = false
                            testAdButton?.text = "Load test rewarded ad"
                            loadTestRewardedAd()
                        }

                        override fun onAdFailedToShowFullScreenContent(error: com.google.android.gms.ads.AdError) {
                            rewardedAd = null
                            adStatus?.text = "Test ad could not be shown: ${error.message}"
                            testAdButton?.isEnabled = false
                            testAdButton?.text = "Retry test rewarded ad"
                            testAdButton?.setOnClickListener { loadTestRewardedAd() }
                        }
                    }
                }

                override fun onAdFailedToLoad(error: LoadAdError) {
                    rewardedAd = null
                    adStatus?.text = "Test ad not ready: ${error.message}. Check internet and retry."
                    testAdButton?.text = "Retry loading test ad"
                    testAdButton?.isEnabled = true
                    testAdButton?.setOnClickListener { loadTestRewardedAd() }
                }
            }
        )
    }

    private fun showTestRewardedAd() {
        val ad = rewardedAd
        if (ad == null) {
            loadTestRewardedAd()
            return
        }
        testAdButton?.isEnabled = false
        ad.show(this) {
            // Intentionally no points, wallet balance, or mining credit in preview.
            adStatus?.text = "Google test reward callback received. No FundB points were credited."
        }
    }

    private fun showConnectionError(message: String) {
        progress.visibility = View.GONE
        status.text = "$message\n\nReopen FundB Mining to retry."
        status.visibility = View.VISIBLE
    }

    @Deprecated("Use system back navigation when migrating to AndroidX")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.destroy()
        }
        super.onDestroy()
    }
}
