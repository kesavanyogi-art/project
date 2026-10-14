package com.college.ems.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/** Reports (admin only). Each endpoint accepts optional filters and returns plain rows; the browser prints / exports CSV. */
@RestController
@RequestMapping("/api/reports")
public class ReportController {
    @Autowired private JdbcTemplate db;

    private static boolean has(String v) { return v != null && !v.isBlank(); }

    @GetMapping("/employees")
    public List<Map<String, Object>> employees(@RequestParam(required = false) String department, @RequestParam(required = false) String status,
                                               @RequestParam(required = false) String employeeId,
                                               @RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        StringBuilder sql = new StringBuilder("SELECT e.employee_id, e.full_name, d.department_name, e.designation, e.employment_type, e.joining_date, e.salary, e.status, e.email, e.phone " +
            "FROM employees e LEFT JOIN departments d ON d.id=e.department_id WHERE 1=1");
        List<Object> a = new ArrayList<>();
        if (has(department)) { sql.append(" AND e.department_id=?"); a.add(department); }
        if (has(status)) { sql.append(" AND e.status=?"); a.add(status); }
        if (has(employeeId)) { sql.append(" AND e.id=?"); a.add(employeeId); }
        if (has(from)) { sql.append(" AND e.joining_date>=?"); a.add(from); }
        if (has(to)) { sql.append(" AND e.joining_date<=?"); a.add(to); }
        return db.queryForList(sql.append(" ORDER BY e.employee_id").toString(), a.toArray());
    }

    @GetMapping("/departments")
    public List<Map<String, Object>> departments() {
        return db.queryForList("SELECT d.department_name, COUNT(e.id) AS total_employees, " +
            "COALESCE(SUM(e.status='Active'),0) AS active_employees, COALESCE(SUM(e.status='Inactive'),0) AS inactive_employees, " +
            "COALESCE(ROUND(AVG(e.salary),2),0) AS average_salary, COALESCE(SUM(e.salary),0) AS total_salary " +
            "FROM departments d LEFT JOIN employees e ON e.department_id=d.id GROUP BY d.id, d.department_name ORDER BY d.department_name");
    }

    @GetMapping("/attendance")
    public List<Map<String, Object>> attendance(@RequestParam(required = false) String department, @RequestParam(required = false) String status,
                                                @RequestParam(required = false) String employeeId,
                                                @RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        StringBuilder sql = new StringBuilder("SELECT e.employee_id, e.full_name, d.department_name, a.date, a.check_in, a.check_out, a.status " +
            "FROM attendance a JOIN employees e ON e.id=a.employee_id LEFT JOIN departments d ON d.id=e.department_id WHERE 1=1");
        List<Object> a = new ArrayList<>();
        if (has(department)) { sql.append(" AND e.department_id=?"); a.add(department); }
        if (has(status)) { sql.append(" AND a.status=?"); a.add(status); }
        if (has(employeeId)) { sql.append(" AND e.id=?"); a.add(employeeId); }
        if (has(from)) { sql.append(" AND a.date>=?"); a.add(from); }
        if (has(to)) { sql.append(" AND a.date<=?"); a.add(to); }
        return db.queryForList(sql.append(" ORDER BY a.date DESC, e.full_name").toString(), a.toArray());
    }

    @GetMapping("/leaves")
    public List<Map<String, Object>> leaves(@RequestParam(required = false) String department, @RequestParam(required = false) String status,
                                            @RequestParam(required = false) String employeeId,
                                            @RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        StringBuilder sql = new StringBuilder("SELECT e.employee_id, e.full_name, d.department_name, l.leave_type, l.start_date, l.end_date, " +
            "DATEDIFF(l.end_date,l.start_date)+1 AS days, l.status, l.admin_remarks " +
            "FROM leaves l JOIN employees e ON e.id=l.employee_id LEFT JOIN departments d ON d.id=e.department_id WHERE 1=1");
        List<Object> a = new ArrayList<>();
        if (has(department)) { sql.append(" AND e.department_id=?"); a.add(department); }
        if (has(status)) { sql.append(" AND l.status=?"); a.add(status); }
        if (has(employeeId)) { sql.append(" AND e.id=?"); a.add(employeeId); }
        if (has(from)) { sql.append(" AND l.end_date>=?"); a.add(from); }
        if (has(to)) { sql.append(" AND l.start_date<=?"); a.add(to); }
        return db.queryForList(sql.append(" ORDER BY l.start_date DESC").toString(), a.toArray());
    }

    @GetMapping("/payroll")
    public List<Map<String, Object>> payroll(@RequestParam(required = false) String department, @RequestParam(required = false) String status,
                                             @RequestParam(required = false) String employeeId,
                                             @RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        // from/to are months in YYYY-MM format
        StringBuilder sql = new StringBuilder("SELECT e.employee_id, e.full_name, d.department_name, p.salary_month, p.basic_salary, p.allowances, p.bonus, p.deductions, p.net_salary, p.payment_status " +
            "FROM payroll p JOIN employees e ON e.id=p.employee_id LEFT JOIN departments d ON d.id=e.department_id WHERE 1=1");
        List<Object> a = new ArrayList<>();
        if (has(department)) { sql.append(" AND e.department_id=?"); a.add(department); }
        if (has(status)) { sql.append(" AND p.payment_status=?"); a.add(status); }
        if (has(employeeId)) { sql.append(" AND e.id=?"); a.add(employeeId); }
        if (has(from)) { sql.append(" AND p.salary_month>=?"); a.add(from.substring(0, Math.min(7, from.length()))); }
        if (has(to)) { sql.append(" AND p.salary_month<=?"); a.add(to.substring(0, Math.min(7, to.length()))); }
        return db.queryForList(sql.append(" ORDER BY p.salary_month DESC, e.full_name").toString(), a.toArray());
    }
}
