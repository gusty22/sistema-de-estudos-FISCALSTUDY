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
assert_true(!is.na(profile_valid$transfer_exposure$transfer_delta), "Delta de transferencia calculado")

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
assert_equal(dirty_profile$data_quality$valid_attempts, 13L, "Perfil processou com sucesso tentativa com questao anulada sem quebrar")
assert_true(dirty_profile$data_quality$is_valid, "Dados sem erros bloqueantes continuam validos")
