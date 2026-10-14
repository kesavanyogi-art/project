package com.college.ems.controllers;

import com.college.ems.config.Notifier;
import com.college.ems.middleware.Validator;
import com.college.ems.models.ApiException;
import com.college.ems.models.AuthUser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

import static com.college.ems.middleware.Validator.s;

@RestController
@RequestMapping("/api/employees")
public class EmployeeController {
    @Autowired private JdbcTemplate db;
    @Autowired private BCryptPasswordEncoder encoder;
    @Autowired private Notifier notifier;

    private static final String COLS =
        "e.id, e.employee_id, e.full_name, e.gender, e.dob, e.email, e.phone, e.address, e.department_id, " +
        "d.department_name, e.designation, e.joining_date, e.employment_type, e.salary, e.status, " +
        "e.emergency_contact, e.created_at";

    /** Search + filters: ?search=&department=&status= */
    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(required = false) String search,
                                          @RequestParam(required = false) String department,
                                          @RequestParam(required = false) String status) {
        StringBuilder sql = new StringBuilder("SELECT " + COLS + " FROM employees e LEFT JOIN departments d ON d.id=e.department_id WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (search != null && !search.isBlank()) {
            sql.append(" AND (e.employee_id LIKE ? OR e.full_name LIKE ? OR e.email LIKE ? OR e.designation LIKE ? OR d.department_name LIKE ? OR e.status LIKE ?)");
            for (int i = 0; i < 6; i++) args.add("%" + search.trim() + "%");
        }
        if (department != null && !department.isBlank()) { sql.append(" AND e.department_id=?"); args.add(department); }
        if (status != null && !status.isBlank()) { sql.append(" AND e.status=?"); args.add(status); }
        sql.append(" ORDER BY e.id DESC");
        return db.queryForList(sql.toString(), args.toArray());
    }

    @GetMapping("/{id}")
    public Map<String, Object> get(@PathVariable long id) { return fullProfile(id); }

    /** Employee views own profile */
    @GetMapping("/me")
    public Map<String, Object> me(@RequestAttribute("user") AuthUser user) {
        if (user.employeeId() == null) throw new ApiException(404, "Employee not found.");
        return fullProfile(user.employeeId());
    }

    /** Employee may update ONLY these fields */
    @PutMapping("/me")
    public Map<String, String> updateMe(@RequestAttribute("user") AuthUser user, @RequestBody Map<String, Object> b) {
        if (user.employeeId() == null) throw new ApiException(404, "Employee not found.");
        Validator.required(b, "phone", "address");
        Validator.phone(s(b, "phone"));
        String emergency = s(b, "emergency_contact");
        if (!emergency.isEmpty()) Validator.phone(emergency);
        db.update("UPDATE employees SET phone=?, address=?, emergency_contact=? WHERE id=?", s(b, "phone"), s(b, "address"), emergency, user.employeeId());
        String photo = s(b, "profile_photo");
        if (!photo.isEmpty()) {
            if (!photo.startsWith("data:image/")) throw new ApiException(400, "Profile photo must be an image.");
            db.update("UPDATE employees SET profile_photo=? WHERE id=?", photo, user.employeeId());
        }
        return Map.of("message", "Profile updated successfully.");
    }

    private Map<String, Object> fullProfile(long id) {
        List<Map<String, Object>> rows = db.queryForList(
            "SELECT " + COLS + ", e.profile_photo FROM employees e LEFT JOIN departments d ON d.id=e.department_id WHERE e.id=?", id);
        if (rows.isEmpty()) throw new ApiException(404, "Employee not found.");
        Map<String, Object> emp = new LinkedHashMap<>(rows.get(0));

        Map<String, Object> att = new LinkedHashMap<>();
        for (String st : List.of("Present", "Absent", "Late", "Half Day", "Leave"))
            att.put(st, db.queryForObject("SELECT COUNT(*) FROM attendance WHERE employee_id=? AND status=?", Integer.class, id, st));
        emp.put("attendanceSummary", att);

        Map<String, Object> lv = new LinkedHashMap<>();
        for (String st : List.of("Pending", "Approved", "Rejected"))
            lv.put(st, db.queryForObject("SELECT COUNT(*) FROM leaves WHERE employee_id=? AND status=?", Integer.class, id, st));
        lv.put("approvedDays", db.queryForObject(
            "SELECT COALESCE(SUM(DATEDIFF(end_date,start_date)+1),0) FROM leaves WHERE employee_id=? AND status='Approved'", Integer.class, id));
        emp.put("leaveSummary", lv);
        return emp;
    }

    private void validate(Map<String, Object> b, Long selfId) {
        Validator.required(b, "full_name", "gender", "dob", "email", "phone", "address", "department_id",
                "designation", "joining_date", "employment_type", "salary");
        Validator.email(s(b, "email"));
        Validator.phone(s(b, "phone"));
        if (!s(b, "emergency_contact").isEmpty()) Validator.phone(s(b, "emergency_contact"));
        Validator.oneOf(s(b, "gender"), "gender", "Male", "Female", "Other");
        Validator.oneOf(s(b, "employment_type"), "employment type", "Full-Time", "Part-Time", "Contract", "Intern");
        Validator.date(s(b, "dob"), "Date of birth");
        Validator.date(s(b, "joining_date"), "Joining date");
        if (Validator.date(s(b, "dob"), "").after(new java.sql.Date(System.currentTimeMillis())))
            throw new ApiException(400, "Date of birth cannot be in the future.");
        if (Validator.money(b, "salary").signum() <= 0) throw new ApiException(400, "Salary must be greater than zero.");
        long sid = selfId == null ? -1 : selfId;
        Integer dupMail = db.queryForObject("SELECT COUNT(*) FROM employees WHERE LOWER(email)=LOWER(?) AND id<>?", Integer.class, s(b, "email"), sid);
        if (dupMail != null && dupMail > 0) throw new ApiException(409, "An employee with this email already exists.");
        if (!s(b, "employee_id").isEmpty()) {
            Integer dupId = db.queryForObject("SELECT COUNT(*) FROM employees WHERE employee_id=? AND id<>?", Integer.class, s(b, "employee_id"), sid);
            if (dupId != null && dupId > 0) throw new ApiException(409, "Employee ID already exists.");
        }
    }

    @PostMapping
    @Transactional
    public Map<String, Object> create(@RequestBody Map<String, Object> b) {
        validate(b, null);
        String email = s(b, "email");
        Integer dupUser = db.queryForObject("SELECT COUNT(*) FROM users WHERE LOWER(email)=LOWER(?)", Integer.class, email);
        if (dupUser != null && dupUser > 0) throw new ApiException(409, "An account with this email already exists.");

        String empCode = s(b, "employee_id");
        if (empCode.isEmpty()) {
            Long next = db.queryForObject("SELECT COALESCE(MAX(id),0)+1 FROM employees", Long.class);
            empCode = String.format("EMP%03d", next);
            while (db.queryForObject("SELECT COUNT(*) FROM employees WHERE employee_id=?", Integer.class, empCode) > 0)
                empCode = "EMP" + (System.currentTimeMillis() % 100000);
        }
        String password = s(b, "password").isEmpty() ? "Employee@123" : s(b, "password");
        Validator.password(password);

        db.update("INSERT INTO users (username, email, password, role) VALUES (?,?,?, 'EMPLOYEE')", empCode, email, encoder.encode(password));
        Long userId = db.queryForObject("SELECT id FROM users WHERE email=?", Long.class, email);
        String status = s(b, "status").isEmpty() ? "Active" : s(b, "status");
        Validator.oneOf(status, "status", "Active", "Inactive");
        String photo = s(b, "profile_photo");
        db.update("INSERT INTO employees (employee_id,user_id,full_name,gender,dob,email,phone,address,department_id,designation," +
                  "joining_date,employment_type,salary,status,profile_photo,emergency_contact) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            empCode, userId, s(b, "full_name"), s(b, "gender"), Validator.date(s(b, "dob"), "Date of birth"), email, s(b, "phone"),
            s(b, "address"), Long.parseLong(s(b, "department_id")), s(b, "designation"), Validator.date(s(b, "joining_date"), "Joining date"),
            s(b, "employment_type"), Validator.money(b, "salary"), status, photo.startsWith("data:image/") ? photo : null, s(b, "emergency_contact"));
        notifier.toAdmins("New employee added: " + s(b, "full_name") + " (" + empCode + ")");
        return Map.of("message", "Employee added successfully.", "employee_id", empCode);
    }

    @PutMapping("/{id}")
    @Transactional
    public Map<String, String> update(@PathVariable long id, @RequestBody Map<String, Object> b) {
        fullProfile(id); // 404 if not found
        validate(b, id);
        String status = s(b, "status").isEmpty() ? "Active" : s(b, "status");
        Validator.oneOf(status, "status", "Active", "Inactive");
        String code = s(b, "employee_id");
        if (code.isEmpty()) throw new ApiException(400, "Employee id is required.");
        String photo = s(b, "profile_photo");
        db.update("UPDATE employees SET employee_id=?, full_name=?, gender=?, dob=?, email=?, phone=?, address=?, department_id=?, designation=?, " +
                  "joining_date=?, employment_type=?, salary=?, status=?, emergency_contact=? WHERE id=?",
            code, s(b, "full_name"), s(b, "gender"), Validator.date(s(b, "dob"), "Date of birth"), s(b, "email"), s(b, "phone"), s(b, "address"),
            Long.parseLong(s(b, "department_id")), s(b, "designation"), Validator.date(s(b, "joining_date"), "Joining date"),
            s(b, "employment_type"), Validator.money(b, "salary"), status, s(b, "emergency_contact"), id);
        if (photo.startsWith("data:image/")) db.update("UPDATE employees SET profile_photo=? WHERE id=?", photo, id);
        db.update("UPDATE users SET email=?, username=? WHERE id=(SELECT user_id FROM employees WHERE id=?)", s(b, "email"), code, id);
        return Map.of("message", "Employee updated successfully.");
    }

    /** Change status quickly (Activate / Deactivate) */
    @PutMapping("/{id}/status")
    public Map<String, String> status(@PathVariable long id, @RequestBody Map<String, Object> b) {
        String st = s(b, "status");
        Validator.oneOf(st, "status", "Active", "Inactive");
        if (db.update("UPDATE employees SET status=? WHERE id=?", st, id) == 0) throw new ApiException(404, "Employee not found.");
        return Map.of("message", "Employee status changed to " + st + ".");
    }

    /** DELETE = soft delete (deactivate) so attendance/payroll history is never lost */
    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable long id) {
        if (db.update("UPDATE employees SET status='Inactive' WHERE id=?", id) == 0) throw new ApiException(404, "Employee not found.");
        return Map.of("message", "Employee deactivated successfully.");
    }
}
