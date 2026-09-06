package com.millennium.leave_tracker;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Covers the rules in LeaveService: who sees what, who decides, and when a request stops
 * being editable.
 *
 * <p>{@code @Transactional} rolls each test back, so every one of them starts from the
 * same seeded data regardless of the order they run in.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class LeaveControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void employeeOnlySeesOwnRequestsWhileAdminSeesAll() throws Exception {
        // Alice owns two of the four seeded requests.
        mockMvc.perform(get("/api/leaves").header(HttpHeaders.AUTHORIZATION, bearer("alice@mis.com", "alice123")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[*].employee.email").value(everyItem(is("alice@mis.com"))));

        mockMvc.perform(get("/api/leaves").header(HttpHeaders.AUTHORIZATION, bearer("admin@mis.com", "admin123")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4));
    }

    @Test
    void newRequestIsFiledForTheCallerAsPending() throws Exception {
        // The body claims a different owner and an already-approved status; both are ignored.
        long id = createLeave(
                "bob@mis.com",
                "bob123",
                """
                {"startDate":"%s","endDate":"%s","reason":"Study leave",
                 "status":"APPROVED","employee":{"id":1}}
                """
                        .formatted(LocalDate.now().plusDays(30), LocalDate.now().plusDays(31)));

        mockMvc.perform(get("/api/leaves/" + id).header(HttpHeaders.AUTHORIZATION, bearer("bob@mis.com", "bob123")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.employee.email").value("bob@mis.com"));

        // Bob may withdraw his own pending request.
        mockMvc.perform(delete("/api/leaves/" + id).header(HttpHeaders.AUTHORIZATION, bearer("bob@mis.com", "bob123")))
                .andExpect(status().isNoContent());
    }

    @Test
    void endDateBeforeStartDateIsRejected() throws Exception {
        mockMvc.perform(post("/api/leaves")
                        .header(HttpHeaders.AUTHORIZATION, bearer("bob@mis.com", "bob123"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"startDate\":\"2026-05-10\",\"endDate\":\"2026-05-01\",\"reason\":\"Backwards\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void employeeCannotReadOrDeleteSomebodyElsesRequest() throws Exception {
        long alicesLeave = firstLeaveIdOf("alice@mis.com", "alice123");

        mockMvc.perform(get("/api/leaves/" + alicesLeave)
                        .header(HttpHeaders.AUTHORIZATION, bearer("bob@mis.com", "bob123")))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/leaves/" + alicesLeave)
                        .header(HttpHeaders.AUTHORIZATION, bearer("bob@mis.com", "bob123")))
                .andExpect(status().isForbidden());
    }

    @Test
    void employeeCannotChangeAStatusButAdminCan() throws Exception {
        long pending = createLeave(
                "carol@mis.com",
                "carol123",
                "{\"startDate\":\"%s\",\"endDate\":\"%s\",\"reason\":\"Conference\"}"
                        .formatted(LocalDate.now().plusDays(60), LocalDate.now().plusDays(62)));

        mockMvc.perform(statusPatch(pending, "carol@mis.com", "carol123", "APPROVED"))
                .andExpect(status().isForbidden());

        mockMvc.perform(statusPatch(pending, "admin@mis.com", "admin123", "APPROVED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));

        // A decision is final: the same request cannot be decided twice.
        mockMvc.perform(statusPatch(pending, "admin@mis.com", "admin123", "REJECTED"))
                .andExpect(status().isConflict());

        // And a decided request can no longer be withdrawn by its owner.
        mockMvc.perform(delete("/api/leaves/" + pending)
                        .header(HttpHeaders.AUTHORIZATION, bearer("carol@mis.com", "carol123")))
                .andExpect(status().isConflict());
    }

    private org.springframework.test.web.servlet.RequestBuilder statusPatch(
            long id, String email, String password, String newStatus) throws Exception {
        return patch("/api/leaves/" + id + "/status")
                .header(HttpHeaders.AUTHORIZATION, bearer(email, password))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"%s\"}".formatted(newStatus));
    }

    private long createLeave(String email, String password, String body) throws Exception {
        String created = mockMvc.perform(post("/api/leaves")
                        .header(HttpHeaders.AUTHORIZATION, bearer(email, password))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return ((Number) JsonPath.read(created, "$.id")).longValue();
    }

    private long firstLeaveIdOf(String email, String password) throws Exception {
        String body = mockMvc.perform(get("/api/leaves").header(HttpHeaders.AUTHORIZATION, bearer(email, password)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return ((Number) JsonPath.read(body, "$[0].id")).longValue();
    }

    /** Logs in and builds the Authorization header, the way the frontend does. */
    private String bearer(String email, String password) throws Exception {
        String body = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return "Bearer " + JsonPath.read(body, "$.token");
    }
}
