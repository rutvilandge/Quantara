package com.quantara.backend.workspace;

import com.quantara.backend.auth.AccountPrincipal;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/workspace")
public class WorkspaceController {
    private final JdbcTemplate jdbc;
    public WorkspaceController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping("/search")
    public Object search(@AuthenticationPrincipal AccountPrincipal user,@RequestParam(defaultValue="")String q){
        if(q.length()<2)return java.util.List.of();
        if(q.length()>100)throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"Search is limited to 100 characters");
        String pattern="%"+q+"%";var results=new java.util.ArrayList<Map<String,Object>>();
        for(String table:java.util.List.of("datasets","dashboards","saved_queries")){
            var rows=jdbc.queryForList("SELECT id,name"+(table.equals("saved_queries")?",dataset_id":"")+" FROM "+table+" WHERE owner_id=? AND name ILIKE ? ORDER BY created_at DESC LIMIT 10",user.id(),pattern);
            for(var row:rows)results.add(Map.of("id",row.get("id"),"title",row.get("name"),"type",table.equals("saved_queries")?"Saved query":table.equals("datasets")?"Dataset":"Dashboard","path",table.equals("saved_queries")?"/app/queries?dataset="+row.get("dataset_id"):"/app/"+table+"/"+row.get("id")));
        }
        return results;
    }

    @GetMapping("/notifications")
    public Object notifications(@AuthenticationPrincipal AccountPrincipal user){
        return jdbc.queryForList("""
            SELECT a.id,a.kind,a.description,a.created_at,
              (s.notifications_seen_at IS NULL OR a.created_at > s.notifications_seen_at) AS unread
            FROM workspace_activity a LEFT JOIN account_settings s ON s.owner_id=a.owner_id
            WHERE a.owner_id=? ORDER BY a.created_at DESC LIMIT 20
            """,user.id());
    }
    @PostMapping("/notifications/read")
    public Object read(@AuthenticationPrincipal AccountPrincipal user){
        jdbc.update("INSERT INTO account_settings(owner_id,notifications_seen_at) VALUES (?,CURRENT_TIMESTAMP) ON CONFLICT(owner_id) DO UPDATE SET notifications_seen_at=CURRENT_TIMESTAMP",user.id());
        return Map.of("message","Notifications marked as read");
    }

    @GetMapping("/overview")
    public Map<String, Object> overview(@AuthenticationPrincipal AccountPrincipal user) {
        var metrics = jdbc.queryForMap("""
            SELECT COUNT(*) AS datasets, COALESCE(SUM(row_count), 0) AS rows,
              COALESCE(AVG(quality_score), 0) AS quality
            FROM datasets WHERE owner_id = ?
            """, user.id());
        var analyses = jdbc.queryForObject("SELECT COUNT(*) FROM query_history WHERE owner_id = ?", Long.class, user.id());
        var dashboards = jdbc.queryForObject("SELECT COUNT(*) FROM dashboards WHERE owner_id = ?", Long.class, user.id());
        return Map.of("metrics", metrics, "analyses", analyses, "dashboards", dashboards,
            "activity", jdbc.queryForList("SELECT id, kind, description, created_at FROM workspace_activity WHERE owner_id = ? ORDER BY created_at DESC LIMIT 20", user.id()),
            "recentDatasets", jdbc.queryForList("SELECT id, name, row_count, quality_score, is_demo, created_at FROM datasets WHERE owner_id = ? ORDER BY created_at DESC LIMIT 5", user.id()),
            "timeline", jdbc.queryForList("""
                SELECT to_char(day, 'Mon DD') AS label, COUNT(a.id) AS events
                FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day') day
                LEFT JOIN workspace_activity a ON a.created_at::date = day::date AND a.owner_id = ?
                GROUP BY day ORDER BY day
                """, user.id()));
    }
}
