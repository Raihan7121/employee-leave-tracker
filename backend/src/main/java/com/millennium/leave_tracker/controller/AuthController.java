package com.millennium.leave_tracker.controller;

import com.millennium.leave_tracker.domain.Employee;
import com.millennium.leave_tracker.dto.LoginRequest;
import com.millennium.leave_tracker.dto.LoginResponse;
import com.millennium.leave_tracker.service.AuthService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /** The only endpoint that does not need a token - it is how you get one. */
    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest request) {
        return authService.login(request);
    }

    /**
     * Returns the signed-in employee. {@code @AuthenticationPrincipal} hands us the token
     * Spring Security already decoded and verified for this request.
     */
    @GetMapping("/me")
    public Employee me(@AuthenticationPrincipal Jwt jwt) {
        return authService.currentEmployee(jwt);
    }
}
