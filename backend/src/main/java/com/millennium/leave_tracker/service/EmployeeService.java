package com.millennium.leave_tracker.service;

import com.millennium.leave_tracker.domain.Employee;
import com.millennium.leave_tracker.domain.Role;
import com.millennium.leave_tracker.repository.EmployeeRepository;
import com.millennium.leave_tracker.repository.LeaveRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Create, read, update and delete for employee records. */
@Service
public class EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final LeaveRepository leaveRepository;
    private final PasswordEncoder passwordEncoder;

    public EmployeeService(
            EmployeeRepository employeeRepository,
            LeaveRepository leaveRepository,
            PasswordEncoder passwordEncoder) {
        this.employeeRepository = employeeRepository;
        this.leaveRepository = leaveRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public List<Employee> findAll() {
        return employeeRepository.findAll();
    }

    public Employee findById(Long id) {
        return employeeRepository
                .findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee " + id + " not found"));
    }

    /**
     * The request carries a plain password; only its hash is ever stored. The email is
     * unique in the database, so it is checked up front to return a readable 409 instead
     * of a constraint violation.
     */
    public Employee create(Employee employee) {
        require(employee.getName(), "name");
        require(employee.getEmail(), "email");
        require(employee.getPassword(), "password");

        if (employeeRepository.existsByEmail(employee.getEmail())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An employee with that email already exists");
        }

        employee.setPassword(passwordEncoder.encode(employee.getPassword()));
        if (employee.getRole() == null) {
            employee.setRole(Role.EMPLOYEE);
        }
        return employeeRepository.save(employee);
    }

    /**
     * Copies the editable fields onto the stored employee. A blank password means "leave
     * the current one alone", so an admin can edit a name without resetting the login.
     */
    public Employee update(Long id, Employee changes) {
        Employee employee = findById(id);
        require(changes.getName(), "name");
        require(changes.getEmail(), "email");

        if (!employee.getEmail().equals(changes.getEmail())
                && employeeRepository.existsByEmail(changes.getEmail())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An employee with that email already exists");
        }

        employee.setName(changes.getName());
        employee.setEmail(changes.getEmail());
        employee.setDepartment(changes.getDepartment());
        if (changes.getRole() != null) {
            employee.setRole(changes.getRole());
        }
        if (changes.getPassword() != null && !changes.getPassword().isBlank()) {
            employee.setPassword(passwordEncoder.encode(changes.getPassword()));
        }
        return employeeRepository.save(employee);
    }

    /**
     * Leave rows point at the employee with a non-null foreign key, so they have to go
     * first or the database refuses the delete. Both statements run in one transaction.
     */
    @Transactional
    public void delete(Long id) {
        Employee employee = findById(id);
        leaveRepository.deleteByEmployeeId(id);
        employeeRepository.delete(employee);
    }

    private void require(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " is required");
        }
    }
}
