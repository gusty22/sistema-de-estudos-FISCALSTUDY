-- SQLite trigger bodies contain semicolons; ScriptUtils uses the explicit double separator.
CREATE TRIGGER IF NOT EXISTS diagnostic_reservation_no_update
 BEFORE UPDATE ON diagnostic_reservation_events BEGIN
 SELECT RAISE(ABORT,'Diagnostic reservation history is append-only'); END;;
CREATE TRIGGER IF NOT EXISTS diagnostic_reservation_no_delete
 BEFORE DELETE ON diagnostic_reservation_events BEGIN
 SELECT RAISE(ABORT,'Diagnostic reservation history is append-only'); END;;
CREATE TRIGGER IF NOT EXISTS diagnostic_reservation_chain
 BEFORE INSERT ON diagnostic_reservation_events BEGIN
 SELECT CASE WHEN NEW.previous_event_id IS NULL AND (
   NEW.state!='RESERVED' OR EXISTS(SELECT 1 FROM diagnostic_reservation_events
    WHERE reservation_id=NEW.reservation_id) OR EXISTS (
    SELECT 1 FROM diagnostic_blocked_questions WHERE id=NEW.question_id))
 THEN RAISE(ABORT,'Invalid or duplicate reservation root') END;
 SELECT CASE WHEN NEW.previous_event_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM diagnostic_reservation_events p WHERE p.event_id=NEW.previous_event_id
    AND p.reservation_id=NEW.reservation_id AND p.question_id=NEW.question_id
    AND p.protocol_id=NEW.protocol_id AND p.purpose=NEW.purpose
    AND p.classification_snapshot_json=NEW.classification_snapshot_json
    AND p.state IN ('RESERVED','COMPROMISED')
    AND NEW.state IN ('COMPROMISED','RELEASED')
    AND julianday(NEW.occurred_at)>=julianday(p.occurred_at))
 THEN RAISE(ABORT,'Invalid reservation transition') END;
 SELECT CASE WHEN julianday(NEW.occurred_at) IS NULL
 THEN RAISE(ABORT,'Invalid reservation time') END;
 SELECT CASE WHEN NEW.previous_event_id IS NULL AND NOT EXISTS (
   SELECT 1 FROM questions WHERE id=NEW.question_id)
 THEN RAISE(ABORT,'Missing reservation question') END;
 SELECT CASE WHEN NEW.previous_event_id IS NULL AND EXISTS (
   SELECT 1 FROM event_store e JOIN questions q ON q.id=e.aggregate_id
   JOIN questions held ON held.id=NEW.question_id
   WHERE q.id=held.id OR (length(trim(COALESCE(held.enunciado,'')))>0
    AND q.enunciado IS held.enunciado AND q.options_json IS held.options_json))
 THEN RAISE(ABORT,'Recorded item exposure prevents clean reservation') END;
 END;;
CREATE TRIGGER IF NOT EXISTS diagnostic_block_events
 BEFORE INSERT ON event_store
 WHEN NEW.event_type IN ('QUESTION_PRESENTED','ANSWER_SUBMITTED','PREDICTION_COMMITTED')
 AND EXISTS(SELECT 1 FROM diagnostic_blocked_questions b WHERE b.id=NEW.aggregate_id)
 BEGIN SELECT RAISE(ABORT,'Question is quarantined; operational event refused'); END;;
CREATE TRIGGER IF NOT EXISTS diagnostic_freeze_question
 BEFORE UPDATE ON questions
 WHEN EXISTS(SELECT 1 FROM diagnostic_blocked_questions WHERE id=OLD.id)
 BEGIN SELECT RAISE(ABORT,'Explicit quarantine transition required before item maintenance'); END;;
CREATE TRIGGER IF NOT EXISTS diagnostic_keep_question
 BEFORE DELETE ON questions
 WHEN EXISTS(SELECT 1 FROM diagnostic_blocked_questions WHERE id=OLD.id)
 BEGIN SELECT RAISE(ABORT,'Quarantined item must remain recoverable'); END;;
CREATE TRIGGER IF NOT EXISTS diagnostic_freeze_classification
 BEFORE INSERT ON question_topic_classifications
 WHEN EXISTS(SELECT 1 FROM diagnostic_blocked_questions WHERE id=NEW.question_id)
 BEGIN SELECT RAISE(ABORT,'Quarantine classification snapshot is frozen'); END;;
CREATE TRIGGER IF NOT EXISTS diagnostic_freeze_classification_update
 BEFORE UPDATE ON question_topic_classifications
 WHEN EXISTS(SELECT 1 FROM diagnostic_blocked_questions WHERE id=OLD.question_id OR id=NEW.question_id)
 BEGIN SELECT RAISE(ABORT,'Quarantine classification snapshot is frozen'); END;;
CREATE TRIGGER IF NOT EXISTS diagnostic_freeze_classification_delete
 BEFORE DELETE ON question_topic_classifications
 WHEN EXISTS(SELECT 1 FROM diagnostic_blocked_questions WHERE id=OLD.question_id)
 BEGIN SELECT RAISE(ABORT,'Quarantine classification snapshot is frozen'); END;;
