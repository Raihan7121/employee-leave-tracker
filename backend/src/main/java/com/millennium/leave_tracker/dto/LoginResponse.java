package com.millennium.leave_tracker.dto;

import com.millennium.leave_tracker.domain.Role;

/**
 * What login sends back. The id, name and role are already inside the token, but the
 * frontend would have to decode the JWT to read them - returning them here keeps the
 * client from needing a JWT library just to render a greeting.
 */
public record LoginResponse(String token, Long id, String name, String email, Role role) {}
