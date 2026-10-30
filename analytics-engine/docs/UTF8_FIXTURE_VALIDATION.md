# UTF-8 fixtures under Windows locale C

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
