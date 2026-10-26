# tests/test_learning_profile.R
# Testes Unitários do Perfil Multidimensional de Aprendizagem
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

source("R/learning_profile.R", local = FALSE)

# 1. Testes de Entradas Degeneradas e Nulas
profile_null <- build_learning_profile(NULL)
assert_equal(profile_null$profile_version, "1.0.0", "build_learning_profile com NULL retorna versao 1.0.0")
assert_equal(profile_null$data_quality$valid_attempts, 0L, "build_learning_profile com NULL possui 0 tentativas validas")
assert_false(profile_null$data_quality$is_valid, "build_learning_profile com NULL nao e valido")
assert_true(is.na(profile_null$period$start), "build_learning_profile com NULL possui period start NA")

profile_empty <- build_learning_profile(data.frame())
assert_equal(profile_empty$data_quality$valid_attempts, 0L, "build_learning_profile com df vazio possui 0 tentativas")
assert_equal(nrow(profile_empty$mastery_by_discipline), 0L, "build_learning_profile com df vazio tem disciplinas vazias")

# 2. Teste com Fixture Sintética Válida
valid_events <- utils::read.csv("tests/fixtures/valid_events.csv", stringsAsFactors = FALSE)
valid_questions <- utils::read.csv("tests/fixtures/valid_questions.csv", stringsAsFactors = FALSE)
val_evt <- validate_events_dataset(valid_events, valid_questions)

profile_valid <- build_learning_profile(valid_events[valid_events$event_type == "ANSWER_SUBMITTED", ],
                                        valid_questions,
                                        validation_result = val_evt)

assert_true(profile_valid$data_quality$is_valid, "Perfil sobre fixture valida tem is_valid == TRUE")
assert_equal(profile_valid$data_quality$valid_attempts, 12L, "Identificou 12 tentativas validas no perfil")
assert_true(profile_valid$period$total_sessions == 2L, "Identificou 2 sessoes no periodo do perfil")

# 3. Teste de Domínio por Disciplina e Evidências
disc_df <- profile_valid$mastery_by_discipline
assert_true(nrow(disc_df) >= 3, "Perfil contem pelo menos 3 disciplinas analisadas")
assert_true("evidence_level" %in% names(disc_df), "Coluna evidence_level presente nas disciplinas")
# Amostras na fixture tem N < 10 por disciplina -> LOW_EVIDENCE
assert_true(all(disc_df$evidence_level == "LOW_EVIDENCE"), "Disciplinas da fixture classificadas com LOW_EVIDENCE")

# 4. Teste de Domínio por Tópico e Salvaguarda NO_DATA
topic_df <- profile_valid$mastery_by_topic
assert_true(nrow(topic_df) >= 3, "Perfil contem topicos mapeados")
# Tópicos não estudados devem constar como NO_DATA e nunca 0% de acurácia
nodata_topics <- topic_df[topic_df$evidence_level == "NO_DATA", ]
assert_true(nrow(nodata_topics) >= 1, "Catalogo contem topicos nao estudados marcados como NO_DATA")
if (nrow(nodata_topics) > 0) {
  assert_true(is.na(nodata_topics$accuracy[1]), "Topico NO_DATA possui acuracia NA e nao 0%")
  assert_equal(nodata_topics$n_attempts[1], 0L, "Topico NO_DATA possui exatamente 0 tentativas")
}

# 5. Teste de Retenção e Transferência no Perfil
ret <- profile_valid$retention
assert_equal(ret$n_repeated_attempts, 3L, "Perfil registrou 3 tentativas repetidas")
assert_equal(ret$repeat_accuracy, 1.0, "Taxa de acerto em repeticoes e 100% (3/3)")
assert_true(!is.na(profile_valid$transfer_exposure$novel_accuracy), "Acuracia em itens ineditos calculada")
assert_true(!is.na(profile_valid$transfer_exposure$transfer_delta), "Alias historico de diferenca repeticao-inicial calculado, sem provar transferencia")

