package com.millennium.leave_tracker.service;

import com.millennium.leave_tracker.domain.Employee;
import com.millennium.leave_tracker.dto.LoginRequest;
import com.millennium.leave_tracker.dto.LoginResponse;
import com.millennium.leave_tracker.repository.EmployeeRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Issues tokens and turns a verified token back into the employee it belongs to.
 *
 * <p>Verifying a token is not this class's job - Spring Security's resource server
 * filter has already done that by the time a controller runs.
 */
@Service
public class AuthService {

    /** Long enough to work through the app without re-logging in mid-session. */
    private static final Duration TOKEN_LIFETIME = Duration.ofHours(8);

    private final EmployeeRepository employeeRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;

    public AuthService(
            EmployeeRepository employeeRepository, PasswordEncoder passwordEncoder, JwtEncoder jwtEncoder) {
        this.employeeRepository = employeeRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtEncoder = jwtEncoder;
    }

    /**
     * Checks the submitted password against the stored hash and hands back a signed token.
     * A missing account and a wrong password give the same 401 on purpose, so the response
     * cannot be used to discover which emails are registered.
     */
    public LoginResponse login(LoginRequest request) {
        Employee employee = employeeRepository
                .findByEmail(request.email())
                .filter(candidate -> passwordEncoder.matches(request.password(), candidate.getPassword()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        return new LoginResponse(
                signToken(employee), employee.getId(), employee.getName(), employee.getEmail(), employee.getRole());
    }

    /**
     * Resolves the caller behind an already-verified token. The employee id is the token's
     * subject, so this is a single lookup by primary key.
     */
    public Employee currentEmployee(Jwt jwt) {
        return employeeRepository
                .findById(Long.valueOf(jwt.getSubject()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account no longer exists"));
    }

    private String signToken(Employee employee) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("leave-tracker")
                .issuedAt(now)
                .expiresAt(now.plus(TOKEN_LIFETIME))
                .subject(String.valueOf(employee.getId()))
                .claim("roles", List.of(employee.getRole().name()))
                .claim("name", employee.getName())
                .build();

        // The header must say HS256; the encoder's default is RS256, which does not match
        // the shared secret configured in SecurityConfig.
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
}
