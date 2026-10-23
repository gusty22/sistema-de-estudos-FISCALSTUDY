# R/validation.R
# Módulo de Validação e Integridade de Dados
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

if (file.exists("R/provenance.R")) {
  source("R/provenance.R")
}

#' Cria uma estrutura vazia de issues de validação
#' @return data.frame estruturado para issues
create_empty_issues <- function() {
  data.frame(
    severity = character(0),
    rule_code = character(0),
    column_name = character(0),
    row_index = character(0),
    message = character(0),
    stringsAsFactors = FALSE
  )
}

#' Adiciona uma issue à lista de ocorrências
#' @param issues data.frame de issues existentes
#' @param severity "BLOCKING_ERROR", "WARNING", ou "INFO"
#' @param rule_code Código identificador da regra
#' @param column_name Nome da coluna afetada
#' @param row_index Índices das linhas afetadas (vetor numérico ou texto)
#' @param message Mensagem explicativa
#' @return data.frame atualizado
add_issue <- function(issues, severity, rule_code, column_name, row_index, message) {
  row_str <- if (length(row_index) == 0 || all(is.na(row_index))) {
    "N/A"
  } else if (length(row_index) > 10) {
    paste0(paste(head(row_index, 10), collapse = ", "), " ... (", length(row_index), " linhas)")
  } else {
    paste(row_index, collapse = ", ")
  }
  
  new_row <- data.frame(
    severity = as.character(severity),
    rule_code = as.character(rule_code),
    column_name = as.character(column_name),
    row_index = as.character(row_str),
    message = as.character(message),
    stringsAsFactors = FALSE
  )
  rbind(issues, new_row)
}

