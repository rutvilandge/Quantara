package com.quantara.backend.workspace;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class WorkspaceEvents {
    private final JdbcTemplate jdbc;
    public WorkspaceEvents(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public void record(UUID owner, String kind, String description) {
        jdbc.update("INSERT INTO workspace_activity(id, owner_id, kind, description) VALUES (?, ?, ?, ?)",
                UUID.randomUUID(), owner, kind, description.length() > 300 ? description.substring(0,300) : description);
    }
}
