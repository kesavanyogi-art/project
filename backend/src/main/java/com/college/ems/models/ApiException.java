package com.college.ems.models;

/** Thrown anywhere in the backend to return a friendly error message to the browser. */
public class ApiException extends RuntimeException {
    private final int status;
    public ApiException(int status, String message) { super(message); this.status = status; }
    public int getStatus() { return status; }
}
