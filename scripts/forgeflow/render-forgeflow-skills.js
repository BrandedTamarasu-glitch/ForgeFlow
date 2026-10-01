#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { writeFileSafe } = require('./file-safety');

const SKILLS = [
  { name: 'forgeflow-plan', command: '/plan', description: 'Build a phased implementation plan with validation and scope boundaries.' },
  { name: 'forgeflow-implement', command: '/implement', description: 'Implement from the current Forgeflow brief and carry validation through integration.' },
  { name: 'forgeflow-review', command: '/review', description: 'Run Forgeflow review with evidence-first findings and validation follow-up.' },
  { name: 'forgeflow-audit', command: '/audit', description: 'Run a deep Forgeflow audit for architecture, security, and maintainability risks.' },
  { name: 'forgeflow-ship', command: '/ship', description: 'Prepare release handoff, verification, and shipping evidence.' },
];

const FOCUSED_REVIEW_INSTRUCTIONS = [
  "## Focused questions and bounded follow-up",
  "",
  "For every non-skip packet-backed review, supply concrete questions before compilation with `--review-assignments \"$REVIEW_ASSIGNMENTS_INPUT\"`. The trusted local JSON input has `{schema_version:\"1\",assignments:[{assignment_id,reviewer,question,artifact_ids,expected_evidence}]}`. Use the unchanged canonical route roster, including required audit coverage, with exactly one falsifiable project question per required reviewer and nonempty expected-evidence descriptions. Authorized IDs name sealed source/diff/original-contract inputs, never peer reports, answer keys or advisory memory. Before construction use `source-<sha256(repository-relative normalized slash path)>` for source and `git-diff-full` for the diff; after seal inspect the actual `authorized_evidence_artifacts` inventory and confirm IDs/coverage. The returned `required_reviewers` and `review_assignments` must match the supplied contract. Questions focus attention while preserving independent discovery, security, accessibility and every ordinary domain duty. Do not invent generic role slogans or use question planning as another model wave. Missing helper, roster member or decisive evidence is a visible coverage gap; stop enforced dispatch and repair it. Skip has no dispatch, session or challenge. `--no-context-pack` is explicitly legacy unenforced behavior, unsupported for E3 immutable enforcement. A compiler call without assignments records `focused_questions: \"not_enabled\"` and cannot claim E3 enforcement.",
  "",
  "After successful compilation and current E2 inspection, the orchestrator prepares `REVIEW_SESSION_INPUT` outside the seal: `{schema_version:\"1\",evidence_ref:<exact returned ref>,required_reviewers:<unchanged canonical roster>,assignments:<same concrete assignments>,limits:{}}`. Missing limits use hard ceilings; values may only lower them, including zero. Persist the returned session reference in a unique trusted local file outside the seal, keep it across chunks/restarts/alias handoffs, and never choose a latest session:",
  "",
  "```bash",
  "REVIEW_SESSION_JSON=$(node \"$FORGEFLOW_HELPER_DIR/review-questions-cli.js\" start --root \"$PROJECT_ROOT\" --input \"$REVIEW_SESSION_INPUT\" --json) || exit 1",
  "REVIEW_SESSION_STATE_DIR=\"$PROJECT_ROOT/.forgeflow/$(basename \"$PROJECT_ROOT\")/review-session-inputs\"",
  "[ ! -L \"$REVIEW_SESSION_STATE_DIR\" ] || exit 1",
  "mkdir -p -m 700 \"$REVIEW_SESSION_STATE_DIR\" || exit 1",
  "REVIEW_SESSION_REF=$(mktemp \"$REVIEW_SESSION_STATE_DIR/session-ref.XXXXXX\") || exit 1",
  "printf '%s' \"$REVIEW_SESSION_JSON\" | node -e 'let s=\"\";process.stdin.on(\"data\",c=>s+=c);process.stdin.on(\"end\",()=>{const r=JSON.parse(s);if(!r.session_ref)process.exit(1);process.stdout.write(JSON.stringify(r.session_ref))})' > \"$REVIEW_SESSION_REF\" || exit 1",
  "node \"$FORGEFLOW_HELPER_DIR/review-questions-cli.js\" inspect --root \"$PROJECT_ROOT\" --session \"$REVIEW_SESSION_REF\" --json || exit 1",
  "```",
  "",
  "In command hosts use `FORGEFLOW_HELPER_DIR=\"$HELPER_DIR\"`; in skill hosts use the already resolved helper directory. Run from the project root. Input and session reference files are trusted orchestrator-owned files within the project's local `.forgeflow`, outside the seal; safe readers reject outside-root paths. Never let reviewer payloads select paths or overwrite references. The full review has at most **2 requests/reviewer, 4 requests/review, 64 KiB serialized response/request, 128 KiB/review and 2 independent challenges/review**, shared across all chunks, retries, denied attempts and resumed calls. Deep audit and mandatory accessibility coverage remain required; if the roster exceeds supported capacity, report unsupported coverage rather than dropping members. Freeze the union of required chunk reviewers before compilation, including any deep audit identity; never use the wave builder's thin override. Do not start a fresh session per chunk or silently refund/reset budgets. In incremental mode each changed source identity requires an explicitly new contract; never mix old judgments or reset a single review's allowance invisibly.",
  "",
  "### Request and resume",
  "",
  "Give each reviewer its concrete assignment and allowed artifact IDs. A reviewer needing decisive proof returns only `{schema_version:\"1\",request_id,assignment_id,reviewer,artifact_id,extent,why_decisive}`, where extent is `{mode:\"full\"}` or `{mode:\"lines\",start_line,end_line}`. No paths, refs, commands, tools, limits, counters or scope expansion. In enabled mode route all follow-up through the session, not direct mutable file reads or unaccounted E2 retrieval. The orchestrator saves the actual request as a trusted local input and resolves it:",
  "",
  "```bash",
  "node \"$FORGEFLOW_HELPER_DIR/review-questions-cli.js\" request --root \"$PROJECT_ROOT\" --session \"$REVIEW_SESSION_REF\" --input \"$REVIEW_REQUEST_INPUT\" --json",
  "```",
  "",
  "Resume only the relevant reviewer with the retained resolution and original assignment. Fulfilled delivery contains exact UTF-8 evidence or explicit line-context omissions; inspect status before using it. Denied, exhausted, unavailable, stale and interrupted requests leave decisive questions unresolved. Successful retrieval is execution state, not claim truth. Absent proof needs explicit new-run authorization and visibly reissued assignments; never automatic supplements or mixed evidence identities. Save complete actual resumed result and existing decision bytes outside the seal. The orchestrator records `{schema_version:\"1\",response_id,kind:\"reviewer\",subject_id:<assignment_id>,result_path,decision_path,artifact_ids}` with trusted project-relative result paths:",
  "",
  "```bash",
  "node \"$FORGEFLOW_HELPER_DIR/review-questions-cli.js\" response --root \"$PROJECT_ROOT\" --session \"$REVIEW_SESSION_REF\" --input \"$REVIEW_RESPONSE_INPUT\" --json || exit 1",
  "```",
  "",
  "Keep the existing public finding envelope, E1 claim sidecars and evaluator schemas. Retain complete actual responses, not a summary or inferred approval. Never turn request completion into a supported claim.",
  "",
  "### Independent challenge before peer exposure",
  "",
  "Before exposing any reviewer response to the challenger, and before existing claim-bearing high-risk verification, prepare a consequential neutral challenge from the original user contract and question. Input is exactly `{schema_version:\"1\",challenge_id,assignment_id,question,original_contract,artifact_ids,user_constraints}`; IDs must be a subset of authorized neutral inputs. Ask which alternatives fit the source and which distinguishing observation resolves them. Do not send the initial claim proposition/direction, peer identity, verdict, severity, repair, rationale, reviewer-derived facts, grader output or expected answer.",
  "",
  "```bash",
  "node \"$FORGEFLOW_HELPER_DIR/review-questions-cli.js\" challenge --root \"$PROJECT_ROOT\" --session \"$REVIEW_SESSION_REF\" --input \"$REVIEW_CHALLENGE_INPUT\" --json || exit 1",
  "```",
  "",
  "Inspect the exact prepared prompt/export inventory before dispatch. Use a fresh restricted case-only challenger with no full-history fork, sibling memory or peer reports. Record actual host/settings/isolation limits; prompt-only separation is labelled as such and is not OS isolation. Preparation consumes one of the two global challenge calls even if interrupted. Save complete actual challenge response and decision, then use the same `response` command with `kind:\"challenge\"` and `subject_id:<challenge_id>`. No universal extra reviewer wave. Challenge completion requires retained actual bytes; uncompleted reservations remain unresolved. Then retain the existing high-risk verifier gate with its claim-bearing inputs.",
  "",
  "### Current synthesis and unresolved coverage",
  "",
  "Before synthesis, prepare current proof from this same session:",
  "",
  "```bash",
  "node \"$FORGEFLOW_HELPER_DIR/review-questions-cli.js\" synthesis --root \"$PROJECT_ROOT\" --session \"$REVIEW_SESSION_REF\" --json || exit 1",
  "```",
  "",
  "Give synthesis and final acceptance the returned current retained references, unchanged roster coverage and unresolved statuses alongside original packets and ordinary reports. This command implements `prepareSynthesis`; it does not approve the review. Missing/exhausted evidence or missing required reviewer/challenge responses stay explicit unresolved questions, never supported findings or clean acceptance. Source/integrity failure stops current adjudication; historical intact bytes remain historical. Preserve normal full/deep/audit/accessibility duties, route skip behavior and final acceptance. Focused implementation tests support safety only; roadmap closure still requires observed real-PR behavior, independence and the frozen overhead gate.",
  "",
  "",
];

