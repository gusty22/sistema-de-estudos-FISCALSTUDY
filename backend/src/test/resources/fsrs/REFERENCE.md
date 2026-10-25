# FSRS reference core

Reference: local MIT-licensed ts-fsrs packages/fsrs. Algorithm source SHA256: ee18dc4a35aaec50f3fa8813a48f1a318cf0730912c2f4c85c463c0093c33052
Package version: 5.4.2

Executed independent reference through TypeScript transpileModule (existing project TypeScript), CommonJS output in target/fsrs-reference, no added dependency. FSRSAlgorithm.next_state returned:

```json
{"initial":{"difficulty":2.11810397,"stability":2.3065},"next":{"difficulty":4.99022837,"stability":32.02672948},"fail":{"difficulty":8.34176237,"stability":1.39198697},"same":{"difficulty":4.99022837,"stability":10}}
```

Default 21 coefficients; short-term enabled, fuzz disabled. Full scheduler learning/relearning steps not implemented or claimed. The Java application maps eligible correct/incorrect retrieval to Good/Again; this mapping is a product policy, not FSRS evidence of concept mastery.
