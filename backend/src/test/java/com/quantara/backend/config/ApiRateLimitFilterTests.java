package com.quantara.backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import static org.junit.jupiter.api.Assertions.*;

class ApiRateLimitFilterTests {
    @Test void loginBurstIsLimitedAndAnotherAddressStillWorks() throws Exception {
        var filter=new ApiRateLimitFilter();
        for(int i=0;i<30;i++)assertEquals(200,request(filter,"127.0.0.1").getStatus());
        var limited=request(filter,"127.0.0.1");assertEquals(429,limited.getStatus());
        assertNotNull(limited.getHeader("Retry-After"));
        assertEquals(200,request(filter,"127.0.0.2").getStatus());
    }
    private MockHttpServletResponse request(ApiRateLimitFilter filter,String address) throws Exception {
        var request=new MockHttpServletRequest("POST","/api/auth/login");request.setRemoteAddr(address);
        var response=new MockHttpServletResponse();filter.doFilter(request,response,(req,res)->{});return response;
    }
}
