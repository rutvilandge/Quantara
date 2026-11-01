package com.quantara.backend.auth;

import com.quantara.backend.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CsrfController.class)
@Import({SecurityConfig.class, CsrfControllerTests.SessionConfiguration.class})
class CsrfControllerTests {

    @TestConfiguration
    static class SessionConfiguration {
        @Bean
        SecurityContextRepository contexts() { return new HttpSessionSecurityContextRepository(); }
    }

    @Autowired
    private MockMvc mvc;

    @Test
    void anonymousClientCanFetchCsrfToken() throws Exception {
        mvc.perform(get("/api/auth/csrf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("headerName").value("X-XSRF-TOKEN"))
                .andExpect(jsonPath("token").isNotEmpty())
                .andExpect(cookie().exists("XSRF-TOKEN"));
    }

    @Test
    void signupStillRequiresCsrfToken() throws Exception {
        mvc.perform(post("/api/auth/signup").contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void otherEndpointsStillRequireAuthentication() throws Exception {
        mvc.perform(get("/api/private"))
                .andExpect(status().isUnauthorized());
    }
}
