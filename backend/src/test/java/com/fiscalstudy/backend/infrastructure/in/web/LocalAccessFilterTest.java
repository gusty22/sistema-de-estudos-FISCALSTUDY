package com.fiscalstudy.backend.infrastructure.in.web;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;
import static org.junit.jupiter.api.Assertions.*;
class LocalAccessFilterTest {
 @Test void rejectsUntrustedOriginEvenOnOrdinaryRoute()throws Exception{
  var f=new LocalAccessFilter("http://localhost:5173","secret");var req=new MockHttpServletRequest("POST","/api/v1/questions/x/attempts");req.addHeader("Origin","https://evil.example");var res=new MockHttpServletResponse();f.doFilter(req,res,new MockFilterChain());assertEquals(403,res.getStatus());
 }
 @Test void adminRequiresConfiguredTokenAndLoopback()throws Exception{
  var f=new LocalAccessFilter("http://localhost:5173","secret");var req=new MockHttpServletRequest("POST","/api/v1/system/backup/create");req.setRemoteAddr("127.0.0.1");var res=new MockHttpServletResponse();f.doFilter(req,res,new MockFilterChain());assertEquals(403,res.getStatus());
  req.addHeader("X-FiscalStudy-Admin-Token","secret");res=new MockHttpServletResponse();f.doFilter(req,res,new MockFilterChain());assertEquals(200,res.getStatus());
  req.setRemoteAddr("192.0.2.9");res=new MockHttpServletResponse();f.doFilter(req,res,new MockFilterChain());assertEquals(403,res.getStatus());
 }
 @Test void unsetTokenDisablesAdministrationButAllowsLocalSettings()throws Exception{
  var f=new LocalAccessFilter("http://localhost:5173","");var req=new MockHttpServletRequest("POST","/api/v1/system/backup/restore");req.setRemoteAddr("127.0.0.1");var res=new MockHttpServletResponse();f.doFilter(req,res,new MockFilterChain());assertEquals(403,res.getStatus());
  req=new MockHttpServletRequest("POST","/api/v1/system/settings");res=new MockHttpServletResponse();f.doFilter(req,res,new MockFilterChain());assertEquals(200,res.getStatus());
 }
}
