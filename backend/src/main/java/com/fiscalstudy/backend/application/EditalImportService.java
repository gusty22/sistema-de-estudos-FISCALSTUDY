package com.fiscalstudy.backend.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiscalstudy.backend.domain.*;
import com.fiscalstudy.backend.infrastructure.in.web.dto.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
public class EditalImportService {

    private static final Logger logger = LoggerFactory.getLogger(EditalImportService.class);

    private final EditalJsonValidatorService validatorService;
    private final EditalRepository editalRepository;
    private final ConcursoRepository concursoRepository;
    private final ObjectMapper objectMapper;

    public EditalImportService(EditalJsonValidatorService validatorService,
                               EditalRepository editalRepository,
                               ConcursoRepository concursoRepository,
                               ObjectMapper objectMapper) {
        this.validatorService = validatorService;
        this.editalRepository = editalRepository;
        this.concursoRepository = concursoRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Validação estritamente independente de concurso ou banco de dados.
     * Operação pura em memória: 0 efeitos colaterais e 0 escritas no banco operacional.
     */
    public EditalValidationResultDTO validateJson(String rawJson) {
        return validatorService.validateJsonString(rawJson);
    }

    /**
     * Validação do payload já desserializado em memória.
     */
    public EditalValidationResultDTO validatePayload(EditalImportPayloadDTO payload) {
        return validatorService.validatePayload(payload);
    }

    /**
     * Importação atômica do edital e seus tópicos para um concurso existente.
     * Rollback completo garantido se qualquer falha ocorrer durante o processamento.
     */
    @Transactional(rollbackFor = Exception.class)
    public EditalImportSummaryDTO importEdital(String concursoId,
                                              EditalImportPayloadDTO payload,
                                              boolean confirmadoHumano,
                                              String procedenciaStatus,
                                              boolean overwrite,
                                              String versao,
                                              String tipo) {
        return importEditalInternal(concursoId, payload, confirmadoHumano, procedenciaStatus, overwrite, versao, tipo, null, false, false, null, null, null, -1);
    }

    /**
     * Importação atômica estendida: suporta substituição de pré-edital por edital oficial e atualização automática da situação do concurso.
     */
    @Transactional(rollbackFor = Exception.class)
    public EditalImportSummaryDTO importEdital(String concursoId,
                                              EditalImportPayloadDTO payload,
                                              boolean confirmadoHumano,
                                              String procedenciaStatus,
                                              boolean overwrite,
                                              String versao,
                                              String tipo,
                                              String titulo,
                                              boolean replaceAllPreviousTopics,
                                              boolean updateConcursoSituacao,
                                              String novaSituacaoConcurso,
                                              String dataProva,
                                              String linkEdital) {
        return importEditalInternal(concursoId, payload, confirmadoHumano, procedenciaStatus, overwrite, versao, tipo, titulo, replaceAllPreviousTopics, updateConcursoSituacao, novaSituacaoConcurso, dataProva, linkEdital, -1);
    }

    /**
     * Método com hook de teste para simulação determinística de falha e comprovação de rollback atômico.
     */
    @Transactional(rollbackFor = Exception.class)
    public EditalImportSummaryDTO importEditalWithFailureSimulation(String concursoId,
                                                                   EditalImportPayloadDTO payload,
                                                                   boolean confirmadoHumano,
                                                                   String procedenciaStatus,
                                                                   boolean overwrite,
                                                                   String versao,
                                                                   String tipo,
                                                                   int failAfterTopicIndex) {
        return importEditalInternal(concursoId, payload, confirmadoHumano, procedenciaStatus, overwrite, versao, tipo, null, false, false, null, null, null, failAfterTopicIndex);
    }

    private EditalImportSummaryDTO importEditalInternal(String concursoId,
                                                       EditalImportPayloadDTO payload,
                                                       boolean confirmadoHumano,
                                                       String procedenciaStatus,
                                                       boolean overwrite,
                                                       String versao,
                                                       String tipo,
                                                       String titulo,
                                                       boolean replaceAllPreviousTopics,
                                                       boolean updateConcursoSituacao,
                                                       String novaSituacaoConcurso,
                                                       String dataProva,
                                                       String linkEdital,
                                                       int failAfterTopicIndex) {
        if (concursoId == null || concursoId.isBlank()) {
            throw new IllegalArgumentException("O ID do concurso é obrigatório.");
        }

        // Valida existência do concurso
        Concurso concurso = concursoRepository.findById(concursoId)
                .orElseThrow(() -> new IllegalArgumentException("Concurso não encontrado: " + concursoId));

        if (payload == null) {
            throw new IllegalArgumentException("Payload do edital não pode ser nulo.");
        }

        // Validação estrutural do payload
        EditalValidationResultDTO validation = validatorService.validatePayload(payload);
        if (!validation.isValid()) {
            throw new IllegalArgumentException("Payload do edital inválido: " + String.join("; ", validation.getErrors()));
        }

        String ver = (versao != null && !versao.isBlank()) ? versao : (payload.getVersao() != null ? payload.getVersao() : "1.0");
        String tip = (tipo != null && !tipo.isBlank()) ? tipo : (payload.getTipo() != null ? payload.getTipo() : "ORIGINAL");
        String filename = payload.getDocOrigem() != null ? payload.getDocOrigem() : "edital_importado.json";

        // ID determinístico do edital para o concurso e versão
        String editalId = "edital-" + concursoId + "-v" + ver.replace(".", "_");

        // Regra de procedência epistemológica: SOURCE_VERIFIED não pode ser atribuído automaticamente
        String finalProcedencia = procedenciaStatus != null && !procedenciaStatus.isBlank()
                ? procedenciaStatus
                : (confirmadoHumano ? ProcedenciaEdital.STRUCTURE_HUMAN_REVIEWED.name() : ProcedenciaEdital.JSON_STRUCTURALLY_VALID.name());

        if (ProcedenciaEdital.SOURCE_VERIFIED.name().equals(finalProcedencia) && !confirmadoHumano) {
            throw new IllegalArgumentException("Procedência SOURCE_VERIFIED exige confirmação humana e conferência explícita com o edital oficial.");
        }

        // Se replaceAllPreviousTopics habilitado, limpa toda a grade anterior deste concurso (ex: pré-edital sendo substituído pelo edital oficial definitivo)
        if (replaceAllPreviousTopics) {
            editalRepository.deleteTopicosByConcursoId(concursoId);
        } else if (overwrite) {
            // Se overwrite habilitado para a versão, expurga tópicos antigos deste edital específico para evitar duplicidade
            editalRepository.deleteTopicosByEditalId(editalId);
        }

        // Se solicitado, atualiza a situação do concurso (ex: EDITAL_PUBLICADO), data da prova e link oficial
        if (updateConcursoSituacao || (novaSituacaoConcurso != null && !novaSituacaoConcurso.isBlank())) {
            concurso.setSituacao(novaSituacaoConcurso != null && !novaSituacaoConcurso.isBlank() ? novaSituacaoConcurso : "EDITAL_PUBLICADO");
            if (dataProva != null && !dataProva.isBlank()) {
                concurso.setDataProva(dataProva);
            }
            if (linkEdital != null && !linkEdital.isBlank()) {
                concurso.setLinkEdital(linkEdital);
            }
            concursoRepository.save(concurso);
        }

        // Título customizado ou padrão
        String finalTitulo = (titulo != null && !titulo.isBlank())
                ? titulo
                : ("Edital Verticalizado — " + concurso.getNome());

        // Criação / Atualização do registro do Edital
        Edital edital = new Edital(
                editalId,
                concursoId,
                finalTitulo,
                ver,
                tip,
                filename
        );
        editalRepository.saveEdital(edital);

        int totalMaterias = 0;
        int totalTopicos = 0;
        int totalSubtopicos = 0;
        int persistedRows = 0;

        int sequenceOrder = 1;

        // Persistência hierárquica preservando integridade, identidade global única e procedência dos nós
        for (EditalMateriaImportDTO materia : validation.getNormalizedMaterias()) {
            totalMaterias++;
            List<EditalTopicoImportDTO> topicos = materia.getTopicos();
            if (topicos == null || topicos.isEmpty()) continue;

            for (EditalTopicoImportDTO topico : topicos) {
                totalTopicos++;
                List<EditalSubtopicoImportDTO> subtopicos = topico.getSubtopicos();

                if (subtopicos != null && !subtopicos.isEmpty()) {
                    for (EditalSubtopicoImportDTO sub : subtopicos) {
                        totalSubtopicos++;

                        // Identificador único global (UUID) — desacoplado de IDs reutilizáveis do JSON
                        String nodeGlobalId = UUID.randomUUID().toString();

                        String trechoOrigem = serializeOriginMetadata(
                                materia.getId(), topico.getId(), sub.getId(),
                                materia.getOrdem(), topico.getOrdem(), sub.getOrdem()
                        );

                        EditalTopico row = new EditalTopico(
                                nodeGlobalId,
                                editalId,
                                concursoId,
                                materia.getNome(),
                                topico.getNome(),
                                sub.getNome(),
                                1.0,
                                null,
                                filename,
                                sequenceOrder++,
                                trechoOrigem,
                                finalProcedencia,
                                confirmadoHumano
                        );

                        editalRepository.saveTopico(row);
                        persistedRows++;

                        // Simulação determinística de falha para testes de atomicidade
                        if (failAfterTopicIndex >= 0 && persistedRows >= failAfterTopicIndex) {
                            throw new RuntimeException("Falha simulada para comprovação de rollback atômico na gravação do tópico #" + persistedRows);
                        }
                    }
                } else {
                    // Tópico folha sem subtópicos
                    String nodeGlobalId = UUID.randomUUID().toString();
                    String trechoOrigem = serializeOriginMetadata(
                            materia.getId(), topico.getId(), null,
                            materia.getOrdem(), topico.getOrdem(), null
                    );

                    EditalTopico row = new EditalTopico(
                            nodeGlobalId,
                            editalId,
                            concursoId,
                            materia.getNome(),
                            topico.getNome(),
                            null,
                            1.0,
                            null,
                            filename,
                            sequenceOrder++,
                            trechoOrigem,
                            finalProcedencia,
                            confirmadoHumano
                    );

                    editalRepository.saveTopico(row);
                    persistedRows++;

                    if (failAfterTopicIndex >= 0 && persistedRows >= failAfterTopicIndex) {
                        throw new RuntimeException("Falha simulada para comprovação de rollback atômico na gravação do tópico #" + persistedRows);
                    }
                }
            }
        }

        return new EditalImportSummaryDTO(
                concursoId,
                editalId,
                edital.getTitulo(),
                ver,
                tip,
                totalMaterias,
                totalTopicos,
                totalSubtopicos,
                persistedRows,
                finalProcedencia,
                confirmadoHumano
        );
    }

    /**
     * Cadastro atômico inicial: cria o concurso e seu edital na mesma transação.
     * Se houver falha no edital ou nos tópicos, o concurso também sofre rollback completo.
     */
    @Transactional(rollbackFor = Exception.class)
    public ConcursoWithEditalResponseDTO createConcursoWithEdital(ConcursoWithEditalCreateDTO dto, int failAfterTopicIndex) {
        if (dto == null || dto.getConcurso() == null) {
            throw new IllegalArgumentException("Dados do concurso são obrigatórios.");
        }

        Concurso c = dto.getConcurso();
        if (c.getNome() == null || c.getNome().isBlank()) {
            throw new IllegalArgumentException("O nome do concurso é obrigatório.");
        }
        if (c.getOrgao() == null || c.getOrgao().isBlank()) {
            throw new IllegalArgumentException("O órgão do concurso é obrigatório.");
        }

        if (c.getId() == null || c.getId().isBlank()) {
            String slug = slugify(c.getOrgao() + "-" + (c.getCargo() != null ? c.getCargo() : "concurso") + "-" + (c.getAno() != null ? c.getAno() : ""));
            c.setId(slug.length() > 5 ? slug : UUID.randomUUID().toString());
        }

        if (c.getStatus() == null || c.getStatus().isBlank()) {
            c.setStatus("ACTIVE");
        }

        // Salva concurso
        Concurso savedConcurso = concursoRepository.save(c);

        EditalImportSummaryDTO editalSummary = null;

        // Se o payload do edital foi fornecido, importa na mesma transação
        if (dto.getEditalPayload() != null) {
            String edVersao = dto.getEditalPayload().getVersao() != null ? dto.getEditalPayload().getVersao() : "1.0";
            String edTipo = dto.getEditalPayload().getTipo() != null ? dto.getEditalPayload().getTipo() : "ORIGINAL";
            editalSummary = importEditalInternal(
                    savedConcurso.getId(),
                    dto.getEditalPayload(),
                    dto.isConfirmadoHumano(),
                    dto.getProcedenciaStatus(),
                    true,
                    edVersao,
                    edTipo,
                    null,
                    false,
                    false,
                    null,
                    null,
                    null,
                    failAfterTopicIndex
            );
        }

        ConcursoDTO concursoDTO = new ConcursoDTO(savedConcurso, concursoRepository.countAvailableQuestions(savedConcurso.getId()));
        return new ConcursoWithEditalResponseDTO(concursoDTO, editalSummary);
    }

    private String serializeOriginMetadata(String matId, String topId, String subId,
                                          Integer matOrdem, Integer topOrdem, Integer subOrdem) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("origMateriaId", matId);
        map.put("origTopicoId", topId);
        map.put("origSubtopicoId", subId);
        map.put("ordemMateria", matOrdem);
        map.put("ordemTopico", topOrdem);
        map.put("ordemSubtopico", subOrdem);
        try {
            return objectMapper.writeValueAsString(map);
        } catch (JsonProcessingException e) {
            return "{\"origMateriaId\":\"" + matId + "\",\"origTopicoId\":\"" + topId + "\"}";
        }
    }

    private String slugify(String input) {
        if (input == null) return "concurso";
        return java.text.Normalizer.normalize(input, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .replaceAll("[^a-zA-Z0-9]+", "-")
                .toLowerCase()
                .replaceAll("^-+|-+$", "");
    }
}
