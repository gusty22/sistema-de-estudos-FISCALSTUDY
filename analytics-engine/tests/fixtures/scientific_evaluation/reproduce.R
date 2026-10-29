#!/usr/bin/env Rscript
# SYNTHETIC software example only. Run from analytics-engine; outputs must be new.
source("lab/decision_scientific_evaluation.R")
source("tests/fixtures/scientific_evaluation/scenarios.R")
args<-commandArgs(trailingOnly=TRUE)
if(length(args)!=2L)stop("Usage: Rscript tests/fixtures/scientific_evaluation/reproduce.R NEW-input.json NEW-report.json")
if(file.exists(args[1])||file.exists(args[2]))stop("Refusing to overwrite evidence artifacts")
request<-scientific_fixture()
write_analytical_bundle(request,args[1])
# Evaluate the actual serialized transport, including analytical policy replay.
result<-evaluate_scientific_decisions(read_analytical_bundle(args[1])$payload)
write_analytical_bundle(result,args[2])
