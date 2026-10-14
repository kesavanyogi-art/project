package com.college.ems.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Creates in-app notifications (bell icon in the top bar). */
@Component
public class Notifier {
    @Autowired private JdbcTemplate db;

    public void toAdmins(String message) {
        db.update("INSERT INTO notifications (user_id, message) SELECT id, ? FROM users WHERE role='ADMIN'", message);
    }
    public void toUser(long userId, String message) {
        db.update("INSERT INTO notifications (user_id, message) VALUES (?, ?)", userId, message);
    }
    public void toEmployee(long employeeId, String message) {
        db.update("INSERT INTO notifications (user_id, message) SELECT user_id, ? FROM employees WHERE id=?", message, employeeId);
    }
}
