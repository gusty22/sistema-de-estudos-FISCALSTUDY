# Resolve an explicitly configured library first; sandbox LOCALAPPDATA may differ.
configured_lib <- Sys.getenv("FISCALSTUDY_R_LIBS", "")
r_ver_short <- paste(R.version$major, strsplit(R.version$minor, "\\.")[[1]][1], sep=".")
user_lib <- file.path(Sys.getenv("USERPROFILE"), "AppData", "Local", "R", "win-library", r_ver_short)
local_app_data_lib <- file.path(Sys.getenv("LOCALAPPDATA"), "R", "win-library", r_ver_short)
for (lib in c(configured_lib, user_lib, local_app_data_lib)) if (nzchar(lib) && dir.exists(lib)) .libPaths(c(lib, .libPaths()))
has_sha256 <- requireNamespace("digest", quietly = TRUE) || (requireNamespace("tools", quietly = TRUE) && exists("sha256sum", envir = asNamespace("tools")))
if (!requireNamespace("jsonlite", quietly = TRUE)) stop("Required package unavailable: jsonlite. Configure FISCALSTUDY_R_LIBS; no outputs were published.")
if (!has_sha256) stop("No cryptographic SHA-256 provider available (neither digest nor tools::sha256sum). Configure FISCALSTUDY_R_LIBS; no outputs were published.")

# tests/test_runner.R
# Executor Autônomo de Testes em Base R
# Projeto: FiscalStudy Analytics (R >= 4.0.0)

test_env <- new.env(parent = emptyenv())
test_env$passed_count <- 0L
test_env$failed_count <- 0L
test_env$failures <- list()

assert_true <- function(expr, description = "") {
  val <- tryCatch(expr, error = function(e) structure(FALSE, err = e$message))
  if (isTRUE(val)) {
    test_env$passed_count <- test_env$passed_count + 1L
    cat(sprintf("  [PASS] %s\n", description))
  } else {
    test_env$failed_count <- test_env$failed_count + 1L
    err_msg <- if (!is.null(attr(val, "err"))) attr(val, "err") else "Esperado TRUE, obtido FALSE ou NA"
    cat(sprintf("  [FAIL] %s -> %s\n", description, err_msg))
    test_env$failures[[length(test_env$failures) + 1]] <- sprintf("%s -> %s", description, err_msg)
  }
}

assert_false <- function(expr, description = "") {
  val <- tryCatch(expr, error = function(e) structure(TRUE, err = e$message))
  if (identical(val, FALSE)) {
    test_env$passed_count <- test_env$passed_count + 1L
    cat(sprintf("  [PASS] %s\n", description))
  } else {
    test_env$failed_count <- test_env$failed_count + 1L
    err_msg <- if (!is.null(attr(val, "err"))) attr(val, "err") else "Esperado FALSE, obtido TRUE ou NA"
    cat(sprintf("  [FAIL] %s -> %s\n", description, err_msg))
    test_env$failures[[length(test_env$failures) + 1]] <- sprintf("%s -> %s", description, err_msg)
  }
}

assert_equal <- function(actual, expected, description = "", tolerance = 1e-4) {
  match <- FALSE
  if (is.null(actual) && is.null(expected)) {
    match <- TRUE
  } else if (is.numeric(actual) && is.numeric(expected)) {
    if (length(actual) == length(expected)) {
      match <- all(abs(actual - expected) <= tolerance, na.rm = TRUE) &&
               all(is.na(actual) == is.na(expected))
    }
  } else {
    match <- identical(actual, expected)
  }
  
  if (match) {
    test_env$passed_count <- test_env$passed_count + 1L
    cat(sprintf("  [PASS] %s\n", description))
  } else {
    test_env$failed_count <- test_env$failed_count + 1L
    cat(sprintf("  [FAIL] %s (Esperado: '%s' | Obtido: '%s')\n",
                description, paste(expected, collapse = ", "), paste(actual, collapse = ", ")))
    test_env$failures[[length(test_env$failures) + 1]] <- sprintf(
      "%s (Esperado: '%s' | Obtido: '%s')", description, paste(expected, collapse = ", "), paste(actual, collapse = ", ")
    )
  }
}

run_all_tests <- function() {
  cat("=========================================================\n")
  cat("FISCALSTUDY ANALYTICS — SUITE DE TESTES AUTOMATIZADOS (R)\n")
  cat("=========================================================\n\n")
  
  # Carregar modulos centrais
  source("R/validation.R")
  source("R/descriptive_analysis.R")
  source("R/retention_analysis.R")
  source("R/visualization.R")
  source("R/export_results.R")
  source("R/learning_profile.R")
  source("R/analytical_signals.R")
  source("R/intervention_analysis.R")
  source("R/recommendation_evaluation.R")
  source("R/adapter.R")
  source("R/baselines.R")
  source("R/provenance.R")
  
  test_files <- c(
    "tests/test_validation.R",
    "tests/test_descriptive.R",
    "tests/test_retention.R",
    "tests/test_visualization.R",
    "tests/test_export.R",
    "tests/test_learning_profile.R",
    "tests/test_analytical_signals.R",
    "tests/test_interventions.R",
    "tests/test_adapter.R",
    "tests/test_baselines_and_rigor.R",
    "tests/test_provenance.R"
  )
  
  start_time <- Sys.time()
  
  for (tf in test_files) {
    if (file.exists(tf)) {
      cat(sprintf("\n--- Executando modulo: %s ---\n", tf))
      tryCatch({
        source(tf, local = TRUE)
      }, error = function(e) {
        test_env$failed_count <- test_env$failed_count + 1L
        cat(sprintf("  [ERROR DE EXECUCAO NO ARQUIVO %s]: %s\n", tf, e$message))
      })
    }
  }
  
  elapsed <- round(as.numeric(difftime(Sys.time(), start_time, units = "secs")), 3)
  
  cat("\n=========================================================\n")
  cat("RESULTADO FINAL DOS TESTES\n")
  cat(sprintf("Passaram:  %d\n", test_env$passed_count))
  cat(sprintf("Falharam:  %d\n", test_env$failed_count))
  cat(sprintf("Tempo:     %.3f segundos\n", elapsed))
  cat("=========================================================\n")
  
  if (test_env$failed_count > 0) {
    cat("\nFALHAS REGISTRADAS:\n")
    for (f in test_env$failures) {
      cat(sprintf("  - %s\n", f))
    }
    quit(status = 1)
  } else {
    cat("\nTODOS OS TESTES FORAM APROVADOS COM SUCESSO! (100% PASS)\n")
    quit(status = 0)
  }
}

if (!interactive()) {
  run_all_tests()
}
