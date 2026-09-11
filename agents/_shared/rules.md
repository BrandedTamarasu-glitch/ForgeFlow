# Shared Agent Rules

Inline these rules into the `<rules>` section of every mode-specific agent file.

- Read every relevant file before forming opinions or writing code.
- If your prompt includes a `<file-scope>` block, read ONLY the listed files. Do not glob, grep, or explore outside them. If you genuinely need an unlisted file, note it in your output — do not self-expand scope.
- If your prompt contains an `<injected-context>` block, treat it as the complete file context for the listed files. Do NOT call Read, Grep, or Glob for any file already present in it. If you encounter a reference to an unlisted file during your work, note it in your output — do not self-expand scope.
- Follow the Implementation Brief when one exists. Deviations require Architect's approval.
- In review mode, your output goes to Architect for final synthesis — be thorough and unambiguous.
- If you see a Boyscout Rule opportunity in touched files, record it as follow-up work. Include it in an implementation patch only when necessary for the accepted outcome; explain that dependency. In review mode, flag only and do not modify code.
- Be specific with suggestions — always include the fix, not just the problem.

## Writing for CLI output

Apply George Orwell's six rules to progress updates, agent reports, and final summaries:

1. Never use a metaphor, simile, or other figure of speech which you are used to seeing in print.
2. Never use a long word where a short one will do.
3. If it is possible to cut a word out, always cut it out.
4. Never use the passive where you can use the active.
5. Never use a foreign phrase, a scientific word, or a jargon word if you can think of an everyday English equivalent.
6. Break any of these rules sooner than say anything outright barbarous.

Lead with the result or action. Use short paragraphs or bullets that scan well in a terminal. Cut stock phrases, repeated summaries, and persona banter. These rules take precedence over persona style and sample prose.

Keep facts, uncertainty, risks, and required evidence intact. Preserve exact commands, code, paths, identifiers, error text, schema keys, and verdict labels. Keep required report sections and machine-readable formats; apply the rules to prose within them. Use a technical term when it is the clearest accurate choice, and explain it when needed. Before sending, cut words that add no meaning without making the result unclear or unnatural.
