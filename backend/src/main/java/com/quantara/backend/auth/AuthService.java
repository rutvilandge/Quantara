package com.quantara.backend.auth;

import com.quantara.backend.auth.dto.SignupRequest;
import com.quantara.backend.user.User;
import com.quantara.backend.user.UserRepository;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public UUID register(SignupRequest request) {

        // 1. Normalize user input
        String fullName = request.fullName().trim();
        if (fullName.length() < 2 || request.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use a name of at least two characters and a password up to 72 UTF-8 bytes");
        }

        String email = request.email()
                .trim()
                .toLowerCase(Locale.ROOT);

        // 2. Check whether email already exists
        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "An account with this email already exists"
            );
        }

        // 3. Hash password using BCrypt
        String hashedPassword = passwordEncoder.encode(
                request.password()
        );

        // 4. Create user
        User user = new User();

        // Generate UUID in Java for Spring Data JDBC
        user.setId(UUID.randomUUID());

        user.setFullName(fullName);
        user.setEmail(email);
        user.setPasswordHash(hashedPassword);

        user.setEmailVerified(false);
        user.setActive(true);

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        user.setCreatedAt(now);
        user.setUpdatedAt(now);

        // 5. Save user in Neon PostgreSQL
        try {
            userRepository.save(user);
        } catch (DuplicateKeyException exception) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "An account with this email already exists"
            );
        }

        // 6. Return only the user's ID
        return user.getId();
    }
}
