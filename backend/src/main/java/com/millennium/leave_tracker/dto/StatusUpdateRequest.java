package com.millennium.leave_tracker.dto;

import com.millennium.leave_tracker.domain.LeaveStatus;

/** Body of {@code PATCH /api/leaves/{id}/status}: {@code {"status": "APPROVED"}}. */
public record StatusUpdateRequest(LeaveStatus status) {}
