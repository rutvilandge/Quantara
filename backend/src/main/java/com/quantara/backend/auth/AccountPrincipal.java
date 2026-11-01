package com.quantara.backend.auth;

import com.quantara.backend.user.User;
import java.util.UUID;
import java.util.List;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

public final class AccountPrincipal extends org.springframework.security.core.userdetails.User {
    private final UUID id;
    private final String fullName;

    public AccountPrincipal(User user) {
        super(user.getEmail(), user.getPasswordHash(), user.isActive(), true, true, true,
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        this.id = user.getId();
        this.fullName = user.getFullName();
    }

    public UUID id() { return id; }
    public String fullName() { return fullName; }
}
