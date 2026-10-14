package com.college.ems.middleware;

import com.college.ems.config.TokenStore;
import com.college.ems.models.AuthUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.List;

/**
 * Token + Role based access control.
 *  - Public: login, forgot/reset password
 *  - ADMIN: everything
 *  - EMPLOYEE: only the whitelisted endpoints below
 */
@Component
public class AuthInterceptor implements HandlerInterceptor {
    @Autowired private TokenStore tokens;

    private static final List<String> PUBLIC = List.of("POST /api/auth/login", "POST /api/auth/forgot-password", "POST /api/auth/reset-password");

    private static final List<String> EMPLOYEE_ALLOWED = List.of(
        "POST /api/auth/logout", "GET /api/auth/me", "POST /api/auth/change-password", "PUT /api/auth/profile",
        "GET /api/employees/me", "PUT /api/employees/me",
        "GET /api/attendance", "GET /api/leaves", "POST /api/leaves",
        "GET /api/payroll", "GET /api/departments", "GET /api/departments/\\d+",
        "GET /api/notifications", "PUT /api/notifications/read-all",
        "GET /api/dashboard/employee");

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) throws Exception {
        String method = req.getMethod();
        if ("OPTIONS".equals(method)) return true;
        String key = method + " " + req.getRequestURI();
        if (PUBLIC.contains(key)) return true;

        String header = req.getHeader("Authorization");
        String token = (header != null && header.startsWith("Bearer ")) ? header.substring(7) : null;
        AuthUser user = tokens.get(token);
        if (user == null) { deny(res, 401, "Your session has expired. Please login again."); return false; }

        req.setAttribute("user", user);
        req.setAttribute("token", token);
        if (user.isAdmin()) return true;
        for (String rule : EMPLOYEE_ALLOWED) if (key.matches(rule)) return true;
        deny(res, 403, "You are not allowed to access this resource.");
        return false;
    }

    private void deny(HttpServletResponse res, int status, String msg) throws Exception {
        res.setStatus(status);
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write("{\"message\":\"" + msg + "\"}");
    }
}
