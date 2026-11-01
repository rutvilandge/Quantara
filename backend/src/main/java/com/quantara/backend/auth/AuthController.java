package com.quantara.backend.auth;

import com.quantara.backend.auth.dto.SignupRequest;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    public ResponseEntity<Map<String, Object>> signup(
            @Valid @RequestBody SignupRequest request
    ) {

        UUID userId = authService.register(request);

        Map<String, Object> response = Map.of(
                "message", "Account created successfully",
                "userId", userId
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }
}