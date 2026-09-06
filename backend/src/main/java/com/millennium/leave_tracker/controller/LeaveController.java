package com.millennium.leave_tracker.controller;

import com.millennium.leave_tracker.domain.Employee;
import com.millennium.leave_tracker.domain.Leave;
import com.millennium.leave_tracker.dto.StatusUpdateRequest;
import com.millennium.leave_tracker.service.AuthService;
import com.millennium.leave_tracker.service.LeaveService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Leave requests. Every method resolves the caller from the verified token and hands the
 * decision to {@link LeaveService} - the controller itself contains no rules.
 */
@RestController
@RequestMapping("/api/leaves")
public class LeaveController {

    private final LeaveService leaveService;
    private final AuthService authService;

    public LeaveController(LeaveService leaveService, AuthService authService) {
        this.leaveService = leaveService;
        this.authService = authService;
    }

    /** Admins get every request; employees get their own. */
    @GetMapping
    public List<Leave> list(@AuthenticationPrincipal Jwt jwt) {
        return leaveService.findAllFor(caller(jwt));
    }

    @GetMapping("/{id}")
    public Leave get(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return leaveService.findById(caller(jwt), id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Leave create(@AuthenticationPrincipal Jwt jwt, @RequestBody Leave leave) {
        return leaveService.create(caller(jwt), leave);
    }

    @PutMapping("/{id}")
    public Leave update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @RequestBody Leave leave) {
        return leaveService.update(caller(jwt), id, leave);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        leaveService.delete(caller(jwt), id);
    }

    /** Approve or reject. The only endpoint an employee can never reach. */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public Leave updateStatus(@PathVariable Long id, @RequestBody StatusUpdateRequest request) {
        return leaveService.updateStatus(id, request.status());
    }

    /** Turns the request's verified token into the employee who sent it. */
    private Employee caller(Jwt jwt) {
        return authService.currentEmployee(jwt);
    }
}