function usage() {
  console.error('Usage: render-forgeflow-skills.js [--root <repo>] [--write] [--json]');
}

function requireValue(argv, name, index) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), write: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      opts.root = path.resolve(requireValue(argv, arg, i));
      i += 1;
    } else if (arg === '--write') {
      opts.write = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function skillText(skill) {
  const codexInstruction = skill.name === 'forgeflow-review'
    ? 'In Codex, execute this skill directly; do not invoke `/review`, which is a Codex built-in. In Claude Code, run `/review`.'
    : `In Codex, execute this skill directly. In Claude Code, run \`${skill.command}\`.`;
  return [
    '---',
    `name: ${skill.name}`,
    `description: ${skill.description}`,
    '---',
    '',
    `# ${skill.name}`,
    '',
    'Use this skill when the host supports skill discovery but not Forgeflow slash-command browsing.',
    '',
    `${codexInstruction} If slash commands are unavailable, follow the same objective manually and preserve current user instructions, local evidence, validation, security, accessibility, and repository boundaries.`,
    '',
    'Do not commit, push, install dependencies, edit host settings, call the network, or launch long-running services unless the user explicitly asks or the command workflow requires it.',
    '',
    ...(skill.name === 'forgeflow-review' ? [
      ...FOCUSED_REVIEW_INSTRUCTIONS,
      '## Immutable review evidence',
      '',
      'Resolve helpers from the checkout scripts/forgeflow first, then the installed Forgeflow runtime for this host. In Codex, follow the maintained forgeflow-review skill when installed; otherwise use this same evidence sequence directly with native reviewer dispatch. Do not substitute a Codex built-in review.',
      '',
      'For route skip do not compile or dispatch. Otherwise supply concrete assignments before compiling: build-context-pack.js --root <project-root> --mode <already-selected-mode> --review-assignments <trusted-assignments-json> --json. Capture successful output. Pin its exact returned run_dir and evidence_ref.manifest_sha256 through dispatch and synthesis. Save returned evidence_ref as a unique local JSON reference file outside the seal; use that file with review-evidence-cli.js inspect --root <project-root> --ref <pinned-reference> --require-current. Build or inspection failure stops packet-backed review; never fall back to context/latest. Read agent-packets and synthesis-input.json from that same run. Reinspect before synthesis. Hash integrity, source freshness and claim truth are separate.',
      '',
      'Run check-context-budget.js --root <project-root> --file <run_dir>/context-telemetry.json --warn-only --json against selected telemetry. Keep lean advisory output, history, reviewer reports and decisions outside the sealed run. If using advise-context.js --record, supply --root <project-root> --file <run_dir>/context-telemetry.json and --history <project-local-path-outside-run>. Preserve native host authorization.',
      '',
      'In legacy unenforced mode only, for consequential proof consumption, use review-evidence-cli.js retrieve --root <project-root> --ref <pinned-reference> --artifact <manifest-artifact-id>; use --raw-required when full proof is required. Save actual result and decision bytes outside the sealed run, then opt in to record --root <project-root> --ref <pinned-reference> --id <unique-id> --kind review --result <actual-result-path> --decision <actual-decision-path> --artifacts <consumed-artifact-ids>. Use kind synthesis for synthesis and retain the returned separate sidecar in the local report/task evidence. Native identities stay unknown when unobserved. Do not invent decisions or treat successful inspection as claim truth. This does not require an E3 claim ledger for every observation.',
      '',
    ] : []),
    "## Local-only workflow boundary",
    '',
    "- Treat every `.forgeflow/` directory, its contents, and workflow agent identities as local working context only. Never stage, commit, push, attach, upload, or sync this state, including through memory-sync commands. Use Git's local `info/exclude` for generated state; never force-add it. Ignore rules do not protect already tracked files.",
    "- Never include local artifact paths, agent names, persona names, role labels, agent verdict attribution, or workflow signatures in PR titles, bodies, comments, commit messages, release notes, or published artifacts. Describe the change and observed validation in ordinary engineering language. Keep detailed review attribution and evidence links in local reports.",
    "- Never insert workflow agent identities or local evidence references into application source, comments, docstrings, tests, fixtures, identifiers, UI text, or shipped documentation. Use domain-based names and explain technical reasons without agent attribution.",
    "- Before staging or publishing, inspect the actual staged diff, outgoing commits, and public text. A local-state file or workflow attribution leak blocks the action until corrected. Do not silently delete local evidence or rewrite existing history; report already tracked or committed state for cleanup.",
    "- These rules govern project work produced with Forgeflow. Forgeflow's own maintained agent definitions, integration code, and documentation may name the agents and state paths needed to implement the tool; generated session state is always local. Ordinary domain terms that happen to match a role name are not workflow attribution.",
    "- Local CLI labels, orchestration messages, and local report schemas may retain identities. This boundary takes precedence over instructions to copy local reports into public output or sync session memory.",
    '',
  ].join('\n');
}

function skillFile(root, skill) {
  return path.join(root, 'skills', skill.name, 'SKILL.md');
}

function buildForgeflowSkills(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const skills = SKILLS.map((skill) => {
    const file = skillFile(root, skill);
    const expected = skillText(skill);
    const actual = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '';
    const current = actual.trim() === expected.trim();
    if (opts.write && !current) writeFileSafe(file, expected);
    return {
      name: skill.name,
      file,
      command: skill.command,
      status: opts.write || current ? 'pass' : (actual ? 'drift' : 'missing'),
    };
  });
  const failures = skills.filter((item) => item.status !== 'pass').length;
  return {
    schema_version: '1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    root,
    status: failures ? 'drift' : 'pass',
    skills,
    summary: { skills: skills.length, failures },
    next: failures ? '/forgeflow-skills --write' : '/forgeflow-health',
    boundary: 'Forgeflow skill generation is read-only unless --write is supplied. It writes only committed skills/forgeflow-*/SKILL.md files and does not install skills, edit host settings, commit, push, or call the network.',
  };
}

function renderMarkdown(result) {
  const lines = ['# Forgeflow Skills', '', `Status: ${result.status}`, '', result.boundary, '', '## Skills', ''];
  for (const skill of result.skills) lines.push(`- ${skill.status}: ${skill.name} (${skill.command})`);
  lines.push('', `Next: ${result.next}`, '');
  return lines.join('\n');
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const result = buildForgeflowSkills(opts);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result));
    if (result.status !== 'pass') process.exit(1);
  } catch (err) {
    console.error(`forgeflow skills failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  SKILLS,
  buildForgeflowSkills,
  parseArgs,
  renderMarkdown,
  skillText,
};
