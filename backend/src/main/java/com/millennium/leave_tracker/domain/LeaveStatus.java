package com.millennium.leave_tracker.domain;

/**
 * Lifecycle of a leave request: it is created as PENDING and an admin moves it to
 * APPROVED or REJECTED. Those two are final states.
 */
public enum LeaveStatus {
    PENDING,
    APPROVED,
    REJECTED
}
