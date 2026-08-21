package com.quay.ops;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Binder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.webkit.WebView;

import androidx.core.app.NotificationCompat;

/**
 * Foreground service that keeps Quay's transfer engine alive in the background.
 * Holds a partial wake lock while jobs are active and updates the status notification.
 */
public class QuayService extends Service {

    public static final String CHANNEL_ID = "quay_transfers";
    public static final int NOTIFICATION_ID = 4201;

    private final IBinder binder = new LocalBinder();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private boolean uiVisible = true;
    private PowerManager.WakeLock wakeLock;
    private int activeJobs;
    private int waitingJobs;
    private String statusLine = "Quay standby";

    public class LocalBinder extends Binder {
        QuayService getService() {
            return QuayService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "quay:transfers");
            wakeLock.setReferenceCounted(false);
        }
        startForeground(NOTIFICATION_ID, buildNotification("Quay ready", "Transfer service running"));
        handler.postDelayed(statusTicker, 2000);
    }

    private final Runnable statusTicker = new Runnable() {
        @Override
        public void run() {
            if (webView != null) {
                webView.evaluateJavascript(
                        "(function(){try{" +
                        "if(typeof window.__quayStatus==='function')return window.__quayStatus();" +
                        "if(window.__QUAY_STATE){var s=window.__QUAY_STATE;" +
                        "var live=(s.jobs||[]).filter(function(j){return j.status==='transferring'}).length;" +
                        "var wait=(s.jobs||[]).filter(function(j){return j.status==='waiting'}).length;" +
                        "return JSON.stringify({live:live,wait:wait});}" +
                        "return null;}catch(e){return null;}})()",
                        value -> {
                            if (value != null && !value.equals("null") && value.length() > 2) {
                                parseStatus(value);
                            }
                        });
            }
            updateNotification();
            manageWakeLock();
            handler.postDelayed(this, 2500);
        }
    };

    private void parseStatus(String raw) {
        try {
            String cleaned = raw;
            if (cleaned.startsWith("\"") && cleaned.endsWith("\"")) {
                cleaned = cleaned.substring(1, cleaned.length() - 1)
                        .replace("\\\"", "\"");
            }
            int liveIdx = cleaned.indexOf("\"live\":");
            int waitIdx = cleaned.indexOf("\"wait\":");
            if (liveIdx >= 0) {
                activeJobs = extractInt(cleaned, liveIdx + 7);
            }
            if (waitIdx >= 0) {
                waitingJobs = extractInt(cleaned, waitIdx + 7);
            }
            if (activeJobs > 0) {
                statusLine = activeJobs + " transferring" +
                        (waitingJobs > 0 ? " · " + waitingJobs + " waiting" : "");
            } else if (waitingJobs > 0) {
                statusLine = waitingJobs + " waiting in queue";
            } else {
                statusLine = "Idle · schedules armed";
            }
        } catch (Exception ignored) {
        }
    }

    private int extractInt(String s, int from) {
        int i = from;
        while (i < s.length() && (s.charAt(i) == ' ' || s.charAt(i) == ':')) i++;
        int j = i;
        while (j < s.length() && Character.isDigit(s.charAt(j))) j++;
        if (j > i) return Integer.parseInt(s.substring(i, j));
        return 0;
    }

    private void manageWakeLock() {
        if (wakeLock == null) return;
        if (activeJobs > 0 || waitingJobs > 0) {
            if (!wakeLock.isHeld()) wakeLock.acquire(60 * 60 * 1000L);
        } else {
            if (wakeLock.isHeld()) wakeLock.release();
        }
    }

    public void attachWebView(WebView wv) {
        this.webView = wv;
    }

    public void setUiVisible(boolean visible) {
        this.uiVisible = visible;
        updateNotification();
    }

    public void updateJobCounts(int live, int wait) {
        this.activeJobs = live;
        this.waitingJobs = wait;
        updateNotification();
        manageWakeLock();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Quay transfers",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Background queue and schedule runner");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification(String title, String body) {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(
                this, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(R.drawable.ic_quay_notification)
                .setContentIntent(pi)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void updateNotification() {
        String title = activeJobs > 0 ? "Quay · transferring" : "Quay · background";
        Notification n = buildNotification(title, statusLine);
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIFICATION_ID, n);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, buildNotification("Quay ready", statusLine));
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(statusTicker);
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        super.onDestroy();
    }
}
