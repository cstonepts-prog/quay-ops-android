package com.quay.ops;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.webkit.JavascriptInterface;

/**
 * JS bridge: window.QuayNative.* from the WebView.
 */
public class QuayBridge {
    private final MainActivity activity;

    public QuayBridge(MainActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public String platform() {
        return "android";
    }

    @JavascriptInterface
    public int sdkInt() {
        return Build.VERSION.SDK_INT;
    }

    @JavascriptInterface
    public void toast(String message) {
        activity.toast(message);
    }

    @JavascriptInterface
    public void startBackground() {
        Intent i = new Intent(activity, QuayService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            activity.startForegroundService(i);
        } else {
            activity.startService(i);
        }
    }

    @JavascriptInterface
    public void reportStatus(int live, int waiting) {
        Intent i = new Intent(activity, QuayService.class);
        activity.runOnUiThread(() -> {
        });
    }

    @JavascriptInterface
    public boolean isAndroid() {
        return true;
    }
}
