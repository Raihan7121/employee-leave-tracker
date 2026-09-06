package com.millennium.leave_tracker.domain;

/**
 * Who an employee is allowed to be. ADMIN manages everyone and decides on leave
 * requests; EMPLOYEE can only see and manage their own requests.
 */
public enum Role {
    ADMIN,
    EMPLOYEE
}
