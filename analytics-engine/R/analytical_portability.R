# Portable, inert analytical contracts. Imported text is never evaluated.
# SHA integrity does not authenticate authorship or validate learning.
portable_scalar_text <- function(x) is.character(x) && length(x) == 1L && !is.na(x) && nzchar(trimws(x))
portable_utc <- function(x) {
  if (!portable_scalar_text(x) || !grepl('^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?Z$', x)) return(FALSE)
  !is.na(suppressWarnings(as.POSIXct(x, format='%Y-%m-%dT%H:%M:%OSZ', tz='UTC')))
}
portable_finite <- function(x) {
  if (is.numeric(x)) return(all(is.finite(x) | is.na(x)) && !any(is.nan(x)))
  if (is.list(x)) return(all(vapply(x, portable_finite, logical(1))))
  TRUE
}

validate_external_assessment <- function(x, cutoff) {
  codes <- character()
  if (!is.list(x)) return(list(is_valid=FALSE, blocking_codes='INVALID_ASSESSMENT'))
  required <- c('assessment_id','source_id','model_id','model_version','occurred_at',
                'question','response','scoring_criteria','assistance','verifiability','epistemic_type')
  for (key in required) if (!portable_scalar_text(x[[key]])) codes <- c(codes,paste0('MISSING_',toupper(key)))
  if (!identical(x$schema_version,'external-assessment-v1')) codes <- c(codes,'UNKNOWN_SCHEMA_VERSION')
  if (!identical(x$epistemic_type,'EXTERNAL_ASSESSMENT')) codes <- c(codes,'INVALID_EPISTEMIC_TYPE')
  if (!portable_utc(cutoff) || !portable_utc(x$occurred_at)) codes <- c(codes,'INVALID_TIMESTAMP')
  else if (as.POSIXct(x$occurred_at,format='%Y-%m-%dT%H:%M:%OSZ',tz='UTC') > as.POSIXct(cutoff,format='%Y-%m-%dT%H:%M:%OSZ',tz='UTC')) codes <- c(codes,'FUTURE_ASSESSMENT')
  if (!isTRUE(x$assistance %in% c('NONE_REPORTED','HINTS','ANSWER_EXPOSED','UNKNOWN'))) codes <- c(codes,'UNKNOWN_ASSISTANCE')
  if (!isTRUE(x$verifiability %in% c('UNVERIFIED','SOURCE_TRACEABLE','INDEPENDENTLY_VERIFIED'))) codes <- c(codes,'UNKNOWN_VERIFIABILITY')
  if (!portable_finite(x)) codes <- c(codes,'INVALID_NUMERIC_OUTPUT')
  # An imported envelope cannot grant itself operational authority.
  for (key in c('can_apply','can_schedule','eligible_for_fsrs','eligible_for_mastery')) {
    if (!identical(x[[key]],FALSE)) codes <- c(codes,paste0('FORBIDDEN_',toupper(key)))
  }
  list(is_valid=length(codes)==0L, blocking_codes=sort(unique(codes)),
       can_apply=FALSE, can_schedule=FALSE, eligible_for_fsrs=FALSE, eligible_for_mastery=FALSE)
}

import_external_assessments <- function(records, cutoff) {
  if (!is.list(records)) stop('External assessments must be a list')
  ids <- vapply(records,function(x) if (is.list(x) && portable_scalar_text(x$assessment_id)) x$assessment_id else '',character(1))
  duplicated_ids <- unique(ids[duplicated(ids)])
  audit <- lapply(seq_along(records),function(i) {
    v <- validate_external_assessment(records[[i]],cutoff)
    if (ids[i] %in% duplicated_ids) {
      v$is_valid <- FALSE; v$blocking_codes <- sort(unique(c(v$blocking_codes,'DUPLICATE_ASSESSMENT_ID')))
    }
    list(assessment_id=ids[i], validation=v, record=records[[i]])
  })
  list(schema_version='external-assessment-import-v1', cutoff=cutoff, records=audit,
       status='CONTEXT_ONLY', can_apply=FALSE, can_schedule=FALSE,
       limitations=c('Imported assessments are not canonical student outcomes',
                    'Verifiability is a declaration; independent custody must be checked separately'))
}

