package com.quantara.backend.config;

import com.quantara.backend.auth.AccountPrincipal;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.LOWEST_PRECEDENCE - 10)
public class ApiRateLimitFilter extends OncePerRequestFilter {
    private record Bucket(long expiresAt,AtomicInteger requests){}
    private final ConcurrentHashMap<String,Bucket> buckets=new ConcurrentHashMap<>();
    private final AtomicInteger calls=new AtomicInteger();
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
        String path=request.getRequestURI();
        if(!path.startsWith("/api/")||request.getMethod().equals("OPTIONS")){chain.doFilter(request,response);return;}
        long now=System.currentTimeMillis();
        if(calls.incrementAndGet()%100==0)buckets.entrySet().removeIf(entry->entry.getValue().expiresAt()<now);
        var authentication=SecurityContextHolder.getContext().getAuthentication();
        String identity=authentication!=null&&authentication.getPrincipal() instanceof AccountPrincipal principal?principal.id().toString():request.getRemoteAddr();
        int limit=600;long window=60_000;String category="read";
        if(!request.getMethod().equals("GET")){limit=120;category="write";}
        if(path.equals("/api/auth/login")){limit=30;window=300_000;category="login";}
        if(path.equals("/api/auth/signup")){limit=15;window=3_600_000;category="signup";}
        if(path.startsWith("/api/copilot/")&&!request.getMethod().equals("GET")){limit=6;category="ai";}
        if(path.equals("/api/analytics/analyze")){limit=10;category="ml";}
        String key=category+":"+identity;
        if(buckets.size()>10_000&&!buckets.containsKey(key)){reject(response,60);return;}
        long duration=window;
        var bucket=buckets.compute(key,(ignored,previous)->previous==null||previous.expiresAt()<now?new Bucket(now+duration,new AtomicInteger()):previous);
        if(bucket.requests().incrementAndGet()>limit){reject(response,Math.max(1,(bucket.expiresAt()-now)/1000));return;}
        try{chain.doFilter(request,response);}
        finally{
            // Deliberately omit request bodies, query strings, cookies, and credentials.
            if(!request.getMethod().equals("GET"))logger.info("API audit method="+request.getMethod()+" path="+path+" status="+response.getStatus());
        }
    }
    private void reject(HttpServletResponse response,long retry) throws IOException {
        response.setStatus(429);response.setHeader("Retry-After",String.valueOf(retry));response.setContentType("application/json");response.getWriter().write("{\"message\":\"Too many requests. Try again shortly.\"}");
    }
}