# 6. Teste de Fluência e Tempos Discrepantes
flu <- profile_valid$fluency
assert_equal(flu$n_valid_times, 12L, "Perfil analisou 12 tempos validos")
assert_true(flu$median_sec > 0, "Mediana de tempo e positiva")
assert_equal(flu$sub_second_count, 0L, "Fixture valida nao possui tempos sub-segundo")

# 7. Teste de Metacognição e Superconfiança
meta <- profile_valid$metacognition
assert_equal(meta$n_observations, 12L, "Metacognicao cobriu 12 observacoes")
assert_equal(meta$overconfidence_count, 1L, "Perfil detectou 1 caso de superconfianca maxima")
assert_true(meta$brier_score >= 0 && meta$brier_score <= 1, "Brier score esta no intervalo [0, 1]")
assert_true(meta$ece >= 0 && meta$ece <= 1, "ECE esta no intervalo [0, 1]")

# 8. Teste de Recorrência de Erros
err_pat <- profile_valid$error_patterns
assert_equal(err_pat$total_errors, 3L, "Total de 3 erros identificado no perfil")
assert_equal(err_pat$recurrent_error_attempts, 0L, "Zero erros reincidentes em questoes ja repetidas na fixture valida")

# 9. Teste com Questões Anuladas e Dados Inconsistentes
dirty_events <- valid_events
# Adicionar tentativa em questão anulada q009
dirty_events <- rbind(dirty_events, data.frame(
  event_id = "evt-dirty-01",
  event_type = "ANSWER_SUBMITTED",
  session_id = "sess-1",
  question_id = "q009", # q009 é anulada no catálogo
  occurred_at = "2026-10-10T11:00:00Z",
  selected_option = "A",
  is_correct = TRUE,
  confidence_level = 5,
  active_time_ms = 45000,
  stringsAsFactors = FALSE
))
dirty_profile <- build_learning_profile(dirty_events[dirty_events$event_type == "ANSWER_SUBMITTED", ], valid_questions)
assert_equal(dirty_profile$data_quality$valid_attempts, 12L, "Questao anulada nao entra nas evidencias avaliaveis do perfil")
assert_true(dirty_profile$data_quality$is_valid, "Dados sem erros bloqueantes continuam validos")


# 10. Evidence eligibility is rechecked at the profile boundary.
assert_equal(dirty_profile$data_quality$excluded_non_evaluable_attempts, 1L, "Catalogo anulada aparece no denominador de exclusao")
assert_equal(dirty_profile$metacognition$n_observations, 12L, "Anulada nao contamina calibracao")
assert_equal(profile_valid$retention$transfer_status, "NOT_ESTABLISHED", "Repetir item nao estabelece transferencia conceitual")
assert_equal(profile_valid$transfer_exposure$repeat_vs_initial_accuracy_delta,
             profile_valid$transfer_exposure$transfer_delta, "Alias legado conserva valor e significado explicito")
assert_false(profile_valid$is_real_student_profile, "Fixture permanece diagnostica e nao perfil pessoal")

one_attempt <- valid_events[valid_events$event_type == "ANSWER_SUBMITTED", , drop = FALSE][1, , drop = FALSE]
one_question <- valid_questions[valid_questions$question_id == one_attempt$question_id, , drop = FALSE]
verified_provenance <- list(provenance_type = "PROVEN_OPERATIONAL", is_proven_operational = TRUE,
                           is_real_student_data = TRUE, can_generate_student_profile = TRUE,
                           audit_verdict = "PROCEDENCIA_OPERACIONAL_COMPROVADA", reasons = character(), warnings = character())
personal_attempt <- one_attempt
personal_attempt$origin_type <- "REAL_STUDY"
attr(personal_attempt, "provenance_info") <- verified_provenance
personal_profile <- build_learning_profile(personal_attempt, one_question)
assert_true(personal_profile$is_real_student_profile, "Origem REAL_STUDY explicita e auditoria comprovada permitem perfil pessoal")
assert_equal(personal_profile$data_quality$personal_origin_rows, 1L, "Contagem de origem pessoal usa dados originais")

