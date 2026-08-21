package com.quay.ops.ftp;

/**
 * One entry from an FTP LIST / MLSD response.
 */
public class FtpEntry {
    public String name;
    public String path;
    public boolean isDirectory;
    public long size;
    public long modified;
    public String raw;

    public FtpEntry() {}

    public FtpEntry(String name, String path, boolean isDirectory, long size, long modified) {
        this.name = name;
        this.path = path;
        this.isDirectory = isDirectory;
        this.size = size;
        this.modified = modified;
    }

    public String toJson() {
        StringBuilder sb = new StringBuilder(128);
        sb.append('{');
        sb.append("\"name\":").append(jsonStr(name)).append(',');
        sb.append("\"path\":").append(jsonStr(path)).append(',');
        sb.append("\"isDirectory\":").append(isDirectory).append(',');
        sb.append("\"size\":").append(size).append(',');
        sb.append("\"modified\":").append(modified);
        sb.append('}');
        return sb.toString();
    }

    private static String jsonStr(String s) {
        if (s == null) return "null";
        StringBuilder b = new StringBuilder(s.length() + 8);
        b.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"':  b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                default:
                    if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
                    else b.append(c);
            }
        }
        b.append('"');
        return b.toString();
    }
}
