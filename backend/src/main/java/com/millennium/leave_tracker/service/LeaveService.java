package com.millennium.leave_tracker.service;

import com.millennium.leave_tracker.domain.Employee;
import com.millennium.leave_tracker.domain.Leave;
import com.millennium.leave_tracker.domain.LeaveStatus;
import com.millennium.leave_tracker.domain.Role;
import com.millennium.leave_tracker.repository.LeaveRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * The rules of the app live here.
 *
 * <p>Every method takes the {@code caller} - the employee behind the request's token -
 * because who is asking changes both what comes back and what is allowed. The controller
 * never decides any of this; it only resolves the caller and delegates.
 */
@Service
public class LeaveService {

    private final LeaveRepository leaveRepository;

    public LeaveService(LeaveRepository leaveRepository) {
        this.leaveRepository = leaveRepository;
    }

    /** An admin oversees everyone; an employee only ever sees their own requests. */
    public List<Leave> findAllFor(Employee caller) {
        return caller.getRole() == Role.ADMIN
                ? leaveRepository.findAll()
                : leaveRepository.findByEmployeeId(caller.getId());
    }

    public Leave findById(Employee caller, Long id) {
        Leave leave = leaveRepository
                .findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Leave " + id + " not found"));
        if (caller.getRole() != Role.ADMIN && !isOwner(caller, leave)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "That leave request is not yours");
        }
        return leave;
    }

    /**
     * A request is always filed for the caller and always starts as PENDING. Neither is
     * taken from the request body, so nobody can apply on somebody else's behalf or file
     * a request that is already approved.
     */
    public Leave create(Employee caller, Leave request) {
        validateDates(request);

        Leave leave = new Leave();
        leave.setEmployee(caller);
        leave.setStartDate(request.getStartDate());
        leave.setEndDate(request.getEndDate());
        leave.setReason(request.getReason());
        leave.setStatus(LeaveStatus.PENDING);
        return leaveRepository.save(leave);
    }

    /** You may only edit your own request, and only while it is still PENDING. */
    public Leave update(Employee caller, Long id, Leave changes) {
        Leave leave = requireOwnPending(caller, id);
        validateDates(changes);

        leave.setStartDate(changes.getStartDate());
        leave.setEndDate(changes.getEndDate());
        leave.setReason(changes.getReason());
        return leaveRepository.save(leave);
    }

    /** Same rule as editing: your own request, still PENDING. */
    public void delete(Employee caller, Long id) {
        leaveRepository.delete(requireOwnPending(caller, id));
    }

    /**
     * The admin decision. A request can only move out of PENDING once, and only into
     * APPROVED or REJECTED - re-approving a decided request is rejected as a conflict.
     */
    public Leave updateStatus(Long id, LeaveStatus newStatus) {
        if (newStatus != LeaveStatus.APPROVED && newStatus != LeaveStatus.REJECTED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be APPROVED or REJECTED");
        }

        Leave leave = leaveRepository
                .findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Leave " + id + " not found"));

        if (leave.getStatus() != LeaveStatus.PENDING) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Leave " + id + " was already " + leave.getStatus());
        }

        leave.setStatus(newStatus);
        return leaveRepository.save(leave);
    }

    private Leave requireOwnPending(Employee caller, Long id) {
        Leave leave = leaveRepository
                .findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Leave " + id + " not found"));

        if (!isOwner(caller, leave)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "That leave request is not yours");
        }
        if (leave.getStatus() != LeaveStatus.PENDING) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "A " + leave.getStatus() + " request can no longer be changed");
        }
        return leave;
    }

    private boolean isOwner(Employee caller, Leave leave) {
        return leave.getEmployee().getId().equals(caller.getId());
    }

    private void validateDates(Leave leave) {
        if (leave.getStartDate() == null || leave.getEndDate() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "startDate and endDate are required");
        }
        if (leave.getEndDate().isBefore(leave.getStartDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "endDate cannot be before startDate");
        }
    }
}
