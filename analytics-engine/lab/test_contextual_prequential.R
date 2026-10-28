# Software fixtures only. No synthetic result is evidence of human predictive validity.
source("lab/contextual_prequential.R")
d<-data.frame(event_id=paste0("fixture-",1:80),student_id=rep(c("a","b"),each=40),
 question_id=paste0("item-",rep(1:10,8)),event_order=rep(1:40,2),
 skill_key=rep(c("tax","accounts"),40),is_correct=as.integer(1:80%%3!=0))
a<-contextual_prequential(d)
stopifnot(nrow(a)==60*4,all(a$cutoff_order<a$event_order))
# Future mutation does not change earlier predictions, even contextual parameter updates.
changed<-d;changed$is_correct[changed$event_order>=30]<-1-changed$is_correct[changed$event_order>=30]
b<-contextual_prequential(changed)
stopifnot(identical(a$predicted_probability[a$event_order<30],b$predicted_probability[b$event_order<30]))
stopifnot(identical(a,contextual_prequential(d[80:1,])))
# Ineligible events do not affect chronology, exposure counts or fitted parameters.
extra<-d[1,,drop=FALSE];extra$event_id<-"ineligible";extra$event_order<-0;extra$is_correct<-NA
d$eligible<-TRUE;extra$eligible<-FALSE
stopifnot(identical(a,contextual_prequential(rbind(d,extra))))
# Event-local labels: mutate FUTURE classification, not historical rows.
changed<-d;changed$skill_key[changed$event_order>=30]<-"later-reclassification"
b<-contextual_prequential(changed)
stopifnot(identical(a$predicted_probability[a$event_order<30],b$predicted_probability[b$event_order<30]))
stopifnot(inherits(try(contextual_prequential(rbind(d,d[1,])),silent=TRUE),"try-error"))
bad<-d;bad$event_id[2]<-"new";bad$event_order[2]<-1
stopifnot(inherits(try(contextual_prequential(bad),silent=TRUE),"try-error"))
bad<-d;bad$is_correct[2]<-2
stopifnot(inherits(try(contextual_prequential(bad),silent=TRUE),"try-error"))
stopifnot(nrow(contextual_prequential(d[FALSE,]))==0,
 nrow(contextual_prequential(d[FALSE,setdiff(names(d),"eligible")]))==0,
 nrow(contextual_prequential(d[1:3,]))==0)
short<-d[1:12,];p<-contextual_prequential(short)
stopifnot(all(is.finite(p$predicted_probability)),all(p$predicted_probability>0 & p$predicted_probability<1))
# No model receives context unknown to others; prefix beta independently reproducible.
for(i in 11:40) {
 r<-a[a$student_id=="a" & a$event_order==i & a$model_name=="PERSONAL_BETA11_PREFIX_V1",]
 stopifnot(abs(r$predicted_probability-(sum(d$is_correct[1:(i-1)])+1)/(i+1))<1e-14)
}
# Class-degenerate AUC is unavailable; endpoint logs remain finite.
s<-contextual_scores(data.frame(observed_correct=c(1,1),predicted_probability=c(0,1),question_id=c("x","x"),student_id=c("a","a")))
stopifnot(is.null(s$roc_auc),is.finite(s$log_loss),s$unique_items==1)
set.seed(19);before<-.Random.seed
r<-contextual_report(a,replicates=100L)
stopifnot(identical(before,.Random.seed),!r$can_apply,!r$can_schedule)
stopifnot(identical(r,contextual_report(a,replicates=100L)))
one<-contextual_report(a[a$student_id=="a",],replicates=100L)
stopifnot(all(vapply(one$comparisons,function(x)is.null(x$student_cluster_bootstrap_95),logical(1))))
# Complete matched evaluation is mandatory; corrupt labels cannot silently pair.
bad<-a;ix<-which(bad$model_name=="CONTEXT_ONLINE_RIDGE_V1")[1];bad$event_id[ix]<-"different"
stopifnot(inherits(try(contextual_report(bad),silent=TRUE),"try-error")==FALSE) # development row not scored
ix<-which(bad$model_name=="CONTEXT_ONLINE_RIDGE_V1" & bad$evaluation_partition=="FINAL_TEMPORAL")[1]
bad$event_id[ix]<-"different-final"
stopifnot(inherits(try(contextual_report(bad),silent=TRUE),"try-error"))
cat("Contextual prequential metamorphic and numerical gates passed. Scientific validity NOT_ESTABLISHED.\n")
