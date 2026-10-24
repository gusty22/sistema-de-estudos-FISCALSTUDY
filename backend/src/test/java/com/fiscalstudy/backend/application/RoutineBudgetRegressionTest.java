package com.fiscalstudy.backend.application;
import org.junit.jupiter.api.Test;
import com.fiscalstudy.backend.domain.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.ClassPathResource;
import com.fiscalstudy.backend.infrastructure.out.persistence.StudentRoutineRepositoryImpl;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class RoutineBudgetRegressionTest {
 @Test void zeroBudgetIsAnEmptyPlan(){var r=mock(StudentRoutineRepository.class);var e=mock(EditalRepository.class);var service=new StudentRoutineService(r,e,new ObjectMapper());assertTrue(service.generateCycleFromEdital("c",0).isEmpty());}
 @Test void differentConcursoCannotBorrowRoutine(){var ds=new SingleConnectionDataSource("jdbc:sqlite::memory:",true);try{new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(ds);var j=new JdbcTemplate(ds);j.update("INSERT INTO student_routines(id,concurso_id,modo_planejamento,updated_at) VALUES('one','c1','SEMANAL','2026-01-01')");var repo=new StudentRoutineRepositoryImpl(j);assertTrue(repo.findByConcursoId("c2").isEmpty());assertEquals("one",repo.findByConcursoId("c1").orElseThrow().getId());}finally{ds.destroy();}}
 @Test void legacyDuplicatesArePreservedAndSelectedDeterministically(){var ds=new SingleConnectionDataSource("jdbc:sqlite::memory:",true);try{new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(ds);var j=new JdbcTemplate(ds);j.update("INSERT INTO student_routines(id,concurso_id,modo_planejamento,updated_at) VALUES('old','c','SEMANAL','2026-01-01'),('new','c','SEMANAL','2026-02-01')");var repo=new StudentRoutineRepositoryImpl(j);assertEquals("new",repo.findByConcursoId("c").orElseThrow().getId());assertEquals(2,j.queryForObject("SELECT COUNT(*) FROM student_routines",Integer.class));}finally{ds.destroy();}}
}
