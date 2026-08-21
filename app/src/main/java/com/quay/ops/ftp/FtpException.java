package com.quay.ops.ftp;

public class FtpException extends Exception {
    public final int code;

    public FtpException(String message) {
        super(message);
        this.code = 0;
    }

    public FtpException(int code, String message) {
        super(message);
        this.code = code;
    }

    public FtpException(String message, Throwable cause) {
        super(message, cause);
        this.code = 0;
    }
}
