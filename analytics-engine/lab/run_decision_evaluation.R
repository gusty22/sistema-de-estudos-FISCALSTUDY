#!/usr/bin/env Rscript
# Run from analytics-engine. Inert analytical bundles only; never imports source authority.
source("lab/decision_scientific_evaluation.R")
args<-commandArgs(trailingOnly=TRUE)
if(length(args)!=2L)stop("Usage: Rscript lab/run_decision_evaluation.R input-bundle.json NEW-output.json")
input<-read_analytical_bundle(args[1])$payload
result<-evaluate_scientific_decisions(input)
write_analytical_bundle(result,args[2])
