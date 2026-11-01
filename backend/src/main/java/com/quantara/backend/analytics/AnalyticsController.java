package com.quantara.backend.analytics;

import com.quantara.backend.auth.AccountPrincipal;
import com.quantara.backend.dataset.DatasetService;
import com.quantara.backend.workspace.WorkspaceEvents;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api")
public class AnalyticsController {
    private final DatasetService datasets;private final OllamaService ollama;private final ObjectMapper json;private final WorkspaceEvents events;
    private final String mlUrl;private final String mlToken;private final QueryEngine engine;
    private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    public AnalyticsController(DatasetService datasets,OllamaService ollama,ObjectMapper json,WorkspaceEvents events,QueryEngine engine,
            @Value("${app.ml.url:http://127.0.0.1:8001}")String mlUrl,@Value("${ML_SERVICE_TOKEN:}")String mlToken){this.datasets=datasets;this.ollama=ollama;this.json=json;this.events=events;this.engine=engine;this.mlUrl=mlUrl.replaceAll("/+$","");this.mlToken=mlToken;}
    public record Ask(@NotNull UUID datasetId,@NotBlank @Size(max=2000)String question,UUID conversationId){}
    public record Explain(@NotNull UUID datasetId,@NotBlank @Size(max=10_000)String sql){}
    @PostMapping("/copilot/insights")public Object insights(@AuthenticationPrincipal AccountPrincipal user,@Valid @RequestBody Explain body){
        var result=engine.execute(datasets.get(user.id(),body.datasetId()),body.sql());
        var insight=ollama.explain(result);events.record(user.id(),"ai","Interpreted computed query results");return insight;
    }
    public record Analysis(@NotNull UUID datasetId,@NotBlank String dateColumn,@NotBlank String metricColumn,@Min(1)@Max(60)int horizon,@Pattern(regexp="D|W|MS")String frequency,@Pattern(regexp="sum|mean")String aggregation){}
    @GetMapping("/copilot/status")public Object status(){return ollama.status();}
    @PostMapping(value="/copilot/ask/stream",produces="text/event-stream")
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter stream(@AuthenticationPrincipal AccountPrincipal user,@Valid @RequestBody Ask body){
        var dataset=datasets.get(user.id(),body.datasetId());var owner=user.id();
        var emitter=new org.springframework.web.servlet.mvc.method.annotation.SseEmitter(125_000L);
        var worker=Thread.startVirtualThread(()->{
            try{
                var draft=ollama.draft(owner,dataset,body.question(),body.conversationId(),token->{
                    try{emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event().name("token").data(Map.of("text",token)));}
                    catch(java.io.IOException error){throw new java.io.UncheckedIOException(error);}
                });
                events.record(owner,"ai","Drafted a streaming AI-assisted query");
                emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event().name("draft").data(draft));emitter.complete();
            }catch(Exception error){
                try{String message=error instanceof ResponseStatusException status?status.getReason():"The local model could not complete this draft. Please try again.";emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event().name("error").data(Map.of("message",Objects.requireNonNullElse(message,"Unable to draft query"))));emitter.complete();}
                catch(Exception ignored){emitter.completeWithError(error);}
            }
        });
        emitter.onTimeout(worker::interrupt);emitter.onError(error->worker.interrupt());
        return emitter;
    }
    @PostMapping("/copilot/ask")public Object ask(@AuthenticationPrincipal AccountPrincipal user,@Valid @RequestBody Ask body){
        var draft=ollama.draft(user.id(),datasets.get(user.id(),body.datasetId()),body.question(),body.conversationId());
        events.record(user.id(),"ai","Drafted an AI-assisted query");return draft;
    }
    @GetMapping("/analytics/status")public Object mlStatus(){
        if(mlToken.isBlank())return Map.of("available",false,"reason","Statistical service is not configured");
        try{var response=client.send(HttpRequest.newBuilder(URI.create(mlUrl+"/health")).timeout(Duration.ofSeconds(3)).GET().build(),HttpResponse.BodyHandlers.ofString());return Map.of("available",response.statusCode()==200);}
        catch(Exception e){return Map.of("available",false,"reason","Statistical service is not reachable");}
    }
    @PostMapping("/analytics/analyze")public Object analyze(@AuthenticationPrincipal AccountPrincipal user,@Valid @RequestBody Analysis body){
        var dataset=datasets.get(user.id(),body.datasetId());
        if(dataset.columns().stream().noneMatch(c->c.name().equals(body.dateColumn())&&c.type().equals("date"))||dataset.columns().stream().noneMatch(c->c.name().equals(body.metricColumn())&&c.type().equals("number")))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose an inferred date column and numeric metric");
        if(mlToken.isBlank())throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"The statistical service is not configured. Start the Python ML service with the shared ML_SERVICE_TOKEN; see the deployment guide.");
        var rows=dataset.rows().stream().map(row->{var values=new LinkedHashMap<String,Object>();values.put(body.dateColumn(),row.get(body.dateColumn()));values.put(body.metricColumn(),row.get(body.metricColumn()));return values;}).toList();
        try{
            var payload=Map.of("rows",rows,"dateColumn",body.dateColumn(),"metricColumn",body.metricColumn(),"horizon",body.horizon(),"frequency",body.frequency()==null?"D":body.frequency(),"aggregation",body.aggregation()==null?"sum":body.aggregation());
            var request=HttpRequest.newBuilder(URI.create(mlUrl+"/v1/analyze")).timeout(Duration.ofSeconds(60)).header("Content-Type","application/json").header("X-ML-Token",mlToken).POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(payload))).build();
            var response=client.send(request,HttpResponse.BodyHandlers.ofString());
            if(response.statusCode()==422)throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,json.readTree(response.body()).path("detail").asText("This dataset is not suitable for time-series modeling"));
            if(response.statusCode()!=200)throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"The statistical service is unavailable or busy. Try again shortly.");
            events.record(user.id(),"ml","Computed statistical analysis for "+dataset.name());return json.readTree(response.body());
        }catch(ResponseStatusException e){throw e;}
        catch(InterruptedException e){Thread.currentThread().interrupt();throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Statistical analysis was interrupted");}
        catch(Exception e){throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Cannot reach the Python statistical service. Check its configuration; no predictions have been substituted.");}
    }
}