for (origin in c("AUTOMATED_TEST", "DEMO", "UNKNOWN", "", NA_character_)) {
  stale <- personal_attempt
  stale$origin_type <- origin
  attr(stale, "provenance_info") <- verified_provenance
  result <- build_learning_profile(stale, one_question)
  assert_false(result$is_real_student_profile, paste("Atributo antigo nao lava origem nao pessoal:", origin))
  assert_equal(result$data_provenance, "UNVERIFIED_SOURCE", paste("Procedencia conflitante explicitamente nao verificada:", origin))
}
missing_origin <- personal_attempt
missing_origin$origin_type <- NULL
attr(missing_origin, "provenance_info") <- verified_provenance
assert_false(build_learning_profile(missing_origin, one_question)$is_real_student_profile,
             "Atributo operacional nao substitui origem por linha ausente")

mixed <- rbind(personal_attempt, personal_attempt)
mixed$event_id <- c("personal-one", "automated-annulled")
mixed$origin_type <- c("REAL_STUDY", "AUTOMATED_TEST")
mixed$gabarito_status <- c("DEFINITIVO", "ANULADA")
attr(mixed, "provenance_info") <- verified_provenance
mixed_profile <- build_learning_profile(mixed, one_question)
assert_equal(mixed_profile$data_quality$valid_attempts, 1L, "Linha nao avaliavel e removida da metrica")
assert_false(mixed_profile$is_real_student_profile, "Excluir teste anulado nao transforma dataset misto em pessoal")

for (status in c("ANULADA", "AUSENTE", "SOB_REVISAO")) {
  ungraded <- personal_attempt
  ungraded$gabarito_status <- status
  result <- build_learning_profile(ungraded, one_question)
  assert_equal(result$data_quality$valid_attempts, 0L, paste("Resultado presente nao supera gabarito nao avaliavel:", status))
  assert_true("NO_DATA" %in% result$data_quality$quality_flags, paste("Sem resultado avaliavel permanece NO_DATA:", status))
  assert_false(result$is_real_student_profile, paste("Perfil sem evidencias avaliaveis nao e pessoal:", status))
  assert_true(all(is.na(result$mastery_by_topic$accuracy)), paste("Ausencia de evidencia nao vira 0%:", status))
  catalog_ungraded <- one_question
  catalog_ungraded$gabarito_status <- status
  assert_equal(build_learning_profile(personal_attempt, catalog_ungraded)$data_quality$valid_attempts, 0L,
               paste("Status do catalogo tambem exclui resultado:", status))
}
annulled_attempt <- personal_attempt
annulled_attempt$is_annulled <- TRUE
assert_equal(build_learning_profile(annulled_attempt, one_question)$data_quality$valid_attempts, 0L,
             "is_annulled registrado na tentativa tambem exclui evidencia")

unknown_outcome <- personal_attempt
unknown_outcome$is_correct <- NA
unknown_profile <- build_learning_profile(unknown_outcome, one_question)
assert_equal(unknown_profile$data_quality$missing_outcome_attempts, 1L, "Ausencia de resultado possui contador explicito")
assert_equal(unknown_profile$data_quality$valid_attempts, 0L, "Sem resultado nao atualiza metrica")

missing_context <- personal_attempt
missing_context$confidence_level <- NA
missing_context$active_time_ms <- NA
missing_context$occurred_at <- NA
missing_context$session_id <- NA
context_profile <- build_learning_profile(missing_context, one_question)
assert_equal(context_profile$data_quality$missingness$confidence, 1L, "Confianca ausente explicitamente contada")
assert_equal(context_profile$data_quality$missingness$active_time, 1L, "Tempo ausente explicitamente contado")
assert_equal(context_profile$data_quality$missingness$occurred_at, 1L, "Data ausente explicitamente contada")
assert_equal(context_profile$period$total_sessions, 0L, "Sessao ausente nao fabrica uma sessao")

