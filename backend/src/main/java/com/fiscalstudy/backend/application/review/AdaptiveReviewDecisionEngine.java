package com.fiscalstudy.backend.application.review;

import com.fiscalstudy.backend.application.cognitive.UnifiedCognitiveArchitectureService;
import com.fiscalstudy.backend.application.cognitive.UnifiedCognitiveStateDTO;
import com.fiscalstudy.backend.domain.EventStoreRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class AdaptiveReviewDecisionEngine {

    private static final Logger log = LoggerFactory.getLogger(AdaptiveReviewDecisionEngine.class);

    private final UnifiedCognitiveArchitectureService cognitiveService;
    private final EventStoreRepository eventStoreRepository;
    private final JdbcTemplate jdbcTemplate;

    public AdaptiveReviewDecisionEngine(UnifiedCognitiveArchitectureService cognitiveService,
                                        EventStoreRepository eventStoreRepository,
                                        JdbcTemplate jdbcTemplate) {
        this.cognitiveService = cognitiveService;
        this.eventStoreRepository = eventStoreRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Avalia e decide a próxima revisão combinando os 4 fatores essenciais:
     * 1. Estimativa de recuperabilidade do conhecimento (FSRS / R(t))
     * 2. Importância do conteúdo para o edital (Peso e incidência)
     * 3. Consequências de esquecer para os tópicos seguintes (DAG de pré-requisitos)
     * 4. Tempo disponível para estudar e revisar (Alocação com restrição)
     */
    public AdaptiveRevisionDecisionDTO evaluateDecisions(String concursoId, int tempoDisponivelMinutos) {
        if (tempoDisponivelMinutos <= 0) {
            tempoDisponivelMinutos = 60;
        }

        UnifiedCognitiveStateDTO cognitiveState = cognitiveService.computeUnifiedState(concursoId, tempoDisponivelMinutos);
        List<UnifiedCognitiveStateDTO.TopicKnowledgeEstimate> topics = cognitiveState.getKnowledgeModel();

        AdaptiveRevisionDecisionDTO result = new AdaptiveRevisionDecisionDTO();
        result.setConcursoId(concursoId != null ? concursoId : "Concurso Fiscal");
        result.setTempoDisponivelMinutos(tempoDisponivelMinutos);
        result.setEstrategiaGlobal("Alocação Adaptativa baseada em Recuperabilidade, Impacto no Edital, DAG de Pré-Requisitos e Coleta Ativa de Informação.");

        List<AdaptiveRevisionDecisionDTO.TopicRevisionDecision> decisions = new ArrayList<>();
        int adiadas = 0;
        int ativas = 0;
        int diagnosticos = 0;

        for (UnifiedCognitiveStateDTO.TopicKnowledgeEstimate top : topics) {
            AdaptiveRevisionDecisionDTO.TopicRevisionDecision dec = new AdaptiveRevisionDecisionDTO.TopicRevisionDecision();
            dec.setTopicId(top.getTopicId());
            dec.setDisciplina(top.getDisciplina());
            dec.setTopico(top.getAssunto());
            dec.setDominioPct(top.getDominioEstimadoPct());
            dec.setRetencaoFsrsPct(top.getRetencaoAtualPct());
            dec.setIncertezaSigma(top.getIncertezaSigma());
            dec.setPesoEdital(top.getPesoEdital());

            // 1. Nível de Domínio
            if (top.getDominioEstimadoPct() >= 75.0) {
                dec.setDominioEstimadoNivel("Alto");
            } else if (top.getDominioEstimadoPct() >= 55.0) {
                dec.setDominioEstimadoNivel("Médio");
            } else {
                dec.setDominioEstimadoNivel("Baixo");
            }

            // 2. Fator 1: Recuperabilidade Estimada
            // Se incerteza for alta ou sem tentativas, a recuperabilidade é Incerta
            if (top.getIncertezaSigma() >= 0.65 || top.getEvidenciasValidasCount() == 0) {
                dec.setRecuperabilidadeNivel("Incerta");
            } else if (top.getRetencaoAtualPct() >= 78.0) {
                dec.setRecuperabilidadeNivel("Alta");
            } else if (top.getRetencaoAtualPct() >= 62.0) {
                dec.setRecuperabilidadeNivel("Média");
            } else {
                dec.setRecuperabilidadeNivel("Baixa");
            }

            // 3. Fator 2: Importância no Edital
            if (top.getPesoEdital() >= 2.5) {
                dec.setImportanciaEditalNivel("Alta");
            } else if (top.getPesoEdital() >= 1.5) {
                dec.setImportanciaEditalNivel("Média");
            } else {
                dec.setImportanciaEditalNivel("Baixa");
            }

            // 4. Fator 3: Consequências de Esquecer para Tópicos Seguintes (DAG)
            int dependentes = calculateDownstreamDependencies(top.getDisciplina(), top.getAssunto());
            dec.setDependentesCount(dependentes);
            if (dependentes >= 2) {
                dec.setConsequenciaEsquecimento("Crítica (Pré-requisito Essencial)");
            } else if (dependentes == 1) {
                dec.setConsequenciaEsquecimento("Moderada");
            } else {
                dec.setConsequenciaEsquecimento("Isolada");
            }

            // 5. Motor de Decisão e Estratégia Adaptativa
            // CASO A: Recuperabilidade Incerta / Alta Incerteza (Active Information Gathering)
            if ("Incerta".equals(dec.getRecuperabilidadeNivel()) && !"Baixa".equals(dec.getImportanciaEditalNivel())) {
                dec.setDecisao("DIAGNOSTICO_DIRECIONADO");
                dec.setActiveInformationGathering(true);
                dec.setJustificativa(String.format(Locale.US,
                        "Incerteza do modelo é alta (σ = %.2f, N=%d). O sistema não inventa probabilidades de esquecimento; prescreve pequena atividade diagnóstica (2-3 questões) para reduzir a incerteza e verificar pré-requisitos antes de planejar revisões extensas.",
                        top.getIncertezaSigma(), top.getEvidenciasValidasCount()
                ));
                dec.setDuracaoSugeridaMinutos(10);
                dec.setUrgenciaScore((dec.getPesoEdital() * 2.2) + (dependentes * 1.5) + 4.0);
                diagnosticos++;
            }
            // CASO B: Domínio Alto + Recuperabilidade Alta
            else if ("Alto".equals(dec.getDominioEstimadoNivel()) && "Alta".equals(dec.getRecuperabilidadeNivel())) {
                dec.setDecisao("ADIAR_REVISAO");
                dec.setActiveInformationGathering(false);
                dec.setJustificativa(String.format(Locale.US,
                        "Domínio estimado consolidado (%.1f%%) e recuperabilidade alta (%.1f%%). Adiar a revisão ativa para economizar tempo útil de estudo e testar novamente mais tarde.",
                        top.getDominioEstimadoPct(), top.getRetencaoAtualPct()
                ));
                dec.setDuracaoSugeridaMinutos(0);
                dec.setUrgenciaScore(0.5);
                adiadas++;
            }
            // CASO C: Recuperabilidade Baixa + Importância Alta ou Média
            else if ("Baixa".equals(dec.getRecuperabilidadeNivel()) && !"Baixa".equals(dec.getImportanciaEditalNivel())) {
                dec.setDecisao("PRIORIZAR_REVISAO_ATIVA");
                dec.setActiveInformationGathering(false);
                dec.setJustificativa(String.format(Locale.US,
                        "Recuperabilidade em risco (%.1f%%) em tópico de alta relevância no edital (peso %.1f). Prioridade máxima para revisão ativa imediata (recuperação de memória com questões-chave).",
                        top.getRetencaoAtualPct(), top.getPesoEdital()
                ));
                dec.setDuracaoSugeridaMinutos(20);
                dec.setUrgenciaScore((dec.getPesoEdital() * 2.5) + ((100.0 - top.getRetencaoAtualPct()) * 0.05) + (dependentes * 2.0));
                ativas++;
            }
            // CASO D: Micro-Revisão de Manutenção
            else {
                dec.setDecisao("MICRO_REVISAO_RAPIDA");
                dec.setActiveInformationGathering(false);
                dec.setJustificativa(String.format(Locale.US,
                        "Manutenção preventiva de estabilidade (Retenção %.1f%%, Domínio %.1f%%).",
                        top.getRetencaoAtualPct(), top.getDominioEstimadoPct()
                ));
                dec.setDuracaoSugeridaMinutos(15);
                dec.setUrgenciaScore((dec.getPesoEdital() * 1.2) + (dependentes * 0.8));
                ativas++;
            }

            decisions.add(dec);
        }

        // Ordenar decisões por Urgência decrescente
        decisions.sort((a, b) -> Double.compare(b.getUrgenciaScore(), a.getUrgenciaScore()));

        // Fator 4: Ajustar alocação de tempo total
        int minutosAlocados = 0;
        for (AdaptiveRevisionDecisionDTO.TopicRevisionDecision d : decisions) {
            if ("ADIAR_REVISAO".equals(d.getDecisao())) continue;
            if (minutosAlocados + d.getDuracaoSugeridaMinutos() <= tempoDisponivelMinutos) {
                minutosAlocados += d.getDuracaoSugeridaMinutos();
            } else {
                // Se o tempo estourar, ajusta para micro-bloco ou posterga
                if (tempoDisponivelMinutos - minutosAlocados >= 10) {
                    d.setDuracaoSugeridaMinutos(tempoDisponivelMinutos - minutosAlocados);
                    minutosAlocados = tempoDisponivelMinutos;
                }
            }
        }

        result.setDecisoes(decisions);

        AdaptiveRevisionDecisionDTO.DecisionStatistics stats = new AdaptiveRevisionDecisionDTO.DecisionStatistics();
        stats.setTotalAnalisados(decisions.size());
        stats.setAdiadasCount(adiadas);
        stats.setAtivasPrioritariasCount(ativas);
        stats.setDiagnosticosCount(diagnosticos);
        stats.setTempoTotalAlocadoMinutos(minutosAlocados);
        result.setEstatisticas(stats);

        return result;
    }

    /**
     * Tratamento formal de quando uma revisão dá errado:
     * O sistema NUNCA zera o domínio do estudante.
     * Analisa tempo decorrido, confiança, novidade e pré-requisitos para calibrar a intervenção exata.
     */
    public ReviewFailureDiagnosisDTO handleReviewFailure(ReviewFailureRequestDTO request) {
        ReviewFailureDiagnosisDTO diag = new ReviewFailureDiagnosisDTO();
        diag.setDominioZerado(false); // Regra inegociável: domínio nunca é zerado

        double dias = request.getDiasDesdeUltimaTentativa() != null ? request.getDiasDesdeUltimaTentativa() : 0.0;
        double domAnt = request.getDominioAnteriorPct() != null ? request.getDominioAnteriorPct() : 50.0;
        int conf = request.getConfidenceLevel() != null ? request.getConfidenceLevel() : 3;
        boolean isInedita = Boolean.TRUE.equals(request.getIsQuestionInedita());
        boolean usedHelp = Boolean.TRUE.equals(request.getUsedHelp());

        diag.setDominioAnteriorPct(domAnt);

        // Situação 1: Intervalo Longo (Δt >= 14 dias) -> Falha de Acessibilidade/Decaimento
        if (dias >= 14.0) {
            diag.setTipoFalha("ACESSIBILIDADE_TEMPORAL");
            diag.setDiagnosticoCientifico(String.format(Locale.US,
                    "Falha após intervalo longo (%.1f dias). A memória estava menos acessível do que o previsto pela curva de decaimento natural, e não por incompreensão congênita da matéria.",
                    dias
            ));
            double novoDom = Math.max(30.0, Math.round(domAnt * 0.85 * 10.0) / 10.0);
            diag.setNovoDominioAjustadoPct(novoDom);
            diag.setNovaEstabilidadeDias(Math.max(1.5, Math.round((domAnt * 0.06) * 10.0) / 10.0));
            diag.setStatusPrerequisitos("PRE_REQUISITOS_INTACTOS");
            diag.setIntervencaoPrescrita("MICRO_REATIVACAO_ESPACADA");
            diag.setExplicacaoPedagogica("Agendar micro-reativação ativa (D+3) com questões focadas no núcleo conceitual. A estabilidade foi atenuada suavemente.");
        }
        // Situação 2: Erro Imediato após Estudo (Δt <= 2 dias) -> Falha de Compreensão Estrutural
        else if (dias <= 2.0 && !isInedita) {
            diag.setTipoFalha("COMPREENSAO_ESTRUTURAL");
            diag.setDiagnosticoCientifico(String.format(Locale.US,
                    "Erro ocorrido logo após contato recente (%.1f dias). O estudante não consolidou o modelo mental durante a explicação inicial.",
                    dias
            ));
            double novoDom = Math.max(20.0, Math.round(domAnt * 0.70 * 10.0) / 10.0);
            diag.setNovoDominioAjustadoPct(novoDom);
            diag.setNovaEstabilidadeDias(1.0);
            diag.setStatusPrerequisitos("INVESTIGAR_LACUNA_BASE");
            diag.setIntervencaoPrescrita("DESCONSTRUCAO_FEYNMAN");
            diag.setExplicacaoPedagogica("Interrupção de novas questões do tópico. Ativação de auto-explicação estruturada com próprias palavras para alinhar a lógica de base.");
        }
        // Situação 3: Erro com Certeza Absoluta (Confiança = 5) -> Falsa Fluência / Pegadinha
        else if (conf == 5) {
            diag.setTipoFalha("OVERCONFIDENCE_PEGADINHA");
            diag.setDiagnosticoCientifico("Erro cometido com Nível 5 de Confiança (Certeza Absoluta). O estudante foi atraído por distrator de banca ou confundiu conceitos simétricos.");
            double novoDom = Math.max(25.0, Math.round(domAnt * 0.78 * 10.0) / 10.0);
            diag.setNovoDominioAjustadoPct(novoDom);
            diag.setNovaEstabilidadeDias(2.0);
            diag.setStatusPrerequisitos("PRE_REQUISITOS_INTACTOS");
            diag.setIntervencaoPrescrita("AUDITORIA_PEGADINHA_ARMADILHA");
            diag.setExplicacaoPedagogica("Desmontar a pegadinha através de confronto direto entre a alternativa marcada e a regra do gabarito definitivo.");
        }
        // Situação 4: Resposta que dependeu de ajuda
        else if (usedHelp) {
            diag.setTipoFalha("DEPENDENCIA_ASSISTIDA");
            diag.setDiagnosticoCientifico("Erro precedido ou associado ao uso de material de apoio. Indica dependência de muleta teórica durante a resolução.");
            double novoDom = Math.max(25.0, Math.round(domAnt * 0.80 * 10.0) / 10.0);
            diag.setNovoDominioAjustadoPct(novoDom);
            diag.setNovaEstabilidadeDias(1.5);
            diag.setStatusPrerequisitos("PRE_REQUISITOS_MODERADOS");
            diag.setIntervencaoPrescrita("EXERCICIO_DESASSISTIDO");
            diag.setExplicacaoPedagogica("Prescrever resolução estritamente desassistida no próximo ciclo para construir autonomia cognitiva.");
        }
        // Situação Padrão
        else {
            diag.setTipoFalha("FALHA_PADRAO_REVISAO");
            diag.setDiagnosticoCientifico("Erro dentro do desvio esperado para ciclos normais de consolidação.");
            double novoDom = Math.max(25.0, Math.round(domAnt * 0.82 * 10.0) / 10.0);
            diag.setNovoDominioAjustadoPct(novoDom);
            diag.setNovaEstabilidadeDias(2.5);
            diag.setStatusPrerequisitos("PRE_REQUISITOS_INTACTOS");
            diag.setIntervencaoPrescrita("PRATICA_DIRECIONADA");
            diag.setExplicacaoPedagogica("Praticar bateria curta (3 itens) para recuperar o limiar de acerto.");
        }

        // Registrar evento auditável no Append-Only Event Store
        try {
            String payload = String.format(Locale.US,
                    "{\"questionId\":\"%s\",\"disciplina\":\"%s\",\"topico\":\"%s\",\"dias\":%.2f,\"dominioAnterior\":%.1f,\"novoDominio\":%.1f,\"tipoFalha\":\"%s\",\"intervencao\":\"%s\"}",
                    request.getQuestionId(),
                    request.getDisciplina() != null ? request.getDisciplina().replace("\"", "\\\"") : "",
                    request.getTopico() != null ? request.getTopico().replace("\"", "\\\"") : "",
                    dias, domAnt, diag.getNovoDominioAjustadoPct(), diag.getTipoFalha(), diag.getIntervencaoPrescrita()
            );
            eventStoreRepository.appendEvent(
                    "REVISION_FAILURE_CALIBRATED",
                    "REVISION",
                    request.getQuestionId() != null ? request.getQuestionId() : UUID.randomUUID().toString(),
                    request.getSessionId() != null ? request.getSessionId() : "system",
                    1,
                    "v1",
                    payload
            );
        } catch (Exception e) {
            log.warn("Falha ao registrar log de erro de revisão no event store: {}", e.getMessage());
        }

        return diag;
    }

    /**
     * Calcula o número de dependentes a jusante no grafo conceitual (DAG).
     * Se o banco contiver mapeamentos explícitos em canonical_concept_prerequisites, utiliza-os.
     * Caso contrário, aplica heurística de dependência ontológica da carreira fiscal.
     */
    private int calculateDownstreamDependencies(String disciplina, String topico) {
        if (topico == null) return 0;
        String normalized = topico.toLowerCase();

        // 1. Consulta SQL no banco se existirem pré-requisitos canônicos cadastrados
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM canonical_concept_prerequisites ccp " +
                            "JOIN canonical_concepts cc ON ccp.prerequisite_concept_id = cc.id " +
                            "WHERE LOWER(cc.nome) LIKE ?",
                    Integer.class,
                    "%" + normalized + "%"
            );
            if (count != null && count > 0) {
                return count;
            }
        } catch (Exception ignored) {}

        // 2. Heurística Epistemológica para Matérias Fiscais
        // Português: Morfologia é pré-requisito essencial para Sintaxe, Concordância, Regência e Crase
        if (normalized.contains("morfologia") || normalized.contains("classes de palavras") || normalized.contains("estrutura das palavras")) {
            return 3;
        }
        if (normalized.contains("sintaxe") || normalized.contains("termos da oração")) {
            return 2;
        }
        // Tributário: Princípios e Competência são pré-requisitos para Fato Gerador, Lançamento, Suspensão e Extinção
        if (normalized.contains("conceito de tributo") || normalized.contains("princípios tributários") || normalized.contains("competência")) {
            return 4;
        }
        if (normalized.contains("obrigação tributária") || normalized.contains("fato gerador")) {
            return 3;
        }
        // Contabilidade: Contabilidade Básica/Método das Partidas Dobradas é pré-requisito para DFC, DVA, Balanço
        if (normalized.contains("partidas dobradas") || normalized.contains("atos e fatos") || normalized.contains("estrutura conceitual")) {
            return 4;
        }
        if (normalized.contains("estoques") || normalized.contains("ativo imobilizado")) {
            return 2;
        }

        return 0;
    }
}
