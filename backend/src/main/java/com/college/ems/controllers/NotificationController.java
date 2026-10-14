package com.college.ems.controllers;

import com.college.ems.models.AuthUser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    @Autowired private JdbcTemplate db;

    @GetMapping
    public Map<String, Object> list(@RequestAttribute("user") AuthUser user) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("items", db.queryForList("SELECT id, message, is_read, created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 15", user.userId()));
        m.put("unread", db.queryForObject("SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=0", Integer.class, user.userId()));
        return m;
    }

    @PutMapping("/read-all")
    public Map<String, String> readAll(@RequestAttribute("user") AuthUser user) {
        db.update("UPDATE notifications SET is_read=1 WHERE user_id=?", user.userId());
        return Map.of("message", "Notifications marked as read.");
    }
}
