# R/learning_profile.R
# Módulo de Construção do Perfil Multidimensional de Aprendizagem
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

if (file.exists("R/provenance.R")) {
  source("R/provenance.R")
}

#' Classifica Nível de Evidência com base no tamanho amostral (heurística operacional provisória)
#' @param n Quantidade de observações
#' @param thresholds Lista opcional de limiares (padrão: low = 10L, moderate = 30L)
#' @return String com a categoria de evidência
categorize_evidence_level <- function(n, thresholds = list(low = 10L, moderate = 30L)) {
  if (is.na(n) || n <= 0) return("NO_DATA")
  t_low <- if (!is.null(thresholds$low)) thresholds$low else 10L
  t_mod <- if (!is.null(thresholds$moderate)) thresholds$moderate else 30L
  if (n < t_low) return("LOW_EVIDENCE")
  if (n < t_mod) return("MODERATE_EVIDENCE")
  "HIGH_EVIDENCE"
}

# Shared eligibility boundary for profile and pipeline metrics. Original rows are never modified.
select_evaluable_attempts <- function(attempts_df, questions_df = NULL) {
  if (is.null(attempts_df)) attempts_df <- data.frame()
  # A non-null outcome is not enough: annulled/ungraded items are not evidence.
  raw_outcomes <- if ("is_correct" %in% names(attempts_df)) toupper(trimws(as.character(attempts_df$is_correct))) else rep(NA_character_, nrow(attempts_df))
  normalized_outcomes <- rep(NA, nrow(attempts_df))
  normalized_outcomes[raw_outcomes %in% c("TRUE", "1")] <- TRUE
  normalized_outcomes[raw_outcomes %in% c("FALSE", "0")] <- FALSE
  non_evaluable <- rep(FALSE, nrow(attempts_df))
  blocked_statuses <- c("ANULADA", "AUSENTE", "SOB_REVISAO")
  for (column in intersect(c("gabarito_status", "correct_option"), names(attempts_df))) {
    non_evaluable <- non_evaluable | toupper(trimws(as.character(attempts_df[[column]]))) %in% blocked_statuses
  }
  if ("is_annulled" %in% names(attempts_df)) {
    non_evaluable <- non_evaluable | toupper(trimws(as.character(attempts_df$is_annulled))) %in% c("TRUE", "1")
  }
  if (!is.null(questions_df) && "question_id" %in% names(questions_df) && "question_id" %in% names(attempts_df)) {
    excluded_catalog <- rep(FALSE, nrow(questions_df))
    for (column in intersect(c("gabarito_status", "correct_option"), names(questions_df))) {
      excluded_catalog <- excluded_catalog | toupper(trimws(as.character(questions_df[[column]]))) %in% blocked_statuses
    }
    if ("is_annulled" %in% names(questions_df)) {
      excluded_catalog <- excluded_catalog | toupper(trimws(as.character(questions_df$is_annulled))) %in% c("TRUE", "1")
    }
    non_evaluable <- non_evaluable | attempts_df$question_id %in% questions_df$question_id[excluded_catalog]
  }
  evaluable <- !is.na(normalized_outcomes) & !non_evaluable
  valid_attempts <- attempts_df[evaluable, , drop = FALSE]
  valid_attempts$is_correct <- normalized_outcomes[evaluable]
  n_valid <- nrow(valid_attempts)

  # Provenance still describes the original dataset, not proof granted by this filter.
  provenance <- attr(attempts_df, "provenance_info")
  if (!is.null(provenance)) attr(valid_attempts, "provenance_info") <- provenance
  list(attempts_df = valid_attempts, evaluable_mask = evaluable,
       original_count = as.integer(nrow(attempts_df)),
       excluded_count = as.integer(sum(!evaluable)),
       missing_outcome_count = as.integer(sum(is.na(normalized_outcomes))),
       status_excluded_count = as.integer(sum(non_evaluable)))
}

