package com.fiscalstudy.backend.infrastructure.out.persistence;

import com.fiscalstudy.backend.domain.Concurso;
import com.fiscalstudy.backend.domain.ConcursoRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public class ConcursoRepositoryImpl implements ConcursoRepository {

    private static final Logger logger = LoggerFactory.getLogger(ConcursoRepositoryImpl.class);
    private final JdbcTemplate jdbcTemplate;

    private final RowMapper<Concurso> rowMapper = (rs, rowNum) -> {
        Concurso c = new Concurso();
        c.setId(rs.getString("id"));
        c.setNome(rs.getString("nome"));
        c.setOrgao(rs.getString("orgao"));
        c.setBanca(rs.getString("banca"));
        c.setAno(rs.getObject("ano") != null ? rs.getInt("ano") : null);
        c.setCargo(rs.getString("cargo"));
        c.setCargoCodigo(rs.getString("cargo_codigo"));
        c.setStatus(rs.getString("status"));
        c.setDescricao(rs.getString("descricao"));
        c.setCreatedAt(rs.getString("created_at"));
        c.setUpdatedAt(rs.getString("updated_at"));
        return c;
    };

    public ConcursoRepositoryImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void initDefaultConcursos() {
        try {
            Integer count = jdbcTemplate.queryForObject("SELECT count(*) FROM concursos", Integer.class);
            if (count != null && count == 0) {
                logger.info("Initializing default official concursos: Araguari Auditor e Técnico");
                String now = Instant.now().toString();

                save(new Concurso(
                        "iss-araguari-auditor-2023",
                        "ISS Araguari 2023 — Auditor Fiscal",
                        "Prefeitura Municipal de Araguari - MG",
                        "IBGP",
                        2023,
                        "Auditor Fiscal da Receita Municipal",
                        "503",
                        "ACTIVE",
                        "Concurso oficial para Auditor Fiscal da Receita Municipal de Araguari/MG."
                ));

                save(new Concurso(
                        "iss-araguari-tecnico-2023",
                        "ISS Araguari 2023 — Técnico Fiscal",
                        "Prefeitura Municipal de Araguari - MG",
                        "IBGP",
                        2023,
                        "Técnico Fiscal da Receita Municipal",
                        "532",
                        "ACTIVE",
                        "Concurso oficial para Técnico Fiscal da Receita Municipal de Araguari/MG (Prova aplicada)."
                ));
            }
        } catch (Exception e) {
            logger.warn("Could not check or seed default concursos: {}", e.getMessage());
        }
    }

    @Override
    public List<Concurso> findAll(String statusFilter) {
        if (statusFilter != null && !statusFilter.isBlank() && !"ALL".equalsIgnoreCase(statusFilter)) {
            return jdbcTemplate.query("SELECT * FROM concursos WHERE status = ? ORDER BY ano DESC, nome ASC", rowMapper, statusFilter.toUpperCase());
        }
        return jdbcTemplate.query("SELECT * FROM concursos ORDER BY ano DESC, nome ASC", rowMapper);
    }

    @Override
    public Optional<Concurso> findById(String id) {
        List<Concurso> list = jdbcTemplate.query("SELECT * FROM concursos WHERE id = ?", rowMapper, id);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    @Override
    public Concurso save(Concurso c) {
        String now = Instant.now().toString();
        if (c.getCreatedAt() == null) {
            c.setCreatedAt(now);
        }
        c.setUpdatedAt(now);

        String sql = "INSERT INTO concursos (id, nome, orgao, banca, ano, cargo, cargo_codigo, status, descricao, created_at, updated_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
                "ON CONFLICT(id) DO UPDATE SET nome=excluded.nome, orgao=excluded.orgao, banca=excluded.banca, " +
                "ano=excluded.ano, cargo=excluded.cargo, cargo_codigo=excluded.cargo_codigo, status=excluded.status, " +
                "descricao=excluded.descricao, updated_at=excluded.updated_at";

        jdbcTemplate.update(sql,
                c.getId(),
                c.getNome(),
                c.getOrgao(),
                c.getBanca(),
                c.getAno(),
                c.getCargo(),
                c.getCargoCodigo(),
                c.getStatus() != null ? c.getStatus() : "ACTIVE",
                c.getDescricao(),
                c.getCreatedAt(),
                c.getUpdatedAt()
        );
        return c;
    }

    @Override
    public void updateStatus(String id, String status) {
        String now = Instant.now().toString();
        jdbcTemplate.update("UPDATE concursos SET status = ?, updated_at = ? WHERE id = ?", status.toUpperCase(), now, id);
    }

    @Override
    public long countAvailableQuestions(String concursoId) {
        Optional<Concurso> cOpt = findById(concursoId);
        if (cOpt.isEmpty()) return 0;
        Concurso c = cOpt.get();

        String sql = "SELECT count(*) FROM questions WHERE 1=1 ";
        if (c.getBanca() != null) sql += " AND banca = '" + c.getBanca().replace("'", "''") + "'";
        if (c.getAno() != null) sql += " AND ano = " + c.getAno();
        if (c.getCargo() != null) sql += " AND cargo = '" + c.getCargo().replace("'", "''") + "'";

        try {
            Long count = jdbcTemplate.queryForObject(sql, Long.class);
            return count != null ? count : 0;
        } catch (Exception e) {
            return 0;
        }
    }
}
