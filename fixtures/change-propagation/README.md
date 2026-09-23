# Change propagation examples

Run `node scripts/forgeflow/test-change-propagation.js` from the checkout root. The test creates and removes a disposable repository; no services, models or generators are invoked.

`corpus.json` contains newly authored synthetic source definitions and old/current consumer variants. `answer-key.json` holds expected detections and round-trip values separately. Both are under the repository MIT license. The test freezes source identities in an impact manifest and checks favicon, guide and screenshot references plus schema import/export/backup consumers. It also executes the synthetic codecs to verify current round trips, preserve a supported old-format import and expose a mixed-version reader and broken backup. An old writer/reader pair can agree while still violating the new wire format.

These are deterministic helper checks, not evidence that a model discovers all consumers or benefits from the procedure. Screenshot pixels, actual generators and served artifacts remain untested. The corpus includes answers in its variant labels and must not be sent whole to a future model pilot: freeze a selected workspace and objective separately and withhold variant labels, checks and answer keys. F1.3 owns that controlled comparison.
