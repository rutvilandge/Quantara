package com.quantara.backend.analytics;

import com.quantara.backend.dataset.DatasetService;
import jakarta.annotation.PreDestroy;
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** Ephemeral per-request analytics: the Neon owner connection never executes user SQL. */
@Component
public class QueryEngine {
    private static final Pattern FORBIDDEN=Pattern.compile("(?i)\\b(insert|update|delete|drop|alter|create|copy|export|import|attach|detach|install|load|pragma|call|set|reset|secret|execute|prepare|vacuum|checkpoint|grant|revoke|truncate|read_[a-z_]*|glob|query|query_table|duckdb_[a-z_]*|sqlite_[a-z_]*|postgres_[a-z_]*|http[a-z_]*)\\b");
    private final Semaphore capacity=new Semaphore(2);
    private final ScheduledExecutorService timer=Executors.newScheduledThreadPool(1,r->{var t=new Thread(r,"query-timeout");t.setDaemon(true);return t;});
    public record Result(List<String> columns,List<Map<String,Object>> rows,long durationMs,boolean truncated) {}

    public String validate(String sql) {
        if(sql==null||sql.isBlank()||sql.length()>10_000)bad("Enter a SQL query up to 10,000 characters");
        String query=sql.trim().replaceFirst(";\\s*$", "");
        if(!query.matches("(?is)^(SELECT|WITH)\\b.*")||query.contains(";")||query.contains("--")||query.contains("/*")||FORBIDDEN.matcher(query).find())bad("Only a single read-only SELECT query over your dataset is allowed");
        return query;
    }

    public Result execute(DatasetService.Dataset dataset,String input) {
        String sql=validate(input);
        if(!capacity.tryAcquire())throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"The query engine is busy. Try again in a moment.");
        long start=System.nanoTime();
        try(var connection=DriverManager.getConnection("jdbc:duckdb:")) {
            try(var settings=connection.createStatement()) {
                settings.execute("SET memory_limit='64MB'");settings.execute("SET threads=1");
                settings.execute("SET temp_directory=''");settings.execute("SET autoinstall_known_extensions=false");
                settings.execute("SET autoload_known_extensions=false");settings.execute("SET enable_external_access=false");
                settings.execute("SET lock_configuration=true");
                String columns=dataset.columns().stream().map(c->quote(c.name())+" "+switch(c.type()){case "number"->"DOUBLE";case "boolean"->"BOOLEAN";case "date"->"DATE";default->"VARCHAR";}).reduce((a,b)->a+","+b).orElseThrow();
                settings.execute("CREATE TABLE data ("+columns+")");
            }
            String placeholders=String.join(",",Collections.nCopies(dataset.columns().size(),"?"));
            try(var insert=connection.prepareStatement("INSERT INTO data VALUES ("+placeholders+")")) {
                for(var row:dataset.rows()) {
                    for(int c=0;c<dataset.columns().size();c++) {
                        var column=dataset.columns().get(c);Object value=row.get(column.name());
                        if(value!=null&&column.type().equals("date"))value=java.sql.Date.valueOf(value.toString());
                        insert.setObject(c+1,value);
                    }
                    insert.addBatch();
                }
                insert.executeBatch();
            }
            try(var statement=connection.createStatement()) {
                var timeout=timer.schedule(()->{try{statement.cancel();}catch(SQLException ignored){}},8,TimeUnit.SECONDS);
                try(var results=statement.executeQuery("SELECT * FROM ("+sql+") AS quantara_result LIMIT 501")) {
                    var columns=new ArrayList<String>();var rows=new ArrayList<Map<String,Object>>();
                    var metadata=results.getMetaData();
                    for(int c=1;c<=metadata.getColumnCount();c++)columns.add(metadata.getColumnLabel(c));
                    if(new HashSet<>(columns).size()!=columns.size())bad("Use unique aliases for your result columns");
                    while(results.next()) {
                        var row=new LinkedHashMap<String,Object>();
                        for(int c=1;c<=columns.size();c++) {
                            Object value=results.getObject(c);
                            if(value instanceof java.sql.Date||value instanceof java.sql.Timestamp||value instanceof java.time.temporal.TemporalAccessor)value=value.toString();
                            if(value instanceof String text&&text.length()>10_000)value=text.substring(0,10_000);
                            row.put(columns.get(c-1),value);
                        }
                        rows.add(row);
                    }
                    boolean truncated=rows.size()>500;if(truncated)rows.removeLast();
                    return new Result(columns,rows,TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-start),truncated);
                } finally { timeout.cancel(false); }
            }
        } catch(SQLException e) {
            String message=e.getMessage();
            if(message!=null&&message.toLowerCase(Locale.ROOT).contains("interrupt"))bad("The query exceeded the 8-second execution limit. Try a smaller query.");
            bad("Query could not run. Check column names, types, and SQL syntax; the dataset table is named data.");
            throw new IllegalStateException();
        } finally { capacity.release(); }
    }
    private String quote(String name){return "\""+name.replace("\"","\"\"")+"\"";}
    private void bad(String message){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,message);}
    @PreDestroy public void close(){timer.shutdownNow();}
}
