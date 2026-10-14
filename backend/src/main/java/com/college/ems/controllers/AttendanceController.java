package com.college.ems.controllers;

import com.college.ems.middleware.Validator;
import com.college.ems.models.ApiException;
import com.college.ems.models.AuthUser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

import static com.college.ems.middleware.Validator.s;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {
    @Autowired private JdbcTemplate db;
    private static final String[] STATUSES = {"Present", "Absent", "Late", "Half Day", "Leave"};

    /** Filters: ?search=(name or employee id)&date=&from=&to=&status= . Employees only ever see their own rows. */
    @GetMapping
    public List<Map<String, Object>> list(@RequestAttribute("user") AuthUser user,
                                          @RequestParam(required = false) String search,
                                          @RequestParam(required = false) String date,
                                          @RequestParam(required = false) String from,
                                          @RequestParam(required = false) String to,
                                          @RequestParam(required = false) String status) {
        StringBuilder sql = new StringBuilder(
            "SELECT a.id, a.employee_id, e.employee_id AS emp_code, e.full_name, a.date, a.check_in, a.check_out, a.status " +
            "FROM attendance a JOIN employees e ON e.id=a.employee_id WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (!user.isAdmin()) { sql.append(" AND a.employee_id=?"); args.add(user.employeeId()); }
        if (search != null && !search.isBlank()) { sql.append(" AND (e.full_name LIKE ? OR e.employee_id LIKE ?)"); args.add("%" + search.trim() + "%"); args.add("%" + search.trim() + "%"); }
        if (date != null && !date.isBlank()) { sql.append(" AND a.date=?"); args.add(Validator.date(date, "Date")); }
        if (from != null && !from.isBlank()) { sql.append(" AND a.date>=?"); args.add(Validator.date(from, "From date")); }
        if (to != null && !to.isBlank()) { sql.append(" AND a.date<=?"); args.add(Validator.date(to, "To date")); }
        if (status != null && !status.isBlank()) { sql.append(" AND a.status=?"); args.add(status); }
        sql.append(" ORDER BY a.date DESC, e.full_name");
        return db.queryForList(sql.toString(), args.toArray());
    }

    @PostMapping
    public Map<String, String> mark(@RequestBody Map<String, Object> b) {
        Validator.required(b, "employee_id", "date", "status");
        Validator.oneOf(s(b, "status"), "status", STATUSES);
        Validator.date(s(b, "date"), "Date");
        checkTimes(b);
        long empId = Long.parseLong(s(b, "employee_id"));
        Integer exists = db.queryForObject("SELECT COUNT(*) FROM attendance WHERE employee_id=? AND date=?", Integer.class, empId, Validator.date(s(b, "date"), "Date"));
        if (exists != null && exists > 0) throw new ApiException(409, "Attendance is already marked for this employee on this date. Please edit the existing record.");
        db.update("INSERT INTO attendance (employee_id, date, check_in, check_out, status) VALUES (?,?,?,?,?)",
            empId, Validator.date(s(b, "date"), "Date"), Validator.time(s(b, "check_in")), Validator.time(s(b, "check_out")), s(b, "status"));
        return Map.of("message", "Attendance marked successfully.");
    }

    @PutMapping("/{id}")
    public Map<String, String> update(@PathVariable long id, @RequestBody Map<String, Object> b) {
        Validator.required(b, "status");
        Validator.oneOf(s(b, "status"), "status", STATUSES);
        checkTimes(b);
        int n = db.update("UPDATE attendance SET check_in=?, check_out=?, status=? WHERE id=?",
            Validator.time(s(b, "check_in")), Validator.time(s(b, "check_out")), s(b, "status"), id);
        if (n == 0) throw new ApiException(404, "Attendance record not found.");
        return Map.of("message", "Attendance updated successfully.");
    }

    private void checkTimes(Map<String, Object> b) {
        var in = Validator.time(s(b, "check_in")); var out = Validator.time(s(b, "check_out"));
        if (in != null && out != null && out.before(in)) throw new ApiException(400, "Check-out time cannot be before check-in time.");
    }
}
