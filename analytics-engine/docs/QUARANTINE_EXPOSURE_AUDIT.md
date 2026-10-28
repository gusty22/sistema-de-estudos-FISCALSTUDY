# Diagnostic quarantine exposure audit v1 — 27/10/2026
Base main7a562217d9bec73bccd322ea4382bae2d561d0de, merged PR36.
Audit used remote tracked tree and all176 backend production Java files, plus ingestion/scripts Python consumers. No working checkout/Graphify graph exists in this session.
This is a known-path inventory, not a proof that arbitrary future code, manual SQLite tools, external documents or memory caches cannot leak content.

## Central boundary and its limits
Physical questions table stays writable for legitimate ingestion, backup and maintenance.
Operational reads use study_questions, a shared SQLite view that excludes active RESERVED and COMPROMISED items and exact statement+option copies, independent of answer key.
No fingerprint containing correct_option is exposed by the public family endpoint. Internal exact-family implementation is preserved for compatibility; no semantic-equivalence claim.
The architecture test fails on new literal raw FROM/JOIN questions in production Java (including common quoted/qualified forms). It is a regression gate, not a runtime SQLite authorizer or a proof against dynamic SQL/hostile code.
The standard schema creates the views for existing fixture compatibility; SchemaMigration additionally installs transactional triggers with an explicit delimiter and records migration5.
Anki cards with direct item source_id use study_anki_flashcards. Notebook IDs/known questionIds filters use QuestionAccessPolicy. Stored rows are preserved.
No runtime renaming, shadow table, arbitrary SQL rewriting, destructive cleanup, new database or model equation.

## SQL consumers changed
| File | Methods around observed queries | Policy / evidence |
| --- | --- | --- |
| `application/AnkiIntegrationService.java` | `public List<AnkiFlashcardDTO> generateSessionBatch15` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |
| `application/AnswerSwitchTrackerService.java` | `public Map<String, Object> getAnswerSwitchAnalytics` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |
| `application/IngestionPipelineService.java` | `public ImportSimulationDTO simulateImport` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |
| `application/MediaRoutingService.java` | `public String evaluateFamiliarity`, `public int getConsecutiveErrors` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |
| `application/PerformanceIntelligenceService.java` | `public Map<String, Object> getPerformanceDashboard`, `public Map<String, Object> getContentAnalysis`, `public Map<String, Object> getCalibrationAndStudentModel` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |
| `application/QuestionBankService.java` | `public Map<String, Object> searchQuestions`, `public Map<String, Object> getFiltersMetadata` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |
| `application/QuestionClassificationService.java` | `public List<Map<String,Object>> questions`, `public Map<String,Object> coverage`, `public Map<String,Object> family`, `private void requireQuestion` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |
| `application/QuestionHistoryService.java` | `public QuestionHistoryDTO.Response getQuestionHistory`, `public PerformanceXRayDTO getPerformanceXRay` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |
| `application/ReverseEngineeringService.java` | `private List<Map<String, Object>> selectQuestionsForReverseStudy` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |
| `application/RevisionCalendarService.java` | `public Map<String, Object> getRevisionExecutionContext` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |
| `application/StagingDatabaseService.java` | `public Map<String, Object> getQualityOverview` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |
| `application/StrategicSimuladoService.java` | `private Map<String, PerformanceAcc> getPerformancePorTopico`, `private List<String> queryQuestionIds` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |
| `application/StrategicSummaryService.java` | `private Map<String, Object> resolveExamContext`, `public Map<String, Object> generateSummary` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |
| `application/StudentKnowledgeStateService.java` | `public List<TopicKnowledgeState> computeKnowledgeStates` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |
| `application/SystemSettingsService.java` | `public Map<String, Object> getTechnicalAuditReport`, `public Map<String, List<Map<String, Object>>> globalSearch` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |
| `application/cognitive/UnifiedCognitiveArchitectureService.java` | `private QuestionMeta fetchQuestionMeta` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |
| `application/knowledge/TopicKnowledgeAggregatorService.java` | `private Map<String, QuestionMetadata> loadQuestionMetadata`, `private Map<String, MemoryState> loadMemoryStates` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |
| `infrastructure/in/web/IngestionController.java` | `public ResponseEntity<Void> importData` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |
| `infrastructure/out/persistence/ConcursoRepositoryImpl.java` | `public long countAvailableQuestions` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |
| `infrastructure/out/persistence/QuestionRepositoryImpl.java` | `public List<Question> findQuestionBatch`, `public Optional<Question> findById`, `public List<String> findAllDisciplines`, `public List<String> findAllAssuntos` | Raw SQL migrated to shared view; architecture gate. Component-specific validation as below. |

