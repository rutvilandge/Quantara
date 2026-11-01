package com.quantara.backend;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
@EnabledIfEnvironmentVariable(named = "DATABASE_PASSWORD", matches = ".+")
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
