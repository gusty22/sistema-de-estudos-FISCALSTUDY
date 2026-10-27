source("lab/prospective_evaluation.R")
fixture <- "../backend/target/prospective-fixture.json"
result <- evaluate_prospective(fixture)
stopifnot(result$source_kind=="SYNTHETIC_FIXTURE",result$forecast_count==3,
          result$scored_count==2,result$excluded_count==1,
          abs(result$metrics$brier-25/72)<1e-12,
          result$metrics$brier_skill_score<0,
          identical(result$can_apply,FALSE),identical(result$can_schedule,FALSE))
envelope <- jsonlite::fromJSON(fixture,simplifyVector=FALSE)
input <- jsonlite::fromJSON(envelope$inputJson,simplifyVector=FALSE)
expect_error <- function(code) {
  failed <- FALSE
  tryCatch(force(code),error=function(e)failed<<-TRUE)
  stopifnot(failed)
}
emit <- function(data,sha=TRUE) {
  out <- envelope
  out$inputJson <- jsonlite::toJSON(data,auto_unbox=TRUE,null="null",digits=16)
  if(sha)out$inputSha256 <- digest::digest(enc2utf8(out$inputJson),algo="sha256",serialize=FALSE)
  path <- tempfile(fileext=".json")
  writeLines(jsonlite::toJSON(out,auto_unbox=TRUE,null="null",digits=16),path)
  path
}
shuffled <- input;shuffled$events <- rev(input$events)
replay <- evaluate_prospective(emit(shuffled))
stopifnot(identical(result$metrics,replay$metrics))
duplicate <- input;duplicate$events <- c(input$events,input$events[1])
expect_error(evaluate_prospective(emit(duplicate)))
broken <- input
index <- which(vapply(broken$events,function(e)e$event_type=="PREDICTION_COMMITTED",logical(1)))[1]
node <- jsonlite::fromJSON(broken$events[[index]]$payload_json,simplifyVector=FALSE)
node$probability <- 0.99
broken$events[[index]]$payload_json <- jsonlite::toJSON(node,auto_unbox=TRUE,null="null")
expect_error(evaluate_prospective(emit(broken))) # Even a recomputed envelope cannot conceal wrong prefix math.
hash_bad <- envelope;hash_bad$inputSha256 <- paste(rep("0",64),collapse="")
hash_path <- tempfile();writeLines(jsonlite::toJSON(hash_bad,auto_unbox=TRUE,null="null"),hash_path)
expect_error(evaluate_prospective(hash_path))
bad_time <- input;bad_time$events[[1]]$occurred_at <- "2026-01-01 12:00:00"
expect_error(evaluate_prospective(emit(bad_time)))
future <- input
node <- jsonlite::fromJSON(future$events[[index]]$payload_json,simplifyVector=FALSE)
node$snapshotRowid <- input$snapshotRowid
future$events[[index]]$payload_json <- jsonlite::toJSON(node,auto_unbox=TRUE,null="null")
expect_error(evaluate_prospective(emit(future)))
wrong_id <- input
node <- jsonlite::fromJSON(wrong_id$events[[index]]$payload_json,simplifyVector=FALSE)
node$attemptId <- "not-a-uuid"
wrong_id$events[[index]]$payload_json <- jsonlite::toJSON(node,auto_unbox=TRUE,null="null")
expect_error(evaluate_prospective(emit(wrong_id)))
empty <- input;empty$events <- list();empty$snapshotRowid <- 0
e <- envelope;e$snapshotRowid <- 0;e$inputJson <- jsonlite::toJSON(empty,auto_unbox=TRUE,null="null")
e$inputSha256 <- digest::digest(enc2utf8(e$inputJson),algo="sha256",serialize=FALSE)
path <- tempfile();writeLines(jsonlite::toJSON(e,auto_unbox=TRUE,null="null"),path)
zero <- evaluate_prospective(path)
stopifnot(zero$scored_count==0,zero$metrics$status=="INSUFFICIENT_EVIDENCE",is.null(zero$coverage))
cat("Prospective R: 9 integrity/scoring scenarios passed; fixture-only, no personal validation.\n")
