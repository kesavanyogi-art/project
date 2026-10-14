package com.college.ems.models;

/** The logged-in user (kept in memory while the token is valid). */
public record AuthUser(long userId, String username, String email, String role, Long employeeId) {
    public boolean isAdmin() { return "ADMIN".equals(role); }
}
