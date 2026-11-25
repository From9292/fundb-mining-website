package com.fundb.mining.preview

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
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView

/**
 * Thin Android host for the existing FundB PWA.
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

    private val appHost = "fundb-production-hardening.fundb-mining-website.pages.dev"
    private val appUrl = "https://$appHost/"

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
