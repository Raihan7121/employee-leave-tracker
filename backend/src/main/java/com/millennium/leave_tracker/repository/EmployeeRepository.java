package com.millennium.leave_tracker.repository;

import com.millennium.leave_tracker.domain.Employee;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Spring Data writes the implementation at startup: JpaRepository supplies the CRUD
 * methods and {@link #findByEmail} is derived from its own name.
 */
public interface EmployeeRepository extends JpaRepository<Employee, Long> {

    /** Used by login to find the account behind a submitted email. */
    Optional<Employee> findByEmail(String email);

    boolean existsByEmail(String email);
}
