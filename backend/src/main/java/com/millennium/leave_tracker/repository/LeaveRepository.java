package com.millennium.leave_tracker.repository;

import com.millennium.leave_tracker.domain.Leave;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LeaveRepository extends JpaRepository<Leave, Long> {

    /** Employees only ever see their own requests, so the query is scoped by owner. */
    List<Leave> findByEmployeeId(Long employeeId);

    /** Clears the foreign key rows before an employee can be removed. */
    void deleteByEmployeeId(Long employeeId);
}
