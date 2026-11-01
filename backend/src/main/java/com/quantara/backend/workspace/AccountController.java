package com.quantara.backend.workspace;

import com.quantara.backend.auth.AccountPrincipal;
import com.quantara.backend.auth.SessionController.Account;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/account")
public class AccountController {
    private final JdbcTemplate jdbc;private final WorkspaceEvents events;
    public AccountController(JdbcTemplate jdbc,WorkspaceEvents events){this.jdbc=jdbc;this.events=events;}
    public record Profile(@NotBlank @Size(min=2,max=100)String fullName){}
    public record Preferences(@Pattern(regexp="light|dark|system")String theme,Boolean onboardingComplete){}
    @PatchMapping("/profile") @Transactional
    public Account update(@AuthenticationPrincipal AccountPrincipal user,@Valid @RequestBody Profile profile){
        String name=profile.fullName().trim();if(name.length()<2)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Full name must contain at least two characters");
        jdbc.update("UPDATE users SET full_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",name,user.id());
        events.record(user.id(),"account","Updated account profile");return new Account(user.id(),name,user.getUsername());
    }
    @GetMapping("/preferences") public Object preferences(@AuthenticationPrincipal AccountPrincipal user){
        var rows=jdbc.queryForList("SELECT theme,onboarding_complete FROM account_settings WHERE owner_id=?",user.id());
        return rows.isEmpty()?Map.of("theme","system","onboarding_complete",false):rows.getFirst();
    }
    @PatchMapping("/preferences") public Object preferences(@AuthenticationPrincipal AccountPrincipal user,@Valid @RequestBody Preferences preferences){
        jdbc.update("""
            INSERT INTO account_settings(owner_id,theme,onboarding_complete) VALUES (?,COALESCE(?,'system'),COALESCE(?,false))
            ON CONFLICT(owner_id) DO UPDATE SET theme=COALESCE(?,account_settings.theme),onboarding_complete=COALESCE(?,account_settings.onboarding_complete)
            """,user.id(),preferences.theme(),preferences.onboardingComplete(),preferences.theme(),preferences.onboardingComplete());
        return preferences(user);
    }
    @GetMapping("/usage") public Object usage(@AuthenticationPrincipal AccountPrincipal user){
        return Map.of("queries",jdbc.queryForMap("SELECT COUNT(*) AS count,COALESCE(AVG(duration_ms),0) AS average_ms,COALESCE(SUM(row_count),0) AS result_rows FROM query_history WHERE owner_id=?",user.id()),
                "aiQuestions",jdbc.queryForObject("SELECT COUNT(*) FROM copilot_messages WHERE owner_id=? AND role='user'",Long.class,user.id()),
                "statisticalRuns",jdbc.queryForObject("SELECT COUNT(*) FROM workspace_activity WHERE owner_id=? AND kind='ml'",Long.class,user.id()),
                "datasets",jdbc.queryForObject("SELECT COUNT(*) FROM datasets WHERE owner_id=?",Long.class,user.id()),
                "rows",jdbc.queryForObject("SELECT COALESCE(SUM(row_count),0) FROM datasets WHERE owner_id=?",Long.class,user.id()));
    }
}
