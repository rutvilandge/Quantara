package com.quantara.backend.analytics;

import com.quantara.backend.auth.AccountPrincipal;
import com.quantara.backend.dataset.DatasetService;
import com.quantara.backend.workspace.WorkspaceEvents;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/queries")
public class QueryController {
    private final DatasetService datasets;private final QueryEngine engine;private final JdbcTemplate jdbc;private final WorkspaceEvents events;
    public QueryController(DatasetService datasets,QueryEngine engine,JdbcTemplate jdbc,WorkspaceEvents events){this.datasets=datasets;this.engine=engine;this.jdbc=jdbc;this.events=events;}
    public record QueryRequest(@NotNull UUID datasetId,@NotBlank @Size(max=10_000) String sql,
                               String dateColumn,String from,String to,String categoryColumn,String categoryValue) {}
    public record SaveRequest(@NotNull UUID datasetId,@NotBlank @Size(max=150) String name,@NotBlank @Size(max=10_000) String sql) {}
    @PostMapping("/run")
    public Object run(@AuthenticationPrincipal AccountPrincipal user,@Valid @RequestBody QueryRequest body){
        var source=datasets.get(user.id(),body.datasetId());
        var result=engine.execute(datasets.filter(source,body.dateColumn(),body.from(),body.to(),body.categoryColumn(),body.categoryValue()),body.sql());
        jdbc.update("INSERT INTO query_history(id,owner_id,dataset_id,sql_text,row_count,duration_ms) VALUES (?,?,?,?,?,?)",UUID.randomUUID(),user.id(),body.datasetId(),body.sql(),result.rows().size(),result.durationMs());
        events.record(user.id(),"query","Executed an analysis: "+result.rows().size()+" result rows");return result;
    }
    @GetMapping("/history") public Object history(@AuthenticationPrincipal AccountPrincipal user){return jdbc.queryForList("SELECT id,dataset_id,question,sql_text,row_count,duration_ms,created_at FROM query_history WHERE owner_id=? ORDER BY created_at DESC LIMIT 100",user.id());}
    @GetMapping public Object saved(@AuthenticationPrincipal AccountPrincipal user){return jdbc.queryForList("SELECT id,dataset_id,name,sql_text,created_at FROM saved_queries WHERE owner_id=? ORDER BY created_at DESC LIMIT 100",user.id());}
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public Object save(@AuthenticationPrincipal AccountPrincipal user,@Valid @RequestBody SaveRequest body){
        datasets.get(user.id(),body.datasetId());engine.validate(body.sql());UUID id=UUID.randomUUID();
        jdbc.update("INSERT INTO saved_queries(id,owner_id,dataset_id,name,sql_text) VALUES (?,?,?,?,?)",id,user.id(),body.datasetId(),body.name().trim(),body.sql());
        events.record(user.id(),"query","Saved query: "+body.name().trim());return Map.of("id",id);
    }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AccountPrincipal user,@PathVariable UUID id){if(jdbc.update("DELETE FROM saved_queries WHERE id=? AND owner_id=?",id,user.id())==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Query not found");}
}
