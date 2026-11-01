package com.quantara.backend.workspace;

import com.quantara.backend.analytics.QueryEngine;
import com.quantara.backend.auth.AccountPrincipal;
import com.quantara.backend.dataset.DatasetService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/dashboards")
public class DashboardController {
    private final JdbcTemplate jdbc;private final DatasetService datasets;private final QueryEngine engine;private final ObjectMapper json;private final WorkspaceEvents events;
    public DashboardController(JdbcTemplate jdbc,DatasetService datasets,QueryEngine engine,ObjectMapper json,WorkspaceEvents events){this.jdbc=jdbc;this.datasets=datasets;this.engine=engine;this.json=json;this.events=events;}
    public record Widget(@NotBlank @Size(max=64)String id,@NotBlank @Size(max=120)String title,@NotNull UUID datasetId,
                         @NotBlank @Size(max=10000)String sql,@NotNull @Pattern(regexp="bar|line|area|pie|scatter|heatmap|table|kpi")String chartType,
                         @Size(max=100)String dimension,@Size(max=100)String metric){}
    public record Layout(@NotBlank @Size(max=150)String name,@NotNull @Size(max=12)List<@Valid Widget> widgets){}
    @GetMapping public Object list(@AuthenticationPrincipal AccountPrincipal user){return jdbc.queryForList("SELECT id,name,jsonb_array_length(layout_json) AS widget_count,created_at,updated_at FROM dashboards WHERE owner_id=? ORDER BY updated_at DESC LIMIT 100",user.id());}
    @GetMapping("/{id}")public Object get(@AuthenticationPrincipal AccountPrincipal user,@PathVariable UUID id){
        var rows=jdbc.queryForList("SELECT id,name,layout_json,updated_at FROM dashboards WHERE id=? AND owner_id=?",id,user.id());
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Dashboard not found");
        var row=rows.getFirst();return Map.of("id",row.get("id"),"name",row.get("name"),"widgets",json.readTree(row.get("layout_json").toString()),"updatedAt",row.get("updated_at"));
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) @Transactional
    public Object create(@AuthenticationPrincipal AccountPrincipal user,@Valid @RequestBody Layout layout){
        validate(user.id(),layout);UUID id=UUID.randomUUID();
        if(jdbc.queryForObject("SELECT COUNT(*) FROM dashboards WHERE owner_id=?",Long.class,user.id())>=100)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"The limit is 100 saved dashboards");
        jdbc.update("INSERT INTO dashboards(id,owner_id,name,layout_json) VALUES (?,?,?,?::jsonb)",id,user.id(),layout.name().trim(),json.writeValueAsString(layout.widgets()));
        events.record(user.id(),"dashboard","Created dashboard: "+layout.name());return Map.of("id",id);
    }
    @PutMapping("/{id}") @Transactional
    public Object update(@AuthenticationPrincipal AccountPrincipal user,@PathVariable UUID id,@Valid @RequestBody Layout layout){
        validate(user.id(),layout);
        if(jdbc.update("UPDATE dashboards SET name=?,layout_json=?::jsonb,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?",layout.name().trim(),json.writeValueAsString(layout.widgets()),id,user.id())==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Dashboard not found");
        events.record(user.id(),"dashboard","Updated dashboard: "+layout.name());return Map.of("id",id);
    }
    private void validate(UUID owner,Layout layout){
        var checked=new HashSet<UUID>();var identifiers=new HashSet<String>();
        for(var widget:layout.widgets()){
            if(!identifiers.add(widget.id()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Widget identifiers must be unique");
            if(checked.add(widget.datasetId()))datasets.get(owner,widget.datasetId());engine.validate(widget.sql());
        }
    }
}
