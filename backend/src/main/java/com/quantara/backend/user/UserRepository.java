package com.quantara.backend.user;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends CrudRepository<User, UUID> {

    // Find a user by email (case-insensitive)
    @Query("""
        SELECT *
        FROM users
        WHERE LOWER(email) = LOWER(:email)
        LIMIT 1
        """)
    Optional<User> findByEmail(String email);

    // Check whether an email is already registered
    @Query("""
        SELECT EXISTS (
            SELECT 1
            FROM users
            WHERE LOWER(email) = LOWER(:email)
        )
        """)
    boolean existsByEmail(String email);
}