## Endpoint and indirect exposure matrix
| Path / component | Exposure risk | Verification / remaining gate |
| --- | --- | --- |
| QuestionController next,batch → QuestionSelectionService → QuestionRepositoryImpl; /api/v1/questions/next and /batch | Statement/options/support payload | Integration direct findById,next,batch; full Spring/Chromium checks batch |
| ProspectivePredictionController POST /questions/{id}/predictions | Guess ID and obtain forecast/item context | Repository view; full Spring browser asserts quarantined404 with no new forecast |
| QuestionController POST /{id}/presented and /attempts | Cached presentation or answer after quarantine | event_store BEFORE INSERT guard; integration all3 event types refused, no FSRS evidence |
| QuestionBankController /api/v1/bank/questions and filters-metadata | Search/metadata exposure | Shared view; bank integration and actual browser HTTP |
| QuestionBankController notebooks GET/POST → QuestionBankService | Previously saved item IDs in JSON | Filter known IDs and nested questionIds; reject reserved save; integration |
| StrategicSimuladoService.generateStrategicSimulado → SimuladoController | Alternative random selection, notebook persistence | Shared view; integration validates generated questionIds |
| RevisionCalendarService recovery context | Statement/commentary/support copied into intervention context | Source query view + architecture gate; full per-endpoint scenario NOT_EXECUTED |
| Maestro / UnifiedCognitiveArchitecture / StudentKnowledgeState | Indirect recommendations/metadata | Question lookups shared view; topic-only signals not item exposure proof; dedicated planner scenarios NOT_EXECUTED |
| QuestionClassificationController questions, history, family, classify | Raw statement or key-dependent fingerprint; later classification | Shared view, public hash redacted; DB classification insert/update/delete blocked while quarantined |
| AnalyticsProjectionService /analytics/export/questions-v1 | Repository metadata export and event payloads | findById view; no reserved outcomes can be inserted by operational events; pre-existing exports/caches remain a gate |
| QuestionHistory/PerformanceIntelligence/TopicKnowledgeAggregator/AnswerSwitchTracker | Metadata and answer-key joins | Shared view + static gate; no claim existing copied payloads erased |
| ReverseEngineering/StrategicSummary/MediaRouting | Statement/commentary in summaries | Shared query view; old persisted content cannot be proven scrubbed |
| AnkiIntegration generate/session-batch/export/recent/pending sync | Outbound card content with source item | Shared question/card views; isolated export integration without network. Missing-source copies remain a gate |
| IngestionController/StagingDatabaseService/Python ingestion | Staging question, answer key, image/PDF or same item occurrence | Authorized maintenance preserved; staging/source reads NOT fully quarantined; blocks enabling creation |
| SystemSettingsService backup/restore and administrative tooling | Whole physical DB or material source | Legitimate existing admin protection retained; raw maintenance is NOT an experimental read path |
| Frontend local journal, cached batch, saved summaries/materials | Content fetched before reservation, including another browser | No retroactive clean-novelty claim; all-cache invalidation NOT implemented; blocks enabling creation |
| External source PDF or manually opened SQLite; Python migration/publish_verified | Bypasses operational Java view | Trusted maintenance/out-of-process access, not quarantined. Must document exposure/compromise; blocks clean reservation claim |

