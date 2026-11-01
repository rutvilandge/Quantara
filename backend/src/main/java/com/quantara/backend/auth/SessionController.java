package com.quantara.backend.auth;

import com.quantara.backend.user.UserRepository;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class SessionController {
    private final AuthenticationManager manager;
    private final SecurityContextRepository contexts;
    private final UserRepository users;

    public SessionController(AuthenticationManager manager, SecurityContextRepository contexts, UserRepository users) {
        this.manager = manager;
        this.contexts = contexts;
        this.users = users;
    }

    public record LoginRequest(@NotBlank @Email @Size(max=255) String email,
                               @NotBlank @Size(max=128) String password) {
        @Override public String toString() { return "LoginRequest[credentials=REDACTED]"; }
    }
    public record Account(UUID id, String fullName, String email) {}

    @PostMapping("/login")
    public Account login(@Valid @RequestBody LoginRequest login, HttpServletRequest request,
                         HttpServletResponse response) {
        var authentication = manager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(login.email(), login.password()));
        new ChangeSessionIdAuthenticationStrategy().onAuthentication(authentication, request, response);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
        new CookieCsrfTokenRepository().saveToken(null, request, response);
        return account((AccountPrincipal) authentication.getPrincipal());
    }

    @GetMapping("/me")
    public Account me(@AuthenticationPrincipal AccountPrincipal user) {
        var current=users.findById(user.id()).orElseThrow(()->new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED,"Please sign in again"));
        if(!current.isActive())throw new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED,"Please sign in again");
        return new Account(current.getId(),current.getFullName(),current.getEmail());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(Authentication authentication, HttpServletRequest request,
                       HttpServletResponse response) {
        new SecurityContextLogoutHandler().logout(request, response, authentication);
        new CookieCsrfTokenRepository().saveToken(null, request, response);
    }

    private Account account(AccountPrincipal user) {
        return new Account(user.id(), user.fullName(), user.getUsername());
    }
}
