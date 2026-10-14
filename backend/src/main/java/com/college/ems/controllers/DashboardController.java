package com.college.ems.controllers;

import com.college.ems.models.ApiException;
import com.college.ems.models.AuthUser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
    @Autowired private JdbcTemplate db;

    private int count(String sql, Object... args) {
        Integer n = db.queryForObject(sql, Integer.class, args);
        return n == null ? 0 : n;
    }

    /** All numbers & chart data come from the database */
    @GetMapping("/admin")
    public Map<String, Object> admin() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("totalEmployees", count("SELECT COUNT(*) FROM employees"));
        m.put("activeEmployees", count("SELECT COUNT(*) FROM employees WHERE status='Active'"));
        m.put("inactiveEmployees", count("SELECT COUNT(*) FROM employees WHERE status='Inactive'"));
        m.put("totalDepartments", count("SELECT COUNT(*) FROM departments"));
        m.put("todayPresent", count("SELECT COUNT(*) FROM attendance WHERE date=CURDATE() AND status IN ('Present','Late','Half Day')"));
        m.put("todayMarked", count("SELECT COUNT(*) FROM attendance WHERE date=CURDATE()"));
        m.put("pendingLeaves", count("SELECT COUNT(*) FROM leaves WHERE status='Pending'"));
        m.put("recentEmployees", db.queryForList("SELECT e.id, e.employee_id, e.full_name, d.department_name, e.designation, e.joining_date, e.status " +
            "FROM employees e LEFT JOIN departments d ON d.id=e.department_id ORDER BY e.id DESC LIMIT 5"));
        // Chart 1: employees by department
        m.put("employeesByDepartment", db.queryForList("SELECT d.department_name AS label, COUNT(e.id) AS value FROM departments d LEFT JOIN employees e ON e.department_id=d.id GROUP BY d.id, d.department_name ORDER BY d.department_name"));
        // Chart 2: attendance of the current month by status
        m.put("monthlyAttendance", db.queryForList("SELECT status AS label, COUNT(*) AS value FROM attendance WHERE YEAR(date)=YEAR(CURDATE()) AND MONTH(date)=MONTH(CURDATE()) GROUP BY status"));
        // Chart 3: leave statistics
        m.put("leaveStats", db.queryForList("SELECT status AS label, COUNT(*) AS value FROM leaves GROUP BY status"));
        // Chart 4: employee status
        m.put("employeeStatus", db.queryForList("SELECT status AS label, COUNT(*) AS value FROM employees GROUP BY status"));
        // Chart 5: payroll summary (net salary per month, last 6 months)
        List<Map<String, Object>> pay = db.queryForList("SELECT salary_month AS label, SUM(net_salary) AS value FROM payroll GROUP BY salary_month ORDER BY salary_month DESC LIMIT 6");
        Collections.reverse(pay);
        m.put("payrollSummary", pay);
        return m;
    }

    @GetMapping("/employee")
    public Map<String, Object> employee(@RequestAttribute("user") AuthUser user) {
        if (user.employeeId() == null) throw new ApiException(404, "Employee not found.");
        long id = user.employeeId();
        Map<String, Object> m = new LinkedHashMap<>();
        List<Map<String, Object>> info = db.queryForList("SELECT e.full_name, e.employee_id, e.designation, e.joining_date, d.department_name, d.description AS department_description, " +
            "(SELECT COUNT(*) FROM employees x WHERE x.department_id=e.department_id) AS department_size " +
            "FROM employees e LEFT JOIN departments d ON d.id=e.department_id WHERE e.id=?", id);
        m.put("info", info.isEmpty() ? null : info.get(0));
        m.put("monthAttendance", db.queryForList("SELECT status AS label, COUNT(*) AS value FROM attendance WHERE employee_id=? AND YEAR(date)=YEAR(CURDATE()) AND MONTH(date)=MONTH(CURDATE()) GROUP BY status", id));
        m.put("leaveStats", db.queryForList("SELECT status AS label, COUNT(*) AS value FROM leaves WHERE employee_id=? GROUP BY status", id));
        List<Map<String, Object>> last = db.queryForList("SELECT salary_month, net_salary, payment_status FROM payroll WHERE employee_id=? ORDER BY salary_month DESC LIMIT 1", id);
        m.put("lastPayslip", last.isEmpty() ? null : last.get(0));
        m.put("pendingLeaves", count("SELECT COUNT(*) FROM leaves WHERE employee_id=? AND status='Pending'", id));
        return m;
    }
}