blocked_validation <- list(is_valid = FALSE, has_warnings = FALSE, summary = list(warnings = 0L))
assert_false(build_learning_profile(personal_attempt, one_question, blocked_validation)$is_real_student_profile,
             "Erro bloqueante de validacao impede perfil pessoal")
incomplete_flags <- personal_attempt
incomplete_audit <- verified_provenance
incomplete_audit$can_generate_student_profile <- FALSE
attr(incomplete_flags, "provenance_info") <- incomplete_audit
assert_false(build_learning_profile(incomplete_flags, one_question)$is_real_student_profile,
             "Flag explicita de inelegibilidade da auditoria e respeitada")

# 11. Java-shaped rows retain their recorded classification without duplicating evidence.
operational_attempt <- personal_attempt
operational_attempt$disciplina <- one_question$disciplina
operational_attempt$assunto <- one_question$assunto
operational_profile <- build_learning_profile(operational_attempt, one_question)
assert_equal(sum(operational_profile$mastery_by_discipline$n_attempts), 1L,
             "Colunas Java e catalogo coexistem sem .x/.y ou perda de evidencia")
assert_equal(sum(operational_profile$mastery_by_topic$n_attempts), 1L,
             "Perfil operacional possui topico observado")
identical_catalog_rows <- rbind(one_question, one_question)
assert_equal(build_learning_profile(operational_attempt, identical_catalog_rows)$data_quality$valid_attempts, 1L,
             "Duplicata identica no catalogo nao altera denominador do perfil")
assert_equal(sum(build_learning_profile(operational_attempt, identical_catalog_rows)$mastery_by_discipline$n_attempts), 1L,
             "Join de desempenho nao duplica tentativa por catalogo repetido")
missing_catalog_metadata <- one_question
missing_catalog_metadata$disciplina <- NA_character_
missing_catalog_metadata$assunto <- NA_character_
joined <- join_question_metadata(operational_attempt, missing_catalog_metadata)
assert_equal(joined$disciplina, operational_attempt$disciplina,
             "Catalogo incompleto nao apaga disciplina registrada na tentativa")
assert_equal(joined$assunto, operational_attempt$assunto,
             "Catalogo incompleto nao apaga topico registrado na tentativa")
conflicting_catalog <- rbind(one_question, one_question)
conflicting_catalog$disciplina[2] <- "Outra disciplina"
join_failed <- tryCatch({ join_question_metadata(operational_attempt, conflicting_catalog); FALSE },
                        error = function(e) grepl("Conflicting question metadata", conditionMessage(e), fixed = TRUE))
assert_true(join_failed, "Catalogo conflitante gera erro explicito em vez de multiplicar evidencias")
assert_equal(profile_null$evidence_policy_version, "1.1.0", "Politica de evidencia versionada tambem no perfil vazio")
assert_equal(profile_valid$evidence_policy_version, "1.1.0", "Politica de evidencia distingue perfil com filtro novo")

shared_selection <- select_evaluable_attempts(mixed, one_question)
assert_equal(shared_selection$original_count, 2L, "Helper central preserva denominador original")
assert_equal(shared_selection$excluded_count, 1L, "Helper central usa mesma exclusao do perfil")
assert_equal(shared_selection$evaluable_mask, c(TRUE, FALSE), "Mascara central rastreia cada linha original")
assert_equal(nrow(shared_selection$attempts_df), mixed_profile$data_quality$valid_attempts,
             "Pipeline e perfil compartilham identica elegibilidade")
assert_true(identical(attr(shared_selection$attempts_df, "provenance_info"), attr(mixed, "provenance_info")),
            "Filtro nao altera auditoria original nem cria nova procedencia")
assert_equal(select_evaluable_attempts(NULL)$original_count, 0L, "Helper central aceita entrada nula sem fabricar dados")
