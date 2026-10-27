package com.fiscalstudy.backend.infrastructure.in.web;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;
import static org.junit.jupiter.api.Assertions.*;
class ProspectiveExportSecurityTest {
 int status(String path,String remote,String host,String token,String origin,String referer) throws Exception {
  var req=new MockHttpServletRequest("GET",path);req.setRemoteAddr(remote);req.setServerName(host);
  if(token!=null)req.addHeader("X-FiscalStudy-Admin-Token",token);
  if(origin!=null)req.addHeader("Origin",origin);
  if(referer!=null)req.addHeader("Referer",referer);
  var res=new MockHttpServletResponse();
  new LocalAccessFilter("http://localhost:5173,http://127.0.0.1:5173","fixture-token")
    .doFilter(req,res,(r,s)->((jakarta.servlet.http.HttpServletResponse)s).setStatus(204));
  return res.getStatus();
 }
 @Test void exportRequiresTokenEvenOnLoopback() throws Exception {
  assertEquals(403,status("/api/v1/learning-lab/prospective-export","127.0.0.1","localhost",null,null,null));
  assertEquals(403,status("/api/v1/learning-lab/prospective-export","127.0.0.1","localhost","wrong",null,null));
  assertEquals(204,status("/api/v1/learning-lab/prospective-export","127.0.0.1","localhost","fixture-token",null,null));
 }
 @Test void encodedExportPathStillRequiresAuthorization() throws Exception {
  assertEquals(403,status("/api/v1/learning-lab/prospective-%65xport","127.0.0.1","localhost",null,null,null));
 }
 @Test void tokenDoesNotAuthorizeLanOrReboundHost() throws Exception {
  assertEquals(403,status("/api/v1/learning-lab/prospective-export","192.168.1.2","localhost","fixture-token",null,null));
  assertEquals(403,status("/api/v1/learning-lab/prospective-export","127.0.0.1","evil.example","fixture-token",null,null));
 }
 @Test void exactRefererOriginAndFetchOriginsAreEnforced() throws Exception {
  assertEquals(403,status("/api/v1/learning-lab/prospective-export","127.0.0.1","localhost","fixture-token","https://evil.example",null));
  assertEquals(403,status("/api/v1/learning-lab/prospective-export","127.0.0.1","localhost","fixture-token",null,"http://localhost:5173.evil.example/"));
  assertEquals(204,status("/api/v1/learning-lab/prospective-export","127.0.0.1","localhost","fixture-token",null,"http://localhost:5173/path"));
 }
 @Test void localPreparationDoesNotRequireExportCredentials() throws Exception {
  assertEquals(204,status("/api/v1/questions/q/predictions","127.0.0.1","localhost",null,"http://localhost:5173",null));
  assertEquals(403,status("/api/v1/questions/q/predictions","192.168.1.2","localhost",null,null,null));
 }
}
