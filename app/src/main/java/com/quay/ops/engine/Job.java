package com.quay.ops.engine;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * One transfer / sync unit in the queue.
 */
public class Job {
    public static final String TYPE_UPLOAD = "upload";
    public static final String TYPE_DOWNLOAD = "download";
    public static final String TYPE_SYNC_UP = "sync_up";
    public static final String TYPE_SYNC_DOWN = "sync_down";
    public static final String TYPE_DELETE_REMOTE = "delete_remote";

    public static final String STATUS_WAITING = "waiting";
    public static final String STATUS_RUNNING = "running";
    public static final String STATUS_DONE = "done";
    public static final String STATUS_ERROR = "error";
    public static final String STATUS_CANCELLED = "cancelled";

    public String id;
    public String type;
    public String siteId;
    public String localPath;
    public String remotePath;
    public boolean deleteAfter;
    public String status;
    public long bytesDone;
    public long bytesTotal;
    public String error;
    public long createdAt;
    public long finishedAt;
    public String label;

    public Job() {}

    public static Job upload(String siteId, String local, String remote, boolean deleteAfter) {
        Job j = base(TYPE_UPLOAD, siteId);
        j.localPath = local;
        j.remotePath = remote;
        j.deleteAfter = deleteAfter;
        j.label = basename(local) + " \u2192 " + remote;
        return j;
    }

    public static Job download(String siteId, String remote, String local) {
        Job j = base(TYPE_DOWNLOAD, siteId);
        j.remotePath = remote;
        j.localPath = local;
        j.label = remote + " \u2192 " + basename(local);
        return j;
    }

    public static Job syncUp(String siteId, String localDir, String remoteDir, boolean deleteAfter) {
        Job j = base(TYPE_SYNC_UP, siteId);
        j.localPath = localDir;
        j.remotePath = remoteDir;
        j.deleteAfter = deleteAfter;
        j.label = "Sync \u2191 " + basename(localDir);
        return j;
    }

    public static Job syncDown(String siteId, String remoteDir, String localDir) {
        Job j = base(TYPE_SYNC_DOWN, siteId);
        j.remotePath = remoteDir;
        j.localPath = localDir;
        j.label = "Sync \u2193 " + basename(remoteDir);
        return j;
    }

    private static Job base(String type, String siteId) {
        Job j = new Job();
        j.id = "j" + System.currentTimeMillis() + "_" + (int) (Math.random() * 10000);
        j.type = type;
        j.siteId = siteId;
        j.status = STATUS_WAITING;
        j.createdAt = System.currentTimeMillis();
        j.bytesDone = 0;
        j.bytesTotal = 0;
        return j;
    }

    private static String basename(String p) {
        if (p == null) return "";
        int i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
        return i >= 0 ? p.substring(i + 1) : p;
    }

    public JSONObject toJson() throws JSONException {
        JSONObject o = new JSONObject();
        o.put("id", id);
        o.put("type", type);
        o.put("siteId", siteId);
        o.put("localPath", localPath == null ? "" : localPath);
        o.put("remotePath", remotePath == null ? "" : remotePath);
        o.put("deleteAfter", deleteAfter);
        o.put("status", status);
        o.put("bytesDone", bytesDone);
        o.put("bytesTotal", bytesTotal);
        o.put("error", error == null ? "" : error);
        o.put("createdAt", createdAt);
        o.put("finishedAt", finishedAt);
        o.put("label", label == null ? "" : label);
        return o;
    }

    public static Job fromJson(JSONObject o) {
        Job j = new Job();
        j.id = o.optString("id");
        j.type = o.optString("type");
        j.siteId = o.optString("siteId");
        j.localPath = o.optString("localPath");
        j.remotePath = o.optString("remotePath");
        j.deleteAfter = o.optBoolean("deleteAfter", false);
        j.status = o.optString("status", STATUS_WAITING);
        j.bytesDone = o.optLong("bytesDone", 0);
        j.bytesTotal = o.optLong("bytesTotal", 0);
        j.error = o.optString("error", null);
        j.createdAt = o.optLong("createdAt", 0);
        j.finishedAt = o.optLong("finishedAt", 0);
        j.label = o.optString("label", "");
        return j;
    }

    public int progressPercent() {
        if (bytesTotal <= 0) return 0;
        return (int) Math.min(100, (bytesDone * 100) / bytesTotal);
    }
}
