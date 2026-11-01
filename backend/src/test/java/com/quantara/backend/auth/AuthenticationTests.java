package com.quantara.backend.auth;

import com.quantara.backend.config.*;
import com.quantara.backend.user.User;
import com.quantara.backend.user.UserRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SessionController.class)
@Import({SecurityConfig.class,AuthenticationConfig.class,PasswordConfig.class,ApiErrors.class})
class AuthenticationTests {
    @Autowired MockMvc mvc;
    @Autowired PasswordEncoder encoder;
    @MockitoBean UserRepository users;
    @BeforeEach void user(){
        var user=new User();user.setId(UUID.randomUUID());user.setFullName("Test User");user.setEmail("unit@example.test");user.setPasswordHash(encoder.encode("UnitTest!2026"));user.setActive(true);
        when(users.findByEmail("unit@example.test")).thenReturn(Optional.of(user));
        when(users.findById(user.getId())).thenReturn(Optional.of(user));
    }
    @Test void loginPersistsSessionAndLogoutRevokesIt() throws Exception {
        var result=mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json").content("{\"email\":\"unit@example.test\",\"password\":\"UnitTest!2026\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("email").value("unit@example.test")).andExpect(jsonPath("passwordHash").doesNotExist()).andReturn();
        var session=(MockHttpSession)result.getRequest().getSession(false);
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk()).andExpect(jsonPath("fullName").value("Test User"));
        mvc.perform(post("/api/auth/logout").session(session).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }
    @Test void rejectsWrongPasswordWithoutLeakingUserDetails() throws Exception {
        mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json").content("{\"email\":\"unit@example.test\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("message").value("Invalid email or password"));
    }
    @Test void loginRequiresCsrf() throws Exception {
        mvc.perform(post("/api/auth/login").contentType("application/json").content("{}" )).andExpect(status().isForbidden());
    }
}
