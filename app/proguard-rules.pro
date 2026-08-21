# Quay — keep WebView bridge
-keepclassmembers class com.quay.ops.QuayBridge {
    @android.webkit.JavascriptInterface <methods>;
}
