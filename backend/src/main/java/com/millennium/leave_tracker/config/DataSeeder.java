package com.millennium.leave_tracker.config;

import com.millennium.leave_tracker.domain.Employee;
import com.millennium.leave_tracker.domain.Leave;
import com.millennium.leave_tracker.domain.LeaveStatus;
import com.millennium.leave_tracker.domain.Role;
import com.millennium.leave_tracker.repository.EmployeeRepository;
import com.millennium.leave_tracker.repository.LeaveRepository;
import java.time.LocalDate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * The database is in-memory, so it starts empty on every boot. This runner fills it
 * with one admin, three employees and a few leave requests so that no screen in the
 * app is ever blank on a fresh start.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final EmployeeRepository employeeRepository;
    private final LeaveRepository leaveRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(
            EmployeeRepository employeeRepository,
            LeaveRepository leaveRepository,
            PasswordEncoder passwordEncoder) {
        this.employeeRepository = employeeRepository;
        this.leaveRepository = leaveRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (employeeRepository.count() > 0) {
            return;
        }

        Employee admin = employee("Admin User", "admin@mis.com", "HR", "admin123", Role.ADMIN);
        Employee alice = employee("Alice Rahman", "alice@mis.com", "Engineering", "alice123", Role.EMPLOYEE);
        Employee bob = employee("Bob Hasan", "bob@mis.com", "Sales", "bob123", Role.EMPLOYEE);
        Employee carol = employee("Carol Akter", "carol@mis.com", "Engineering", "carol123", Role.EMPLOYEE);

        LocalDate today = LocalDate.now();
        leave(alice, today.plusDays(3), today.plusDays(5), "Family wedding", LeaveStatus.PENDING);
        leave(alice, today.minusDays(20), today.minusDays(18), "Sick leave", LeaveStatus.APPROVED);
        leave(bob, today.plusDays(10), today.plusDays(14), "Annual vacation", LeaveStatus.PENDING);
        leave(carol, today.minusDays(5), today.minusDays(4), "Personal errand", LeaveStatus.REJECTED);

        log.info(
                "Seeded {} employees and {} leave requests (admin login: {} / admin123)",
                employeeRepository.count(),
                leaveRepository.count(),
                admin.getEmail());
    }

    private Employee employee(String name, String email, String department, String rawPassword, Role role) {
        Employee employee = new Employee();
        employee.setName(name);
        employee.setEmail(email);
        employee.setDepartment(department);
        employee.setPassword(passwordEncoder.encode(rawPassword));
        employee.setRole(role);
        return employeeRepository.save(employee);
    }

    private void leave(Employee employee, LocalDate start, LocalDate end, String reason, LeaveStatus status) {
        Leave leave = new Leave();
        leave.setEmployee(employee);
        leave.setStartDate(start);
        leave.setEndDate(end);
        leave.setReason(reason);
        leave.setStatus(status);
        leaveRepository.save(leave);
    }
}
