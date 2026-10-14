package com.college.ems.config;

import com.college.ems.models.AuthUser;
import org.springframework.stereotype.Component;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Simple in-memory token store. Token = random UUID, valid for 8 hours. */
@Component
public class TokenStore {
    private record Entry(AuthUser user, long expiresAt) {}
    private final Map<String, Entry> tokens = new ConcurrentHashMap<>();
    private final Map<String, Entry> resetTokens = new ConcurrentHashMap<>();
    private static final long EIGHT_HOURS = 8L * 60 * 60 * 1000;
    private static final long FIFTEEN_MIN = 15L * 60 * 1000;

    public String create(AuthUser user) {
        String t = UUID.randomUUID().toString();
        tokens.put(t, new Entry(user, System.currentTimeMillis() + EIGHT_HOURS));
        return t;
    }
    public AuthUser get(String token) {
        if (token == null) return null;
        Entry e = tokens.get(token);
        if (e == null) return null;
        if (e.expiresAt < System.currentTimeMillis()) { tokens.remove(token); return null; }
        return e.user;
    }
    public void remove(String token) { if (token != null) tokens.remove(token); }
    public void removeAllForUser(long userId, String exceptToken) {
        tokens.entrySet().removeIf(en -> en.getValue().user.userId() == userId && !en.getKey().equals(exceptToken));
    }

    public String createResetToken(AuthUser user) {
        String t = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        resetTokens.put(t, new Entry(user, System.currentTimeMillis() + FIFTEEN_MIN));
        return t;
    }
    public AuthUser useResetToken(String t) {
        if (t == null) return null;
        Entry e = resetTokens.remove(t.trim().toUpperCase());
        if (e == null || e.expiresAt < System.currentTimeMillis()) return null;
        return e.user;
    }
}