#' Valida catálogo de questões (questions_df)
#' @param questions_df data.frame com o catálogo de questões
#' @return Lista com resultado da validação, issues e sumário
validate_questions_dataset <- function(questions_df) {
  issues <- create_empty_issues()
  
  if (is.null(questions_df) || !is.data.frame(questions_df)) {
    issues <- add_issue(issues, "BLOCKING_ERROR", "INVALID_INPUT", "questions_df", NA, "Objeto questions_df é nulo ou não é um data.frame.")
    return(list(
      is_valid = FALSE,
      has_warnings = FALSE,
      issues = issues,
      summary = list(total_rows = 0, blocking_errors = 1, warnings = 0)
    ))
  }
  
  n_rows <- nrow(questions_df)
  if (n_rows == 0) {
    issues <- add_issue(issues, "BLOCKING_ERROR", "EMPTY_DATASET", "questions_df", NA, "Dataset de questões está vazio (0 linhas).")
    return(list(
      is_valid = FALSE,
      has_warnings = FALSE,
      issues = issues,
      summary = list(total_rows = 0, blocking_errors = 1, warnings = 0)
    ))
  }
  
  # 1. Presença de colunas essenciais
  req_cols <- c("question_id", "enunciado", "disciplina")
  missing_cols <- setdiff(req_cols, names(questions_df))
  if (length(missing_cols) > 0) {
    issues <- add_issue(issues, "BLOCKING_ERROR", "MISSING_REQUIRED_COLUMNS",
                        paste(missing_cols, collapse = ", "), NA,
                        paste("Colunas obrigatórias ausentes no dataset de questões:", paste(missing_cols, collapse = ", ")))
    return(list(
      is_valid = FALSE,
      has_warnings = any(issues$severity == "WARNING"),
      issues = issues,
      summary = list(total_rows = n_rows, blocking_errors = sum(issues$severity == "BLOCKING_ERROR"), warnings = 0)
    ))
  }
  
  # 2. Integridade de identificadores (unicidade e não-vazio)
  empty_ids <- which(is.na(questions_df$question_id) | trimws(as.character(questions_df$question_id)) == "")
  if (length(empty_ids) > 0) {
    issues <- add_issue(issues, "BLOCKING_ERROR", "EMPTY_QUESTION_ID", "question_id", empty_ids,
                        paste("Existem", length(empty_ids), "questões com question_id nulo ou vazio."))
  }
  
  dup_ids <- which(duplicated(questions_df$question_id))
  if (length(dup_ids) > 0) {
    dup_values <- unique(questions_df$question_id[dup_ids])
    issues <- add_issue(issues, "BLOCKING_ERROR", "DUPLICATE_QUESTION_ID", "question_id", dup_ids,
                        paste("Identificadores de questão duplicados:", paste(head(dup_values, 5), collapse = ", ")))
  }
  
  # 3. Disciplinas ausentes ou em branco
  blank_disc <- which(is.na(questions_df$disciplina) | trimws(as.character(questions_df$disciplina)) == "")
  if (length(blank_disc) > 0) {
    issues <- add_issue(issues, "WARNING", "MISSING_DISCIPLINE", "disciplina", blank_disc,
                        paste("Existem", length(blank_disc), "questões sem disciplina preenchida."))
  }
  
  # 4. Gabarito oficial ausente ou preliminar
  if ("correct_option" %in% names(questions_df)) {
    missing_key <- which(is.na(questions_df$correct_option) | trimws(as.character(questions_df$correct_option)) == "")
    if (length(missing_key) > 0) {
      issues <- add_issue(issues, "WARNING", "MISSING_CORRECT_OPTION", "correct_option", missing_key,
                          paste("Existem", length(missing_key), "questões sem gabarito oficial definitivo."))
    }
    # 4.1 Validade dos valores de gabarito (A-E ou ANULADA)
    valid_keys <- c("A", "B", "C", "D", "E", "ANULADA")
    non_empty_keys <- which(!is.na(questions_df$correct_option) & trimws(as.character(questions_df$correct_option)) != "")
    invalid_keys <- non_empty_keys[which(!toupper(trimws(as.character(questions_df$correct_option[non_empty_keys]))) %in% valid_keys)]
    if (length(invalid_keys) > 0) {
      issues <- add_issue(issues, "WARNING", "INVALID_CORRECT_OPTION_VALUE", "correct_option", invalid_keys,
                          paste("Questões com valores de gabarito fora do domínio padrão (A-E ou ANULADA):", length(invalid_keys)))
    }
  } else {
    issues <- add_issue(issues, "WARNING", "OPTIONAL_COLUMN_MISSING", "correct_option", NA,
                        "Coluna correct_option ausente no catálogo de questões.")
  }
  
  # 5. Questões anuladas
  if ("is_annulled" %in% names(questions_df)) {
    annulled_rows <- which(questions_df$is_annulled == TRUE)
    if (length(annulled_rows) > 0) {
      issues <- add_issue(issues, "INFO", "ANNULLED_QUESTIONS_CATALOGED", "is_annulled", annulled_rows,
                          paste("Catálogo contém", length(annulled_rows), "questões marcadas como anuladas."))
    }
  }

  # 6. Procedência temporal do catálogo (ano de aplicação)
  if ("ano" %in% names(questions_df)) {
    ano_num <- suppressWarnings(as.numeric(questions_df$ano))
    anomalous_years <- which(!is.na(ano_num) & (ano_num < 1980 | ano_num > 2035))
    if (length(anomalous_years) > 0) {
      issues <- add_issue(issues, "WARNING", "ANOMALOUS_PROVENANCE_YEAR", "ano", anomalous_years,
                          paste("Questões com ano de aplicação fora da faixa plausível [1980, 2035]:", length(anomalous_years)))
    }
  }
  
  blocking_count <- sum(issues$severity == "BLOCKING_ERROR")
  warning_count <- sum(issues$severity == "WARNING")
  
  list(
    is_valid = (blocking_count == 0),
    has_warnings = (warning_count > 0),
    issues = issues,
    summary = list(
      total_rows = n_rows,
      blocking_errors = blocking_count,
      warnings = warning_count,
      infos = sum(issues$severity == "INFO")
    )
  )
}

