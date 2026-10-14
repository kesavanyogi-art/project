package com.college.ems.controllers;

import com.college.ems.middleware.Validator;
import com.college.ems.models.ApiException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

import static com.college.ems.middleware.Validator.s;

@RestController
@RequestMapping("/api/departments")
public class DepartmentController {
    @Autowired private JdbcTemplate db;

    @GetMapping
    public List<Map<String, Object>> list() {
        return db.queryForList("SELECT d.id, d.department_name, d.description, d.created_at, " +
            "(SELECT COUNT(*) FROM employees e WHERE e.department_id=d.id) AS employee_count " +
            "FROM departments d ORDER BY d.department_name");
    }

    /** Department details + the employees who belong to it */
    @GetMapping("/{id}")
    public Map<String, Object> get(@PathVariable long id) {
        List<Map<String, Object>> rows = db.queryForList("SELECT id, department_name, description, created_at FROM departments WHERE id=?", id);
        if (rows.isEmpty()) throw new ApiException(404, "Department not found.");
        Map<String, Object> d = new LinkedHashMap<>(rows.get(0));
        d.put("employees", db.queryForList("SELECT id, employee_id, full_name, designation, status FROM employees WHERE department_id=? ORDER BY full_name", id));
        return d;
    }

    @PostMapping
    public Map<String, String> create(@RequestBody Map<String, Object> b) {
        Validator.required(b, "department_name");
        checkDuplicate(s(b, "department_name"), -1);
        db.update("INSERT INTO departments (department_name, description) VALUES (?,?)", s(b, "department_name"), s(b, "description"));
        return Map.of("message", "Department added successfully.");
    }

    @PutMapping("/{id}")
    public Map<String, String> update(@PathVariable long id, @RequestBody Map<String, Object> b) {
        Validator.required(b, "department_name");
        checkDuplicate(s(b, "department_name"), id);
        if (db.update("UPDATE departments SET department_name=?, description=? WHERE id=?", s(b, "department_name"), s(b, "description"), id) == 0)
            throw new ApiException(404, "Department not found.");
        return Map.of("message", "Department updated successfully.");
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable long id) {
        Integer n = db.queryForObject("SELECT COUNT(*) FROM employees WHERE department_id=?", Integer.class, id);
        if (n != null && n > 0) throw new ApiException(409, "Cannot delete a department that still has employees. Move the employees first.");
        if (db.update("DELETE FROM departments WHERE id=?", id) == 0) throw new ApiException(404, "Department not found.");
        return Map.of("message", "Department deleted successfully.");
    }

    private void checkDuplicate(String name, long selfId) {
        Integer n = db.queryForObject("SELECT COUNT(*) FROM departments WHERE LOWER(department_name)=LOWER(?) AND id<>?", Integer.class, name, selfId);
        if (n != null && n > 0) throw new ApiException(409, "A department with this name already exists.");
    }
}
