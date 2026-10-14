package com.college.ems.controllers;

import com.college.ems.config.Notifier;
import com.college.ems.middleware.Validator;
import com.college.ems.models.ApiException;
import com.college.ems.models.AuthUser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Date;
import java.time.LocalDate;
import java.util.*;

import static com.college.ems.middleware.Validator.s;

@RestController
@RequestMapping("/api/leaves")
public class LeaveController {
    @Autowired private JdbcTemplate db;
    @Autowired private Notifier notifier;

    /** Filters: ?search=&type=&status=&date= (date falls inside the leave period) */
    @GetMapping
    public List<Map<String, Object>> list(@RequestAttribute("user") AuthUser user,
                                          @RequestParam(required = false) String search,
                                          @RequestParam(required = false) String type,
                                          @RequestParam(required = false) String status,
                                          @RequestParam(required = false) String date) {
        StringBuilder sql = new StringBuilder(
            "SELECT l.id, l.employee_id, e.employee_id AS emp_code, e.full_name, l.leave_type, l.start_date, l.end_date, " +
            "DATEDIFF(l.end_date, l.start_date)+1 AS days, l.reason, l.status, l.admin_remarks, l.applied_date " +
            "FROM leaves l JOIN employees e ON e.id=l.employee_id WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (!user.isAdmin()) { sql.append(" AND l.employee_id=?"); args.add(user.employeeId()); }
        if (search != null && !search.isBlank()) { sql.append(" AND (e.full_name LIKE ? OR e.employee_id LIKE ?)"); args.add("%" + search.trim() + "%"); args.add("%" + search.trim() + "%"); }
        if (type != null && !type.isBlank()) { sql.append(" AND l.leave_type=?"); args.add(type); }
        if (status != null && !status.isBlank()) { sql.append(" AND l.status=?"); args.add(status); }
        if (date != null && !date.isBlank()) { sql.append(" AND ? BETWEEN l.start_date AND l.end_date"); args.add(Validator.date(date, "Date")); }
        sql.append(" ORDER BY l.applied_date DESC, l.id DESC");
        return db.queryForList(sql.toString(), args.toArray());
    }

    /** Employee applies for leave */
    @PostMapping
    public Map<String, String> apply(@RequestAttribute("user") AuthUser user, @RequestBody Map<String, Object> b) {
        if (user.employeeId() == null) throw new ApiException(403, "Only employees can apply for leave.");
        Validator.required(b, "leave_type", "start_date", "end_date", "reason");
        Validator.oneOf(s(b, "leave_type"), "leave type", "Casual Leave", "Sick Leave", "Emergency Leave", "Other");
        Date start = Validator.date(s(b, "start_date"), "Start date"), end = Validator.date(s(b, "end_date"), "End date");
        if (end.before(start)) throw new ApiException(400, "End date cannot be before start date.");
        if (start.toLocalDate().isBefore(LocalDate.now().minusDays(30))) throw new ApiException(400, "Start date cannot be more than 30 days in the past.");
        if (s(b, "reason").length() < 5) throw new ApiException(400, "Please enter a reason (at least 5 characters).");
        Integer overlap = db.queryForObject("SELECT COUNT(*) FROM leaves WHERE employee_id=? AND status<>'Rejected' AND start_date<=? AND end_date>=?",
            Integer.class, user.employeeId(), end, start);
        if (overlap != null && overlap > 0) throw new ApiException(409, "You already have a leave request for these dates.");
        db.update("INSERT INTO leaves (employee_id, leave_type, start_date, end_date, reason, status) VALUES (?,?,?,?,?, 'Pending')",
            user.employeeId(), s(b, "leave_type"), start, end, s(b, "reason"));
        String name = db.queryForObject("SELECT full_name FROM employees WHERE id=?", String.class, user.employeeId());
        notifier.toAdmins("New leave request from " + name + " (" + s(b, "leave_type") + ")");
        return Map.of("message", "Leave request submitted successfully.");
    }

    @PutMapping("/{id}/approve")
    @Transactional
    public Map<String, String> approve(@PathVariable long id, @RequestBody(required = false) Map<String, Object> b) {
        Map<String, Object> l = decide(id, "Approved", b);
        // Mark attendance as "Leave" for every day of the approved leave (max 60 days)
        LocalDate d = LocalDate.parse(l.get("start_date").toString()), end = LocalDate.parse(l.get("end_date").toString());
        for (int i = 0; i < 60 && !d.isAfter(end); i++, d = d.plusDays(1)) {
            db.update("INSERT INTO attendance (employee_id, date, status) VALUES (?,?, 'Leave') ON DUPLICATE KEY UPDATE status='Leave'",
                l.get("employee_id"), Date.valueOf(d));
        }
        return Map.of("message", "Leave approved.");
    }

    @PutMapping("/{id}/reject")
    public Map<String, String> reject(@PathVariable long id, @RequestBody(required = false) Map<String, Object> b) {
        decide(id, "Rejected", b);
        return Map.of("message", "Leave rejected.");
    }

    private Map<String, Object> decide(long id, String newStatus, Map<String, Object> b) {
        List<Map<String, Object>> rows = db.queryForList("SELECT * FROM leaves WHERE id=?", id);
        if (rows.isEmpty()) throw new ApiException(404, "Leave request not found.");
        Map<String, Object> l = rows.get(0);
        if (!"Pending".equals(l.get("status"))) throw new ApiException(409, "This request has already been " + String.valueOf(l.get("status")).toLowerCase() + ".");
        String remarks = b == null ? "" : s(b, "admin_remarks");
        db.update("UPDATE leaves SET status=?, admin_remarks=? WHERE id=?", newStatus, remarks, id);
        notifier.toEmployee(((Number) l.get("employee_id")).longValue(),
            "Your " + l.get("leave_type") + " request (" + l.get("start_date") + " to " + l.get("end_date") + ") was " + newStatus.toLowerCase() + ".");
        return l;
    }
}
