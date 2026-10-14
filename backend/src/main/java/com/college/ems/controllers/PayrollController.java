package com.college.ems.controllers;

import com.college.ems.config.Notifier;
import com.college.ems.middleware.Validator;
import com.college.ems.models.ApiException;
import com.college.ems.models.AuthUser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

import static com.college.ems.middleware.Validator.s;

@RestController
@RequestMapping("/api/payroll")
public class PayrollController {
    @Autowired private JdbcTemplate db;
    @Autowired private Notifier notifier;

    /** Filters: ?month=YYYY-MM&search=&status= . Employees only see their own payslips. */
    @GetMapping
    public List<Map<String, Object>> list(@RequestAttribute("user") AuthUser user,
                                          @RequestParam(required = false) String month,
                                          @RequestParam(required = false) String search,
                                          @RequestParam(required = false) String status) {
        StringBuilder sql = new StringBuilder(
            "SELECT p.id, p.employee_id, e.employee_id AS emp_code, e.full_name, d.department_name, e.designation, " +
            "p.salary_month, p.basic_salary, p.allowances, p.bonus, p.deductions, p.net_salary, p.payment_status " +
            "FROM payroll p JOIN employees e ON e.id=p.employee_id LEFT JOIN departments d ON d.id=e.department_id WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (!user.isAdmin()) { sql.append(" AND p.employee_id=?"); args.add(user.employeeId()); }
        if (month != null && !month.isBlank()) { sql.append(" AND p.salary_month=?"); args.add(month); }
        if (search != null && !search.isBlank()) { sql.append(" AND (e.full_name LIKE ? OR e.employee_id LIKE ?)"); args.add("%" + search.trim() + "%"); args.add("%" + search.trim() + "%"); }
        if (status != null && !status.isBlank()) { sql.append(" AND p.payment_status=?"); args.add(status); }
        sql.append(" ORDER BY p.salary_month DESC, e.full_name");
        return db.queryForList(sql.toString(), args.toArray());
    }

    @PostMapping
    public Map<String, String> create(@RequestBody Map<String, Object> b) {
        validate(b);
        long empId = Long.parseLong(s(b, "employee_id"));
        Integer dup = db.queryForObject("SELECT COUNT(*) FROM payroll WHERE employee_id=? AND salary_month=?", Integer.class, empId, s(b, "salary_month"));
        if (dup != null && dup > 0) throw new ApiException(409, "Payroll for this employee and month already exists.");
        db.update("INSERT INTO payroll (employee_id, salary_month, basic_salary, allowances, bonus, deductions, net_salary, payment_status) VALUES (?,?,?,?,?,?,?,?)",
            empId, s(b, "salary_month"), Validator.money(b, "basic_salary"), Validator.money(b, "allowances"), Validator.money(b, "bonus"),
            Validator.money(b, "deductions"), net(b), status(b));
        notifier.toEmployee(empId, "Payroll processed for " + s(b, "salary_month") + ". Net salary: " + net(b));
        return Map.of("message", "Payroll processed successfully.");
    }

    @PutMapping("/{id}")
    public Map<String, String> update(@PathVariable long id, @RequestBody Map<String, Object> b) {
        Validator.required(b, "salary_month", "basic_salary");
        Validator.money(b, "basic_salary");
        int n = db.update("UPDATE payroll SET salary_month=?, basic_salary=?, allowances=?, bonus=?, deductions=?, net_salary=?, payment_status=? WHERE id=?",
            s(b, "salary_month"), Validator.money(b, "basic_salary"), Validator.money(b, "allowances"), Validator.money(b, "bonus"),
            Validator.money(b, "deductions"), net(b), status(b), id);
        if (n == 0) throw new ApiException(404, "Payroll record not found.");
        return Map.of("message", "Payroll updated successfully.");
    }

    private void validate(Map<String, Object> b) {
        Validator.required(b, "employee_id", "salary_month", "basic_salary");
        if (!s(b, "salary_month").matches("^\\d{4}-(0[1-9]|1[0-2])$")) throw new ApiException(400, "Salary month must be in YYYY-MM format.");
        Validator.money(b, "basic_salary");
        BigDecimal basic = Validator.money(b, "basic_salary"), allow = Validator.money(b, "allowances"), bonus = Validator.money(b, "bonus"), ded = Validator.money(b, "deductions");
        if (ded.compareTo(basic.add(allow).add(bonus)) > 0) throw new ApiException(400, "Deductions cannot be more than the total earnings.");
    }

    private String status(Map<String, Object> b) {
        String st = s(b, "payment_status").isEmpty() ? "Pending" : s(b, "payment_status");
        Validator.oneOf(st, "payment status", "Pending", "Paid");
        return st;
    }

    /** Net Salary = Basic + Allowances + Bonus - Deductions */
    private BigDecimal net(Map<String, Object> b) {
        return Validator.money(b, "basic_salary").add(Validator.money(b, "allowances")).add(Validator.money(b, "bonus")).subtract(Validator.money(b, "deductions"));
    }
}
