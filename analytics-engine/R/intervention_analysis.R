# R/intervention_analysis.R
# Módulo de Validação e Análise Estruturada de Intervenções Pedagógicas
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

#' Valida Dataset de Intervenções Pedagógicas em Relação ao Contrato V1
#' @param interventions_df data.frame de intervenções
#' @return Lista padronizada com is_valid, has_warnings, summary e issues
validate_interventions_dataset <- function(interventions_df) {
  # 1. Checagem de dados nulos ou vazios
  if (is.null(interventions_df)) {
    return(list(
      is_valid = FALSE,
      has_warnings = FALSE,
      summary = list(total_rows = 0L, blocking_errors = 1L, warnings = 0L),
      issues = data.frame(
        severity = "BLOCKING_ERROR",
        rule_code = "NULL_DATASET",
        column_name = NA_character_,
        row_index = NA_character_,
        message = "O conjunto de intervencoes e nulo (NULL).",
        stringsAsFactors = FALSE
      )
    ))
  }
  
  if (!is.data.frame(interventions_df) || nrow(interventions_df) == 0) {
    return(list(
      is_valid = FALSE,
      has_warnings = FALSE,
      summary = list(total_rows = 0L, blocking_errors = 1L, warnings = 0L),
      issues = data.frame(
        severity = "BLOCKING_ERROR",
        rule_code = "EMPTY_DATASET",
        column_name = NA_character_,
        row_index = NA_character_,
        message = "O conjunto de intervencoes esta vazio (0 linhas).",
        stringsAsFactors = FALSE
      )
    ))
  }
  
  issues_list <- list()
  add_issue <- function(severity, rule_code, col, row_idx, msg) {
    issues_list[[length(issues_list) + 1]] <<- data.frame(
      severity = severity,
      rule_code = rule_code,
      column_name = as.character(col),
      row_index = as.character(row_idx),
      message = as.character(msg),
      stringsAsFactors = FALSE
    )
  }
  
  n_rows <- nrow(interventions_df)
  
  # 2. Verificação de Colunas Obrigatórias
  required_cols <- c(
    "intervention_id", "session_id", "occurred_at", "observed_problem",
    "recommended_activity", "justification", "method_used", "consulted_material",
    "time_spent_ms", "immediate_outcome", "post_assessment_event_id",
    "post_assessment_type", "post_assessment_lag_hours", "post_outcome"
  )
  
  missing_cols <- setdiff(required_cols, names(interventions_df))
  if (length(missing_cols) > 0) {
    add_issue("BLOCKING_ERROR", "MISSING_REQUIRED_COLUMNS", NA, NA,
              paste0("Colunas obrigatorias ausentes: ", paste(missing_cols, collapse = ", ")))
    # Retorno precoce se faltarem colunas estruturais
    issues_df <- do.call(rbind, issues_list)
    return(list(
      is_valid = FALSE,
      has_warnings = FALSE,
      summary = list(total_rows = n_rows, blocking_errors = nrow(issues_df), warnings = 0L),
      issues = issues_df
    ))
  }
  
  # 3. Unicidade de intervention_id
  id_vals <- as.character(interventions_df$intervention_id)
  dup_ids <- id_vals[duplicated(id_vals) & !is.na(id_vals) & trimws(id_vals) != ""]
  if (length(dup_ids) > 0) {
    uniq_dup <- unique(dup_ids)
    for (d in uniq_dup) {
      idx <- which(id_vals == d)
      add_issue("BLOCKING_ERROR", "DUPLICATE_INTERVENTION_ID", "intervention_id",
                paste(idx, collapse = ","), sprintf("Identificador de intervencao duplicado: '%s'", d))
    }
  }
  
  # 4. Validação de Datas ISO-8601
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
  
  parsed_dates <- parse_iso_dates(interventions_df$occurred_at)
  bad_date_idx <- which(is.na(parsed_dates))
  if (length(bad_date_idx) > 0) {
    for (idx in bad_date_idx) {
      add_issue("BLOCKING_ERROR", "INVALID_DATE_FORMAT", "occurred_at", idx,
                sprintf("Timestamp invalido ou fora do padrao ISO-8601: '%s'", interventions_df$occurred_at[idx]))
    }
  }
  
  # 5. Domínio de recommended_activity
  valid_activities <- c(
    "REVIEW_COMMENTED_SOLUTION", "SPACED_PRACTICE_DRILL", "THEORY_SUMMARY_READING",
    "CONTRASTIVE_ANALYSIS", "FLASHCARD_RECALL", "ACTIVE_PRACTICE"
  )
  act_vals <- as.character(interventions_df$recommended_activity)
  bad_act_idx <- which(!act_vals %in% valid_activities | is.na(act_vals))
  if (length(bad_act_idx) > 0) {
    for (idx in bad_act_idx) {
      add_issue("BLOCKING_ERROR", "INVALID_ACTIVITY_DOMAIN", "recommended_activity", idx,
                sprintf("Atividade de intervencao invalida: '%s'", act_vals[idx]))
    }
  }
  
  # 6. Domínio de method_used
  valid_methods <- c(
    "ACTIVE_RECALL", "ELABORATIVE_FEEDBACK", "SPACED_PRACTICE",
    "DESIRABLE_DIFFICULTY", "STANDARD_FEEDBACK", "CONTRASTIVE_ANALYSIS"
  )
  method_vals <- as.character(interventions_df$method_used)
  bad_method_idx <- which(!method_vals %in% valid_methods | is.na(method_vals))
  if (length(bad_method_idx) > 0) {
    for (idx in bad_method_idx) {
      add_issue("BLOCKING_ERROR", "INVALID_METHOD_DOMAIN", "method_used", idx,
                sprintf("Metodo de intervencao invalido: '%s'", method_vals[idx]))
    }
  }
  
  # 7. Domínio de immediate_outcome
  valid_immediate <- c("CORRECT", "INCORRECT", "COMPLETED", "ABANDONED", "NOT_APPLICABLE")
  imm_vals <- as.character(interventions_df$immediate_outcome)
  bad_imm_idx <- which(!imm_vals %in% valid_immediate | is.na(imm_vals))
  if (length(bad_imm_idx) > 0) {
    for (idx in bad_imm_idx) {
      add_issue("BLOCKING_ERROR", "INVALID_IMMEDIATE_OUTCOME", "immediate_outcome", idx,
                sprintf("Desfecho imediato invalido: '%s'", imm_vals[idx]))
    }
  }
  
  # 8. Domínio de post_assessment_type
  valid_post_types <- c("SAME_QUESTION", "SAME_TOPIC_NEW_QUESTION", "TRANSFER_ITEM", "NONE")
  pt_vals <- as.character(interventions_df$post_assessment_type)
  bad_pt_idx <- which(!pt_vals %in% valid_post_types | is.na(pt_vals))
  if (length(bad_pt_idx) > 0) {
    for (idx in bad_pt_idx) {
      add_issue("BLOCKING_ERROR", "INVALID_POST_ASSESSMENT_TYPE", "post_assessment_type", idx,
                sprintf("Tipo de avaliacao posterior invalido: '%s'", pt_vals[idx]))
    }
  }
  
  # 9. Domínio de post_outcome
  valid_post_outcomes <- c("CORRECT", "INCORRECT", "PENDING_EVALUATION", "SKIPPED")
  po_vals <- as.character(interventions_df$post_outcome)
  bad_po_idx <- which(!po_vals %in% valid_post_outcomes | is.na(po_vals))
  if (length(bad_po_idx) > 0) {
    for (idx in bad_po_idx) {
      add_issue("BLOCKING_ERROR", "INVALID_POST_OUTCOME", "post_outcome", idx,
                sprintf("Desfecho posterior invalido: '%s'", po_vals[idx]))
    }
  }
  
  # 10. Validação Numérica de time_spent_ms
  time_num <- suppressWarnings(as.numeric(interventions_df$time_spent_ms))
  neg_time_idx <- which(time_num < 0 | is.na(time_num))
  if (length(neg_time_idx) > 0) {
    for (idx in neg_time_idx) {
      add_issue("BLOCKING_ERROR", "NEGATIVE_OR_NA_TIME", "time_spent_ms", idx,
                sprintf("Tempo dedicado invalido ou negativo: '%s'", interventions_df$time_spent_ms[idx]))
    }
  }
  
  # Warning para tempos atipicamente curtos (< 5000 ms)
  short_time_idx <- which(time_num >= 0 & time_num < 5000)
  if (length(short_time_idx) > 0) {
    for (idx in short_time_idx) {
      add_issue("WARNING", "SUSPICIOUSLY_SHORT_TIME", "time_spent_ms", idx,
                sprintf("Tempo dedicado muito curto (%.1fs < 5s); possivel encerramento prematuro.", time_num[idx] / 1000))
    }
  }
  
  issues_df <- if (length(issues_list) > 0) do.call(rbind, issues_list) else data.frame(
    severity = character(0), rule_code = character(0), column_name = character(0),
    row_index = character(0), message = character(0), stringsAsFactors = FALSE
  )
  
  n_blocking <- sum(issues_df$severity == "BLOCKING_ERROR")
  n_warnings <- sum(issues_df$severity == "WARNING")
  
  list(
    is_valid = (n_blocking == 0),
    has_warnings = (n_warnings > 0),
    summary = list(
      total_rows = n_rows,
      blocking_errors = n_blocking,
      warnings = n_warnings
    ),
    issues = issues_df
  )
}