#' Valida dataset de eventos de aprendizagem (events_df)
#' @param events_df data.frame com os eventos
#' @param questions_df data.frame opcional com catálogo de questões para integridade referencial
#' @return Lista com resultado da validação, issues e sumário
validate_events_dataset <- function(events_df, questions_df = NULL) {
  issues <- create_empty_issues()
  
  if (is.null(events_df) || !is.data.frame(events_df)) {
    issues <- add_issue(issues, "BLOCKING_ERROR", "INVALID_INPUT", "events_df", NA, "Objeto events_df é nulo ou não é um data.frame.")
    return(list(
      is_valid = FALSE,
      has_warnings = FALSE,
      issues = issues,
      summary = list(total_rows = 0, blocking_errors = 1, warnings = 0)
    ))
  }
  
  n_rows <- nrow(events_df)
  if (n_rows == 0) {
    issues <- add_issue(issues, "BLOCKING_ERROR", "EMPTY_DATASET", "events_df", NA, "Dataset de eventos está vazio (0 linhas).")
    return(list(
      is_valid = FALSE,
      has_warnings = FALSE,
      issues = issues,
      summary = list(total_rows = 0, blocking_errors = 1, warnings = 0)
    ))
  }
  
  # 1. Colunas obrigatórias
  req_cols <- c("event_id", "event_type", "session_id", "occurred_at")
  missing_cols <- setdiff(req_cols, names(events_df))
  if (length(missing_cols) > 0) {
    issues <- add_issue(issues, "BLOCKING_ERROR", "MISSING_REQUIRED_COLUMNS",
                        paste(missing_cols, collapse = ", "), NA,
                        paste("Colunas obrigatórias ausentes no dataset de eventos:", paste(missing_cols, collapse = ", ")))
    return(list(
      is_valid = FALSE,
      has_warnings = any(issues$severity == "WARNING"),
      issues = issues,
      summary = list(total_rows = n_rows, blocking_errors = sum(issues$severity == "BLOCKING_ERROR"), warnings = 0)
    ))
  }
  
  # 2. Unicidade de event_id
  empty_event_ids <- which(is.na(events_df$event_id) | trimws(as.character(events_df$event_id)) == "")
  if (length(empty_event_ids) > 0) {
    issues <- add_issue(issues, "BLOCKING_ERROR", "EMPTY_EVENT_ID", "event_id", empty_event_ids,
                        paste("Existem", length(empty_event_ids), "eventos com event_id nulo ou vazio."))
  }
  
  dup_event_ids <- which(duplicated(events_df$event_id))
  if (length(dup_event_ids) > 0) {
    issues <- add_issue(issues, "BLOCKING_ERROR", "DUPLICATE_EVENT_ID", "event_id", dup_event_ids,
                        paste("Identificadores de evento duplicados encontrados:", length(dup_event_ids), "duplicatas."))
  }
  
  # 3. Integridade temporal (parseabilidade de occurred_at)
  parse_iso_dates <- function(x) {
    res <- suppressWarnings(as.POSIXct(x, format = "%Y-%m-%dT%H:%M:%OSZ", tz = "UTC"))
    na_idx <- which(is.na(res))
    if (length(na_idx) > 0) {
      res2 <- suppressWarnings(as.POSIXct(x[na_idx], format = "%Y-%m-%dT%H:%M:%OS", tz = "UTC"))
      res[na_idx] <- res2
      na_idx2 <- which(is.na(res))
      if (length(na_idx2) > 0) {
        res3 <- suppressWarnings(as.POSIXct(x[na_idx2], format = "%Y-%m-%d %H:%M:%S", tz = "UTC"))
        res[na_idx2] <- res3
      }
    }
    res
  }
  
  parsed_dates <- parse_iso_dates(events_df$occurred_at)
  invalid_dates <- which(is.na(parsed_dates))
  if (length(invalid_dates) > 0) {
    issues <- add_issue(issues, "BLOCKING_ERROR", "INVALID_DATE_FORMAT", "occurred_at", invalid_dates,
                        paste("Existem", length(invalid_dates), "eventos com timestamps inválidos ou não parseáveis."))
  }
  
  # 4. Validação específica para ANSWER_SUBMITTED
  sub_indices <- which(events_df$event_type == "ANSWER_SUBMITTED")
  if (length(sub_indices) > 0) {
    sub_df <- events_df[sub_indices, , drop = FALSE]
    
    # 4.1 question_id presente
    if ("question_id" %in% names(sub_df)) {
      missing_qid <- sub_indices[which(is.na(sub_df$question_id) | trimws(as.character(sub_df$question_id)) == "")]
      if (length(missing_qid) > 0) {
        issues <- add_issue(issues, "BLOCKING_ERROR", "MISSING_QUESTION_ID_IN_ATTEMPT", "question_id", missing_qid,
                            paste("Tentativas de resposta sem question_id associado:", length(missing_qid)))
      }
    } else {
      issues <- add_issue(issues, "BLOCKING_ERROR", "MISSING_COLUMN_QUESTION_ID", "question_id", sub_indices,
                          "Coluna question_id ausente no dataset de eventos com ANSWER_SUBMITTED.")
    }
    
    # 4.2 is_correct presente e lógico
    if ("is_correct" %in% names(sub_df)) {
      na_correct <- sub_indices[which(is.na(sub_df$is_correct))]
      if (length(na_correct) > 0) {
        issues <- add_issue(issues, "WARNING", "MISSING_IS_CORRECT", "is_correct", na_correct,
                            paste("Tentativas com valor is_correct ausente (NA):", length(na_correct)))
      }
      non_bool_correct <- sub_indices[which(!is.na(sub_df$is_correct) & !sub_df$is_correct %in% c(TRUE, FALSE, 0, 1))]
      if (length(non_bool_correct) > 0) {
        issues <- add_issue(issues, "BLOCKING_ERROR", "INVALID_IS_CORRECT_TYPE", "is_correct", non_bool_correct,
                            paste("Valores não booleanos em is_correct:", length(non_bool_correct)))
      }
    } else {
      issues <- add_issue(issues, "BLOCKING_ERROR", "MISSING_COLUMN_IS_CORRECT", "is_correct", sub_indices,
                          "Coluna is_correct ausente para eventos ANSWER_SUBMITTED.")
    }
    
    # 4.3 confidence_level entre 1 e 5
    if ("confidence_level" %in% names(sub_df)) {
      conf_vals <- suppressWarnings(as.numeric(sub_df$confidence_level))
      na_conf <- sub_indices[which(is.na(conf_vals))]
      if (length(na_conf) > 0) {
        issues <- add_issue(issues, "WARNING", "MISSING_CONFIDENCE_LEVEL", "confidence_level", na_conf,
                            paste("Tentativas com confiança não preenchida (NA):", length(na_conf)))
      }
      out_of_bounds <- sub_indices[which(!is.na(conf_vals) & (conf_vals < 1 | conf_vals > 5 | conf_vals != round(conf_vals)))]
      if (length(out_of_bounds) > 0) {
        issues <- add_issue(issues, "BLOCKING_ERROR", "INVALID_CONFIDENCE_RANGE", "confidence_level", out_of_bounds,
                            paste("Níveis de confiança fora da escala discreta [1, 5]:", length(out_of_bounds)))
      }
    } else {
      issues <- add_issue(issues, "WARNING", "MISSING_COLUMN_CONFIDENCE", "confidence_level", sub_indices,
                          "Coluna confidence_level ausente em eventos ANSWER_SUBMITTED.")
    }
    
    # 4.4 active_time_ms não negativo e plausível
    if ("active_time_ms" %in% names(sub_df)) {
      time_vals <- suppressWarnings(as.numeric(sub_df$active_time_ms))
      neg_time <- sub_indices[which(!is.na(time_vals) & time_vals < 0)]
      if (length(neg_time) > 0) {
        issues <- add_issue(issues, "BLOCKING_ERROR", "NEGATIVE_ACTIVE_TIME", "active_time_ms", neg_time,
                            paste("Tentativas com tempo ativo negativo:", length(neg_time)))
      }
      sub_second <- sub_indices[which(!is.na(time_vals) & time_vals >= 0 & time_vals < 1000)]
      if (length(sub_second) > 0) {
        issues <- add_issue(issues, "WARNING", "SUSPICIOUS_SUB_SECOND_TIME", "active_time_ms", sub_second,
                            paste("Resoluções em menos de 1 segundo (possível chute rápido ou clique acidental):", length(sub_second)))
      }
      extreme_time <- sub_indices[which(!is.na(time_vals) & time_vals > 1800000)] # > 30 min
      if (length(extreme_time) > 0) {
        issues <- add_issue(issues, "WARNING", "EXTREME_ACTIVE_TIME", "active_time_ms", extreme_time,
                            paste("Resoluções superiores a 30 minutos (possível abandono de tela):", length(extreme_time)))
      }
    } else {
      issues <- add_issue(issues, "WARNING", "MISSING_COLUMN_TIME", "active_time_ms", sub_indices,
                          "Coluna active_time_ms ausente em eventos ANSWER_SUBMITTED.")
    }

    # 4.5 selected_option no domínio válido (A-E)
    if ("selected_option" %in% names(sub_df)) {
      valid_opts <- c("A", "B", "C", "D", "E")
      non_empty_opts <- which(!is.na(sub_df$selected_option) & trimws(as.character(sub_df$selected_option)) != "")
      invalid_opts <- sub_indices[non_empty_opts[which(!toupper(trimws(as.character(sub_df$selected_option[non_empty_opts]))) %in% valid_opts)]]
      if (length(invalid_opts) > 0) {
        issues <- add_issue(issues, "WARNING", "INVALID_SELECTED_OPTION", "selected_option", invalid_opts,
                            paste("Tentativas com alternativa selecionada fora do domínio A-E:", length(invalid_opts)))
      }
    }
  }
  
  # 5. Integridade cronológica de sessões de estudo (STARTED vs ENDED)
  session_starts <- events_df[events_df$event_type == "STUDY_SESSION_STARTED", ]
  session_ends <- events_df[events_df$event_type == "STUDY_SESSION_ENDED", ]
  if (nrow(session_starts) > 0 && nrow(session_ends) > 0) {
    merged_sess <- merge(
      session_starts[, c("session_id", "occurred_at")],
      session_ends[, c("session_id", "occurred_at")],
      by = "session_id",
      suffixes = c("_start", "_end")
    )
    if (nrow(merged_sess) > 0) {
      t_s <- parse_iso_dates(merged_sess$occurred_at_start)
      t_e <- parse_iso_dates(merged_sess$occurred_at_end)
      inverted_sessions <- which(!is.na(t_s) & !is.na(t_e) & t_e < t_s)
      if (length(inverted_sessions) > 0) {
        issues <- add_issue(issues, "BLOCKING_ERROR", "SESSION_CHRONOLOGY_INCONSISTENCY", "occurred_at", NA,
                            paste("Sessão(ões) com encerramento anterior ao início:",
                                  paste(merged_sess$session_id[inverted_sessions], collapse = ", ")))
      }
    }
  }

  # 6. Integridade referencial cruzada com catálogo de questões
  if (!is.null(questions_df) && is.data.frame(questions_df) && "question_id" %in% names(questions_df) && "question_id" %in% names(events_df)) {
    catalog_ids <- as.character(questions_df$question_id)
    attempt_qids <- as.character(events_df$question_id[sub_indices])
    unknown_qids <- which(!is.na(attempt_qids) & !attempt_qids %in% catalog_ids)
    if (length(unknown_qids) > 0) {
      issues <- add_issue(issues, "WARNING", "UNKNOWN_QUESTION_REFERENCE", "question_id", sub_indices[unknown_qids],
                          paste("Tentativas referenciando question_id não cadastrado no catálogo:", length(unknown_qids)))
    }
    
    # Cruzamento com questões anuladas
    if ("is_annulled" %in% names(questions_df)) {
      annulled_ids <- catalog_ids[which(questions_df$is_annulled == TRUE)]
      attempts_on_annulled <- which(attempt_qids %in% annulled_ids)
      if (length(attempts_on_annulled) > 0) {
        issues <- add_issue(issues, "WARNING", "ATTEMPT_ON_ANNULLED_QUESTION", "question_id", sub_indices[attempts_on_annulled],
                            paste("Tentativas de resposta em questões que foram anuladas:", length(attempts_on_annulled)))
      }
    }

    # Cruzamento de consistência lógica entre selected_option, correct_option e is_correct
    if ("selected_option" %in% names(events_df) && "correct_option" %in% names(questions_df) && "is_correct" %in% names(events_df)) {
      sub_events <- events_df[sub_indices, c("event_id", "question_id", "selected_option", "is_correct")]
      matched_eval <- merge(
        sub_events,
        questions_df[, c("question_id", "correct_option", if ("is_annulled" %in% names(questions_df)) "is_annulled" else character(0))],
        by = "question_id",
        all.x = TRUE
      )
      
      check_cand <- matched_eval[!is.na(matched_eval$correct_option) &
                                 matched_eval$correct_option %in% c("A", "B", "C", "D", "E") &
                                 !is.na(matched_eval$selected_option) &
                                 !is.na(matched_eval$is_correct), ]
      if ("is_annulled" %in% names(check_cand)) {
        check_cand <- check_cand[check_cand$is_annulled != TRUE, ]
      }
      
      if (nrow(check_cand) > 0) {
        expected_correct <- (toupper(trimws(check_cand$selected_option)) == toupper(trimws(check_cand$correct_option)))
        actual_correct <- (check_cand$is_correct == TRUE)
        mismatch_idx <- which(expected_correct != actual_correct)
        if (length(mismatch_idx) > 0) {
          issues <- add_issue(issues, "WARNING", "INCONSISTENT_ANSWER_EVALUATION", "is_correct", NA,
                              paste("Tentativas com divergência entre alternativa escolhida/gabarito e valor is_correct:",
                                    length(mismatch_idx), "ocorrência(s)."))
        }
      }
    }
  }
  
  blocking_count <- sum(issues$severity == "BLOCKING_ERROR")
  warning_count <- sum(issues$severity == "WARNING")
  
  list(
    is_valid = (blocking_count == 0),
    has_warnings = (warning_count > 0),
    issues = issues,
    summary = list(
      total_rows = n_rows,
      attempt_events = length(sub_indices),
      blocking_errors = blocking_count,
      warnings = warning_count,
      infos = sum(issues$severity == "INFO")
    )
  )
}