## Persistent semantics
diagnostic-quarantine-v1 history: stable reservation_id, event_id, item ID, previous-event chain, protocol, purpose, timestamp, classification snapshot JSON, reason, state.
EXTERNAL_EXPOSURE_UNKNOWN is mandatory: no local history proves cognitive novelty.
RESERVED → COMPROMISED still blocks; only explicit recorded RELEASED returns an item to operational reads. No public create/release endpoint exists.
A root with recorded exposure of the same/exact copied item is refused. Repeated/forked roots, missing item, invalid/backward times, altered classification snapshots and append-history updates/deletes fail.
Classification relationships remain existing canonical taxonomy. No AI batch classification, manually reviewed semantic reference set or semantic-variant model was invented.
No release-to-experiment bypass, delayed evaluation queue, holdout outcome export or training authorization is implemented yet.

## Activation gate / rollback
GET /api/v1/learning-lab/diagnostic-quarantine/status explicitly returns reservationCreationEnabled=false and both authority flagsfalse.
This increment is IMPLEMENTED policy foundation, not a production-ready diagnostic reservation workflow. No UI button or configurable override can enable creation.
Before activation: source/staging/media copies, frontend/cache exposure, all export/admin scopes, historical snapshots and semantic variants require reviewed policies and empirical leakage tests. Fail any gate → remain disabled.
Migration5 is additive/transactional. Existing-data startup makes a verified recovery snapshot before migration; tests use disposable databases. Rollback code to earlier version is safe ONLY if no real reservations were created: earlier code ignores quarantine. If real histories exist, do not roll back to unguarded code; restore a verified pre-migration copy only with explicit data-recovery review. No originals are edited/deleted by this task.

## Validation
New DiagnosticQuarantineIntegrationTest and DiagnosticQuarantineArchitectureTest; existing DatabaseFoundationTest now checks5versions instead of obsolete3.
Workflow prospective-ledger executes those plus existing Java/SQLite/R/frontend/full Spring Chromium gates. Isolated browser seed contains3study items plus1held SYNTHETIC fixture; reservation creation is still disabled.
Executed results are recorded in the draft PR/checks for the exact HEAD; do not treat this text as passing evidence before execution.
No personal, delayed-retention, semantic-novelty or causal validation performed. FSRS and scientific scorecard PR36 unchanged; can_apply=false,can_schedule=false.


Browser failure at71c75bc/run40615904546: quarantine denied access but GlobalExceptionHandler caught ResponseStatusException as generic500. Fixed by preserving its declared HTTP status with generic non-content response/no-store; real-advice SQLite MVC regression added for prediction and presentation404. Original browser404 assertion retained. This historical failure is not a passing check of the fixed HEAD.


## Source exposure boundary v1 — follow-up after merged PR37
Base maine53180367fba49f0a6d10a24feb55906383929f4. Previous PR37 code/checks preserved.
Local checkout FiscalStudy on feature/learner-evidence-r contains unrelated modified/untracked work and was not changed; current implementation uses remote branch feature/quarantine-source-exposure. Graphify executable/graph unavailable in this Linux workspace.

