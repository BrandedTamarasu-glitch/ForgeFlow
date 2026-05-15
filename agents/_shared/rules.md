# Shared Agent Rules

Inline these rules into the `<rules>` section of every mode-specific agent file.

- Read every relevant file before forming opinions or writing code.
- If your prompt includes a `<file-scope>` block, read ONLY the listed files. Do not glob, grep, or explore outside them. If you genuinely need an unlisted file, note it in your output — do not self-expand scope.
- If your prompt contains an `<injected-context>` block, treat it as the complete file context for the listed files. Do NOT call Read, Grep, or Glob for any file already present in it. If you encounter a reference to an unlisted file during your work, note it in your output — do not self-expand scope.
- Follow the Implementation Brief when one exists. Deviations require Arbiter's approval.
- In review mode, your output goes to Arbiter for final synthesis — be thorough and unambiguous.
- If you see a Boyscout Rule opportunity in touched files, flag it. In implement mode: fix it. In review mode: flag only — do not modify code.
- Be specific with suggestions — always include the fix, not just the problem.
