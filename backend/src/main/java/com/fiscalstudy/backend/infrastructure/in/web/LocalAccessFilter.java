package com.fiscalstudy.backend.infrastructure.in.web;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** Local single-user boundary; browser origins never bypass administrative authorization. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class LocalAccessFilter extends OncePerRequestFilter {
    private final Set<String> origins;
    private final String adminToken;
    public LocalAccessFilter(@Value("${fiscalstudy.security.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}") String allowed,
                             @Value("${fiscalstudy.security.admin-token:}") String token) {
        origins = new HashSet<>(Arrays.asList(allowed.split(",")));
        adminToken = token;
    }
    @Override protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        String origin = req.getHeader("Origin");
        if (origin != null && !origins.contains(origin)) { deny(res,403,"Origin not allowed"); return; }
        String secFetchSite = req.getHeader("Sec-Fetch-Site");
        if (secFetchSite != null && "cross-site".equalsIgnoreCase(secFetchSite)) {
            deny(res, 403, "Cross-site request forbidden");
            return;
        }
        String referer = req.getHeader("Referer");
        if (referer != null && !referer.isBlank()) {
            boolean allowedReferer = false;
            for (String allowed : origins) {
                if (sameOrigin(referer, allowed)) {
                    allowedReferer = true;
                    break;
                }
            }
            if (!allowedReferer) {
                deny(res, 403, "Referer origin not allowed");
                return;
            }
        }
        String uri=req.getServletPath();
        if(uri==null || uri.isBlank()) {
            try { uri=java.net.URLDecoder.decode(req.getRequestURI(),StandardCharsets.UTF_8); }
            catch(IllegalArgumentException invalid) { deny(res,400,"Invalid request path");return; }
        }
        boolean prospective=uri.startsWith("/api/v1/learning-lab/") ||
            (uri.startsWith("/api/v1/questions/") && uri.contains("/predictions"));
        if(prospective) {
            boolean loopback;
            try { loopback=InetAddress.getByName(req.getRemoteAddr()).isLoopbackAddress(); }
            catch(Exception e) { loopback=false; }
            String host=req.getServerName();
            if(!loopback || !Set.of("localhost","127.0.0.1","::1","[::1]").contains(host)) {
                deny(res,403,"Prospective personal lab requires a loopback connection and local Host");return;
            }
        }
        boolean admin=uri.startsWith("/api/v1/learning-lab/prospective-export") || uri.startsWith("/api/v1/system/backup") || uri.startsWith("/api/v1/system/audit") || uri.startsWith("/api/v1/ingestion");
        if (admin && !"OPTIONS".equals(req.getMethod())) {
            boolean local;
            try { local=InetAddress.getByName(req.getRemoteAddr()).isLoopbackAddress(); }
            catch(Exception e){ local=false; }
            String supplied=req.getHeader("X-FiscalStudy-Admin-Token");
            if(!local || adminToken.isBlank() || supplied==null || !MessageDigest.isEqual(adminToken.getBytes(StandardCharsets.UTF_8),supplied.getBytes(StandardCharsets.UTF_8))) {
                deny(res,403,"Administrative operation requires loopback access and configured admin token"); return;
            }
        }
        boolean isKnowledgeRebuild = uri.startsWith("/api/v1/knowledge/rebuild") && !"OPTIONS".equals(req.getMethod());
        if (isKnowledgeRebuild) {
            boolean local;
            try { local = InetAddress.getByName(req.getRemoteAddr()).isLoopbackAddress(); }
            catch(Exception e){ local = false; }
            if (!local) {
                deny(res, 403, "Rebuild operation is strictly restricted to local loopback interface");
                return;
            }
            if (!adminToken.isBlank()) {
                String supplied = req.getHeader("X-FiscalStudy-Admin-Token");
                if (supplied == null || !MessageDigest.isEqual(adminToken.getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8))) {
                    deny(res, 403, "Administrative rebuild requires configured admin token");
                    return;
                }
            }
        }
        chain.doFilter(req,res);
    }
    private static boolean sameOrigin(String referer,String allowed) {
        try {
            java.net.URI actual=java.net.URI.create(referer), expected=java.net.URI.create(allowed);
            return Objects.equals(actual.getScheme(),expected.getScheme()) &&
                Objects.equals(actual.getHost(),expected.getHost()) && actual.getPort()==expected.getPort() &&
                actual.getUserInfo()==null;
        } catch(Exception invalid) { return false; }
    }
    private static void deny(HttpServletResponse res,int code,String message)throws IOException {
        res.setStatus(code);res.setContentType("application/json");res.getWriter().write("{\"error\":\""+message+"\"}");
    }
}