### Origin → transformation → destination → consumer matrix
| Origin | Transformation / existing identifiers | Destination / consumer | Risk | Applied control / test |
| --- | --- | --- | --- | --- |
| Original PDF | staging_files.sha256,rel_path,file ID → staging_documents page_start/page_end,document ID | StagingDatabaseService.getPdfPathForStagingFile/renderPageImageForFile/renderEvidenceForQuestion; IngestionController | Same source contains held item, different source IDs | HTTP source guard plus service preflight before file/process access; SQLite test + actual browser PDF/page-denial test |
| Extracted question | staging_questions document_id,numero_original,pages_json; publish_verified preserves occurrence but versions/copies not fully proven | Staging SQLite → operational questions | Different IDs, modified statement/options, unknown variant | Conservative whole-source denial while any hold exists; not a claimed semantic matching algorithm; actual staging-copy read gated |
| Temporary ingestion uploads/results | sessionId, documentId, filename, output question IDs | IngestionPipelineService sessionQuestions/getSession/evidence/PDF paths | In-memory and persisted copies bypass operational view | Service preflight outside catch/fallback and source-route guard; isolated service test; no deletion of uploads |
| Operational item | Existing canonical question ID; exact-content family remains internal | study_questions; bank/repository/classification | Known exact duplicates | PR37 view/guards retained; full regression; no new taxonomy or public answer-key fingerprint |
| Source/material | study_materials ID/url_ou_caminho, topic links; no universal item-level lineage | StudyMaterialController metadata/file/stream | Notes/PDF may contain held question or answer | Source-route preflight and no-store; actual PDF bytes remain unchanged; source provenance explicitly unresolved |
| Source text | Automatic/user copy, possibly no item source_id | Anki generation/CSV/recent/background sync | Unmapped card bypasses known-ID view | Direct service preflight + source routes; outbound addNote/sync guarded before content/network. Privacy-off behavior retained |
| Material/notes | Existing metadata search | SystemSettingsController /system/search | Search may reproduce notes/paths | Source-route preflight; browser denial test |
| Prior exports | CSV/event payload files, manifests | analytics/export HTTP routes; already saved external files | Content copied outside canonical reads | New HTTP reads guarded/no-store; external saved bytes cannot be revoked and remain UNKNOWN |
| Known item IDs | Notebook/simulado JSON, direct IDs | PR37 policy | Stale saved IDs | Existing filters/regressions preserved; no claim all nested arbitrary copies are identified |
| Browser caches | Previous question journal/batch or previously fetched material | QuestionViewer/localStorage/browser cache | Pre-existing bytes can display without a request | New source responses no-store only; historical cache invalidation is NOT implemented; activation still blocked |
| Summaries / external materials | Existing copied/generated content without verified lineage | Summary/material/other indirect readers | May carry same or related question under unknown ID | Not universally controlled by this increment; source-route registry is finite and needs continued audit |
| Administrator or external application | Manual SQLite/PDF access | Outside HTTP / backend boundaries | No app-wide guarantee possible | Explicitly EXTERNAL_EXPOSURE_UNKNOWN; no claim to control external files |

### Contract and authority
diagnostic-source-exposure-v1 is an administrative exposure receipt, not a new learning event or student prediction target.
Receipt fields: canonical exposure UUID, bound method/path/query, LOCAL_ADMIN_EXPLICIT_MAINTENANCE, server UTC instant, original reservation IDs, UNMAPPED_SOURCE_COMPROMISE_ALL_ACTIVE, version.
Migration6 adds one append-only table and guards; existing reservation history is unchanged in place. Verified backup required before existing-data migration; transaction rollback retains prior state.
Without active holds: existing source reads continue, with no-store on covered routes. With active holds: covered content reads fail409, even when a token alone is provided.
Metadata-only Anki status/preferences and ingestion file listing/quality remain available through their existing access controls.
To deliberately review sources: loopback+local Host+configured admin token AND X-FiscalStudy-Maintenance-Intent:ACKNOWLEDGE_EXPOSURE AND canonical X-FiscalStudy-Exposure-Id.
Before any covered body is released, one transaction records the receipt and appends COMPROMISED for every active hold because the source→item association is unknown. No reservation is RELEASED and operational item views remain blocked.
Same receipt+resource+covered reservation set is idempotent; another resource or new reservation invalidates reuse. Failed audit writes return503 and release no bytes.
Intentional administrative access invalidates clean assessment eligibility conservatively even if later I/O fails; receipt records authorized source access, not proof the student read/understood it.
Thread-local maintenance scope is cleared in finally, does not propagate to background threads and is an internal trusted-code mechanism, not a sandbox for hostile Java.
No automatic AnkiWeb or external synchronization is executed in tests.

### Scope / remaining gates
Creation remains disabled. No semantic-equivalence model, manually reviewed real fiscal item set, item-source crosswalk, complete cache invalidation, evaluation release route, delayed-assessment queue, multi-target R evaluation or personal pilot execution was claimed implemented.
This coarse barrier intentionally cannot selectively certify unrelated source content as safe. Source lineage must be improved before narrowing access.
Future activation requires serialized reservation/read leases: this increment does not prove atomic protection against a new real reservation racing an already authorized stream. There is no reservation creation API here.
Administrative source access cannot be confused with an eligible no-help assessment. Old files, outside-app viewing and manually copied summaries remain unverifiable.
Rollback: preserve receipts/COMPROMISED history; never replace this version with unguarded code while real holds exist. No originals are modified/deleted; no personal database used.
Executed counts and matching HEAD belong in the PR/checks; synthetic fixtures are software evidence only.
