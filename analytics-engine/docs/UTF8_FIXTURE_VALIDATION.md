# Portable Windows fixtures: UTF-8 and canonical source hashes

Issue: [#77](https://github.com/gusty22/sistema-de-estudos-FISCALSTUDY/issues/77).

## Confirmed defect and scope

The historical locale-C checks use `write.csv(fileEncoding="UTF-8")` to
prepare their Unicode inputs. On Windows R 4.5.1 with `LC_CTYPE=C`, this
translates marked Unicode into literal strings such as `<U+00E9>` before
the reader or pipeline runs. An independent byte/codepoint probe reproduced
that transformation. The production reader preserves the corrupted fixture
bytes, so the four original equality assertions correctly fail.

`tests/helpers/utf8_fixture.R` prepares the two fixture CSVs through a binary
connection and a local UTF-8 byte copy, matching the approach already used by
`export_metrics_package`. The source data frames and process locale remain
unchanged. All original reader, BOM, checksum and end-to-end profile assertions
remain in place. No production algorithm, FSRS rule, data provenance gate,
SQLite contract or experimental authority changes.

## Validation checkpoint, 30 October 2026

- Baseline at `789f905`: the four UTF-8 equality assertions fail under Windows
  locale C. A minimal independent probe confirms the corruption occurs during
  fixture creation, not during analytical computation.
- The corrected fixture passes an exact Unicode round trip under `LC_CTYPE=C`.
- `tests/test_pipeline_evidence.R` passes in an isolated assertion harness,
  including both original Unicode label checks and all provenance/authority
  checks. The deliberately missing manifest is rejected as expected.
- `git diff --check` passes.
- Full R suite and Python laboratory reruns are pending at this checkpoint.
  Existing installed R dependencies must be inherited by child processes via
  `R_LIBS_USER`; no dependency was installed. Optional FSRS/pyBKT tests remain
  explicitly skipped when their packages are absent.

This validates software transport only, not learning outcomes or model efficacy.

## Final canonical hash fixture and validation

The full rerun exposed one additional fixture portability defect: core_shadow/request.R called digest(file=TRUE) directly while production already uses compute_file_sha256 to read the same bytes safely. All 12 source hashes from the canonical helper matched independent readBin byte hashes. The fixture now reuses that helper and explicitly rejects missing or malformed SHA-256 values; original provenance and authority assertions remain intact. No production file changed.

Final complete R suite with installed dependencies inherited by subprocesses: `Rscript tests/test_runner.R`, 1112 checks passed, zero failures, 194.043 seconds. The preceding UTF-8-only checkpoint had 1080 passes and one remaining hash-fixture failure. Standalone attempts without inherited jsonlite failed and are not counted as successful.

Python laboratory configured run: 63 tests, 5 failures, 20 optional skips. Four failures reproduce Set-Acl/SeSecurityPrivilege restrictions, including an elevated isolated rerun (9 tests, 4 failures). The fifth reproduces native R exit 3221225477 (0xC0000005), without output, in the frozen-calibration future-label test (module rerun: 12 tests, 1 failure, 1 optional skip). Root cause of that native crash remains unknown. These limitations are tracked separately in Issue #80; no assertions or security checks were disabled. Optional FSRS/pyBKT packages were not installed.

This PR is ready for manual review of the fixture changes, with local Python validation explicitly blocked by Issue #80. Full R validation passes; it does not establish scientific efficacy. CI must be checked again on the updated HEAD.
