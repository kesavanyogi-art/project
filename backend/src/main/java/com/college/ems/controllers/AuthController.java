package com.college.ems.controllers;

import com.college.ems.config.TokenStore;
import com.college.ems.middleware.Validator;
import com.college.ems.models.ApiException;
import com.college.ems.models.AuthUser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.*;

import static com.college.ems.middleware.Validator.s;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @Autowired private JdbcTemplate db;
    @Autowired private TokenStore tokens;
    @Autowired private BCryptPasswordEncoder encoder;

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, Object> body) {
        String email = s(body, "email").toLowerCase(), password = s(body, "password");
        if (email.isEmpty() || password.isEmpty()) throw new ApiException(400, "Email and password are required.");

        List<Map<String, Object>> rows = db.queryForList(
            "SELECT u.id, u.username, u.email, u.password, u.role, e.id AS employee_pk, e.status " +
            "FROM users u LEFT JOIN employees e ON e.user_id = u.id WHERE LOWER(u.email) = ?", email);
        if (rows.isEmpty() || !encoder.matches(password, (String) rows.get(0).get("password")))
            throw new ApiException(401, "Invalid login credentials.");

        Map<String, Object> r = rows.get(0);
        if ("EMPLOYEE".equals(r.get("role")) && !"Active".equals(r.get("status")))
            throw new ApiException(403, "Your account is deactivated. Please contact the admin.");

        Long empId = r.get("employee_pk") == null ? null : ((Number) r.get("employee_pk")).longValue();
        AuthUser user = new AuthUser(((Number) r.get("id")).longValue(), (String) r.get("username"),
                (String) r.get("email"), (String) r.get("role"), empId);
        String token = tokens.create(user);
        return Map.of("token", token, "user", userInfo(user));
    }

    @PostMapping("/logout")
    public Map<String, String> logout(@RequestAttribute("token") String token) {
        tokens.remove(token);
        return Map.of("message", "Logged out successfully.");
    }

    @GetMapping("/me")
    public Map<String, Object> me(@RequestAttribute("user") AuthUser user) {
        return userInfo(user);
    }

    private Map<String, Object> userInfo(AuthUser u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.userId()); m.put("username", u.username()); m.put("email", u.email());
        m.put("role", u.role()); m.put("employeeId", u.employeeId());
        String name = u.username();
        if (u.employeeId() != null) {
            List<String> n = db.queryForList("SELECT full_name FROM employees WHERE id=?", String.class, u.employeeId());
            if (!n.isEmpty()) name = n.get(0);
        }
        m.put("fullName", name);
        return m;
    }

    @PostMapping("/change-password")
    public Map<String, String> changePassword(@RequestAttribute("user") AuthUser user,
                                              @RequestAttribute("token") String token,
                                              @RequestBody Map<String, Object> body) {
        Validator.required(body, "currentPassword", "newPassword");
        String hash = db.queryForObject("SELECT password FROM users WHERE id=?", String.class, user.userId());
        if (!encoder.matches(s(body, "currentPassword"), hash)) throw new ApiException(400, "Current password is incorrect.");
        Validator.password(s(body, "newPassword"));
        db.update("UPDATE users SET password=? WHERE id=?", encoder.encode(s(body, "newPassword")), user.userId());
        tokens.removeAllForUser(user.userId(), token);
        return Map.of("message", "Password changed successfully.");
    }

    @PutMapping("/profile")
    public Map<String, String> updateProfile(@RequestAttribute("user") AuthUser user, @RequestBody Map<String, Object> body) {
        Validator.required(body, "username", "email");
        Validator.email(s(body, "email"));
        Integer dup = db.queryForObject("SELECT COUNT(*) FROM users WHERE LOWER(email)=LOWER(?) AND id<>?", Integer.class, s(body, "email"), user.userId());
        if (dup != null && dup > 0) throw new ApiException(409, "This email is already in use.");
        db.update("UPDATE users SET username=?, email=? WHERE id=?", s(body, "username"), s(body, "email"), user.userId());
        if (user.employeeId() != null) db.update("UPDATE employees SET email=? WHERE id=?", s(body, "email"), user.employeeId());
        return Map.of("message", "Profile updated successfully. Please login again to see all changes.");
    }

    /** DEMO ONLY: a real system would e-mail the code. For the college demo the code is returned in the response. */
    @PostMapping("/forgot-password")
    public Map<String, Object> forgot(@RequestBody Map<String, Object> body) {
        Validator.required(body, "email");
        List<Map<String, Object>> rows = db.queryForList("SELECT id, username, email, role FROM users WHERE LOWER(email)=LOWER(?)", s(body, "email"));
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("message", "If this email is registered, a reset code has been generated.");
        if (!rows.isEmpty()) {
            Map<String, Object> r = rows.get(0);
            AuthUser u = new AuthUser(((Number) r.get("id")).longValue(), (String) r.get("username"), (String) r.get("email"), (String) r.get("role"), null);
            res.put("resetCode", tokens.createResetToken(u)); // demo mode
        }
        return res;
    }

    @PostMapping("/reset-password")
    public Map<String, String> reset(@RequestBody Map<String, Object> body) {
        Validator.required(body, "resetCode", "newPassword");
        Validator.password(s(body, "newPassword"));
        AuthUser u = tokens.useResetToken(s(body, "resetCode"));
        if (u == null) throw new ApiException(400, "Reset code is invalid or has expired.");
        db.update("UPDATE users SET password=? WHERE id=?", encoder.encode(s(body, "newPassword")), u.userId());
        return Map.of("message", "Password reset successfully. You can now login.");
    }
}
