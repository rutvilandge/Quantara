package com.quantara.backend.analytics;

import com.quantara.backend.dataset.DatasetService;
import java.util.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

class QueryEngineTests {
    private final QueryEngine engine=new QueryEngine();
    @AfterEach void close(){engine.close();}
    private DatasetService.Dataset dataset(double revenue){
        return new DatasetService.Dataset(UUID.randomUUID(),"Test","test.csv",
                List.of(new DatasetService.Column("region","region","text",0,1,null,null,null),new DatasetService.Column("revenue","revenue","number",0,1,revenue,revenue,revenue)),
                List.of(Map.of("region","West","revenue",revenue)),1,100,false,"2026-01-01");
    }
    @Test void aggregatesActualValuesAndKeepsRequestsIsolated(){
        var a=engine.execute(dataset(125),"SELECT region, SUM(revenue) AS total FROM data GROUP BY region");
        var b=engine.execute(dataset(9),"SELECT SUM(revenue) AS total FROM data");
        assertEquals(125.0,((Number)a.rows().getFirst().get("total")).doubleValue());
        assertEquals(9.0,((Number)b.rows().getFirst().get("total")).doubleValue());
    }
    @Test void rejectsWritesMultipleStatementsAndExternalReaders(){
        for(String sql:List.of("DELETE FROM data","SELECT * FROM data; DROP TABLE data","SELECT * FROM read_csv('/private.csv')","SELECT * FROM data -- comment","CALL getenv('HOME')")){
            assertThrows(ResponseStatusException.class,()->engine.execute(dataset(1),sql));
        }
    }
    @Test void cannotReadApplicationTables(){
        assertThrows(ResponseStatusException.class,()->engine.execute(dataset(1),"SELECT * FROM users"));
    }
}