write_analytical_bundle <- function(payload, path) {
  if (!is.list(payload) || !portable_finite(payload)) stop('Invalid analytical payload')
  if (file.exists(path)) stop('Refusing to overwrite analytical artifact')
  envelope <- list(schema_version='analytical-bundle-v1',payload=payload,
                   can_apply=FALSE,can_schedule=FALSE)
  text <- jsonlite::toJSON(envelope, auto_unbox=TRUE, null='null', na='null', digits=16, dataframe='rows')
  # Exclusive create prevents accidental replacement during replay.
  con <- file(path,open='wx'); on.exit(close(con),add=TRUE)
  writeLines(enc2utf8(text),con,useBytes=TRUE)
  invisible(envelope)
}

read_analytical_bundle <- function(path, max_bytes=32*1024^2) {
  size <- file.info(path)$size
  if (length(size)!=1L || is.na(size) || size<1 || size>max_bytes) stop('Invalid bundle size')
  x <- jsonlite::fromJSON(path,simplifyVector=FALSE)
  if (!identical(x$schema_version,'analytical-bundle-v1') || !is.list(x$payload) ||
      !identical(x$can_apply,FALSE) || !identical(x$can_schedule,FALSE) || !portable_finite(x)) stop('Invalid analytical bundle')
  x
}

# Link a later observed outcome without rewriting the original proposal or claiming
# causal benefit. The external event store remains the owner of append-only history.
evaluate_learning_proposal <- function(proposal_record, outcome, cutoff) {
  if (!is.list(proposal_record) || !is.list(outcome) ||
      !portable_scalar_text(proposal_record$run_id) || !portable_scalar_text(proposal_record$candidate_id) ||
      !identical(proposal_record$authorization,'NOT_AUTHORIZED')) stop('Invalid proposal evaluation record')
  required <- c('event_id','run_id','candidate_id','occurred_at','origin','epistemic_type')
  if (!all(vapply(required,function(k) portable_scalar_text(outcome[[k]]),logical(1)))) stop('Incomplete outcome identity')
  if (!identical(outcome$run_id,proposal_record$run_id) || !identical(outcome$candidate_id,proposal_record$candidate_id)) stop('Outcome association mismatch')
  times <- c(proposal_record$proposed_at,outcome$occurred_at,cutoff)
  if (length(times)!=3L || !all(vapply(times,portable_utc,logical(1)))) stop('Invalid evaluation chronology')
  instants <- as.POSIXct(times,format='%Y-%m-%dT%H:%M:%OSZ',tz='UTC')
  if (instants[2] <= instants[1] || instants[2] > instants[3]) stop('Outcome must be later than proposal and available at cutoff')
  if (!identical(outcome$epistemic_type,'OBSERVATION') || !outcome$origin %in% c('REAL_STUDY','SYNTHETIC_FIXTURE')) stop('Ineligible observed outcome')
  if (!is.logical(outcome$is_correct) || length(outcome$is_correct)!=1L || is.na(outcome$is_correct)) stop('Invalid observed result')
  list(schema_version='learning-decision-evaluation-v1',run_id=proposal_record$run_id,
    candidate_id=proposal_record$candidate_id,outcome_event_id=outcome$event_id,
    observed_at=outcome$occurred_at,origin=outcome$origin,is_correct=outcome$is_correct,
    association='DESCRIPTIVE_FOLLOWUP_ONLY',causal_effect='NOT_ESTABLISHED',
    personal_source_status='REQUIRES_SEPARATE_PROVENANCE_AUDIT',can_apply=FALSE,can_schedule=FALSE)
}
