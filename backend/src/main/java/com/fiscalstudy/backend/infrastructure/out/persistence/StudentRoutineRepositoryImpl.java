package com.fiscalstudy.backend.infrastructure.out.persistence;

import com.fiscalstudy.backend.domain.RoutineCommitment;
import com.fiscalstudy.backend.domain.RoutineException;
import com.fiscalstudy.backend.domain.StudentRoutine;
import com.fiscalstudy.backend.domain.StudentRoutineRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Repository
public class StudentRoutineRepositoryImpl implements StudentRoutineRepository {

    private final JdbcTemplate jdbcTemplate;

    private final RowMapper<StudentRoutine> routineRowMapper = (rs, rowNum) -> new StudentRoutine(
            rs.getString("id"),
            rs.getString("concurso_id"),
            rs.getString("modo_planejamento"),
            rs.getDouble("horas_segunda"),
            rs.getDouble("horas_terca"),
            rs.getDouble("horas_quarta"),
            rs.getDouble("horas_quinta"),
            rs.getDouble("horas_sexta"),
            rs.getDouble("horas_sabado"),
            rs.getDouble("horas_domingo"),
            rs.getString("ciclo_disciplinas_json"),
            rs.getString("updated_at")
    );

    private final RowMapper<RoutineCommitment> commitmentRowMapper = (rs, rowNum) -> new RoutineCommitment(
            rs.getString("id"),
            rs.getString("titulo"),
            rs.getString("dia_semana"),
            rs.getString("hora_inicio"),
            rs.getString("hora_fim"),
            rs.getString("tipo"),
            rs.getString("created_at")
    );

    private final RowMapper<RoutineException> exceptionRowMapper = (rs, rowNum) -> new RoutineException(
            rs.getString("id"),
            rs.getString("data"),
            rs.getString("tipo"),
            rs.getDouble("horas"),
            rs.getString("motivo"),
            rs.getString("created_at")
    );

    public StudentRoutineRepositoryImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Optional<StudentRoutine> findByConcursoId(String concursoId) {
        String scope = concursoId == null || concursoId.isBlank() ? "default" : concursoId.trim();
        List<StudentRoutine> list = jdbcTemplate.query(
                "SELECT * FROM student_routines WHERE concurso_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1",
                routineRowMapper, scope);
        return list.stream().findFirst();
    }

    @Override
    public StudentRoutine save(StudentRoutine routine) {
        if (routine.getId() == null || routine.getId().isBlank()) {
            routine.setId(UUID.randomUUID().toString());
        }
        if (routine.getConcursoId() == null || routine.getConcursoId().isBlank() || "undefined".equalsIgnoreCase(routine.getConcursoId()) || "null".equalsIgnoreCase(routine.getConcursoId())) routine.setConcursoId("default");
        // Preserve legacy duplicate rows; new saves target the deterministic canonical record.
        findByConcursoId(routine.getConcursoId()).ifPresent(existing -> routine.setId(existing.getId()));
        routine.setUpdatedAt(Instant.now().toString());

        String sql = """
            INSERT INTO student_routines (
                id, concurso_id, modo_planejamento,
                horas_segunda, horas_terca, horas_quarta, horas_quinta, horas_sexta, horas_sabado, horas_domingo,
                ciclo_disciplinas_json, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                modo_planejamento = excluded.modo_planejamento,
                horas_segunda = excluded.horas_segunda,
                horas_terca = excluded.horas_terca,
                horas_quarta = excluded.horas_quarta,
                horas_quinta = excluded.horas_quinta,
                horas_sexta = excluded.horas_sexta,
                horas_sabado = excluded.horas_sabado,
                horas_domingo = excluded.horas_domingo,
                ciclo_disciplinas_json = excluded.ciclo_disciplinas_json,
                updated_at = excluded.updated_at
        """;

        jdbcTemplate.update(sql,
                routine.getId(),
                routine.getConcursoId(),
                routine.getModoPlanejamento(),
                routine.getHorasSegunda(),
                routine.getHorasTerca(),
                routine.getHorasQuarta(),
                routine.getHorasQuinta(),
                routine.getHorasSexta(),
                routine.getHorasSabado(),
                routine.getHorasDomingo(),
                routine.getCicloDisciplinasJson(),
                routine.getUpdatedAt()
        );
        return routine;
    }

    @Override
    public List<RoutineCommitment> findAllCommitments() {
        return jdbcTemplate.query("SELECT * FROM routine_commitments ORDER BY dia_semana, hora_inicio", commitmentRowMapper);
    }

    @Override
    public RoutineCommitment saveCommitment(RoutineCommitment commitment) {
        if (commitment.getId() == null || commitment.getId().isBlank()) {
            commitment.setId(UUID.randomUUID().toString());
        }
        if (commitment.getCreatedAt() == null) {
            commitment.setCreatedAt(Instant.now().toString());
        }

        String sql = """
            INSERT INTO routine_commitments (id, titulo, dia_semana, hora_inicio, hora_fim, tipo, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                titulo = excluded.titulo,
                dia_semana = excluded.dia_semana,
                hora_inicio = excluded.hora_inicio,
                hora_fim = excluded.hora_fim,
                tipo = excluded.tipo
        """;

        jdbcTemplate.update(sql,
                commitment.getId(),
                commitment.getTitulo(),
                commitment.getDiaSemana(),
                commitment.getHoraInicio(),
                commitment.getHoraFim(),
                commitment.getTipo(),
                commitment.getCreatedAt()
        );
        return commitment;
    }

    @Override
    public void deleteCommitment(String id) {
        jdbcTemplate.update("DELETE FROM routine_commitments WHERE id = ?", id);
    }

    @Override
    public List<RoutineException> findAllExceptions() {
        return jdbcTemplate.query("SELECT * FROM routine_exceptions ORDER BY data DESC", exceptionRowMapper);
    }

    @Override
    public RoutineException saveException(RoutineException exception) {
        if (exception.getId() == null || exception.getId().isBlank()) {
            exception.setId(UUID.randomUUID().toString());
        }
        if (exception.getCreatedAt() == null) {
            exception.setCreatedAt(Instant.now().toString());
        }

        String sql = """
            INSERT INTO routine_exceptions (id, data, tipo, horas, motivo, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                data = excluded.data,
                tipo = excluded.tipo,
                horas = excluded.horas,
                motivo = excluded.motivo
        """;

        jdbcTemplate.update(sql,
                exception.getId(),
                exception.getData(),
                exception.getTipo(),
                exception.getHoras(),
                exception.getMotivo(),
                exception.getCreatedAt()
        );
        return exception;
    }

    @Override
    public void deleteException(String id) {
        jdbcTemplate.update("DELETE FROM routine_exceptions WHERE id = ?", id);
    }
}
