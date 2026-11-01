package com.quantara.backend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignupRequest(

    @NotBlank(message = "Full name is required")
    @Size(
        min = 2,
        max = 100,
        message = "Full name must be between 2 and 100 characters"
    )
    String fullName,

    @NotBlank(message = "Email is required")
    @Email(message = "Please enter a valid email address")
    @Size(
        max = 255,
        message = "Email must not exceed 255 characters"
    )
    String email,

    @NotBlank(message = "Password is required")
    @Size(
        min = 8,
        max = 128,
        message = "Password must be between 8 and 128 characters"
    )
    String password

) {
    @Override public String toString() { return "SignupRequest[credentials=REDACTED]"; }
}
