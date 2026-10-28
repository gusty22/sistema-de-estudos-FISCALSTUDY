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
        try { c.setSituacao(rs.getString("situacao")); } catch (Exception ignored) {}
        try { c.setLocalidade(rs.getString("localidade")); } catch (Exception ignored) {}
        try { c.setEscolaridade(rs.getString("escolaridade")); } catch (Exception ignored) {}
        try { c.setVagas(rs.getObject("vagas") != null ? rs.getInt("vagas") : null); } catch (Exception ignored) {}
        try { c.setSalario(rs.getObject("salario") != null ? rs.getDouble("salario") : null); } catch (Exception ignored) {}
        try { c.setLinkEdital(rs.getString("link_edital")); } catch (Exception ignored) {}
        try { c.setDataProva(rs.getString("data_prova")); } catch (Exception ignored) {}
        try { c.setDataProvaTipo(rs.getString("data_prova_tipo")); } catch (Exception ignored) {}
        try { c.setDatasImportantesJson(rs.getString("datas_importantes_json")); } catch (Exception ignored) {}
        try { c.setDisponibilidadeJson(rs.getString("disponibilidade_json")); } catch (Exception ignored) {}
        return c;
    };

    public ConcursoRepositoryImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        ensureSchemaUpdated();
    }

    private void ensureSchemaUpdated() {
        String[] cols = {
                "situacao TEXT DEFAULT 'PREVISTO'",
                "localidade TEXT",
                "escolaridade TEXT",
                "vagas INTEGER",
                "salario REAL",
                "link_edital TEXT",
                "data_prova TEXT",
                "data_prova_tipo TEXT DEFAULT 'INFORMADA_PELO_USUARIO'",
                "datas_importantes_json TEXT",
                "disponibilidade_json TEXT"
        };
        for (String colDef : cols) {
            try {
                jdbcTemplate.execute("ALTER TABLE concursos ADD COLUMN " + colDef);
            } catch (Exception ignored) {
                // Coluna já existe
            }
        }
    }

    @PostConstruct
    public void init() {
        ensureSchemaUpdated();
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

        String sql = "INSERT INTO concursos (id, nome, orgao, banca, ano, cargo, cargo_codigo, status, descricao, " +
                "situacao, localidade, escolaridade, vagas, salario, link_edital, data_prova, data_prova_tipo, " +
                "datas_importantes_json, disponibilidade_json, created_at, updated_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
                "ON CONFLICT(id) DO UPDATE SET nome=excluded.nome, orgao=excluded.orgao, banca=excluded.banca, " +
                "ano=excluded.ano, cargo=excluded.cargo, cargo_codigo=excluded.cargo_codigo, status=excluded.status, " +
                "descricao=excluded.descricao, situacao=excluded.situacao, localidade=excluded.localidade, " +
                "escolaridade=excluded.escolaridade, vagas=excluded.vagas, salario=excluded.salario, " +
                "link_edital=excluded.link_edital, data_prova=excluded.data_prova, data_prova_tipo=excluded.data_prova_tipo, " +
                "datas_importantes_json=excluded.datas_importantes_json, disponibilidade_json=excluded.disponibilidade_json, " +
                "updated_at=excluded.updated_at";

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
                c.getSituacao() != null ? c.getSituacao() : "PREVISTO",
                c.getLocalidade(),
                c.getEscolaridade(),
                c.getVagas(),
                c.getSalario(),
                c.getLinkEdital(),
                c.getDataProva(),
                c.getDataProvaTipo() != null ? c.getDataProvaTipo() : "INFORMADA_PELO_USUARIO",
                c.getDatasImportantesJson(),
                c.getDisponibilidadeJson(),
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

        String sql = "SELECT count(*) FROM study_questions WHERE 1=1 ";
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