#' Constrói o Perfil Multidimensional de Aprendizagem do Estudante
#' @param attempts_df data.frame de tentativas (ANSWER_SUBMITTED)
#' @param questions_df data.frame do catálogo de questões
#' @param validation_result Lista opcional resultante de validate_events_dataset
#' @return Lista estruturada com o perfil multidimensional e metadados de incerteza
build_learning_profile <- function(attempts_df, questions_df = NULL, validation_result = NULL) {
  # 1. Tratamento seguro de dados vazios ou nulos
  if (is.null(attempts_df) || nrow(attempts_df) == 0) {
    return(list(
      profile_version = "1.0.0",
      evidence_policy_version = "1.1.0",
      generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
      data_provenance = "NO_DATA",
      is_real_student_profile = FALSE,
      provenance_audit = "DADOS_VAZIOS",
      data_quality = list(
        is_valid = FALSE,
        total_events = 0L,
        valid_attempts = 0L,
        excluded_non_evaluable_attempts = 0L,
        missing_outcome_attempts = 0L,
        personal_origin_rows = 0L,
        classification_metadata_policy = "RECORDED_VALUES_WITH_CURRENT_CATALOG_FALLBACK",
        classification_temporal_validity = "NOT_ESTABLISHED",
        missingness = list(confidence = 0L, active_time = 0L, occurred_at = 0L, session_id = 0L),
        has_blocking_errors = FALSE,
        warnings_count = 0L,
        quality_flags = c("EMPTY_DATASET", "NO_DATA")
      ),
      period = list(
        start = NA_character_,
        end = NA_character_,
        total_sessions = 0L
      ),
      mastery_by_discipline = data.frame(
        disciplina = character(0),
        n_attempts = integer(0),
        n_correct = integer(0),
        accuracy = numeric(0),
        ci_lower = numeric(0),
        ci_upper = numeric(0),
        evidence_level = character(0),
        denominator_text = character(0),
        stringsAsFactors = FALSE
      ),
      mastery_by_topic = data.frame(
        disciplina = character(0),
        assunto = character(0),
        n_attempts = integer(0),
        n_correct = integer(0),
        accuracy = numeric(0),
        ci_lower = numeric(0),
        ci_upper = numeric(0),
        evidence_level = character(0),
        denominator_text = character(0),
        stringsAsFactors = FALSE
      ),
      retention = list(
        retention_by_interval = data.frame(),
        transition_matrix = matrix(0, 2, 2),
        n_repeated_attempts = 0L,
        repeat_accuracy = NA_real_,
        initial_accuracy = NA_real_,
        transfer_delta = NA_real_,
        repeat_vs_initial_accuracy_delta = NA_real_,
        transfer_status = "NOT_ESTABLISHED"
      ),
      fluency = list(
        n_valid_times = 0L,
        median_sec = NA_real_,
        iqr_sec = NA_real_,
        mean_sec = NA_real_,
        sub_second_count = 0L,
        outliers_detected = 0L
      ),
      metacognition = list(
        n_observations = 0L,
        brier_score = NA_real_,
        ece = NA_real_,
        overconfidence_rate_level5 = NA_real_,
        underconfidence_rate_low = NA_real_,
        accuracy_by_level = data.frame()
      ),
      error_patterns = list(
        total_errors = 0L,
        recurrent_error_attempts = 0L,
        recurrent_error_rate = NA_real_,
        recurrent_error_questions = character(0)
      ),
      transfer_exposure = list(
        initial_attempts_count = 0L,
        repeated_attempts_count = 0L,
        novel_vs_repeat_ratio = NA_real_,
        novel_accuracy = NA_real_,
        repeat_accuracy = NA_real_,
        repeat_vs_initial_accuracy_delta = NA_real_,
        transfer_status = "NOT_ESTABLISHED"
      ),
      methodological_cautions = c("Perfil gerado sobre conjunto de dados vazio.")
    ))
  }
  
  # Auditoria de Procedência
  prov_attr <- attr(attempts_df, "provenance_info")
  provenance_info <- if (!is.null(prov_attr)) {
    prov_attr
  } else if (exists("verify_data_provenance", mode = "function")) {
    verify_data_provenance(attempts_df)
  } else {
    list(
      provenance_type = "UNVERIFIED_SOURCE",
      is_proven_operational = FALSE,
      is_real_student_data = FALSE,
      can_generate_student_profile = FALSE,
      audit_verdict = "AUDITORIA_PROVENANCE_NAO_CARREGADA",
      reasons = character(0),
      warnings = character(0)
    )
  }

  selection <- select_evaluable_attempts(attempts_df, questions_df)
  valid_attempts <- selection$attempts_df
  n_valid <- nrow(valid_attempts)

  # Audit the original rows, not just the retained subset: filtering cannot launder origins.
  personal_origins <- "origin_type" %in% names(attempts_df) &&
    all(!is.na(attempts_df$origin_type) & as.character(attempts_df$origin_type) == "REAL_STUDY")
  provenance_allows_profile <- isTRUE(provenance_info$is_proven_operational) &&
    isTRUE(provenance_info$is_real_student_data) && isTRUE(provenance_info$can_generate_student_profile)
  real_profile <- provenance_allows_profile && personal_origins && n_valid > 0L &&
    (is.null(validation_result) || isTRUE(validation_result$is_valid))
  if (provenance_allows_profile && !personal_origins) {
    provenance_info$provenance_type <- "UNVERIFIED_SOURCE"
    provenance_info$audit_verdict <- "ORIGIN_NOT_PERSONAL"
    provenance_info$reasons <- c(provenance_info$reasons, "Original dataset contains missing or nonpersonal origins; profile cannot be personal.")
  }
  missing_count <- function(column) {
    if (!column %in% names(valid_attempts)) return(as.integer(n_valid))
    values <- valid_attempts[[column]]
    as.integer(sum(is.na(values) | trimws(as.character(values)) == ""))
  }
  
  # Metadados de qualidade
  quality_flags <- c(paste0("PROVENANCE_", provenance_info$provenance_type))
  if (selection$excluded_count > 0L) quality_flags <- c(quality_flags, "NON_EVALUABLE_ATTEMPTS_EXCLUDED")
  if (n_valid == 0L) quality_flags <- c(quality_flags, "NO_EVALUABLE_ATTEMPTS", "NO_DATA")
  if (!real_profile) quality_flags <- c(quality_flags, "NOT_A_PERSONAL_LEARNING_PROFILE")
  has_blocking <- FALSE
  warn_count <- 0L
  if (!is.null(validation_result)) {
    if (!validation_result$is_valid) {
      quality_flags <- c(quality_flags, "HAS_BLOCKING_ERRORS")
      has_blocking <- TRUE
    } else {
      quality_flags <- c(quality_flags, "VALID_DATA", "NO_BLOCKING_ERRORS")
    }
    warn_count <- as.integer(validation_result$summary$warnings)
    if (validation_result$has_warnings) {
      quality_flags <- c(quality_flags, paste0("WARNINGS_COUNT_", warn_count))
    }
  } else {
    quality_flags <- c(quality_flags, "UNVALIDATED_RAW_DATA")
  }
  
  if (n_valid < 30) {
    quality_flags <- c(quality_flags, "LOW_POWER_SAMPLE")
  }
  
  # Janela temporal
  times_present <- "occurred_at" %in% names(valid_attempts) && any(!is.na(valid_attempts$occurred_at))
  p_start <- if (times_present) min(valid_attempts$occurred_at, na.rm = TRUE) else NA_character_
  p_end   <- if (times_present) max(valid_attempts$occurred_at, na.rm = TRUE) else NA_character_
  total_sess <- if ("session_id" %in% names(valid_attempts)) length(unique(valid_attempts$session_id[!is.na(valid_attempts$session_id) & trimws(valid_attempts$session_id) != ""])) else 0L
  
  # 2. Dimensão 1: Domínio por Disciplina
  disc_df <- calculate_performance_by_discipline(valid_attempts, questions_df)
  if (nrow(disc_df) > 0) {
    disc_df$evidence_level <- vapply(disc_df$n_attempts, categorize_evidence_level, character(1))
  } else {
    disc_df$evidence_level <- character(0)
  }
  
  # 3. Dimensão 1b: Domínio por Tópico (com salvaguarda de NO_DATA para tópicos não estudados)
  topic_df <- calculate_performance_by_topic(valid_attempts, questions_df, min_sample = 1)
  if (nrow(topic_df) > 0) {
    topic_df$evidence_level <- vapply(topic_df$n_attempts, categorize_evidence_level, character(1))
  } else {
    topic_df$evidence_level <- character(0)
  }
  
  # Se houver catálogo de questões, identificar tópicos cadastrados com zero tentativas (NO_DATA)
  if (!is.null(questions_df) && "assunto" %in% names(questions_df)) {
    catalog_topics <- unique(questions_df[!is.na(questions_df$assunto) & trimws(questions_df$assunto) != "", c("disciplina", "assunto")])
    if (nrow(catalog_topics) > 0) {
      studied_topics <- if (nrow(topic_df) > 0) paste(topic_df$disciplina, topic_df$assunto, sep = ":::") else character(0)
      unstudied_rows <- list()
      for (i in seq_len(nrow(catalog_topics))) {
        d_val <- as.character(catalog_topics$disciplina[i])
        t_val <- as.character(catalog_topics$assunto[i])
        key <- paste(d_val, t_val, sep = ":::")
        if (!key %in% studied_topics) {
          unstudied_rows[[length(unstudied_rows) + 1]] <- data.frame(
            disciplina = d_val,
            assunto = t_val,
            n_attempts = 0L,
            n_correct = 0L,
            n_incorrect = 0L,
            accuracy = NA_real_,
            ci_lower = NA_real_,
            ci_upper = NA_real_,
            low_sample_flag = TRUE,
            denominator_text = "0/0 (Sem dados observados)",
            evidence_level = "NO_DATA",
            stringsAsFactors = FALSE
          )
        }
      }
      if (length(unstudied_rows) > 0) {
        unstudied_df <- do.call(rbind, unstudied_rows)
        topic_df <- rbind(topic_df, unstudied_df)
        topic_df <- topic_df[order(topic_df$disciplina, topic_df$assunto), ]
      }
    }
  }
  
  # 4. Dimensão 2 & 6: Retenção, Histórico e Transferência
  classified_df <- classify_attempt_history(valid_attempts, questions_df)
  retention_metrics <- calculate_retention_metrics(classified_df)
  
  init_attempts <- classified_df[classified_df$is_initial_attempt == TRUE, ]
  rep_attempts  <- classified_df[classified_df$is_initial_attempt == FALSE, ]
  
  n_init <- nrow(init_attempts)
  k_init <- sum(init_attempts$is_correct == TRUE)
  acc_init <- if (n_init > 0) round(k_init / n_init, 4) else NA_real_
  ci_init <- calculate_wilson_ci(k_init, n_init, 0.95)
  
  n_rep <- nrow(rep_attempts)
  k_rep <- sum(rep_attempts$is_correct == TRUE)
  acc_rep <- if (n_rep > 0) round(k_rep / n_rep, 4) else NA_real_
  ci_rep <- calculate_wilson_ci(k_rep, n_rep, 0.95)
  
  transfer_delta <- if (!is.na(acc_rep) && !is.na(acc_init)) round(acc_rep - acc_init, 4) else NA_real_
  novel_ratio <- if (nrow(classified_df) > 0) round(n_init / nrow(classified_df), 4) else NA_real_
  
  # 5. Dimensão 3: Fluência e Gestão de Tempo
  time_res <- calculate_time_metrics(valid_attempts)
  sub_sec_count <- 0L
  if ("active_time_ms" %in% names(valid_attempts)) {
    raw_ms <- suppressWarnings(as.numeric(valid_attempts$active_time_ms))
    sub_sec_count <- sum(!is.na(raw_ms) & raw_ms < 1000 & raw_ms >= 0)
  }
  
  # 6. Dimensão 4: Metacognição e Calibração
  conf_res <- calculate_confidence_metrics(valid_attempts)
  
  # 7. Dimensão 5: Padrões e Recorrência de Erros
  total_errors <- sum(valid_attempts$is_correct == FALSE)
  recurrent_error_qids <- character(0)
  recurrent_error_count <- 0L
  
  if (n_rep > 0) {
    # Erros em tentativas repetidas
    rep_errors <- rep_attempts[rep_attempts$is_correct == FALSE, ]
    recurrent_error_count <- nrow(rep_errors)
    
    # Questões onde o usuário errou 2 ou mais vezes
    q_error_counts <- table(valid_attempts$question_id[valid_attempts$is_correct == FALSE])
    recurrent_error_qids <- names(q_error_counts[q_error_counts >= 2])
  }
  
  recurrent_error_rate <- if (n_rep > 0) round(recurrent_error_count / n_rep, 4) else NA_real_
  
  # 8. Advertências Metodológicas e Salvaguarda Epistêmica
  cautions <- c(
    "Evidence-level categories depend only on provisional sample-size thresholds; HIGH_EVIDENCE does not establish mastery or pedagogical efficacy.",
    "transfer_delta is a compatibility alias for repeat-minus-initial accuracy; it is not evidence of conceptual transfer.",
    "Accuracy describes observed task performance, not measured conceptual mastery; confidence and response time do not establish the cause of an error.",
    "Recorded classification is preserved; current catalog only fills gaps and does not establish the classification known at the historical attempt time.",
    "Confidence-to-probability mapping is provisional; ECE on samples below 30 should be interpreted as descriptive and unstable.",
    "1. Perfil multidimensional: nenhum escore isolado sintetiza a proficiencia do estudante.",
    "2. Ausencia de tentativas em tópicos e rotulada estritamente como NO_DATA e nao como deficiencia.",
    "3. Estimativas pontuais acompanhadas de intervalos de confianca Wilson a 95%.",
    "4. Retencao em itens repetidos reflete memoria do item especifico e nao garantia de transferencia abstrata."
  )
  if (!real_profile) {
    cautions <- c(
      sprintf("BLOQUEIO EPISTEMICO MANDATORIO: Procedencia dos dados e '%s'. PROIBIDO apresentar como historico real de estudante.", provenance_info$provenance_type),
      cautions
    )
  }
  if (n_valid < 30) {
    cautions <- c(cautions, sprintf("Amostra global reduzida (N = %d); intervalos amplos requerem cautela analítica.", n_valid))
  }
  if (sub_sec_count > 0) {
    cautions <- c(cautions, sprintf("%d resposta(s) sub-segundo identificada(s); possivel clique impulsivo ou desatencao.", sub_sec_count))
  }
  if (!is.na(conf_res$overconfidence_count) && conf_res$overconfidence_count > 0) {
    cautions <- c(cautions, sprintf("%d erro(s) cometido(s) com confianca maxima (nivel 5), apontando para discrepancia entre certeza declarada e gabarito em conteudos especificos.", conf_res$overconfidence_count))
  }
  
  list(
    profile_version = "1.0.0",
      evidence_policy_version = "1.1.0",
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    data_provenance = provenance_info$provenance_type,
    is_real_student_profile = real_profile,
    provenance_audit = provenance_info$audit_verdict,
    provenance_reasons = provenance_info$reasons,
    provenance_warnings = provenance_info$warnings,
    data_quality = list(
      is_valid = if (!is.null(validation_result)) validation_result$is_valid else TRUE,
      total_events = nrow(attempts_df),
      valid_attempts = n_valid,
      excluded_non_evaluable_attempts = selection$excluded_count,
      missing_outcome_attempts = selection$missing_outcome_count,
      personal_origin_rows = if ("origin_type" %in% names(attempts_df)) as.integer(sum(attempts_df$origin_type %in% "REAL_STUDY")) else 0L,
      classification_metadata_policy = "RECORDED_VALUES_WITH_CURRENT_CATALOG_FALLBACK",
      classification_temporal_validity = "NOT_ESTABLISHED",
      missingness = list(confidence = missing_count("confidence_level"), active_time = missing_count("active_time_ms"), occurred_at = missing_count("occurred_at"), session_id = missing_count("session_id")),
      has_blocking_errors = has_blocking,
      warnings_count = warn_count,
      quality_flags = quality_flags
    ),
    period = list(
      start = p_start,
      end = p_end,
      total_sessions = total_sess
    ),
    mastery_by_discipline = disc_df,
    mastery_by_topic = topic_df,
    retention = list(
      retention_by_interval = retention_metrics$retention_by_interval,
      transition_matrix = retention_metrics$transition_matrix,
      n_repeated_attempts = n_rep,
      repeat_accuracy = acc_rep,
      repeat_ci_lower = ci_rep["lower"],
      repeat_ci_upper = ci_rep["upper"],
      initial_accuracy = acc_init,
      initial_ci_lower = ci_init["lower"],
      initial_ci_upper = ci_init["upper"],
      transfer_delta = transfer_delta,
      repeat_vs_initial_accuracy_delta = transfer_delta,
      transfer_status = "NOT_ESTABLISHED"
    ),
    fluency = list(
      n_valid_times = time_res$n_valid_times,
      median_sec = time_res$median_sec,
      iqr_sec = time_res$iqr_sec,
      mean_sec = time_res$mean_sec,
      sub_second_count = sub_sec_count,
      outliers_detected = time_res$outliers_detected,
      outlier_cutoff_high_sec = time_res$outlier_cutoff_high_sec
    ),
    metacognition = list(
      n_observations = conf_res$n_observations,
      brier_score = conf_res$brier_score,
      ece = conf_res$ece,
      overconfidence_count = conf_res$overconfidence_count,
      overconfidence_rate_level5 = conf_res$overconfidence_rate_in_level5,
      underconfidence_count = conf_res$underconfidence_count,
      underconfidence_rate_low = conf_res$underconfidence_rate_in_low_conf,
      accuracy_by_level = conf_res$accuracy_by_level
    ),
    error_patterns = list(
      total_errors = total_errors,
      recurrent_error_attempts = recurrent_error_count,
      recurrent_error_rate = recurrent_error_rate,
      recurrent_error_questions = recurrent_error_qids
    ),
    transfer_exposure = list(
      initial_attempts_count = n_init,
      repeated_attempts_count = n_rep,
      novel_vs_repeat_ratio = novel_ratio,
      novel_accuracy = acc_init,
      novel_ci_lower = ci_init["lower"],
      novel_ci_upper = ci_init["upper"],
      repeat_accuracy = acc_rep,
      repeat_ci_lower = ci_rep["lower"],
      repeat_ci_upper = ci_rep["upper"],
      transfer_delta = transfer_delta,
      repeat_vs_initial_accuracy_delta = transfer_delta,
      transfer_status = "NOT_ESTABLISHED"
    ),
    methodological_cautions = cautions
  )
}
