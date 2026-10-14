package com.college.ems.middleware;

import com.college.ems.models.ApiException;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Time;
import java.util.Map;

/** Server-side validation helpers (the browser also validates, but never trust the browser). */
public class Validator {

    public static String s(Map<String, Object> m, String key) {
        Object v = m.get(key);
        return v == null ? "" : v.toString().trim();
    }

    public static void required(Map<String, Object> m, String... keys) {
        for (String k : keys)
            if (s(m, k).isEmpty()) throw new ApiException(400, label(k) + " is required.");
    }

    private static String label(String k) {
        String t = k.replace('_', ' ');
        return Character.toUpperCase(t.charAt(0)) + t.substring(1);
    }

    public static void email(String e) {
        if (!e.matches("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"))
            throw new ApiException(400, "Please enter a valid email address.");
    }

    public static void phone(String p) {
        if (!p.matches("^\\+?[0-9]{10,13}$"))
            throw new ApiException(400, "Phone number must contain 10 to 13 digits.");
    }

    public static void password(String p) {
        if (!p.matches("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$"))
            throw new ApiException(400, "Password must be at least 8 characters with uppercase, lowercase, number and special character.");
    }

    public static Date date(String v, String name) {
        try { return Date.valueOf(v); }
        catch (Exception e) { throw new ApiException(400, name + " must be a valid date (YYYY-MM-DD)."); }
    }

    public static Time time(String v) {
        if (v == null || v.isBlank()) return null;
        try { return Time.valueOf(v.length() == 5 ? v + ":00" : v); }
        catch (Exception e) { throw new ApiException(400, "Time must be in HH:MM format."); }
    }

    public static BigDecimal money(Map<String, Object> m, String key) {
        String v = s(m, key);
        if (v.isEmpty()) return BigDecimal.ZERO;
        try {
            BigDecimal b = new BigDecimal(v);
            if (b.signum() < 0) throw new NumberFormatException();
            return b;
        } catch (NumberFormatException e) {
            throw new ApiException(400, label(key) + " must be a positive number.");
        }
    }

    public static void oneOf(String v, String name, String... allowed) {
        for (String a : allowed) if (a.equals(v)) return;
        throw new ApiException(400, "Invalid " + name + ".");
    }
}
