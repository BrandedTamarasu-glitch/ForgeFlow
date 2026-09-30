# Automated completion comparison

The [frozen protocol](protocol.json) records the new twelve-workflow schedule. See [runner behavior and validation](../../docs/completion-runner.md) and [results](../../docs/completion-auto-results.md). The original pilot remains separate. Raw schedules, prompts, sources and traces stay local.

A [post-observation control diagnostic](control-diagnostic.mjs) adds one malformed-ID case to a temporary copy of the primary oracle. It leaves the frozen oracle and primary scoring unchanged. Run it against a disposable source copy:

```sh
node fixtures/completion-auto/control-diagnostic.mjs /path/to/disposable/source
```

The authored corrected control passes the original 21 checks but fails the added case: a native Pi ID containing the recorded path wrongly sends a prompt. Restricting direct equality to path/non-Pi identities fixes that case but breaks legitimate legacy UUID bindings. A diagnostic correction that also preserves valid UUID equality passes all 22. These checks were added after observing a control-trial report; they are not preregistered scores, additional model trials, or evidence of live native exploitability. Control edits cannot be scored as false positives merely because this fixture was intended to be clean.

A later baseline control report identified canonical native path aliases as another omitted case. Add `--include-path-alias` to run a separate 23-check diagnostic. The original authored control passes 21/23: it also rejects a symlink resolving to the same session file. The default 22-check diagnostic remains available; neither diagnostic replaces the frozen 21-check score. The malformed-ID finding occurred in both arms, so its first appearance in the recovery-guided arm does not establish an incremental benefit.
